// 성경 구절 파싱 + 본문 가져오기
// - "요한복음 3장 16절", "요 3:16-21", "시편 23편", "롬 8:28~30" 같은 입력을 이해함
// - 음성 인식 결과("요한복음 3장 16절부터 21절까지")도 처리
// - 본문은 Bolls Life 무료 API에서 가져옴 (책 번호 1~66 = 창세기~요한계시록)

export const BOOKS = [
  [1, '창세기', ['창']],
  [2, '출애굽기', ['출']],
  [3, '레위기', ['레']],
  [4, '민수기', ['민']],
  [5, '신명기', ['신']],
  [6, '여호수아', ['수']],
  [7, '사사기', ['삿']],
  [8, '룻기', ['룻']],
  [9, '사무엘상', ['삼상']],
  [10, '사무엘하', ['삼하']],
  [11, '열왕기상', ['왕상']],
  [12, '열왕기하', ['왕하']],
  [13, '역대상', ['대상']],
  [14, '역대하', ['대하']],
  [15, '에스라', ['스']],
  [16, '느헤미야', ['느']],
  [17, '에스더', ['에']],
  [18, '욥기', ['욥']],
  [19, '시편', ['시']],
  [20, '잠언', ['잠']],
  [21, '전도서', ['전']],
  [22, '아가', ['아']],
  [23, '이사야', ['사']],
  [24, '예레미야', ['렘']],
  [25, '예레미야애가', ['애']],
  [26, '에스겔', ['겔']],
  [27, '다니엘', ['단']],
  [28, '호세아', ['호']],
  [29, '요엘', ['욜']],
  [30, '아모스', ['암']],
  [31, '오바댜', ['옵']],
  [32, '요나', ['욘']],
  [33, '미가', ['미']],
  [34, '나훔', ['나']],
  [35, '하박국', ['합']],
  [36, '스바냐', ['습']],
  [37, '학개', ['학']],
  [38, '스가랴', ['슥']],
  [39, '말라기', ['말']],
  [40, '마태복음', ['마']],
  [41, '마가복음', ['막']],
  [42, '누가복음', ['눅']],
  [43, '요한복음', ['요']],
  [44, '사도행전', ['행']],
  [45, '로마서', ['롬']],
  [46, '고린도전서', ['고전']],
  [47, '고린도후서', ['고후']],
  [48, '갈라디아서', ['갈']],
  [49, '에베소서', ['엡']],
  [50, '빌립보서', ['빌']],
  [51, '골로새서', ['골']],
  [52, '데살로니가전서', ['살전']],
  [53, '데살로니가후서', ['살후']],
  [54, '디모데전서', ['딤전']],
  [55, '디모데후서', ['딤후']],
  [56, '디도서', ['딛']],
  [57, '빌레몬서', ['몬']],
  [58, '히브리서', ['히']],
  [59, '야고보서', ['약']],
  [60, '베드로전서', ['벧전']],
  [61, '베드로후서', ['벧후']],
  [62, '요한일서', ['요일', '요한1서']],
  [63, '요한이서', ['요이', '요한2서']],
  [64, '요한삼서', ['요삼', '요한3서']],
  [65, '유다서', ['유']],
  [66, '요한계시록', ['계', '계시록']],
];

// 장이 하나뿐인 책 (오바댜, 빌레몬서, 요한이서, 요한삼서, 유다서)
const SINGLE_CHAPTER = new Set([31, 57, 63, 64, 65]);

// 책별 장 수 (창세기 ~ 요한계시록)
export const CHAPTERS = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9,
  1, 4, 7, 3, 3, 3, 2, 14, 4, 28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22,
];

