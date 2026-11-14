/**
 * @file 키보드 조작 안내 (keyboard-help.tsx)
 *
 * 이 파일이 하는 일
 *   화면 왼쪽 아래에 "키보드 조작" 단추를 띄우고, 누르면 지금 화면에서 쓸 수 있는 키를 위쪽으로 펼쳐 보여 줘요.
 *   옛 DOS 프로그램의 도움말 창처럼, 화면마다 안내하는 키가 달라요.
 *
 *     ┌ 이 화면의 키 ─────────┐
 *     │ [▲][▼]   리뷰 고르기   │
 *     │ [Enter]  고른 리뷰 열기 │
 *     │ ...                    │
 *     └────────────────────────┘
 *     [키보드 조작]   ← 단추. 다시 누르거나 Esc를 누르면 닫혀요.
 *
 * 맡은 기능
 *   - 여닫기: 단추를 누를 때마다 열고 닫아요. 열려 있을 때 Esc를 눌러도 닫혀요.
 *   - 기억하기: 열어 둔 채로 다른 화면에 가거나 다시 방문해도 열린 채로 있어요(브라우저 저장소 localStorage).
 *   - 처음 방문하면 닫혀 있어요. 화면을 가리지 않게요.
 *   - 휴대폰처럼 좁은 화면(640px 미만)에서는 키보드를 거의 쓰지 않아 숨겨요.
 *   - 리뷰 추가·수정 화면(/write…)에서는 단추를 두지 않아요.
 *
 * 접근성: "디스클로저(펼침) 단추" 패턴
 *   - <button aria-expanded="true|false">: 화면 낭독기가 "키보드 조작, 단추, 펼쳐짐/접힘"으로 읽어요.
 *   - aria-controls: 이 단추가 여닫는 영역의 id를 알려 줘요.
 *   - 닫힌 안내는 hidden 속성으로 숨겨, 화면에도 화면 낭독기에도 나오지 않아요.
 *   - 단추 글자 "키보드 조작"이 곧 접근 이름이에요. 여닫힘은 aria-expanded와 단추 색(펼치면 반전)으로 알려요.
 *
 * 누가 쓰나요?
 *   components/site-footer.tsx(바닥글)가 모든 화면에 놓아요.
 */

"use client";

import { usePathname } from "next/navigation";
// useSyncExternalStore: React 바깥에 있는 값(여기서는 브라우저 저장소)을 화면과 맞춰 읽는 React 훅이에요.
import { Fragment, useId, useLayoutEffect, useRef, useSyncExternalStore } from "react";

import { isPlainKeyPress, keepsOwnKeys } from "@/lib/keyboard";
import { REVIEW_DETAIL_PUBLIC } from "@/lib/site";
import { createStoredValue } from "@/lib/stored-value";

/* ──────────────────────────────────────────────────────────────
 * 1. 안내할 키 목록
 * ────────────────────────────────────────────────────────────── */

/** 키 하나. glyph는 화면에 보일 모양, name은 화면 낭독기가 읽을 이름이에요(없으면 glyph를 그대로 읽어요). */
type Key = { glyph: string; name?: string };

/** 안내 한 줄: 어떤 키를 누르면 무엇을 하는지 */
type Shortcut = { keys: Key[]; action: string };

// ▲ ▼ ◀ ▶ 같은 기호는 화면 낭독기마다 읽는 말이 달라서 이름을 따로 붙여 줘요.
const UP: Key = { glyph: "▲", name: "위쪽 화살표" };
const DOWN: Key = { glyph: "▼", name: "아래쪽 화살표" };
const LEFT: Key = { glyph: "◀", name: "왼쪽 화살표" };
const RIGHT: Key = { glyph: "▶", name: "오른쪽 화살표" };

/** 검색창 추천을 고르는 키(components/search-box.tsx) */
const SEARCH_KEYS: Shortcut[] = [{ keys: [UP, DOWN], action: "검색창에서 추천 검색어 고르기" }];

/**
 * 목록(처음 화면)에서 쓰는 키. 목록은 components/use-list-keys.ts, 검색창 추천은 components/search-box.tsx가 맡아요.
 * 리뷰를 고르고 여는 키는 상세 화면을 방문자에게 열었을 때(v3, lib/site.ts의 REVIEW_DETAIL_PUBLIC)만 안내해요.
 * v3 전까지는 목록 제목이 링크가 아니라 고르거나 열 리뷰가 없어서 검색창 키만 안내해요.
 */
