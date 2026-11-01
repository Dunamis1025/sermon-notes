// Firebase(로그인 + 클라우드 저장소) 연결.
// 설정값이 있을 때만 App.jsx가 이 파일을 불러와요(그 전에는 앱 용량에도 영향 없음).
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { initializeFirestore, collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// 네트워크 환경에 따라 알아서 연결 방식을 고르게 함
const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });

export const configured = true;

export function onAuth(cb) {
  return onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null));
}
export async function signIn(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}
export async function signUp(email, password) {
  await createUserWithEmailAndPassword(auth, email, password);
}
export function signOutUser() {
  return signOut(auth);
}
export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

// 내 계정의 노트 저장소: users/{내 id}/notes/{노트 id}
export function backendFor(uid) {
  const col = collection(db, 'users', uid, 'notes');
  return {
    subscribe(onDocs, onError) {
      return onSnapshot(
        col,
        (snap) => {
          // 인터넷이 없을 때의 임시 내용(캐시)으로는 합치지 않음 → 서버가 확인해 준 내용만 사용
          if (snap.metadata.fromCache) return;
          onDocs(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        },
        onError
      );
    },
    push(note) {
      const clean = JSON.parse(JSON.stringify(note)); // undefined 값 제거
      return setDoc(doc(db, 'users', uid, 'notes', note.id), clean);
    },
  };
}
