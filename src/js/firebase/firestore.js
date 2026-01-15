import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, setDoc } from 'firebase/firestore';
import { app } from './app.js';

export const db = getFirestore(app);

// Collection Reference Helper
// Structure: users/{uid}/fixed_income/{assetId}
const getFICollection = (uid) => collection(db, `users/${uid}/fixed_income`);

export function subscribeToFixedIncome(uid, callback) {
    if (!uid) return () => { };

    // Default sort by dueDate? Or local sort?
    // Let's just fetch and let the UI/Store sort.
    const q = query(getFICollection(uid));

    return onSnapshot(q, (snapshot) => {
        const assets = [];
        snapshot.forEach((doc) => {
            assets.push({ id: doc.id, ...doc.data() });
        });
        callback(assets);
    }, (error) => {
        console.error("Firestore Error:", error);
    });
}

export async function addAsset(uid, assetData) {
    if (!uid) throw new Error("User not authenticated");
    return addDoc(getFICollection(uid), assetData);
}

export async function updateAsset(uid, assetId, data) {
    if (!uid) throw new Error("User not authenticated");
    const ref = doc(db, `users/${uid}/fixed_income`, assetId);
    return updateDoc(ref, data);
}

export async function deleteAsset(uid, assetId) {
    if (!uid) throw new Error("User not authenticated");
    const ref = doc(db, `users/${uid}/fixed_income`, assetId);
    return deleteDoc(ref);
}

// --- Variable Income ---

const getVariableCollection = (uid) => collection(db, `users/${uid}/variable_income`);

export function subscribeToVariableIncome(uid, callback) {
    if (!uid) return () => { };
    const q = query(getVariableCollection(uid));
    return onSnapshot(q, (snapshot) => {
        const assets = [];
        snapshot.forEach((doc) => {
            assets.push({ id: doc.id, ...doc.data() });
        });
        callback(assets);
    }, (error) => console.error("Firestore Variable Error:", error));
}

export async function addVariableAsset(uid, assetData) {
    if (!uid) throw new Error("User not authenticated");
    return addDoc(getVariableCollection(uid), assetData);
}

export async function updateVariableAsset(uid, assetId, data) {
    if (!uid) throw new Error("User not authenticated");
    const ref = doc(db, `users/${uid}/variable_income`, assetId);
    return updateDoc(ref, data);
}

export async function deleteVariableAsset(uid, assetId) {
    if (!uid) throw new Error("User not authenticated");
    const ref = doc(db, `users/${uid}/variable_income`, assetId);
    return deleteDoc(ref);
}

// --- Proventos (Dividends/Earnings) ---

const getProventosCollection = (uid) => collection(db, `users/${uid}/proventos`);

export function subscribeToProventos(uid, callback) {
    if (!uid) return () => { };
    const q = query(getProventosCollection(uid));
    return onSnapshot(q, (snapshot) => {
        const items = [];
        snapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() });
        });
        callback(items);
    }, (error) => console.error("Firestore Proventos Error:", error));
}

export async function addProvento(uid, data) {
    if (!uid) throw new Error("User not authenticated");
    return addDoc(getProventosCollection(uid), data);
}

export async function updateProvento(uid, docId, data) {
    if (!uid) throw new Error("User not authenticated");
    const ref = doc(db, `users/${uid}/proventos`, docId);
    return updateDoc(ref, data);
}

export async function deleteProvento(uid, docId) {
    if (!uid) throw new Error("User not authenticated");
    const ref = doc(db, `users/${uid}/proventos`, docId);
    return deleteDoc(ref);
}

// --- User Settings (Doc: users/{uid}) ---

export function subscribeToUserDocument(uid, callback) {
    if (!uid) return () => { };
    const ref = doc(db, 'users', uid);
    return onSnapshot(ref, (doc) => {
        if (doc.exists()) {
            callback(doc.data());
        } else {
            callback({}); // Empty if new user
        }
    }, (error) => console.error("Firestore User Doc Error:", error));
}

export async function updateUserDocument(uid, data) {
    if (!uid) throw new Error("User not authenticated");
    const ref = doc(db, 'users', uid);
    // Use set with merge: true to create if not exists or update fields
    const { setDoc } = await import('firebase/firestore'); // Dynamic import to avoid changing top imports if possible, or just add setDoc to top
    return setDoc(ref, data, { merge: true });

}
