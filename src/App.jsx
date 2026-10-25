import React, { useEffect, useMemo, useRef, useState } from 'react';
import { parseReference, formatReference, fetchPassage } from './bible';

const NOTES_KEY = 'sermon-notes-v1';
const SETTINGS_KEY = 'sermon-settings-v1';
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

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
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${DAYS[d.getDay()]}요일`;
}
function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return `${y}년 ${Number(m)}월`;
}

function newNote() {
  return {
    id: String(Date.now()),
    date: todayStr(),
    ref: '',
    refLabel: '',
    verses: [],
    manual: '',
    translation: '',
    title: '',
    body: '',
    updatedAt: Date.now(),
  };
}
function isEmpty(n) {
  return !n.ref && !n.title && !n.body.trim() && !n.verses.length && !n.manual.trim();
}
function passageText(n) {
  return n.verses.map((v) => v.text).join(' ') + ' ' + n.manual;
}

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export default function App() {
  const [notes, setNotes] = useState(() => load(NOTES_KEY, []));
  const [settings, setSettings] = useState(() => ({ translation: 'KRV', ...load(SETTINGS_KEY, {}) }));
  const [editingId, setEditingId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => save(NOTES_KEY, notes), 300);
    return () => clearTimeout(t);
  }, [notes]);
  useEffect(() => save(SETTINGS_KEY, settings), [settings]);

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
  function deleteNote(id) {
    if (!window.confirm('이 노트를 삭제할까요? 되돌릴 수 없어요.')) return;
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
        />
      ) : (
        <List
          notes={notes}
          onOpen={setEditingId}
          onCreate={createNote}
          onSettings={() => setShowSettings(true)}
        />
      )}
      {showSettings && (
        <Settings
          settings={settings}
          setSettings={setSettings}
          notes={notes}
          setNotes={setNotes}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

/* ───────────── 목록 + 검색 ───────────── */

function List({ notes, onOpen, onCreate, onSettings }) {
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
        n.title,
        n.refLabel,
        n.ref,
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
        <h1>설교 노트</h1>
        <button className="icon-btn" onClick={onSettings} aria-label="설정">
          ⚙︎
        </button>
      </header>

      <div className="searchbox">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="날짜 · 제목 · 말씀 · 내용으로 찾기"
        />
        <label className="datepick" title="날짜로 찾기">
          📅
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </label>
      </div>

      {months.length > 0 && (
        <div className="chips">
          <button className={month === 'all' ? 'chip on' : 'chip'} onClick={() => setMonth('all')}>
            전체
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
          {dateLabel(dateFilter)} 필터 해제 ✕
        </button>
      )}

      {notes.length === 0 ? (
        <div className="empty">
          <p>아직 노트가 없어요.</p>
          <p className="sub">아래 + 버튼으로 오늘 설교를 시작해 보세요.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <p>찾는 노트가 없어요.</p>
        </div>
      ) : (
        <ul className="notelist">
          {filtered.map((n) => (
            <li key={n.id}>
              <button className="card" onClick={() => onOpen(n.id)}>
                <div className="card-date">{dateLabel(n.date)}</div>
                <div className="card-title">{n.title || '(제목 없음)'}</div>
                {n.refLabel && <div className="card-ref">{n.refLabel}</div>}
                {n.body.trim() && <div className="card-snip">{n.body.trim().slice(0, 80)}</div>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {filtering && filtered.length > 0 && <p className="count">{filtered.length}개의 노트</p>}

      <button className="fab" onClick={onCreate} aria-label="새 노트">
        ＋
      </button>
    </>
  );
}

/* ───────────── 노트 작성 ───────────── */

function Editor({ note, translation, onPatch, onBack, onDelete }) {
  const [refInput, setRefInput] = useState(note.ref);
  const [status, setStatus] = useState({ type: 'idle', msg: '' });
  const [listening, setListening] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [openPassage, setOpenPassage] = useState(true);
  const bodyRef = useRef(null);

  // 받아 적는 칸이 글 길이에 맞춰 늘어나게
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(220, el.scrollHeight) + 'px';
  }, [note.body]);

  async function lookup(text) {
    const input = (text ?? refInput).trim();
    const parsed = parseReference(input);
    if (parsed.error) {
      setStatus({ type: 'error', msg: parsed.error });
      return;
    }
    const label = formatReference(parsed);
    setRefInput(label);
    setStatus({ type: 'loading', msg: `${label} 찾는 중…` });
    try {
      const verses = await fetchPassage(parsed, translation);
      onPatch({ ref: label, refLabel: label, verses, translation, manual: '' });
      setStatus({ type: 'idle', msg: '' });
      setOpenPassage(true);
    } catch (e) {
      onPatch({ ref: label, refLabel: label });
      setStatus({
        type: 'error',
        msg: `본문을 불러오지 못했어요 (${e.message}). 아래 "직접 붙여넣기"로 넣을 수 있어요.`,
      });
      setShowManual(true);
    }
  }

  function startVoice() {
    if (!SR) {
      setStatus({ type: 'error', msg: '이 브라우저는 음성 인식을 지원하지 않아요. 키보드의 🎤 받아쓰기를 써 주세요.' });
      return;
    }
    const rec = new SR();
    rec.lang = 'ko-KR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      setStatus({
        type: 'error',
        msg: '음성 인식을 시작하지 못했어요. 키보드의 🎤 받아쓰기를 대신 써 보세요.',
      });
    };
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setRefInput(t);
      lookup(t);
    };
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  const hasPassage = note.verses.length > 0 || note.manual.trim();
  const multiChapter = note.verses.length > 0 && note.verses[0].c !== note.verses[note.verses.length - 1].c;

  return (
    <>
      <header className="topbar">
        <button className="back" onClick={onBack}>
          ‹ 목록
        </button>
        <span className="saved">자동 저장됨</span>
        <button className="icon-btn danger" onClick={onDelete} aria-label="삭제">
          🗑
        </button>
      </header>

      <div className="field">
        <label>날짜</label>
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
        <label>본문 말씀</label>
        <div className="row">
          <input
            type="text"
            value={refInput}
            onChange={(e) => setRefInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookup()}
            placeholder="예: 요한복음 3장 16절"
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
          />
          {SR && (
            <button className={listening ? 'mic on' : 'mic'} onClick={startVoice} aria-label="음성으로 입력">
              🎤
            </button>
          )}
          <button className="primary" onClick={() => lookup()} disabled={status.type === 'loading'}>
            찾기
          </button>
        </div>
        {status.msg && <p className={status.type === 'error' ? 'msg error' : 'msg'}>{status.msg}</p>}
      </div>

      <div className="field">
        <label>설교 제목</label>
        <input
          type="text"
          value={note.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder="주보에 적힌 제목"
        />
      </div>

      <section className="passage">
        <button className="passage-head" onClick={() => setOpenPassage(!openPassage)}>
          <span>{note.refLabel || '오늘의 말씀'}</span>
          <span className="tr">{note.translation && note.verses.length ? note.translation : ''}</span>
          <span className="chev">{openPassage ? '접기 ▲' : '펼치기 ▼'}</span>
        </button>
        {openPassage && (
          <div className="passage-body">
            {note.verses.length > 0 && (
              <p>
                {note.verses.map((v, i) => (
                  <span key={i}>
                    <sup>{multiChapter && (i === 0 || v.c !== note.verses[i - 1].c) ? `${v.c}:${v.v}` : v.v}</sup>
                    {v.text}{' '}
                  </span>
                ))}
              </p>
            )}
            {note.manual.trim() && !showManual && <p>{note.manual}</p>}
            {!hasPassage && <p className="placeholder">위에서 구절을 찾으면 본문이 여기에 나타나요.</p>}
            <button className="linkbtn" onClick={() => setShowManual(!showManual)}>
              {showManual ? '직접 붙여넣기 닫기' : '직접 붙여넣기'}
            </button>
            {showManual && (
              <textarea
                className="manual"
                value={note.manual}
                onChange={(e) => onPatch({ manual: e.target.value })}
                placeholder="다른 성경앱에서 복사한 본문을 여기에 붙여넣어요"
                rows={5}
              />
            )}
          </div>
        )}
      </section>

      <div className="field">
        <label>받아 적기</label>
        <textarea
          ref={bodyRef}
          className="body"
          value={note.body}
          onChange={(e) => onPatch({ body: e.target.value })}
          placeholder="말씀을 들으며 감동받은 부분, 요점을 적어 보세요"
        />
      </div>
    </>
  );
}

/* ───────────── 설정 / 백업 ───────────── */

function Settings({ settings, setSettings, notes, setNotes, onClose }) {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState('');

  function exportAll() {
    const blob = new Blob([JSON.stringify({ app: 'sermon-notes', notes }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sermon-notes-${todayStr()}.json`;
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
        const add = incoming.filter((n) => n && n.id && n.date && !have.has(n.id));
        setNotes((prev) => [...prev, ...add]);
        setMsg(`${add.length}개의 노트를 가져왔어요.`);
      } catch {
        setMsg('파일을 읽지 못했어요.');
      }
    };
    reader.readAsText(f);
    e.target.value = '';
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>설정</h2>

        <div className="field">
          <label>성경 번역 코드</label>
          <input
            type="text"
            value={settings.translation}
            onChange={(e) => setSettings({ ...settings, translation: e.target.value.trim() })}
            autoCapitalize="characters"
            autoCorrect="off"
          />
          <p className="msg">기본값 KRV(개역한글). 본문이 안 나오면 다른 코드로 바꿔 보세요.</p>
        </div>

        <div className="field">
          <label>백업</label>
          <div className="row">
            <button onClick={exportAll}>내보내기</button>
            <button onClick={() => fileRef.current.click()}>가져오기</button>
            <input ref={fileRef} type="file" accept="application/json" onChange={importAll} hidden />
          </div>
          <p className="msg">노트는 이 기기에만 저장돼요. 가끔 내보내기로 백업해 두면 안전해요.</p>
          {msg && <p className="msg">{msg}</p>}
        </div>

        <button className="primary wide" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
