import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { app } from './app.js';

export const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export async function loginWithGoogle() {
    try {
        const result = await signInWithPopup(auth, provider);
        return result.user;
    } catch (error) {
        console.error("Login failed:", error);
        throw error;
    }
}

export async function logout() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout failed:", error);
    }
}

export function subscribeToAuth(callback) {
    return onAuthStateChanged(auth, callback);
}