// 자동완성: 앞글자가 이름·약어와 맞는 책 번호들 (성경 순서, 최대 8개)
export function suggestBooks(q) {
  const s = (q || '').replace(/\s+/g, '');
  if (!s) return [];
  const exact = []; // 약어·이름이 정확히 같은 책 (예: 요 → 요한복음)
  const prefix = [];
  for (const [id, name, abbrs] of BOOKS) {
    const keys = [name, ...abbrs];
    const m = name.match(/^(.{2,})(복음|서|기)$/);
    if (m) keys.push(m[1]);
    if (keys.includes(s)) exact.push(id);
    else if (keys.some((k) => k.startsWith(s))) prefix.push(id);
  }
  return [...exact, ...prefix].slice(0, 8);
}

// 별칭 목록 만들기: 정식 이름 + 약어 + "서/복음/기"를 뗀 형태 (예: 로마, 요한, 마태)
const ALIASES = (() => {
  const list = [];
  for (const [id, name, abbrs] of BOOKS) {
    const names = new Set([name, ...abbrs]);
    const m = name.match(/^(.{2,})(복음|서|기)$/);
    if (m) names.add(m[1]);
    for (const n of names) list.push([n, id]);
  }
  // 많이 쓰는 표기 추가
  list.push(['열왕기상', 11], ['열왕기하', 12], ['데살로니가전', 52], ['데살로니가후', 53]);
  list.push(['요한1서', 62], ['요한2서', 63], ['요한3서', 64], ['요한일서', 62], ['요한이서', 63], ['요한삼서', 64]);
  list.sort((a, b) => b[0].length - a[0].length); // 긴 이름부터 맞춰봄
  return list;
})();

const BOOK_NAME = Object.fromEntries(BOOKS.map(([id, name]) => [id, name]));

// 입력 문자열 앞부분이 alias와 맞으면 소비한 글자 수를 돌려줌 (공백은 건너뜀)
function consumeAlias(s, alias) {
  let i = 0;
  for (const ch of alias) {
    while (s[i] === ' ') i++;
    if (s[i] !== ch) return -1;
    i++;
  }
  return i;
}

export function parseReference(input) {
  const s = (input || '').trim();
  if (!s) return { error: '말씀 구절을 입력해 주세요. 예: 요한복음 3:16' };

  let bookId = null;
  let used = 0;
  for (const [alias, id] of ALIASES) {
    const n = consumeAlias(s, alias);
    if (n > 0) {
      bookId = id;
      used = n;
      break;
    }
  }
  if (!bookId) return { error: '책 이름을 찾지 못했어요. 예: 요한복음, 요, 롬, 시편' };

  let r = s
    .slice(used)
    .replace(/(\d)\.(\d)/g, '$1:$2') // 3.16 → 3:16
    .replace(/[~〜–—－]/g, '-')
    .replace(/부터|에서/g, '-')
    .replace(/까지/g, '')
    .replace(/\s*-\s*/g, '-')
    .replace(/장|편/g, ':')
    .replace(/절/g, '')
    .replace(/:\s+/g, ':')
    .replace(/\s+/g, ' ')
    .trim();

  let c1, v1, c2, v2;
  let m;
  if (SINGLE_CHAPTER.has(bookId) && (m = r.match(/^(\d+)(?:-(\d+))?$/))) {
    c1 = c2 = 1;
    v1 = +m[1];
    v2 = m[2] ? +m[2] : v1;
  } else if ((m = r.match(/^(\d+):?$/))) {
    c1 = c2 = +m[1];
    v1 = v2 = null; // 장 전체
  } else if ((m = r.match(/^(\d+):(\d+)$/))) {
    c1 = c2 = +m[1];
    v1 = v2 = +m[2];
  } else if ((m = r.match(/^(\d+):(\d+)-(\d+)$/))) {
    c1 = c2 = +m[1];
    v1 = +m[2];
    v2 = +m[3];
  } else if ((m = r.match(/^(\d+):(\d+)-(\d+):(\d+)$/))) {
    c1 = +m[1];
    v1 = +m[2];
    c2 = +m[3];
    v2 = +m[4];
  } else if ((m = r.match(/^(\d+)-(\d+):?$/))) {
    c1 = +m[1];
    c2 = +m[2];
    v1 = v2 = null; // 여러 장 전체
  } else if ((m = r.match(/^(\d+) (\d+)(?:-(\d+))?$/))) {
    c1 = c2 = +m[1];
    v1 = +m[2];
    v2 = m[3] ? +m[3] : v1;
  } else if (SINGLE_CHAPTER.has(bookId) && r === '') {
    c1 = c2 = 1;
    v1 = v2 = null;
  } else {
    return { error: '장과 절을 이해하지 못했어요. 예: 요한복음 3장 16절' };
  }

  const maxC = CHAPTERS[bookId - 1];
  if (c1 < 1 || c2 > maxC) {
    return { error: `${BOOK_NAME[bookId]}은(는) ${maxC}${bookId === 19 ? '편' : '장'}까지 있어요.` };
  }
  if (c2 < c1 || (c1 === c2 && v1 != null && v2 < v1)) {
    return { error: '범위가 거꾸로 되어 있어요. 시작이 끝보다 앞이어야 해요.' };
  }
  if (c2 - c1 > 9) return { error: '한 번에 10장까지만 찾을 수 있어요.' };

  return { book: bookId, bookName: BOOK_NAME[bookId], c1, v1, c2, v2 };
}

