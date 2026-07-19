import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getConfig } from '@/lib/config';

// Server-side Firebase initialization only (server actions, route handlers,
// and seed scripts). Client components never touch Firestore directly. A
// runtime check replaces the server-only package so tsx-run seed scripts work.

function getApp(): App {
  if (typeof window !== 'undefined') {
    throw new Error('lib/firebase.ts must never be imported in the browser.');
  }
  const existing = getApps()[0];
  if (existing) return existing;
  const { firebase } = getConfig();
  if (!firebase) {
    // Reachable only by importing this module under a non-firestore store,
    // which is a wiring mistake: the config schema requires these keys
    // whenever DATA_STORE=firestore.
    throw new Error(
      'Firebase credentials are absent. Set DATA_STORE=firestore with FIREBASE_* ' +
        'variables, or use the postgres/dev-file store instead.',
    );
  }
  return initializeApp({
    credential: cert({
      projectId: firebase.projectId,
      clientEmail: firebase.clientEmail,
      privateKey: firebase.privateKey,
    }),
  });
}

export function getDb(): Firestore {
  return getFirestore(getApp());
}