const LIST_KEYS: Shortcut[] = REVIEW_DETAIL_PUBLIC
  ? [
      { keys: [UP, DOWN], action: "리뷰 고르기" },
      // ◀ ▶도 리뷰 사이를 오가요(목록 순서대로 위·아래 리뷰). 상세 화면의 ◀ ▶와 같은 "리뷰 사이 이동" 키예요.
      { keys: [LEFT, RIGHT], action: "이전·다음 리뷰" },
      { keys: [{ glyph: "Home" }, { glyph: "End" }], action: "처음·끝 리뷰" },
      { keys: [{ glyph: "Enter" }], action: "고른 리뷰 열기" },
      ...SEARCH_KEYS,
    ]
  : SEARCH_KEYS;

/** 리뷰 상세 화면에서 쓰는 키. components/review-keys.tsx가 맡아요. */
const REVIEW_KEYS: Shortcut[] = [
  { keys: [LEFT, RIGHT], action: "이전·다음 리뷰" },
  { keys: [{ glyph: "Esc" }], action: "목록으로" },
];

/** 어느 화면에서나 쓰는 키(브라우저의 원래 기능) */
const COMMON_KEYS: Shortcut[] = [{ keys: [{ glyph: "Tab" }], action: "다음 항목으로" }];

/**
 * 지금 주소에 맞는 키 목록을 골라요.
 *
 * @param pathname 지금 주소의 경로. 예: "/", "/reviews/winter-stop/"
 */
export function shortcutsFor(pathname: string): Shortcut[] {
  if (pathname === "/") return [...LIST_KEYS, ...COMMON_KEYS];
  if (pathname.startsWith("/reviews/")) return [...REVIEW_KEYS, ...COMMON_KEYS];
  return COMMON_KEYS;
}

/* ──────────────────────────────────────────────────────────────
 * 2. 열림 상태 기억하기 (브라우저 저장소)
 *
 * localStorage는 브라우저에 글자를 저장해 두는 곳이에요. 창을 닫았다 열어도 남아 있어요.
 * 저장소를 쓸 수 없을 때(개인 정보 보호 모드 등)도 안전하게 다루는 공용 도구(lib/stored-value.ts)를 써요.
 * ────────────────────────────────────────────────────────────── */

/** 열림 상태 저장소. 이름표는 다른 기능과 겹치지 않게 "blog:"를 앞에 붙였어요. 저장된 값이 "open"일 때만 열림이에요. */
const helpStore = createStoredValue(
  "blog:keyboard-help",
  (raw) => raw === "open",
  (open) => (open ? "open" : "closed"),
);

/** 서버에서 HTML을 미리 만들 때는 저장소가 없으니 늘 닫힘으로 그려요. 브라우저에서 저장된 값으로 바로 맞춰져요. */
const closedOnServer = () => false;

/* ──────────────────────────────────────────────────────────────
 * 3. 화면
 * ────────────────────────────────────────────────────────────── */

