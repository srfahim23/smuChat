import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp, setDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyATEgv8QAqp8Nqnw3m8pjVBedZf7govrmc",
    authDomain: "smuchat.firebaseapp.com",
    projectId: "smuchat",
    storageBucket: "smuchat.firebasestorage.app",
    messagingSenderId: "851151186986",
    appId: "1:851151186986:web:a8192113d1aa7c2b062753"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let activeChatId = null;

const loginScreen = document.getElementById('login-screen');
const chatApp = document.getElementById('chat-app');

// ১. অথেনটিকেশন লিসেনার (লগইন চেক)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        loginScreen.style.display = 'none';
        chatApp.style.display = 'flex';
        await setupUser(user);
    } else {
        loginScreen.style.display = 'flex';
        chatApp.style.display = 'none';
    }
});

// ২. গুগল লগইন
document.getElementById('google-login-btn').onclick = () => signInWithPopup(auth, provider);

// ৩. গেস্ট লগইন
document.getElementById('guest-login-btn').onclick = async () => {
    const name = document.getElementById('custom-username').value.trim();
    if (!name) return alert("Please enter a username");
    const res = await signInAnonymously(auth);
    await setupUser({ uid: res.user.uid, displayName: name, isGuest: true });
};

// ৪. ইউজার প্রোফাইল সেটআপ
async function setupUser(user) {
    const userId = user.displayName.split(' ')[0].toLowerCase() + user.uid.substring(0, 4);
    currentUser = { uid: user.uid, name: user.displayName, customId: userId };

    document.getElementById('display-name').innerText = user.displayName;
    document.getElementById('my-unique-id').innerText = "ID: #" + userId;
    document.getElementById('my-avatar').src = user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`;

    await setDoc(doc(db, "users", userId), {
        uid: user.uid,
        name: user.displayName,
        photo: document.getElementById('my-avatar').src
    }, { merge: true });
}

// ৫. ফ্রেন্ড কানেক্ট করা
document.getElementById('add-friend-btn').onclick = async () => {
    const friendId = document.getElementById('friend-id-input').value.trim();
    if (!friendId || friendId === currentUser.customId) return;

    const docRef = doc(db, "users", friendId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        openChat(friendId, docSnap.data().name);
    } else {
        alert("User ID found হয়নি!");
    }
};

// ৬. চ্যাট ওপেন এবং মেসেজ রিড
function openChat(friendId, friendName) {
    activeChatId = [currentUser.customId, friendId].sort().join('_');
    document.getElementById('chat-with-name').innerText = friendName;
    document.getElementById('msg-input').disabled = false;
    document.getElementById('send-btn').disabled = false;

    const q = query(collection(db, "chats", activeChatId, "messages"), orderBy("timestamp", "asc"));
    onSnapshot(q, (snapshot) => {
        const area = document.getElementById('message-area');
        area.innerHTML = "";
        snapshot.forEach(d => {
            const m = d.data();
            const type = m.sender === currentUser.customId ? 'sent' : 'received';
            area.innerHTML += `<div class="glass-msg ${type}">${m.text}</div>`;
        });
        area.scrollTop = area.scrollHeight;
    });
}

// ৭. মেসেজ পাঠানো
document.getElementById('send-btn').onclick = async () => {
    const input = document.getElementById('msg-input');
    if (input.value && activeChatId) {
        await addDoc(collection(db, "chats", activeChatId, "messages"), {
            text: input.value,
            sender: currentUser.customId,
            timestamp: serverTimestamp()
        });
        input.value = "";
    }
};