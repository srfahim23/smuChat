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

let isSignUpMode = false;
let currentUserData = null;
let activeChatId = null;

// --- AUTHENTICATION ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('chat-app').style.display = 'flex';
        await setupUser(user);
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('chat-app').style.display = 'none';
    }
});

// Toggle Login/Signup
document.getElementById('tab-signup').onclick = () => { isSignUpMode = true; document.getElementById('main-auth-btn').innerText = "Sign Up"; toggleTabs('tab-signup'); };
document.getElementById('tab-login').onclick = () => { isSignUpMode = false; document.getElementById('main-auth-btn').innerText = "Login"; toggleTabs('tab-login'); };

function toggleTabs(id) {
    document.querySelectorAll('.auth-tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// Email/Pass Auth
document.getElementById('main-auth-btn').onclick = async () => {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    try {
        if (isSignUpMode) await createUserWithEmailAndPassword(auth, email, pass);
        else await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) { alert(e.message); }
};

// Google & Guest Auth
document.getElementById('google-login-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('guest-login-btn').onclick = async () => {
    const name = document.getElementById('guest-name').value || "Guest User";
    const res = await signInAnonymously(auth);
    await setupUser({ ...res.user, displayName: name });
};

document.getElementById('logout-btn').onclick = () => signOut(auth);

// --- USER SETUP ---
async function setupUser(user) {
    const userId = user.displayName ? user.displayName.split(' ')[0].toLowerCase() + user.uid.substring(0, 4) : "user" + user.uid.substring(0, 4);
    currentUserData = { uid: user.uid, id: userId, name: user.displayName || "Guest" };

    document.getElementById('display-name').innerText = currentUserData.name;
    document.getElementById('my-unique-id').innerText = "ID: #" + userId;
    document.getElementById('my-avatar').src = user.photoURL || `https://ui-avatars.com/api/?name=${currentUserData.name}`;

    await setDoc(doc(db, "users", userId), { uid: user.uid, name: currentUserData.name, photo: document.getElementById('my-avatar').src }, { merge: true });
}

// --- CHAT LOGIC ---
document.getElementById('add-friend-btn').onclick = async () => {
    const fId = document.getElementById('friend-id-input').value.trim();
    if (!fId) return;
    const docSnap = await getDoc(doc(db, "users", fId));
    if (docSnap.exists()) startChat(fId, docSnap.data().name);
    else alert("User not found!");
};

function startChat(friendId, friendName) {
    activeChatId = [currentUserData.id, friendId].sort().join('_');
    document.getElementById('chat-header').innerText = "Chatting with: " + friendName;
    document.getElementById('msg-input').disabled = false;
    document.getElementById('send-btn').disabled = false;

    const q = query(collection(db, "chats", activeChatId, "messages"), orderBy("timestamp", "asc"));
    onSnapshot(q, (snap) => {
        const area = document.getElementById('message-area');
        area.innerHTML = "";
        snap.forEach(d => {
            const m = d.data();
            const cls = m.sender === currentUserData.id ? 'sent' : 'received';
            area.innerHTML += `<div class="msg ${cls}">${m.text}</div>`;
        });
        area.scrollTop = area.scrollHeight;
    });
}

document.getElementById('send-btn').onclick = async () => {
    const input = document.getElementById('msg-input');
    if (!input.value) return;
    await addDoc(collection(db, "chats", activeChatId, "messages"), {
        text: input.value, sender: currentUserData.id, timestamp: serverTimestamp()
    });
    input.value = "";
};