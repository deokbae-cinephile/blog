/**
 * @file 화면 조건(미디어 쿼리) 훅 (use-media-query.ts)
 *
 * 이 파일이 하는 일
 *   "화면 너비가 1024px 이상인가?" 같은 CSS 미디어 쿼리가 지금 맞는지 true/false로 알려 주는 훅이에요.
 *   창 크기를 바꾸거나 휴대폰을 돌리면 저절로 다시 그려져요.
 *
 * 서버에서는 화면 크기를 모르니까
 *   서버에서 그릴 때는 serverValue(기본 false)를 쓰고, 브라우저에서 화면이 준비되면 진짜 값으로 맞춰요.
 *   그래서 보이는 모양(숨기기·나란히 놓기)은 CSS(lg:, max-lg:)가 먼저 정하고, 이 훅은 화면 낭독기용 역할(role) 같은
 *   CSS로 할 수 없는 일에만 써요.
 *
 * 누가 쓰나요?
 *   components/write-preview-panes.tsx(넓은 화면은 나란히, 좁은 화면은 탭)
 */

import { useCallback, useSyncExternalStore } from "react";

/**
 * 미디어 쿼리가 지금 맞는지 알려 줘요.
 *
 * @param query CSS 미디어 쿼리. 예: "(min-width: 64rem)"
 * @param serverValue 서버에서 그릴 때 쓸 값(기본 false)
 * @returns 지금 맞으면 true
 * @example
 * const wide = useMediaQuery("(min-width: 64rem)", true);
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  // 화면 조건이 바뀌면 알려 달라고 등록해요(useSyncExternalStore가 불러요). query가 같으면 같은 함수를 써요.
  const subscribe = useCallback(
    (onChange: () => void) => {
      // 아주 오래된 브라우저처럼 matchMedia가 없으면 지켜보지 않아요.
      if (typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  // useSyncExternalStore: React 바깥(브라우저)의 값을 안전하게 읽는 훅이에요. 값이 true/false라 바뀔 때만 다시 그려요.
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia === "function" && window.matchMedia(query).matches,
    () => serverValue,
  );
}
