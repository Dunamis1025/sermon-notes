import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

// 홈 화면 앱은 켜 둔 채로 며칠 지나면 옛 버전이 계속 보임
// → 앱이 다시 앞으로 나올 때 새 버전이 배포되어 있으면 자동으로 새로고침
const loadedScript = Array.from(document.scripts)
  .map((el) => el.src)
  .find((src) => /\/static\/js\/main\.\w+\.js/.test(src));

async function checkForUpdate() {
  if (!loadedScript) return; // 개발 중(npm start)에는 건너뜀
  try {
    const last = Number(sessionStorage.getItem('update-reload-at') || 0);
    if (Date.now() - last < 60000) return; // 무한 새로고침 방지
    const res = await fetch('/?v=' + Date.now(), { cache: 'no-store' });
    const m = (await res.text()).match(/\/static\/js\/main\.\w+\.js/);
    if (m && !loadedScript.endsWith(m[0])) {
      sessionStorage.setItem('update-reload-at', String(Date.now()));
      window.location.reload();
    }
  } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkForUpdate();
});
checkForUpdate();
