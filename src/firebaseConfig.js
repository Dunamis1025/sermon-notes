// Firebase 웹 앱 설정값. 비밀번호가 아니라 "이 앱이 어느 Firebase 프로젝트를 쓰는지" 알려 주는 공개 정보예요.
// (데이터는 Firestore 보안 규칙과 로그인으로 보호됨)
// 값이 비어 있으면 동기화 기능은 꺼진 채로 앱이 지금처럼 동작해요.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
};
