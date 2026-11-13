/**
 * @file 키보드 조작 도우미 (keyboard.ts)
 *
 * 이 파일이 하는 일
 *   옛 DOS 프로그램처럼 방향키·Esc로 화면을 다루는 기능들이 함께 쓰는 "판단 함수"를 모아 둬요.
 *     - 이 키 누름을 우리가 처리해도 될까? (isPlainKeyPress)
 *     - 지금 초점이 있는 곳이 키를 스스로 쓰는 곳일까? (keepsOwnKeys)
 *
 * 왜 이런 판단이 필요할까요?
 *   방향키와 Esc는 원래 브라우저와 입력란이 쓰는 키예요.
 *     - 검색창에서 ◀ ▶는 글자 사이를 오가고, 라디오 단추에서 ▲ ▼는 다른 항목을 골라요.
 *     - Alt + ◀는 "뒤로 가기", Shift + 방향키는 "글자 선택"이에요.
 *     - 한글을 조합하는 중(ㅎ → 하 → 한)에 누른 키는 입력기(IME)가 먼저 써요.
 *   이런 때까지 우리가 키를 가로채면 원래 기능이 망가져요. 그래서 "우리 차례일 때만" 처리합니다.
 *
 * 누가 쓰나요?
 *   components/use-list-keys.ts(목록의 ▲ ▼), components/review-keys.tsx(상세의 ◀ ▶ Esc),
 *   components/keyboard-help.tsx(Esc로 안내 닫기)
 */

/**
 * 우리가 처리해도 되는 "그냥 누른 키"인지 알려 줘요.
 *
 * 이런 때는 false(처리하지 않음)예요.
 *   - defaultPrevented: 다른 코드가 이미 이 키를 처리했어요(preventDefault를 불렀어요).
 *   - isComposing: 한글처럼 글자를 조합하는 중이에요.
 *   - Alt·Ctrl·Shift·⌘(meta)를 함께 눌렀어요. 브라우저와 운영체제의 단축키라서 건드리지 않아요.
 *
 * @param event 키보드 이벤트
 * @example
 * document.addEventListener("keydown", (event) => {
 *   if (!isPlainKeyPress(event)) return; // 우리 차례가 아니면 아무것도 하지 않아요.
 * });
 */
export function isPlainKeyPress(event: KeyboardEvent): boolean {
  return !event.defaultPrevented && !event.isComposing && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}

/**
 * 방향키·Esc를 스스로 쓰는 요소들(CSS 선택자)
 *
 * - input, textarea, select: 입력란, 글상자, 고르기 상자. 라디오 단추(input type="radio")도 여기에 들어가요.
 * - [contenteditable]: 글을 고칠 수 있게 열어 둔 영역
 * - .table-scroll: 본문의 넓은 표를 감싼 가로 스크롤 상자(lib/markdown.ts). ◀ ▶로 표를 옆으로 밀어 봐요.
 * - dialog: 화면 위에 뜬 창(사진 크게 보기 등). Esc는 그 창을 닫는 데 써야 해요(목록으로 가면 안 돼요).
 */
const OWN_KEYS_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), .table-scroll, dialog';

/**
 * 키를 받은 곳(target)이 방향키·Esc를 스스로 쓰는 요소이거나 그 안쪽인지 알려 줘요.
 *
 * closest(선택자): 자기 자신부터 부모 쪽으로 올라가며 선택자에 맞는 첫 요소를 찾아요. 없으면 null이에요.
 *
 * @param target 키보드 이벤트가 일어난 곳(event.target)
 * @returns 스스로 쓰는 곳이면 true(우리는 손대지 않아요)
 */
export function keepsOwnKeys(target: EventTarget | null): boolean {
  // target이 화면의 요소(Element)가 아닐 수도 있어서 먼저 확인해요. (예: window, document)
  if (!(target instanceof Element)) return false;
  return target.closest(OWN_KEYS_SELECTOR) !== null;
}
