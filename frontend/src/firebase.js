import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCGyzlaWokc0fssXhysO3PEldF2bWFc66M",
  authDomain: "wellmed-add5c.firebaseapp.com",
  projectId: "wellmed-add5c",
  storageBucket: "wellmed-add5c.firebasestorage.app",
  messagingSenderId: "576555795064",
  appId: "1:576555795064:web:1914b329989d35a403a38d",
  measurementId: "G-8W85761JMS"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
