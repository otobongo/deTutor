import 'server-only';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getConfig } from '@/lib/config';

// Server-side Firebase initialization only. Client components never touch
// Firestore directly; they go through server actions and route handlers.

function getApp(): App {
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
