import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInAs: (role: UserRole, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (user) {
        const { onSnapshot, doc, updateDoc } = await import('firebase/firestore');
        unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            const resolvedPhotoURL = data.photoURL || user.photoURL || '';
            const resolvedProfile: UserProfile = {
              ...data,
              photoURL: resolvedPhotoURL,
            };
            setProfile(resolvedProfile);

            // Auto-sync photoURL to Firestore if profile didn't store it yet
            if (!data.photoURL && user.photoURL) {
              updateDoc(doc(db, 'users', user.uid), { photoURL: user.photoURL }).catch(() => {});
            }
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          setProfile(null);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const signInAs = async (role: UserRole, name: string) => {
    if (!auth.currentUser) throw new Error("Not authenticated");
    
    const newProfile: UserProfile = {
      uid: auth.currentUser.uid,
      name,
      email: auth.currentUser.email || '',
      role,
      photoURL: auth.currentUser.photoURL || '',
      createdAt: new Date().toISOString(),
    };
    
    await setDoc(doc(db, 'users', auth.currentUser.uid), newProfile);
    setProfile(newProfile);
  };

  const signOut = async () => {
    if (auth.currentUser) {
      try {
        const { setDoc, doc } = await import('firebase/firestore');
        await setDoc(doc(db, 'presence', auth.currentUser.uid), {
          status: 'offline',
          lastSeen: new Date().toISOString(),
        }, { merge: true });
      } catch (e) {
        // ignore
      }
    }
    return auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInAs, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