/** 화면 왼쪽 아래의 키보드 조작 안내 */
export function KeyboardHelp() {
  const open = useSyncExternalStore(helpStore.subscribe, helpStore.get, closedOnServer);
  const pathname = usePathname();
  // 단추와 안내 영역을 이어 줄 id(aria-controls)
  const panelId = useId();
  // 여닫기 단추의 손잡이. 단추가 지금 화면에 보이는지 확인할 때 써요(아래 Esc 처리).
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Esc 듣기는 처음 한 번 걸어 두고 계속 둬요(빈 배열 []).
  // 열렸는지는 키를 누른 순간 저장소에서 직접 읽어요(helpStore.get). 화면이 열린 모양으로 바뀌기 전에 누른 Esc도 놓치지 않아요.
  // useLayoutEffect: 화면이 준비되는 바로 그 순간에 걸어요. 상세 화면의 Esc(review-keys.tsx)와 같은 때에 걸려서,
  //   "목록으로 가기"만 먼저 걸려 있는 틈이 생기지 않아요.
  useLayoutEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !helpStore.get() || !isPlainKeyPress(event) || keepsOwnKeys(event.target)) return;
      // 좁은 화면(640px 미만)에서는 안내 전체가 숨어 있어요. 저장된 상태가 "열림"이어도 보이지 않는 안내를 닫느라
      // Esc를 가져가면 안 되니, 단추가 화면에 그려져 있을 때만 처리해요.
      // getClientRects(): 요소가 화면에 그려진 상자 목록. display: none으로 숨으면 상자가 없어 0개예요.
      if (!buttonRef.current || buttonRef.current.getClientRects().length === 0) return;
      // "처리했어요" 표시. 상세 화면의 Esc(목록으로 가기, review-keys.tsx)는 이 표시를 보고 이번에는 쉬어요.
      // 그래서 Esc를 한 번 누르면 안내만 닫히고, 한 번 더 눌러야 목록으로 가요(위에 덮인 것부터 닫기).
      event.preventDefault();
      helpStore.set(false);
    }

    // capture: true — 이벤트가 요소에 닿기 "전에" document에서 먼저 받아요(캡처 단계).
    // 그래서 다른 곳(review-keys.tsx)의 Esc 듣기보다 늘 먼저 실행돼요.
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, []);

  // 리뷰 추가·수정 화면(/write, /write/<주소>)에서는 키보드 조작 단추를 두지 않아요. 안내할 화면 키가 없고,
  // 왼쪽 아래 자리를 글쓰기에 비워 줘요. (훅은 모두 부른 다음에 돌아가야 해서 여기에 둬요.)
  if (pathname.startsWith("/write")) return null;

  return (
    // 자리: 왼쪽 아래 고정 줄(site-footer.tsx)의 맨 앞이에요. 오른쪽에 [로그아웃](로그인했을 때만)이 붙어요.
    // hidden sm:block: 휴대폰에서는 숨기고 640px 이상에서 보여요.
    // relative: 펼친 안내 창(absolute)을 이 단추 위에 띄우는 기준이에요. 창이 떠 있어서 단추 줄의 너비가 바뀌지 않아요(옆의 [로그아웃]이 밀리지 않게).
    // (코드 순서 = 화면 낭독기가 읽는 순서라서, "단추 → 펼쳐진 안내" 순으로 읽혀요.)
    <div className="relative hidden sm:block">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => helpStore.set(!open)}
        className="btn-float"
      >
        {/* 열려 있으면 단추가 반전돼요(globals.css의 .btn-float[aria-expanded="true"]). 상태는 aria-expanded가 알려 줘요. */}
        키보드 조작
      </button>

      {/* hidden={!open}: 닫혀 있으면 숨겨요. 숨겨도 id는 남아 있어서 aria-controls가 늘 이 영역을 가리켜요. */}
      {/* absolute bottom-full mb-2: 단추 바로 위(8px 위)에 떠요. */}
      <div
        id={panelId}
        hidden={!open}
        className="absolute bottom-full left-0 mb-2 w-72 border-2 border-crt-fg bg-crt-bg shadow-[0_0_1rem_rgb(var(--glow-rgb)/0.3)]"
      >
        {/* 창 제목 줄(반전). 옛 프로그램의 창 위쪽 막대처럼 보여요. */}
        <h2 className="inverse px-3">이 화면의 키</h2>
        {/* <dl>(설명 목록): 키(<dt>)와 하는 일(<dd>)을 짝지어 읽어 줘요. 두 칸 그리드로 줄을 맞춰요. */}
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-3 py-3">
          {shortcutsFor(pathname).map(({ keys, action }) => (
            // Fragment: 감싸는 태그 없이 <dt>와 <dd>를 한 쌍으로 묶어요. key는 React가 줄을 구분하는 이름표예요.
            <Fragment key={action}>
              <dt className="flex gap-1">
                {keys.map((key) => (
                  <KeyCap key={key.glyph} {...key} />
                ))}
              </dt>
              <dd>{action}</dd>
            </Fragment>
          ))}
        </dl>
        <p className="border-t-2 border-dotted border-crt-line px-3 py-2 text-crt-dim">Esc를 누르면 이 안내를 닫아요.</p>
      </div>
    </div>
  );
}

/**
 * 키 모양 하나(예: [Enter])
 *
 * <kbd>: "키보드로 누르는 키"라는 뜻의 HTML 태그예요. 모양은 globals.css에서 테두리 상자로 꾸며요.
 * 이름(name)이 따로 있으면 기호는 화면에만 보이고, 화면 낭독기는 이름을 읽어요.
 */
function KeyCap({ glyph, name }: Key) {
  if (!name) return <kbd>{glyph}</kbd>;
  return (
    <kbd>
      <span aria-hidden="true">{glyph}</span>
      <span className="sr-only">{name}</span>
    </kbd>
  );
}