export function formatReference(p) {
  const name = p.bookName;
  const unit = p.book === 19 ? '편' : '장';
  if (p.v1 == null) {
    if (SINGLE_CHAPTER.has(p.book)) return name;
    return p.c1 === p.c2 ? `${name} ${p.c1}${unit}` : `${name} ${p.c1}-${p.c2}${unit}`;
  }
  if (SINGLE_CHAPTER.has(p.book)) {
    return p.v1 === p.v2 ? `${name} ${p.v1}절` : `${name} ${p.v1}-${p.v2}절`;
  }
  if (p.c1 === p.c2) {
    return p.v1 === p.v2 ? `${name} ${p.c1}:${p.v1}` : `${name} ${p.c1}:${p.v1}-${p.v2}`;
  }
  return `${name} ${p.c1}:${p.v1}-${p.c2}:${p.v2}`;
}

function cleanText(html) {
  return String(html || '')
    .replace(/<S>.*?<\/S>/gi, '') // 원어 번호 태그
    .replace(/<sup>.*?<\/sup>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// 한 장 가져오기: [{ c, v, text }] (한 번 받은 장은 기억해 둠)
const chapterCache = new Map();

export async function fetchChapter(book, chapter, translation) {
  const key = `${translation}/${book}/${chapter}`;
  if (chapterCache.has(key)) return chapterCache.get(key);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(`https://bolls.life/get-text/${encodeURIComponent(translation)}/${book}/${chapter}/`, {
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`서버 응답 오류 (${res.status})`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('본문 형식이 달라요');
    const rows = data.map((r) => ({ c: chapter, v: r.verse, text: cleanText(r.text) })).filter((r) => r.text);
    if (!rows.length) throw new Error('해당 장을 찾지 못했어요');
    chapterCache.set(key, rows);
    return rows;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('시간이 너무 오래 걸려요. 인터넷을 확인해 주세요.');
    if (e instanceof TypeError) throw new Error('인터넷 연결을 확인해 주세요');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// 구절(범위) 가져오기
export async function fetchPassage(p, translation) {
  const out = [];
  for (let c = p.c1; c <= p.c2; c++) {
    const rows = await fetchChapter(p.book, c, translation);
    for (const r of rows) {
      if (p.v1 != null) {
        if (c === p.c1 && r.v < p.v1) continue;
        if (c === p.c2 && r.v > p.v2) continue;
      }
      out.push(r);
    }
  }
  if (!out.length) throw new Error('해당 구절을 찾지 못했어요. 장·절 번호를 확인해 주세요.');
  return out;
}
