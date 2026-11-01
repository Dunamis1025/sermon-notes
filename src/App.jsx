import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PassagePicker from './PassagePicker';
import SyncPanel from './SyncPanel';
import { useCloudSync } from './sync';
import { firebaseConfig } from './firebaseConfig';
import { t, setLang, detectLang, locale, getLang } from './i18n';

const NOTES_KEY = 'sermon-notes-v1';
const SETTINGS_KEY = 'sermon-settings-v1';

// 화면 분위기 (색은 App.css의 data-theme와 같게 유지)
const THEMES = [
  { id: 'fresh', name: '산뜻', desc: '맑은 하늘색', bg: '#f3f8ff', card: '#ffffff', accent: '#2b72d6', ink: '#1b2733' },
  { id: 'chic', name: '시크', desc: '차분한 흑백', bg: '#f5f5f3', card: '#ffffff', accent: '#1c1c1c', ink: '#151515' },
  { id: 'warm', name: '따뜻', desc: '포근한 크림색', bg: '#fff7ee', card: '#fffdfa', accent: '#cf5d37', ink: '#3b2d25' },
];

function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// 노트 저장 — 저장한 뒤 다시 읽어 봐서 실제로 저장됐는지 확인함
function writeNotes(list) {
  try {
    const json = JSON.stringify(list);
    localStorage.setItem(NOTES_KEY, json);
    return localStorage.getItem(NOTES_KEY) === json;
  } catch {
    return false;
  }
}

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function dateLabel(s) {
  const d = parseDate(s);
  return d.toLocaleDateString(locale(), { month: 'long', day: 'numeric', weekday: 'long' });
}
function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(locale(), { year: 'numeric', month: 'long' });
}

function newNote() {
  return {
    id: String(Date.now()),
    date: todayStr(),
    passages: [],
    title: '',
    body: '',
    updatedAt: Date.now(),
  };
}
// 옛 버전(말씀 1개) 노트를 새 구조(말씀 여러 개)로 바꿔 줌
function normalizeNote(n) {
  if (Array.isArray(n.passages)) return n;
  const has = (n.verses && n.verses.length) || (n.manual && n.manual.trim()) || n.refLabel || n.ref;
  const { ref, refLabel, verses, manual, translation, ...rest } = n;
  return {
    ...rest,
    passages: has
      ? [
          {
            id: n.id + '-p0',
            refLabel: refLabel || ref || '말씀',
            verses: verses || [],
            manual: manual || '',
            translation: translation || '',
          },
        ]
      : [],
  };
}
function isEmpty(n) {
  return !n.passages.length && !n.title && !n.body.trim();
}
function passageText(n) {
  return n.passages.map((p) => p.refLabel + ' ' + p.verses.map((v) => v.text).join(' ') + ' ' + p.manual).join(' ');
}
function refLabels(n) {
  return n.passages.map((p) => p.refLabel).join(', ');
}

const TRANSLATIONS = [
  { code: 'KRV', name: '한국어 (개역한글)' },
  { code: 'NIV', name: 'English (NIV)' },
  { code: 'ESV', name: 'English (ESV)' },
  { code: 'KJV', name: 'English (KJV)' },
];

