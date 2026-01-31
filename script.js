import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInAnonymously, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const firebaseConfig = { 
    apiKey: "AIzaSyATEgv8QAqp8Nqnw3m8pjVBedZf7govrmc", // আপনার আসল কী বসান
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

let isSignUpMode = false, currentUserData = null, activeChatId = null;

// --- মোবাইল নেভিগেশন ---
const body = document.body;
document.getElementById('menu-toggle').onclick = () => body.classList.add('sidebar-open');
document.getElementById('close-sidebar').onclick = () => body.classList.remove('sidebar-open');

// --- ট্যাব সুইচ ---
document.getElementById('tab-signup').onclick = () => { 
    isSignUpMode = true; 
    document.getElementById('tab-bg').style.left = 'calc(50% - 4px)';
    document.getElementById('tab-signup').classList.add('active');
    document.getElementById('tab-login').classList.remove('active');
};
document.getElementById('tab-login').onclick = () => { 
    isSignUpMode = false; 
    document.getElementById('tab-bg').style.left = '4px';
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-signup').classList.remove('active');
};

// --- অথেন্টিকেশন স্টেট ---
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

document.getElementById('main-auth-btn').onclick = async () => {
    const e = document.getElementById('auth-email').value.trim();
    const p = document.getElementById('auth-pass').value.trim();
    try { isSignUpMode ? await createUserWithEmailAndPassword(auth, e, p) : await signInWithEmailAndPassword(auth, e, p); } 
    catch (err) { alert(err.message); }
};

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

// চ্যাট এবং ফ্রেন্ডস লজিক
document.getElementById('add-friend-btn').onclick = async () => {
    const fId = document.getElementById('friend-id-input').value.trim();
    const fDoc = await getDoc(doc(db, "users", fId));
    if(fDoc.exists()) {
        await setDoc(doc(db, "users", currentUserData.id, "friends", fId), {id: fId, name: fDoc.data().name, photo: fDoc.data().photo});
        await setDoc(doc(db, "users", fId, "friends", currentUserData.id), {id: currentUserData.id, name: currentUserData.name, photo: currentUserData.photo});
        alert("Friend Added!");
    }
};

function loadFriends() {
    onSnapshot(collection(db, "users", currentUserData.id, "friends"), (snap) => {
        const list = document.getElementById('friend-list'); list.innerHTML = "";
        snap.forEach(d => {
            const f = d.data();
            const div = document.createElement('div');
            div.style = "padding:12px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer; display:flex; align-items:center; gap:10px;";
            div.innerHTML = `<img src="${f.photo}" style="width:35px; border-radius:50%"> <span>${f.name}</span>`;
            div.onclick = () => startChat(f.id, f.name);
            list.appendChild(div);
        });
    });
}

function startChat(id, name) {
    activeChatId = [currentUserData.id, id].sort().join('_');
    document.getElementById('header-name').innerText = name;
    document.getElementById('msg-input').disabled = false;
    body.classList.remove('sidebar-open');

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
    await addDoc(collection(db, "chats", activeChatId, "messages"), {text: msgInp.value, sender: currentUserData.id, timestamp: serverTimestamp()});
    msgInp.value = ""; sendBtn.disabled = true;
};
document.getElementById('logout-btn').onclick = () => signOut(auth);