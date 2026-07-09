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
