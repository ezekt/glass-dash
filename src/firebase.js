import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDc1-GKX0g26tazdRCFt9dvEjOwQzOQZFk",
    authDomain: "glassdash-20266.firebaseapp.com",
    projectId: "glassdash-20266",
    storageBucket: "glassdash-20266.firebasestorage.app",
    messagingSenderId: "926827534866",
    appId: "1:926827534866:web:142b30e53f31e8697716cb",
    measurementId: "G-8ZNTQEFQZ1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, doc, setDoc, getDoc };
