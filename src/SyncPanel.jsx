import React, { useState } from 'react';

const AUTH_ERRORS = {
  'auth/invalid-credential': '이메일이나 비밀번호가 맞지 않아요.',
  'auth/wrong-password': '이메일이나 비밀번호가 맞지 않아요.',
  'auth/user-not-found': '이메일이나 비밀번호가 맞지 않아요.',
  'auth/invalid-email': '이메일 모양이 올바르지 않아요.',
  'auth/email-already-in-use': '이미 가입된 이메일이에요. 로그인을 눌러 주세요.',
  'auth/weak-password': '비밀번호는 6자 이상이어야 해요.',
  'auth/missing-password': '비밀번호를 입력해 주세요.',
  'auth/network-request-failed': '인터넷 연결을 확인해 주세요.',
  'auth/too-many-requests': '시도가 너무 많아요. 잠시 뒤에 다시 해 주세요.',
  'auth/operation-not-allowed': '지금은 새 계정을 만들 수 없어요.',
};
const timeLabel = (t) => new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

function statusText(sync) {
  switch (sync.status) {
    case 'connecting':
      return '연결 중…';
    case 'syncing':
      return '동기화 중…';
    case 'synced':
      return `✓ 동기화됨${sync.lastSyncAt ? ' ' + timeLabel(sync.lastSyncAt) : ''}`;
    case 'offline':
      return '오프라인 — 인터넷이 연결되면 자동으로 올라가요';
    case 'error':
      return `⚠ 동기화 오류${sync.detail ? ` (${sync.detail})` : ''}`;
    default:
      return '';
  }
}

// 설정 화면의 "기기 간 동기화" 칸
export default function SyncPanel({ cloud, user, sync }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  if (!cloud) return null;

  async function run(fn, okText) {
    setBusy(true);
    setMsg({ type: '', text: '' });
    try {
      await fn();
      if (okText) setMsg({ type: 'ok', text: okText });
    } catch (e) {
      setMsg({ type: 'error', text: AUTH_ERRORS[e && e.code] || `실패했어요 (${(e && (e.code || e.message)) || '알 수 없는 오류'})` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <label>기기 간 동기화</label>
      {user === undefined && <p className="msg">확인 중…</p>}

      {user === null && (
        <div className="syncbox">
          <p className="msg" style={{ margin: 0 }}>
            아이폰·아이패드에 같은 계정으로 로그인하면 노트가 자동으로 맞춰져요.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="email"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 (6자 이상)"
            autoComplete="current-password"
          />
          <div className="row">
            <button className="primary" disabled={busy} onClick={() => run(() => cloud.signIn(email.trim(), password))}>
              로그인
            </button>
            <button disabled={busy} onClick={() => run(() => cloud.signUp(email.trim(), password))}>
              새 계정 만들기
            </button>
          </div>
          <button
            className="linkbtn"
            disabled={busy || !email.trim()}
            onClick={() => run(() => cloud.resetPassword(email.trim()), '비밀번호 재설정 메일을 보냈어요. 메일함을 확인해 주세요.')}
          >
            비밀번호를 잊었어요
          </button>
        </div>
      )}

      {user && (
        <div className="syncbox">
          <p className="msg" style={{ margin: 0 }}>
            {user.email}
          </p>
          <p className={sync.status === 'error' ? 'msg error' : 'msg'} style={{ margin: 0 }}>
            {statusText(sync)}
          </p>
          <div className="row">
            <button onClick={sync.syncNow}>지금 동기화</button>
            <button disabled={busy} onClick={() => run(() => cloud.signOutUser())}>
              로그아웃
            </button>
          </div>
          <p className="msg" style={{ margin: 0 }}>
            로그아웃해도 이 기기의 노트는 그대로 남아요.
          </p>
        </div>
      )}

      {msg.text && <p className={msg.type === 'error' ? 'msg error' : 'msg'}>{msg.text}</p>}
    </div>
  );
}
