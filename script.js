import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInAnonymously, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const firebaseConfig = { 
    apiKey: "AIzaSyATEgv8QAqp8Nqnw3m8pjVBedZf7govrmc", 
    authDomain: "smuchat.firebaseapp.com",
    projectId: "smuchat",
    storageBucket: "smuchat.firebasestorage.app",
    messagingSenderId: "851151186986",
    appId: "1:851151186986:web:a8192113d1aa7c2b062753" 
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let isSignUpMode = false, currentUserData = null, activeChatId = null, targetFriendId = null;

// --- ১. কিবোর্ড এন্টার সাপোর্ট ---
const setupEnterKey = (inputId, btnId) => {
    document.getElementById(inputId).addEventListener('keydown', (e) => {
        if(e.key === 'Enter') document.getElementById(btnId).click();
    });
};
setupEnterKey('auth-email', 'main-auth-btn');
setupEnterKey('auth-pass', 'main-auth-btn');
setupEnterKey('msg-input', 'send-btn');

// --- ২. সাইডবার নেভিগেশন ---
document.getElementById('menu-toggle').onclick = () => document.body.classList.add('sidebar-open');
document.getElementById('close-sidebar').onclick = () => document.body.classList.remove('sidebar-open');

// --- ৩. অথেন্টিকেশন স্টেট ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        await setupUser(user);
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('chat-app').style.display = 'flex';
        loadFriends();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('chat-app').style.display = 'none';
    }
});

// লগইন/সাইন-আপ লজিক
document.getElementById('tab-signup').onclick = () => { 
    isSignUpMode = true; 
    document.getElementById('tab-bg').style.left = 'calc(50% - 4px)';
    document.querySelector('#main-auth-btn').innerText = "Create Account";
};
document.getElementById('tab-login').onclick = () => { 
    isSignUpMode = false; 
    document.getElementById('tab-bg').style.left = '4px';
    document.querySelector('#main-auth-btn').innerText = "Continue";
};

document.getElementById('main-auth-btn').onclick = async () => {
    const e = document.getElementById('auth-email').value.trim();
    const p = document.getElementById('auth-pass').value.trim();
    if(!e || !p) return;
    try { isSignUpMode ? await createUserWithEmailAndPassword(auth, e, p) : await signInWithEmailAndPassword(auth, e, p); } 
    catch (err) { alert(err.message); }
};

// --- ৪. প্রোফাইল ও ডাকনাম (Nickname) লজিক ---
document.getElementById('my-profile-trigger').onclick = () => {
    document.getElementById('edit-name').value = currentUserData.name;
    document.getElementById('edit-photo').value = currentUserData.photo;
    document.getElementById('profile-modal').style.display = 'flex';
};

document.getElementById('save-profile').onclick = async () => {
    const name = document.getElementById('edit-name').value;
    const photo = document.getElementById('edit-photo').value;
    await setDoc(doc(db, "users", currentUserData.id), { name, photo }, { merge: true });
    location.reload(); 
};

window.openNickModal = (e, fId, currentNick) => {
    e.stopPropagation();
    targetFriendId = fId;
    document.getElementById('new-nickname').value = currentNick;
    document.getElementById('nickname-modal').style.display = 'flex';
};

document.getElementById('save-nickname').onclick = async () => {
    const nick = document.getElementById('new-nickname').value;
    await setDoc(doc(db, "users", currentUserData.id, "friends", targetFriendId), { nickname: nick }, { merge: true });
    document.getElementById('nickname-modal').style.display = 'none';
};

// --- ৫. ফ্রেন্ডস ও চ্যাট ---
async function setupUser(user) {
    const metaRef = doc(db, "users_meta", user.uid);
    const mDoc = await getDoc(metaRef);
    let cId = mDoc.exists() ? mDoc.data().id : (user.displayName || "user").split(' ')[0].toLowerCase() + Math.floor(1000 + Math.random()*9000);
    if(!mDoc.exists()) await setDoc(metaRef, {id: cId});
    
    const uRef = doc(db, "users", cId);
    const uDoc = await getDoc(uRef);
    currentUserData = uDoc.exists() ? uDoc.data() : { id: cId, name: user.displayName || "Guest", photo: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=random` };
    
    document.getElementById('display-name').innerText = currentUserData.name;
    document.getElementById('my-unique-id').innerText = "#" + cId;
    document.getElementById('my-avatar').src = currentUserData.photo;
    await setDoc(uRef, currentUserData, {merge: true});
}

function loadFriends() {
    onSnapshot(collection(db, "users", currentUserData.id, "friends"), (snap) => {
        const list = document.getElementById('friend-list'); list.innerHTML = "";
        snap.forEach(d => {
            const f = d.data();
            const display = f.nickname || f.name;
            const div = document.createElement('div');
            div.className = "friend-item";
            div.innerHTML = `<img src="${f.photo}"><div><b>${display}</b><br><small>#${f.id}</small></div><span class="edit-nick-icon" onclick="openNickModal(event,'${f.id}','${f.nickname||''}')">✏️</span>`;
            div.onclick = () => startChat(f.id, display);
            list.appendChild(div);
        });
    });
}

function startChat(id, name) {
    activeChatId = [currentUserData.id, id].sort().join('_');
    document.getElementById('header-name').innerText = name;
    document.getElementById('msg-input').disabled = false;
    document.body.classList.remove('sidebar-open');

    onSnapshot(query(collection(db, "chats", activeChatId, "messages"), orderBy("timestamp", "asc")), (snap) => {
        const area = document.getElementById('message-area'); area.innerHTML = "";
        snap.forEach(d => {
            const m = d.data();
            area.innerHTML += `<div class="msg ${m.sender === currentUserData.id ? 'sent' : 'received'}">${m.text}</div>`;
        });
        area.scrollTop = area.scrollHeight;
    });
}

const msgInp = document.getElementById('msg-input'), sendBtn = document.getElementById('send-btn');
msgInp.oninput = () => sendBtn.disabled = !msgInp.value.trim();
sendBtn.onclick = async () => {
    const text = msgInp.value;
    msgInp.value = "";
    await addDoc(collection(db, "chats", activeChatId, "messages"), {text, sender: currentUserData.id, timestamp: serverTimestamp()});
};

window.closeModal = (id) => document.getElementById(id).style.display = 'none';
document.getElementById('logout-btn').onclick = () => signOut(auth);
document.getElementById('google-login-btn').onclick = () => signInWithPopup(auth, provider);