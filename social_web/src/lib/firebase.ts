import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyB2DbqS7LBLda-Ap9AldfB_xrvDiU_h0jg",
  authDomain: "social-3227c.firebaseapp.com",
  projectId: "social-3227c",
  storageBucket: "social-3227c.firebasestorage.app",
  messagingSenderId: "696598494692",
  appId: "1:696598494692:web:a17060d1f1993e7cdb5bf1",
  measurementId: "G-7BK82T8D5G"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);