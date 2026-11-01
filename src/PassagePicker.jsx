import React, { useMemo, useState } from 'react';
import { BOOKS, CHAPTERS, parseReference, formatReference, suggestBooks, fetchChapter, fetchPassage } from './bible';

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const bookName = (id) => BOOKS[id - 1][1];
const OT = BOOKS.filter(([id]) => id <= 39);
const NT = BOOKS.filter(([id]) => id > 39);

// 말씀 고르기: ① 글자 입력(자동완성) ② 구약/신약 목록 ③ 책 → 장 → 절 탭
export default function PassagePicker({ translation, pinned, onPin, onManual, onClose }) {
  const [input, setInput] = useState('');
  const [book, setBook] = useState(null);
  const [chapter, setChapter] = useState(null);
  const [verses, setVerses] = useState([]);
  const [sel, setSel] = useState(null); // { a, b } 선택된 절 범위
  const [testament, setTestament] = useState(null); // null | 'ot' | 'nt'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);

  const hasDigit = /\d/.test(input);
  const parsed = useMemo(() => (hasDigit ? parseReference(input) : null), [input, hasDigit]);
  const books = useMemo(() => (hasDigit ? [] : suggestBooks(input)), [input, hasDigit]);

  function pinVerses(label, rows) {
    if (pinned.includes(label)) {
      setError(`${label}은(는) 이미 붙어 있어요.`);
      return;
    }
    onPin({ refLabel: label, verses: rows, translation });
  }

  async function openChapter(b, c) {
    setError('');
    setBook(b);
    setChapter(c);
    setSel(null);
    setVerses([]);
    setBusy(true);
    try {
      setVerses(await fetchChapter(b, c, translation));
    } catch (e) {
      setError(`본문을 불러오지 못했어요 (${e.message}).`);
    } finally {
      setBusy(false);
    }
  }

  function choose(id) {
    setError('');
    setInput('');
    setTestament(null);
    if (CHAPTERS[id - 1] === 1) openChapter(id, 1);
    else setBook(id);
  }

  async function submit(text) {
    const t = (text ?? input).trim();
    setError('');
    if (!t) return;
    if (!/\d/.test(t)) {
      const ids = suggestBooks(t);
      if (ids.length === 1) choose(ids[0]);
      else setError(ids.length ? '아래 목록에서 책을 눌러 주세요.' : '책 이름을 찾지 못했어요. 예: 마, 마태복음, 롬');
      return;
    }
    const p = parseReference(t);
    if (p.error) {
      setError(p.error);
      return;
    }
    if (p.v1 == null && p.c1 === p.c2) {
      setInput('');
      openChapter(p.book, p.c1);
      return;
    }
    setBusy(true);
    try {
      const rows = await fetchPassage(p, translation);
      pinVerses(formatReference(p), rows);
    } catch (e) {
      setError(`본문을 불러오지 못했어요 (${e.message}).`);
    } finally {
      setBusy(false);
    }
  }

  function startVoice() {
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'ko-KR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      setError('음성 인식을 시작하지 못했어요. 키보드의 🎤 받아쓰기를 써 보세요.');
    };
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setInput(t);
      submit(t);
    };
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  // 절을 누를 때마다 범위가 자연스럽게 늘어나고 줄어듦
  function tapVerse(v) {
    setSel((s) => {
      if (!s) return { a: v, b: v }; // 처음 누른 절
      if (v < s.a) return { a: v, b: s.b }; // 앞쪽 절 → 시작을 넓힘
      if (v > s.b) return { a: s.a, b: v }; // 뒤쪽 절 → 끝을 넓힘
      if (s.a === s.b) return null; // 한 절만 골라 둔 상태에서 같은 절 → 해제
      if (v === s.a) return { a: s.a + 1, b: s.b }; // 시작 절을 누르면 그 절만 빠짐
      if (v === s.b) return { a: s.a, b: s.b - 1 }; // 끝 절을 누르면 그 절만 빠짐
      // 범위 안쪽 절 → 가까운 쪽 끝을 그 절까지 줄임
      return v - s.a <= s.b - v ? { a: v, b: s.b } : { a: s.a, b: v };
    });
  }

  /* ── 절 고르기 ── */
  if (chapter != null) {
    const unit = book === 19 ? '편' : '장';
    const ref = (v1, v2) => ({ book, bookName: bookName(book), c1: chapter, c2: chapter, v1, v2 });
    const selLabel = sel ? formatReference(ref(sel.a, sel.b)) : '';
    return (
      <div className="picker">
        <div className="picker-head">
          <button
            className="back"
            onClick={() => {
              setChapter(null);
              setSel(null);
              setError('');
              if (CHAPTERS[book - 1] === 1) setBook(null);
            }}
          >
            ‹ {CHAPTERS[book - 1] === 1 ? '책 선택' : '장 선택'}
          </button>
          <strong>
            {bookName(book)} {CHAPTERS[book - 1] === 1 ? '' : `${chapter}${unit}`}
          </strong>
          <button className="linkbtn" onClick={onClose}>
            닫기
          </button>
        </div>
        {busy && <p className="msg">불러오는 중…</p>}
        {error && (
          <>
            <p className="msg error">{error}</p>
            <div className="row">
              <button onClick={() => openChapter(book, chapter)}>다시 시도</button>
              <button onClick={() => onManual(`${bookName(book)} ${chapter}`)}>직접 붙여넣기</button>
            </div>
          </>
        )}
        {verses.length > 0 && (
          <>
            <p className="msg">
              {sel
                ? sel.a === sel.b
                  ? `${sel.a}절 선택됨 — 다른 절을 누르면 범위가 넓어져요`
                  : `${sel.a}~${sel.b}절 선택됨 — 바깥 절을 누르면 늘어나고, 양쪽 끝 절을 누르면 줄어요`
                : '시작 절을 누르고, 여러 절이면 끝 절도 눌러 주세요'}
              {sel && (
                <button className="linkbtn inline" onClick={() => setSel(null)}>
                  선택 해제
                </button>
              )}
            </p>
            <ul className="verselist">
              {verses.map((r) => (
                <li key={r.v}>
                  <button
                    className={sel && r.v >= sel.a && r.v <= sel.b ? 'verse in' : 'verse'}
                    onClick={() => tapVerse(r.v)}
                  >
                    <span className="vn">{r.v}</span>
                    <span>{r.text}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="pickbar">
              <button
                className="primary"
                disabled={!sel}
                onClick={() => pinVerses(selLabel, verses.filter((r) => r.v >= sel.a && r.v <= sel.b))}
              >
                {sel ? `📌 ${selLabel} 붙이기` : '절을 선택해 주세요'}
              </button>
              <button onClick={() => pinVerses(formatReference(ref(null, null)), verses)}>
                {unit} 전체
              </button>
            </div>
            {error && !busy && null}
          </>
        )}
      </div>
    );
  }

  /* ── 장 고르기 ── */
  if (book != null) {
    const unit = book === 19 ? '편' : '장';
    return (
      <div className="picker">
        <div className="picker-head">
          <button className="back" onClick={() => setBook(null)}>
            ‹ 책 선택
          </button>
          <strong>{bookName(book)}</strong>
          <button className="linkbtn" onClick={onClose}>
            닫기
          </button>
        </div>
        <p className="msg">몇 {unit}인가요?</p>
        <div className="numgrid">
          {Array.from({ length: CHAPTERS[book - 1] }, (_, i) => (
            <button key={i} onClick={() => openChapter(book, i + 1)}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── 책 고르기 / 직접 입력 ── */
  const list = testament === 'ot' ? OT : testament === 'nt' ? NT : null;
  return (
    <div className="picker">
      <div className="row">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="책 이름 앞글자 (예: 마)  또는  요 3:16"
          enterKeyHint="search"
          autoCapitalize="off"
          autoCorrect="off"
        />
        {SR && (
          <button className={listening ? 'mic on' : 'mic'} onClick={startVoice} aria-label="음성으로 입력">
            🎤
          </button>
        )}
        <button className="primary" onClick={() => submit()} disabled={busy}>
          찾기
        </button>
      </div>

      {books.length > 0 && (
        <div className="suggs">
          {books.map((id) => (
            <button key={id} className="sugg" onClick={() => choose(id)}>
              {bookName(id)}
            </button>
          ))}
        </div>
      )}
      {parsed && !parsed.error && (
        <button className="sugg wide" onClick={() => submit()} disabled={busy}>
          {parsed.v1 == null && parsed.c1 === parsed.c2
            ? `${formatReference(parsed)} — 절 고르기 ›`
            : `📌 ${formatReference(parsed)} 바로 붙이기`}
        </button>
      )}
      {error && <p className="msg error">{error}</p>}
      {busy && <p className="msg">찾는 중…</p>}

      {!input && (
        <>
          <div className="row">
            <button onClick={() => setTestament(testament === 'ot' ? null : 'ot')}>구약 39권</button>
            <button onClick={() => setTestament(testament === 'nt' ? null : 'nt')}>신약 27권</button>
          </div>
          {list && (
            <div className="booksgrid">
              {list.map(([id, name]) => (
                <button key={id} onClick={() => choose(id)}>
                  {name}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div className="row picker-foot">
        <button className="linkbtn" onClick={onClose}>
          닫기
        </button>
        <button className="linkbtn" onClick={() => onManual(input.trim())}>
          직접 붙여넣기
        </button>
      </div>
    </div>
  );
}
