import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInAnonymously, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyATEgv8QAqp8Nqnw3m8pjVBedZf7govrmc", authDomain: "smuchat.firebaseapp.com", projectId: "smuchat", storageBucket: "smuchat.firebasestorage.app", messagingSenderId: "851151186986", appId: "1:851151186986:web:a8192113d1aa7c2b062753" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let isSignUpMode = false, currentUserData = null, activeChatId = null, targetFriend = null;

// অথেন্টিকেশন ট্র্যাকার
onAuthStateChanged(auth, async (user) => {
    if (user) {
        await setupUser(user);
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('chat-app').style.display = 'flex';
        loadFriendList();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('chat-app').style.display = 'none';
    }
});

// লগইন/সাইন-আপ সুইচ
document.getElementById('tab-signup').onclick = () => { isSignUpMode = true; document.getElementById('tab-bg').style.left = '50%'; document.getElementById('main-auth-btn').innerText = "Create Account"; };
document.getElementById('tab-login').onclick = () => { isSignUpMode = false; document.getElementById('tab-bg').style.left = '5px'; document.getElementById('main-auth-btn').innerText = "Login"; };

document.getElementById('main-auth-btn').onclick = async () => {
    const e = document.getElementById('auth-email').value.trim(), p = document.getElementById('auth-pass').value.trim();
    try { isSignUpMode ? await createUserWithEmailAndPassword(auth, e, p) : await signInWithEmailAndPassword(auth, e, p); } catch (err) { alert(err.message); }
};

document.getElementById('google-login-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('guest-quick-btn').onclick = async () => { const n = prompt("Display Name:"); if(n) await setupUser({...(await signInAnonymously(auth)).user, displayName: n}); };
document.getElementById('logout-btn').onclick = () => signOut(auth);

// প্রোফাইল সেটআপ
async function setupUser(user) {
    const mRef = doc(db, "users_meta", user.uid);
    const mDoc = await getDoc(mRef);
    let cId = mDoc.exists() ? mDoc.data().id : (user.displayName || "user").split(' ')[0].toLowerCase() + Math.floor(1000 + Math.random()*9000);
    if(!mDoc.exists()) await setDoc(mRef, {id: cId});
    
    const uRef = doc(db, "users", cId);
    const uDoc = await getDoc(uRef);
    currentUserData = uDoc.exists() ? uDoc.data() : { id: cId, uid: user.uid, name: user.displayName || "Guest", photo: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=random` };
    
    document.getElementById('display-name').innerText = currentUserData.name;
    document.getElementById('my-unique-id').innerText = "#" + cId;
    document.getElementById('my-avatar').src = currentUserData.photo;
    await setDoc(uRef, currentUserData, {merge: true});
}

// ফ্রেন্ড লিস্ট ও চ্যাট
document.getElementById('add-friend-btn').onclick = async () => {
    const fId = document.getElementById('friend-id-input').value.trim();
    const fDoc = await getDoc(doc(db, "users", fId));
    if(fDoc.exists()) {
        await setDoc(doc(db, "users", currentUserData.id, "friends", fId), {id: fId, name: fDoc.data().name, photo: fDoc.data().photo, addedAt: serverTimestamp()});
        await setDoc(doc(db, "users", fId, "friends", currentUserData.id), {id: currentUserData.id, name: currentUserData.name, photo: currentUserData.photo, addedAt: serverTimestamp()});
        document.getElementById('friend-id-input').value = "";
    }
};

function loadFriendList() {
    onSnapshot(query(collection(db, "users", currentUserData.id, "friends"), orderBy("addedAt", "desc")), (snap) => {
        const list = document.getElementById('friend-list'); list.innerHTML = "";
        snap.forEach(d => {
            const f = d.data(), display = f.nickname || f.name;
            const div = document.createElement('div'); div.className = 'friend-item';
            div.innerHTML = `<img src="${f.photo}"><div><b>${display}</b><small>#${f.id}</small></div><button class="edit-nick-btn" onclick="window.openNick(event,'${f.id}')">✏️</button>`;
            div.onclick = () => startChat(f.id, display);
            list.appendChild(div);
        });
    });
}

window.openNick = (e, id) => { e.stopPropagation(); targetFriend = id; document.getElementById('nickname-modal').style.display = 'flex'; };
document.getElementById('save-nickname').onclick = async () => {
    await setDoc(doc(db, "users", currentUserData.id, "friends", targetFriend), {nickname: document.getElementById('new-nickname').value}, {merge: true});
    document.getElementById('nickname-modal').style.display = 'none';
};

function startChat(id, name) {
    activeChatId = [currentUserData.id, id].sort().join('_');
    document.getElementById('header-name').innerText = name;
    document.getElementById('msg-input').disabled = false;
    document.body.classList.add('chat-active'); // মোবাইল ভিউ টগল

    onSnapshot(query(collection(db, "chats", activeChatId, "messages"), orderBy("timestamp", "asc")), (snap) => {
        const area = document.getElementById('message-area'); area.innerHTML = "";
        snap.forEach(d => { const m = d.data(); area.innerHTML += `<div class="msg ${m.sender === currentUserData.id ? 'sent' : 'received'}">${m.text}</div>`; });
        area.scrollTop = area.scrollHeight;
    });
}

document.getElementById('mobile-back').onclick = () => document.body.classList.remove('chat-active');

const msgInp = document.getElementById('msg-input'), sendBtn = document.getElementById('send-btn');
msgInp.oninput = () => sendBtn.disabled = !msgInp.value.trim();
sendBtn.onclick = async () => {
    await addDoc(collection(db, "chats", activeChatId, "messages"), {text: msgInp.value, sender: currentUserData.id, timestamp: serverTimestamp()});
    msgInp.value = ""; sendBtn.disabled = true;
};