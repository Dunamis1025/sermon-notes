// 화면 언어 (한국어 / English)
// t('한국어 문구') → 영어일 때는 아래 EN 표에서 찾아 바꿔 줌. 표에 없으면 한국어 그대로.
// 문구 안의 {이름}은 t('...', { 이름: 값 })으로 채움.
let lang = 'ko';
export const setLang = (l) => {
  lang = l === 'en' ? 'en' : 'ko';
};
export const getLang = () => lang;
export const locale = () => (lang === 'en' ? 'en-AU' : 'ko-KR');

export function detectLang() {
  try {
    return String(navigator.language || 'ko').toLowerCase().startsWith('ko') ? 'ko' : 'en';
  } catch {
    return 'ko';
  }
}

const EN = {
  // 목록
  '설교 노트': 'Sermon Notes',
  '설정': 'Settings',
  '날짜 · 제목 · 말씀 · 내용으로 찾기': 'Search by date, title, passage or notes',
  '날짜로 찾기': 'Find by date',
  '전체': 'All',
  '{d} 필터 해제 ✕': 'Clear {d} filter ✕',
  '아직 노트가 없어요.': 'No notes yet.',
  '아래 + 버튼으로 오늘 설교를 시작해 보세요.': "Tap + below to start today's sermon.",
  '찾는 노트가 없어요.': 'No matching notes.',
  '{n}개의 노트': '{n} notes',
  '노트를 왼쪽으로 밀면 삭제할 수 있어요': 'Swipe a note left to delete it',
  '새 노트': 'New note',
  '삭제': 'Delete',
  '취소': 'Cancel',
  '(제목 없음)': '(Untitled)',
  // 노트
  '‹ 목록': '‹ Notes',
  '✓ 저장됨': '✓ Saved',
  '저장 중…': 'Saving…',
  '⚠ 저장 실패': '⚠ Save failed',
  '저장': 'Save',
  '날짜': 'Date',
  '설교 제목': 'Sermon title',
  '주보에 적힌 제목': 'Title from the bulletin',
  '본문 말씀': 'Scripture',
  '접기 ▲': 'Collapse ▲',
  '펼치기 ▼': 'Expand ▼',
  '이 말씀 떼기': 'Remove this passage',
  '말씀 이름 (예: 히브리서 12:2)': 'Passage name (e.g. Hebrews 12:2)',
  '다른 성경앱에서 복사한 본문을 여기에 붙여넣어요': 'Paste text copied from another Bible app',
  '말씀 붙이기': 'Add passage',
  '＋ 말씀 붙이기': '＋ Add passage',
  '＋ 말씀 더 붙이기': '＋ Add another passage',
  '직접 붙여넣기': 'Paste text',
  '받아 적기': 'Notes',
  '말씀을 들으며 감동받은 부분, 요점을 적어 보세요': 'Write down key points and what moved you',
  '말씀': 'Passage',
  '직접 입력': 'Custom',
  '✓ 저장했어요': '✓ Saved',
  '저장하지 못했어요. 기기 저장 공간을 확인해 주세요': "Couldn't save. Please check the device storage.",
  '이 노트를 삭제할까요? 되돌릴 수 없어요.': 'Delete this note? This cannot be undone.',
  '"{label}" 말씀을 이 노트에서 뗄까요?': 'Remove "{label}" from this note?',
  '장': 'chapter',
  '편': 'psalm',
  // 설정
  '화면 분위기': 'Theme',
  '산뜻': 'Fresh',
  '맑은 하늘색': 'Clear sky blue',
  '시크': 'Chic',
  '차분한 흑백': 'Calm monochrome',
  '따뜻': 'Warm',
  '포근한 크림색': 'Cozy cream',
  '화면 언어': 'Language',
  '성경 번역': 'Bible translation',
  '새로 붙이는 말씀부터 선택한 번역으로 가져와요. 이미 붙인 말씀은 그대로예요. 다른 번역을 쓰려면 아래에 코드를 직접 입력하세요.':
    'New passages use the selected translation. Passages already added stay as they are. For another translation, type its code below.',
  '한국어 (개역한글)': 'Korean (KRV)',
  '백업': 'Backup',
  '내보내기': 'Export',
  '가져오기': 'Import',
  '노트는 이 기기에만 저장돼요. 가끔 내보내기로 백업해 두면 안전해요.': 'Notes are stored on this device only. Export a backup now and then to be safe.',
  '닫기': 'Close',
  '설교 노트 백업': 'Sermon Notes backup',
  '{n}개의 노트를 가져왔어요.': 'Imported {n} notes.',
  '파일을 읽지 못했어요.': "Couldn't read the file.",
  // 말씀 고르기
  '‹ 책 선택': '‹ Books',
  '‹ 장 선택': '‹ Chapters',
  '불러오는 중…': 'Loading…',
  '다시 시도': 'Try again',
  '찾는 중…': 'Searching…',
  '{label}은(는) 이미 붙어 있어요.': '{label} is already added.',
  '본문을 불러오지 못했어요 ({m}).': "Couldn't load the text ({m}).",
  '아래 목록에서 책을 눌러 주세요.': 'Pick a book from the list below.',
  '책 이름을 찾지 못했어요. 예: 마, 마태복음, 롬': "Book not found. e.g. Mt, Matthew, Rom",
  '음성 인식을 시작하지 못했어요. 키보드의 🎤 받아쓰기를 써 보세요.': "Couldn't start voice input. Try the keyboard's 🎤 dictation.",
  '{v}절 선택됨 — 누르면 선택/해제, 떨어진 절도 고를 수 있어요': 'Selected: {v} — tap to select/deselect; non-adjacent verses are fine',
  '시작 절을 누르고, 여러 절이면 끝 절도 눌러 주세요': 'Tap the verses you want',
  '선택 해제': 'Clear selection',
  '📌 {l} 붙이기': '📌 Add {l}',
  '절을 선택해 주세요': 'Select verses',
  '{u} 전체': 'Whole {u}',
  '몇 {u}인가요?': 'Which {u}?',
  '책 이름 앞글자 (예: 마)  또는  요 3:16': 'Book name (e.g. Mat) or John 3:16',
  '음성으로 입력': 'Voice input',
  '찾기': 'Find',
  '{l} — 절 고르기 ›': '{l} — choose verses ›',
  '📌 {l} 바로 붙이기': '📌 Add {l} now',
  '구약 39권': 'Old Testament (39)',
  '신약 27권': 'New Testament (27)',
  // 동기화
  '기기 간 동기화': 'Sync between devices',
  '확인 중…': 'Checking…',
  '아이폰·아이패드에 같은 계정으로 로그인하면 노트가 자동으로 맞춰져요.': 'Sign in with the same account on each device and your notes stay in sync.',
  '이메일': 'Email',
  '비밀번호 (6자 이상)': 'Password (6+ characters)',
  '로그인': 'Sign in',
  '새 계정 만들기': 'Create account',
  '비밀번호를 잊었어요': 'Forgot password',
  '비밀번호 재설정 메일을 보냈어요. 메일함을 확인해 주세요.': 'Password reset email sent. Please check your inbox.',
  '지금 동기화': 'Sync now',
  '로그아웃': 'Sign out',
  '로그아웃해도 이 기기의 노트는 그대로 남아요.': 'Your notes stay on this device after signing out.',
  '이메일이나 비밀번호가 맞지 않아요.': 'Incorrect email or password.',
  '이메일 모양이 올바르지 않아요.': 'That email address looks invalid.',
  '이미 가입된 이메일이에요. 로그인을 눌러 주세요.': 'That email is already registered. Tap Sign in.',
  '비밀번호는 6자 이상이어야 해요.': 'Password must be at least 6 characters.',
  '비밀번호를 입력해 주세요.': 'Please enter a password.',
  '인터넷 연결을 확인해 주세요.': 'Please check your internet connection.',
  '시도가 너무 많아요. 잠시 뒤에 다시 해 주세요.': 'Too many attempts. Please try again shortly.',
  '지금은 새 계정을 만들 수 없어요.': 'New accounts cannot be created right now.',
  '실패했어요 ({m})': 'Failed ({m})',
  '연결 중…': 'Connecting…',
  '동기화 중…': 'Syncing…',
  '✓ 동기화됨': '✓ Synced',
  '오프라인 — 인터넷이 연결되면 자동으로 올라가요': 'Offline — will sync automatically when connected',
  '⚠ 동기화 오류': '⚠ Sync error',
  // 성경 검색 오류
  '말씀 구절을 입력해 주세요. 예: 요한복음 3:16': 'Please enter a passage, e.g. John 3:16',
  '책 이름을 찾지 못했어요. 예: 요한복음, 요, 롬, 시편': 'Book not found. e.g. John, Rom, Psalms',
  '장과 절을 이해하지 못했어요. 예: 요한복음 3장 16절': "Couldn't understand the chapter and verse. e.g. John 3:16",
  '{b}은(는) {n}{u}까지 있어요.': '{b} has only {n} {u}.',
  '범위가 거꾸로 되어 있어요. 시작이 끝보다 앞이어야 해요.': 'The range is backwards. The start must come before the end.',
  '한 번에 10장까지만 찾을 수 있어요.': 'You can look up at most 10 chapters at once.',
  '해당 구절을 찾지 못했어요. 장·절 번호를 확인해 주세요.': "Couldn't find that passage. Please check the chapter and verse.",
  '서버 응답 오류 ({s})': 'Server error ({s})',
  '본문 형식이 달라요': 'Unexpected text format',
  '해당 장을 찾지 못했어요': "Couldn't find that chapter",
  '시간이 너무 오래 걸려요. 인터넷을 확인해 주세요.': 'Taking too long. Please check your internet.',
  '인터넷 연결을 확인해 주세요': 'Please check your internet connection',
};

export function t(ko, vars) {
  let s = lang === 'en' && EN[ko] !== undefined ? EN[ko] : ko;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return s;
}
