import React, { useMemo, useState } from 'react';
import { t, getLang } from './i18n';
import { BOOKS, CHAPTERS, bookDisplay, parseReference, formatReference, suggestBooks, fetchChapter, fetchPassage } from './bible';

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const bookName = (id) => bookDisplay(id);
const OT = BOOKS.filter(([id]) => id <= 39);
const NT = BOOKS.filter(([id]) => id > 39);

// 말씀 고르기: ① 글자 입력(자동완성) ② 구약/신약 목록 ③ 책 → 장 → 절 탭
const SINGLE = new Set([31, 57, 63, 64, 65]); // 장이 하나뿐인 책(오바댜·빌레몬서·요이·요삼·유다서)

export default function PassagePicker({ translation, pinned, onPin, onManual, onClose }) {
  const [input, setInput] = useState('');
  const [book, setBook] = useState(null);
  const [chapter, setChapter] = useState(null);
  const [verses, setVerses] = useState([]);
  const [sel, setSel] = useState([]); // 선택된 절 번호들(오름차순)
  const [testament, setTestament] = useState(null); // null | 'ot' | 'nt'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);

  const hasDigit = /\d/.test(input) && !/^\s*[123]\s*[a-z]+\s*$/i.test(input); // "1 jo"는 책 이름 입력으로 봄
  const parsed = useMemo(() => (hasDigit ? parseReference(input) : null), [input, hasDigit]);
  const books = useMemo(() => (hasDigit ? [] : suggestBooks(input)), [input, hasDigit]);

  function pinVerses(label, rows) {
    if (pinned.includes(label)) {
      setError(t('{label}은(는) 이미 붙어 있어요.', { label }));
      return;
    }
    onPin({ refLabel: label, verses: rows, translation });
  }

  async function openChapter(b, c) {
    setError('');
    setBook(b);
    setChapter(c);
    setSel([]);
    setVerses([]);
    setBusy(true);
    try {
      setVerses(await fetchChapter(b, c, translation));
    } catch (e) {
      setError(t('본문을 불러오지 못했어요 ({m}).', { m: e.message }));
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
      else setError(ids.length ? t('아래 목록에서 책을 눌러 주세요.') : t('책 이름을 찾지 못했어요. 예: 마, 마태복음, 롬'));
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
      setError(t('본문을 불러오지 못했어요 ({m}).', { m: e.message }));
    } finally {
      setBusy(false);
    }
  }

  function startVoice() {
    if (!SR) return;
    const rec = new SR();
    rec.lang = getLang() === 'en' ? 'en-US' : 'ko-KR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      setError(t('음성 인식을 시작하지 못했어요. 키보드의 🎤 받아쓰기를 써 보세요.'));
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

  // 절을 누르면 선택/해제 (떨어져 있는 절도 따로 고를 수 있음)
  function tapVerse(v) {
    setSel((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v].sort((x, y) => x - y)));
  }

  // 선택한 절을 이어진 덩어리로 묶음: [2,3,6] → [[2,3],[6,6]]
  function runsOf(list) {
    const runs = [];
    for (const v of list) {
      const last = runs[runs.length - 1];
      if (last && v === last[1] + 1) last[1] = v;
      else runs.push([v, v]);
    }
    return runs;
  }

  /* ── 절 고르기 ── */
  if (chapter != null) {
    const unit = t(book === 19 ? '편' : '장');
    const ref = (v1, v2) => ({ book, bookName: bookName(book), c1: chapter, c2: chapter, v1, v2 });
    const runs = runsOf(sel);
    const selLabel = runs.length
      ? runs.length === 1
        ? formatReference(ref(runs[0][0], runs[0][1]))
        : formatReference(ref(runs[0][0], runs[0][1])).replace(/절$/, '') +
          runs.slice(1).map(([x, y]) => (x === y ? `, ${x}` : `, ${x}-${y}`)).join('') +
          (SINGLE.has(book) && getLang() !== 'en' ? '절' : '')
      : '';
    return (
      <div className="picker">
        <div className="picker-head">
          <button
            className="back"
            onClick={() => {
              setChapter(null);
              setSel([]);
              setError('');
              if (CHAPTERS[book - 1] === 1) setBook(null);
            }}
          >
            ‹ {CHAPTERS[book - 1] === 1 ? t('‹ 책 선택').slice(2) : t('‹ 장 선택').slice(2)}
          </button>
          <strong>
            {bookName(book)} {CHAPTERS[book - 1] === 1 ? '' : `${chapter}${unit}`}
          </strong>
          <button className="linkbtn" onClick={onClose}>
            {t('닫기')}
          </button>
        </div>
        {busy && <p className="msg">{t('불러오는 중…')}</p>}
        {error && (
          <>
            <p className="msg error">{error}</p>
            <div className="row">
              <button onClick={() => openChapter(book, chapter)}>{t('다시 시도')}</button>
              <button onClick={() => onManual(`${bookName(book)} ${chapter}`)}>{t('직접 붙여넣기')}</button>
            </div>
          </>
        )}
        {verses.length > 0 && (
          <>
            <p className="msg">
              {sel.length
                ? t('{v}절 선택됨 — 누르면 선택/해제, 떨어진 절도 고를 수 있어요', { v: runs.map(([x, y]) => (x === y ? x : `${x}~${y}`)).join(', ') })
                : t('시작 절을 누르고, 여러 절이면 끝 절도 눌러 주세요')}
              {sel.length > 0 && (
                <button className="linkbtn inline" onClick={() => setSel([])}>
                  {t('선택 해제')}
                </button>
              )}
            </p>
            <ul className="verselist">
              {verses.map((r) => (
                <li key={r.v}>
                  <button
                    className={sel.includes(r.v) ? 'verse in' : 'verse'}
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
                disabled={!sel.length}
                onClick={() => pinVerses(selLabel, verses.filter((r) => sel.includes(r.v)))}
              >
                {sel.length ? t('📌 {l} 붙이기', { l: selLabel }) : t('절을 선택해 주세요')}
              </button>
              <button onClick={() => pinVerses(formatReference(ref(null, null)), verses)}>
                {t('{u} 전체', { u: unit })}
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
    const unit = t(book === 19 ? '편' : '장');
    return (
      <div className="picker">
        <div className="picker-head">
          <button className="back" onClick={() => setBook(null)}>
            {t('‹ 책 선택')}
          </button>
          <strong>{bookName(book)}</strong>
          <button className="linkbtn" onClick={onClose}>
            {t('닫기')}
          </button>
        </div>
        <p className="msg">{t('몇 {u}인가요?', { u: unit })}</p>
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
          placeholder={t('책 이름 앞글자 (예: 마)  또는  요 3:16')}
          enterKeyHint="search"
          autoCapitalize="off"
          autoCorrect="off"
        />
        {SR && (
          <button className={listening ? 'mic on' : 'mic'} onClick={startVoice} aria-label={t('음성으로 입력')}>
            🎤
          </button>
        )}
        <button className="primary" onClick={() => submit()} disabled={busy}>
          {t('찾기')}
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
            ? t('{l} — 절 고르기 ›', { l: formatReference(parsed) })
            : t('📌 {l} 바로 붙이기', { l: formatReference(parsed) })}
        </button>
      )}
      {error && <p className="msg error">{error}</p>}
      {busy && <p className="msg">{t('찾는 중…')}</p>}

      {!input && (
        <>
          <div className="row">
            <button onClick={() => setTestament(testament === 'ot' ? null : 'ot')}>{t('구약 39권')}</button>
            <button onClick={() => setTestament(testament === 'nt' ? null : 'nt')}>{t('신약 27권')}</button>
          </div>
          {list && (
            <div className="booksgrid">
              {list.map(([id]) => (
                <button key={id} onClick={() => choose(id)}>
                  {bookName(id)}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div className="row picker-foot">
        <button className="linkbtn" onClick={onClose}>
          {t('닫기')}
        </button>
        <button className="linkbtn" onClick={() => onManual(input.trim())}>
          {t('직접 붙여넣기')}
        </button>
      </div>
    </div>
  );
}
