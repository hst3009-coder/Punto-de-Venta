import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  initializeFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  limit,
  orderBy,
  where,
  writeBatch
} from 'firebase/firestore';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with specific database ID from config if present and ignore undefined properties
// Force long polling to bypass WebSocket restrictions in sandboxed environment
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId || '(default)');

// Initialize Auth safely
export let auth: any;
try {
  auth = getAuth(app);
} catch (e) {
  console.warn("Auth initialization deferred:", e);
}

const getSafeAuth = () => {
  if (!auth) {
    auth = getAuth(app);
  }
  return auth;
};

// Authentication service helper
export const authService = {
  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(getSafeAuth(), provider);
  },
  async signOut() {
    return firebaseSignOut(getSafeAuth());
  },
  onAuthChange(callback: (user: User | null) => void) {
    return onAuthStateChanged(getSafeAuth(), callback);
  }
};

// Dynamic Firestore Helper Functions
export const firestoreService = {
  // Fetch all documents from a collection
  async getCollectionDocs<T = any>(collectionName: string): Promise<T[]> {
    try {
      const colRef = collection(db, collectionName);
      const snapshot = await getDocs(colRef);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
    } catch (error) {
      console.error(`Error fetching collection ${collectionName}:`, error);
      throw error;
    }
  },

  // Subscribe to real-time updates of a collection
  subscribeToCollection<T = any>(
    collectionName: string, 
    onUpdate: (data: T[]) => void, 
    onError?: (err: Error) => void
  ) {
    const colRef = collection(db, collectionName);
    return onSnapshot(
      colRef, 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as T[];
        onUpdate(items);
      },
      (error) => {
        console.error(`Subscription error in ${collectionName}:`, error);
        if (onError) onError(error);
      }
    );
  },

  // Add document with auto-generated ID
  async addDoc(collectionName: string, data: any) {
    try {
      const colRef = collection(db, collectionName);
      const docRef = await addDoc(colRef, {
        ...data,
        createdAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      console.error(`Error adding doc to ${collectionName}:`, error);
      throw error;
    }
  },

  // Set document with a specific ID
  async setDocWithId(collectionName: string, id: string, data: any) {
    try {
      const docRef = doc(db, collectionName, id);
      await setDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error(`Error setting doc in ${collectionName}:`, error);
      throw error;
    }
  },

  // Update an existing document
  async updateDoc(collectionName: string, id: string, data: any) {
    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error updating doc in ${collectionName}:`, error);
      throw error;
    }
  },

  // Delete a document
  async deleteDoc(collectionName: string, id: string) {
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting doc in ${collectionName}:`, error);
      throw error;
    }
  },

  // Run a batch of set/update operations atomically
  async runBatch(operations: Array<{
    type: 'set' | 'update' | 'delete';
    collectionName: string;
    id: string;
    data?: any;
    merge?: boolean;
  }>) {
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      for (const op of operations) {
        const docRef = doc(db, op.collectionName, op.id);
        if (op.type === 'set') {
          batch.set(docRef, {
            ...op.data,
            updatedAt: now
          }, { merge: op.merge !== false });
        } else if (op.type === 'update') {
          batch.update(docRef, {
            ...op.data,
            updatedAt: now
          });
        } else if (op.type === 'delete') {
          batch.delete(docRef);
        }
      }
      await batch.commit();
    } catch (error) {
      console.error("Error committing write batch:", error);
      throw error;
    }
  }
};