export default function App() {
  const [notes, setNotes] = useState(() => load(NOTES_KEY, []).map(normalizeNote));
  const [settings, setSettings] = useState(() => {
    const stored = load(SETTINGS_KEY, {});
    // 이미 쓰던 사람은 한국어 그대로, 처음 쓰는 사람은 기기 언어를 따라감
    const lang = stored.lang || (Object.keys(stored).length || notes.length ? 'ko' : detectLang());
    return { translation: lang === 'en' ? 'NIV' : 'KRV', theme: 'fresh', ...stored, lang };
  });
  setLang(settings.lang); // 화면을 그리기 전에 언어 적용
  const [editingId, setEditingId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // 기기 간 동기화 (firebaseConfig가 채워져 있을 때만 켜짐)
  const [cloud, setCloud] = useState(null);
  const [user, setUser] = useState(undefined); // undefined 확인 중 | null 로그아웃 | {uid,email}
  useEffect(() => {
    if (!firebaseConfig.apiKey) return undefined;
    let off = () => {};
    let dead = false;
    import('./cloud')
      .then((m) => {
        if (dead) return;
        setCloud(m);
        off = m.onAuth(setUser);
      })
      .catch(() => setUser(null));
    return () => {
      dead = true;
      off();
    };
  }, []);
  const backend = useMemo(() => (cloud && user ? cloud.backendFor(user.uid) : null), [cloud, user]);
  const sync = useCloudSync({ notes, setNotes, backend, uid: user ? user.uid : null });
  useEffect(() => {
    if (editingId && !notes.some((n) => n.id === editingId)) setEditingId(null); // 다른 기기에서 지워진 노트
  }, [notes, editingId]);

  const [saveState, setSaveState] = useState('saved'); // 'saved' | 'pending' | 'error'
  const [savedAt, setSavedAt] = useState(null);
  const [toast, setToast] = useState('');
  const notesRef = useRef(notes);
  const dirtyRef = useRef(false); // 아직 저장하지 못한 변경이 있는지
  const firstRun = useRef(true);

  const markSaved = useCallback((ok) => {
    dirtyRef.current = !ok;
    setSaveState(ok ? 'saved' : 'error');
    if (ok) setSavedAt(Date.now());
  }, []);
  // 글을 고치면 잠시 뒤 자동 저장
  useEffect(() => {
    notesRef.current = notes;
    dirtyRef.current = true;
    if (!firstRun.current) setSaveState('pending');
    firstRun.current = false;
    const t = setTimeout(() => markSaved(writeNotes(notes)), 300);
    return () => clearTimeout(t);
  }, [notes, markSaved]);
  // 앱을 닫거나 다른 앱으로 넘어갈 때, 저장 못 한 변경이 있으면 기다리지 않고 바로 저장
  useEffect(() => {
    const flush = () => {
      if (dirtyRef.current) markSaved(writeNotes(notesRef.current));
    };
    const onVis = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
    };
  }, [markSaved]);
  // 저장 버튼: 바로 저장하고 결과를 알려 줌
  function saveNow() {
    const ok = writeNotes(notesRef.current);
    markSaved(ok);
    setToast(ok ? t('✓ 저장했어요') : t('저장하지 못했어요. 기기 저장 공간을 확인해 주세요'));
  }
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => save(SETTINGS_KEY, settings), [settings]);
  // 고른 분위기를 화면에 적용
  useEffect(() => {
    const t = THEMES.find((x) => x.id === settings.theme) || THEMES[0];
    document.documentElement.setAttribute('data-theme', t.id);
    document.documentElement.lang = settings.lang;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t.bg);
  }, [settings.theme, settings.lang]);

  const editing = notes.find((n) => n.id === editingId) || null;

  function createNote() {
    const n = newNote();
    setNotes((prev) => [n, ...prev]);
    setEditingId(n.id);
    window.scrollTo(0, 0);
  }
  function patchNote(id, patch) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)));
  }
  function closeEditor() {
    setNotes((prev) => prev.filter((n) => n.id !== editingId || !isEmpty(n)));
    setEditingId(null);
    window.scrollTo(0, 0);
  }
  function removeNote(id) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }
  function deleteNote(id) {
    if (!window.confirm(t('이 노트를 삭제할까요? 되돌릴 수 없어요.'))) return;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setEditingId(null);
  }

  return (
    <div className="app">
      {editing ? (
        <Editor
          key={editing.id}
          note={editing}
          translation={settings.translation}
          onPatch={(patch) => patchNote(editing.id, patch)}
          onBack={closeEditor}
          onDelete={() => deleteNote(editing.id)}
          saveState={saveState}
          savedAt={savedAt}
          onSave={saveNow}
        />
      ) : (
        <List
          notes={notes}
          onOpen={setEditingId}
          onCreate={createNote}
          onDelete={removeNote}
          onSettings={() => setShowSettings(true)}
        />
      )}
      {showSettings && (
        <Settings
          settings={settings}
          setSettings={setSettings}
          notes={notes}
          setNotes={setNotes}
          cloud={cloud}
          user={user}
          sync={sync}
          onClose={() => setShowSettings(false)}
        />
      )}
      {toast && (
        <div className={saveState === 'error' ? 'toast error' : 'toast'} role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ───────────── 목록 + 검색 ───────────── */

function List({ notes, onOpen, onCreate, onDelete, onSettings }) {
  const [armedId, setArmedId] = useState(null); // 삭제/취소 버튼이 열려 있는 노트
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  const sorted = useMemo(
    () => [...notes].sort((a, b) => (b.date === a.date ? b.updatedAt - a.updatedAt : b.date.localeCompare(a.date))),
    [notes]
  );
  const months = useMemo(() => [...new Set(sorted.map((n) => n.date.slice(0, 7)))], [sorted]);

  const filtered = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return sorted.filter((n) => {
      if (month !== 'all' && !n.date.startsWith(month)) return false;
      if (dateFilter && n.date !== dateFilter) return false;
      if (!tokens.length) return true;
      const d = parseDate(n.date);
      const hay = [
        n.date,
        `${d.getMonth() + 1}월 ${d.getDate()}일`,
        `${d.getMonth() + 1}월${d.getDate()}일`,
        `${d.getFullYear()}년`,
        dateLabel(n.date),
        n.title,
        refLabels(n),
        n.body,
        passageText(n),
      ]
        .join(' ')
        .toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [sorted, query, month, dateFilter]);

  const filtering = query || month !== 'all' || dateFilter;

  return (
    <>
      <header className="topbar">
        <h1>{t('설교 노트')}</h1>
        <button className="icon-btn" onClick={onSettings} aria-label={t('설정')}>
          ⚙︎
        </button>
      </header>

      <div className="searchbox">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('날짜 · 제목 · 말씀 · 내용으로 찾기')}
        />
        <label className="datepick" title={t('날짜로 찾기')}>
          📅
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </label>
      </div>

      {months.length > 0 && (
        <div className="chips">
          <button className={month === 'all' ? 'chip on' : 'chip'} onClick={() => setMonth('all')}>
            {t('전체')}
          </button>
          {months.map((m) => (
            <button key={m} className={month === m ? 'chip on' : 'chip'} onClick={() => setMonth(m)}>
              {monthLabel(m)}
            </button>
          ))}
        </div>
      )}
      {dateFilter && (
        <button className="linkbtn" onClick={() => setDateFilter('')}>
          {t('{d} 필터 해제 ✕', { d: dateLabel(dateFilter) })}
        </button>
      )}

      {notes.length === 0 ? (
        <div className="empty">
          <p>{t('아직 노트가 없어요.')}</p>
          <p className="sub">{t('아래 + 버튼으로 오늘 설교를 시작해 보세요.')}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <p>{t('찾는 노트가 없어요.')}</p>
        </div>
      ) : (
        <ul className="notelist">
          {filtered.map((n) => (
            <NoteRow key={n.id} n={n} armed={armedId === n.id} onArm={setArmedId} onOpen={onOpen} onDelete={onDelete} />
          ))}
        </ul>
      )}
      {filtering && filtered.length > 0 && <p className="count">{t('{n}개의 노트', { n: filtered.length })}</p>}
      {notes.length > 0 && <p className="hint">{t('노트를 왼쪽으로 밀면 삭제할 수 있어요')}</p>}

      <button className="fab" onClick={onCreate} aria-label={t('새 노트')}>
        ＋
      </button>
    </>
  );
}

/* ───────────── 목록의 한 줄 (왼쪽으로 밀면 삭제/취소) ───────────── */

const ACTION_W = 168;

function NoteRow({ n, armed, onArm, onOpen, onDelete }) {
  const [dx, setDx] = useState(null); // 손가락을 따라 움직이는 중일 때만 값이 있음
  const tr = useRef({ x: 0, y: 0, mode: null, moved: false, dx: 0 });
  const base = armed ? -ACTION_W : 0;
  const shift = dx !== null ? dx : base;

  function start(e) {
    const p = e.touches[0];
    tr.current = { x: p.clientX, y: p.clientY, mode: null, moved: false, dx: base };
  }
  function move(e) {
    const r = tr.current;
    const p = e.touches[0];
    const ddx = p.clientX - r.x;
    const ddy = p.clientY - r.y;
    if (!r.mode) {
      if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
      r.mode = Math.abs(ddx) > Math.abs(ddy) ? 'h' : 'v'; // 가로면 밀기, 세로면 그냥 스크롤
    }
    if (r.mode === 'h') {
      r.moved = true;
      r.dx = Math.max(-ACTION_W, Math.min(0, base + ddx));
      setDx(r.dx);
    }
  }
  function end() {
    const r = tr.current;
    if (r.mode === 'h') onArm(r.dx < -70 ? n.id : null); // 충분히 밀었으면 열어 둠
    setDx(null);
    r.mode = null;
  }
  function click() {
    if (tr.current.moved) {
      tr.current.moved = false;
      return;
    }
    if (armed) onArm(null);
    else onOpen(n.id);
  }

  return (
    <li className="swipe">
      <div className={armed || dx !== null ? 'swipe-actions show' : 'swipe-actions'}>
        <button className="del" onClick={() => onDelete(n.id)}>
          {t('삭제')}
        </button>
        <button className="cancel" onClick={() => onArm(null)}>
          {t('취소')}
        </button>
      </div>
      <button
        className={dx !== null ? 'card drag' : 'card'}
        style={{ transform: shift ? `translateX(${shift}px)` : 'none' }}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
        onTouchCancel={end}
        onClick={click}
      >
        <div className="card-date">{dateLabel(n.date)}</div>
        <div className="card-title">{n.title || t('(제목 없음)')}</div>
        {n.passages.length > 0 && <div className="card-ref">{refLabels(n)}</div>}
        {n.body.trim() && <div className="card-snip">{n.body.trim().slice(0, 80)}</div>}
      </button>
    </li>
  );
}

/* ───────────── 노트 작성 ───────────── */

function Editor({ note, translation, onPatch, onBack, onDelete, saveState, savedAt, onSave }) {
  const [mode, setMode] = useState(note.passages.length ? null : 'pick'); // null | 'pick' | 'paste'
  const [paste, setPaste] = useState({ label: '', text: '' });
  const [closed, setClosed] = useState({}); // 접어 둔 말씀 id
  const bodyRef = useRef(null);

  // 받아 적는 칸이 글 길이에 맞춰 늘어나게
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(220, el.scrollHeight) + 'px';
  }, [note.body]);

  function addPassage(p) {
    onPatch({ passages: [...note.passages, { id: String(Date.now()), translation: '', verses: [], manual: '', ...p }] });
  }
  function removePassage(id, label) {
    if (!window.confirm(t('"{label}" 말씀을 이 노트에서 뗄까요?', { label }))) return;
    onPatch({ passages: note.passages.filter((p) => p.id !== id) });
  }
  function pin(p) {
    addPassage(p);
    setMode(null);
  }
  function openPaste(label) {
    setPaste({ label: label || '', text: '' });
    setMode('paste');
  }
  function submitPaste() {
    if (!paste.text.trim()) return;
    addPassage({ refLabel: paste.label.trim() || t('직접 입력'), manual: paste.text.trim() });
    setMode(null);
  }

  return (
    <>
      <header className="topbar sticky">
        <button className="back" onClick={onBack}>
          {t('‹ 목록')}
        </button>
        <div className="savebox">
          <span className={`savestate ${saveState}`}>
            {saveState === 'saved'
              ? `${t('✓ 저장됨')}${savedAt ? ' ' + new Date(savedAt).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) : ''}`
              : saveState === 'pending'
              ? t('저장 중…')
              : t('⚠ 저장 실패')}
          </span>
          <button className="primary small" onClick={onSave}>
            {t('저장')}
          </button>
        </div>
        <button className="icon-btn danger" onClick={onDelete} aria-label={t('삭제')}>
          🗑
        </button>
      </header>

      <div className="field">
        <label>{t('날짜')}</label>
        <div className="row">
          <input
            type="date"
            value={note.date}
            onChange={(e) => e.target.value && onPatch({ date: e.target.value })}
          />
          <span className="weekday">{dateLabel(note.date).split(' ').slice(2).join(' ')}</span>
        </div>
      </div>

      <div className="field">
        <label>{t('설교 제목')}</label>
        <input
          type="text"
          value={note.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder={t('주보에 적힌 제목')}
        />
      </div>

      <div className="field">
        <label>{t('본문 말씀')}</label>
        {note.passages.map((p, i) => {
          const open = !closed[p.id];
          const multi = p.verses.length > 0 && p.verses[0].c !== p.verses[p.verses.length - 1].c;
          return (
            <section className="postit" data-c={i % 4} key={p.id}>
              <div className="postit-head">
                <button className="postit-toggle" onClick={() => setClosed({ ...closed, [p.id]: open })}>
                  <span className="postit-name">📌 {p.refLabel}</span>
                  <span className="tr">{p.verses.length ? p.translation : ''}</span>
                  <span className="chev">{open ? t('접기 ▲') : t('펼치기 ▼')}</span>
                </button>
                <button className="icon-btn danger" onClick={() => removePassage(p.id, p.refLabel)} aria-label={t('이 말씀 떼기')}>
                  ✕
                </button>
              </div>
              {open && (
                <div className="postit-body">
                  {p.verses.length > 0 && (
                    <p>
                      {p.verses.map((v, j) => (
                        <span key={j}>
                          <sup>{multi && (j === 0 || v.c !== p.verses[j - 1].c) ? `${v.c}:${v.v}` : v.v}</sup>
                          {v.text}{' '}
                        </span>
                      ))}
                    </p>
                  )}
                  {p.manual.trim() && <p>{p.manual}</p>}
                </div>
              )}
            </section>
          );
        })}

        {mode === 'pick' && (
          <PassagePicker
            translation={translation}
            pinned={note.passages.map((p) => p.refLabel)}
            onPin={pin}
            onManual={openPaste}
            onClose={() => setMode(null)}
          />
        )}
        {mode === 'paste' && (
          <div className="pastebox">
            <input
              type="text"
              value={paste.label}
              onChange={(e) => setPaste({ ...paste, label: e.target.value })}
              placeholder={t('말씀 이름 (예: 히브리서 12:2)')}
            />
            <textarea
              className="manual"
              value={paste.text}
              onChange={(e) => setPaste({ ...paste, text: e.target.value })}
              placeholder={t('다른 성경앱에서 복사한 본문을 여기에 붙여넣어요')}
              rows={4}
            />
            <div className="row">
              <button className="primary" onClick={submitPaste}>
                {t('말씀 붙이기')}
              </button>
              <button onClick={() => setMode(null)}>{t('취소')}</button>
            </div>
          </div>
        )}
        {mode === null && (
          <div className="row addbar">
            <button className="primary" onClick={() => setMode('pick')}>
              {note.passages.length ? t('＋ 말씀 더 붙이기') : t('＋ 말씀 붙이기')}
            </button>
            <button onClick={() => openPaste('')}>{t('직접 붙여넣기')}</button>
          </div>
        )}
      </div>

      <div className="field">
        <label>{t('받아 적기')}</label>
        <textarea
          ref={bodyRef}
          className="body"
          value={note.body}
          onChange={(e) => onPatch({ body: e.target.value })}
          placeholder={t('말씀을 들으며 감동받은 부분, 요점을 적어 보세요')}
        />
      </div>
    </>
  );
}

/* ───────────── 설정 / 백업 ───────────── */

function Settings({ settings, setSettings, notes, setNotes, cloud, user, sync, onClose }) {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState('');

  function changeLang(code) {
    // 번역이 그 언어의 기본값이었다면 함께 바꿔 줌
    const def = { ko: 'KRV', en: 'NIV' };
    const translation = settings.translation === def[settings.lang] ? def[code] : settings.translation;
    setSettings({ ...settings, lang: code, translation });
  }

  async function exportAll() {
    const name = `sermon-notes-${todayStr()}.json`;
    const text = JSON.stringify({ app: 'sermon-notes', notes }, null, 2);
    // 아이폰·아이패드: 공유 창(에어드롭, 파일에 저장, 카카오톡 등)으로 보냄
    try {
      const file = new File([text], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: t('설교 노트 백업') });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return; // 사용자가 공유 창을 닫음
    }
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }
  function importAll(e) {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const incoming = Array.isArray(data) ? data : data.notes;
        if (!Array.isArray(incoming)) throw new Error();
        const have = new Set(notes.map((n) => n.id));
        const add = incoming.filter((n) => n && n.id && n.date && !have.has(n.id)).map(normalizeNote);
        setNotes((prev) => [...prev, ...add]);
        setMsg(t('{n}개의 노트를 가져왔어요.', { n: add.length }));
      } catch {
        setMsg(t('파일을 읽지 못했어요.'));
      }
    };
    reader.readAsText(f);
    e.target.value = '';
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{t('설정')}</h2>

        <div className="field">
          <label>{t('화면 분위기')}</label>
          <div className="themes">
            {THEMES.map((th) => (
              <button
                key={th.id}
                className={settings.theme === th.id ? 'theme on' : 'theme'}
                onClick={() => setSettings({ ...settings, theme: th.id })}
              >
                <span className="swatch" style={{ background: th.bg }}>
                  <span className="sw-card" style={{ background: th.card }}>
                    <i style={{ background: th.accent }} />
                    <b style={{ background: th.ink }} />
                  </span>
                </span>
                <span className="tname">{t(th.name)}</span>
                <span className="tdesc">{t(th.desc)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>{t('화면 언어')}</label>
          <div className="row">
            {[['ko', '한국어'], ['en', 'English']].map(([code, name]) => (
              <button
                key={code}
                className={settings.lang === code ? 'primary' : ''}
                onClick={() => changeLang(code)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>{t('성경 번역')}</label>
          <div className="row">
            {TRANSLATIONS.map((th) => (
              <button
                key={th.code}
                className={settings.translation === th.code ? 'primary' : ''}
                onClick={() => setSettings({ ...settings, translation: th.code })}
              >
                {t(th.name)}
              </button>
            ))}
          </div>
          <p className="msg">
            {t('새로 붙이는 말씀부터 선택한 번역으로 가져와요. 이미 붙인 말씀은 그대로예요. 다른 번역을 쓰려면 아래에 코드를 직접 입력하세요.')}
          </p>
          <input
            type="text"
            value={settings.translation}
            onChange={(e) => setSettings({ ...settings, translation: e.target.value.trim() })}
            autoCapitalize="characters"
            autoCorrect="off"
          />
        </div>

        <SyncPanel cloud={cloud} user={user} sync={sync} />

        <div className="field">
          <label>{t('백업')}</label>
          <div className="row">
            <button onClick={exportAll}>{t('내보내기')}</button>
            <button onClick={() => fileRef.current.click()}>{t('가져오기')}</button>
            <input ref={fileRef} type="file" accept="application/json" onChange={importAll} hidden />
          </div>
          <p className="msg">{t('노트는 이 기기에만 저장돼요. 가끔 내보내기로 백업해 두면 안전해요.')}</p>
          {msg && <p className="msg">{msg}</p>}
        </div>

        <button className="primary wide" onClick={onClose}>
          {t('닫기')}
        </button>
      </div>
    </div>
  );
}
