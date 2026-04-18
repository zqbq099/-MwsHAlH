import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// استيراد إعدادات Firebase
import firebaseConfig from '../firebase-applet-config.json';

// تهيئة Firebase SDK
const app = initializeApp(firebaseConfig);

// تهيئة الخدمات
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();
