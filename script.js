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

// --- ১. অথেন্টিকেশন লজিক ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('chat-app').style.display = 'flex';
        await setupUser(user);
        loadFriendList(); // বন্ধুরা লোড হবে
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('chat-app').style.display = 'none';
    }
});

// ট্যাব পাল্টানো (Login vs Signup)
document.getElementById('tab-signup').onclick = () => { isSignUpMode = true; updateAuthUI('tab-signup', 'Sign Up'); };
document.getElementById('tab-login').onclick = () => { isSignUpMode = false; updateAuthUI('tab-login', 'Login'); };

function updateAuthUI(tab, btnText) {
    document.querySelectorAll('.auth-tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById(tab).classList.add('active');
    document.getElementById('main-auth-btn').innerText = btnText;
}

// লগইন/রেজিস্ট্রেশন বাটন
document.getElementById('main-auth-btn').onclick = async () => {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    try {
        if (isSignUpMode) await createUserWithEmailAndPassword(auth, email, pass);
        else await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) { alert(e.message); }
};

document.getElementById('google-login-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('guest-login-btn').onclick = async () => {
    const name = document.getElementById('guest-name').value || "Guest";
    const res = await signInAnonymously(auth);
    await setupUser({ ...res.user, displayName: name });
};
document.getElementById('logout-btn').onclick = () => signOut(auth);

// --- ২. ইউজার প্রোফাইল সেটআপ ---
async function setupUser(user) {
    const name = user.displayName || "Anonymous";
    const customId = name.split(' ')[0].toLowerCase() + user.uid.substring(0, 4);
    currentUserData = { uid: user.uid, id: customId, name: name };

    document.getElementById('display-name').innerText = name;
    document.getElementById('my-unique-id').innerText = "ID: #" + customId;
    document.getElementById('my-avatar').src = user.photoURL || `https://ui-avatars.com/api/?name=${name}&background=random`;

    await setDoc(doc(db, "users", customId), {
        uid: user.uid, id: customId, name: name, photo: document.getElementById('my-avatar').src
    }, { merge: true });
}

// --- ৩. ফ্রেন্ডশিপ সিস্টেম (Add Friend) ---
document.getElementById('add-friend-btn').onclick = async () => {
    const fId = document.getElementById('friend-id-input').value.trim();
    if (!fId || fId === currentUserData.id) return;

    const friendDoc = await getDoc(doc(db, "users", fId));
    if (friendDoc.exists()) {
        const friendData = friendDoc.data();
        // নিজের লিস্টে বন্ধুকে সেভ করা
        await setDoc(doc(db, "users", currentUserData.id, "friends", fId), {
            id: fId, name: friendData.name, photo: friendData.photo, addedAt: serverTimestamp()
        });
        // বন্ধুর লিস্টে নিজেকে সেভ করা
        await setDoc(doc(db, "users", fId, "friends", currentUserData.id), {
            id: currentUserData.id, name: currentUserData.name, photo: document.getElementById('my-avatar').src, addedAt: serverTimestamp()
        });
        alert(friendData.name + " added to your friend list!");
        document.getElementById('friend-id-input').value = "";
    } else {
        alert("User ID not found!");
    }
};

// ফ্রেন্ড লিস্ট লোড করা
function loadFriendList() {
    const listUI = document.getElementById('friend-list');
    const q = query(collection(db, "users", currentUserData.id, "friends"), orderBy("addedAt", "desc"));
    
    onSnapshot(q, (snap) => {
        listUI.innerHTML = "";
        if (snap.empty) listUI.innerHTML = '<p class="empty-list">No friends yet</p>';
        snap.forEach(d => {
            const f = d.data();
            const div = document.createElement('div');
            div.className = 'friend-item';
            div.innerHTML = `
                <img src="${f.photo}" class="friend-img">
                <div class="friend-info"><b>${f.name}</b><small>#${f.id}</small></div>
            `;
            div.onclick = () => startChat(f.id, f.name);
            listUI.appendChild(div);
        });
    });
}

// --- ৪. চ্যাট লজিক ---
function startChat(fId, fName) {
    activeChatId = [currentUserData.id, fId].sort().join('_');
    document.getElementById('chat-header').innerText = fName;
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
    if (!input.value || !activeChatId) return;
    await addDoc(collection(db, "chats", activeChatId, "messages"), {
        text: input.value, sender: currentUserData.id, timestamp: serverTimestamp()
    });
    input.value = "";
};