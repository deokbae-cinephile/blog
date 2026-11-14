/**
 * @file 목록을 방향키로 고르기 (use-list-keys.ts)
 *
 * 이 파일이 하는 일
 *   처음 화면의 리뷰 목록을 옛 DOS 프로그램처럼 방향키로 오르내리며 고르게 해요.
 *
 *     ▼ 또는 ▶      : 다음 리뷰로. 목록 밖에서 누르면 화면에 보이는 첫 리뷰로 들어가요.
 *     ▲ 또는 ◀      : 이전 리뷰로
 *     Home / End    : 목록의 처음 / 끝 리뷰로 (목록 안에 있을 때만)
 *     Enter         : 고른 리뷰 열기 (링크의 원래 기능이라 따로 만들지 않았어요)
 *
 *   ◀ ▶는 상세 화면(review-keys.tsx)처럼 "리뷰 사이를 오가는 키"로도 쓸 수 있게 ▲ ▼와 같은 일을 해요.
 *   목록의 순서(최신순·평점순 중 고른 순서)대로 위아래 리뷰로 가요.
 *
 *   "고른다"는 것은 그 리뷰의 제목 링크로 키보드 초점을 옮긴다는 뜻이에요.
 *   초점이 오면 항목 전체가 반전되어(review-list-item.tsx) 단말기에서 고른 줄처럼 보여요.
 *   Tab으로 옮겨 다니는 원래 방법도 그대로 쓸 수 있어요.
 *
 * 목록 끝에서는?
 *   맨 위에서 ▲(◀), 맨 아래에서 ▼(▶)를 누르면 우리는 손을 떼고 브라우저에 맡겨요.
 *   그래서 화면이 평소처럼 스크롤되어 소개 글이나 바닥글을 볼 수 있어요.
 *
 * "훅(hook)"이 뭔가요?
 *   use로 시작하는 함수로, 컴포넌트 안에서 React 기능(useEffect 등)을 묶어 다시 쓰게 해 줘요.
 *   이 훅은 화면을 그리지 않고 "키 듣기"만 붙여 줘요.
 *
 * 누가 쓰나요?
 *   components/review-browser.tsx가 리뷰 목록(<ol>)에 붙여요.
 */

import { type RefObject, useLayoutEffect } from "react";

import { isPlainKeyPress, keepsOwnKeys } from "@/lib/keyboard";

/**
 * 목록(<ol>, <ul>)을 방향키로 오르내리며 고르게 해요.
 *
 * 목록의 항목(<li>)마다 링크가 하나씩 있다고 가정해요. 그 링크들 사이로 초점을 옮겨요.
 *
 * @param listRef 목록 요소를 가리키는 ref(useRef로 만든 손잡이)
 * @param enabled false면 키를 듣지 않아요. 아직 조작할 수 없는 화면(미리 만든 HTML)에서 꺼 둬요. 기본 true
 * @example
 * const listRef = useRef<HTMLOListElement>(null);
 * useListKeys(listRef);
 * return <ol ref={listRef}>...</ol>;
 */
export function useListKeys(listRef: RefObject<HTMLElement | null>, enabled = true) {
  // useLayoutEffect: 목록이 화면에 나타나는 바로 그 순간 키 듣기를 붙여요.
  // (useEffect는 화면을 그린 "뒤"에 실행돼서, 목록이 보인 직후 누른 키를 놓칠 틈이 생겨요. review-keys.tsx 설명 참고)
  useLayoutEffect(() => {
    if (!enabled) return;

    /** 키를 누를 때마다 실행돼요. */
    function handleKeyDown(event: KeyboardEvent) {
      // 우리 차례가 아니면(다른 키와 함께 눌렀거나, 검색창·라디오 단추 안이거나, 이미 처리된 키) 그냥 둬요.
      if (!isPlainKeyPress(event) || keepsOwnKeys(event.target)) return;

      // 목록이 아직(또는 이제) 화면에 없으면 할 일이 없어요. 결과가 0편이면 목록이 없어요.
      const list = listRef.current;
      if (!list) return;

      // 목록 안의 링크를 모두 모아 배열로 만들어요. Array.from: 비슷한 목록(NodeList)을 진짜 배열로 바꿔요.
      const links = Array.from(list.querySelectorAll<HTMLAnchorElement>("li a[href]"));
      // 지금 초점이 있는 링크가 몇 번째인지. 목록 밖에 초점이 있으면 -1이에요.
      // document.activeElement: 지금 키보드 초점을 가진 요소예요.
      const current = links.findIndex((link) => link === document.activeElement);
      // 갈 곳(몇 번째 링크로 갈지)을 정해요.
      const target = nextIndex(event.key, current, links);

      // 갈 곳이 없거나 목록 범위를 벗어나면 브라우저에 맡겨요(평소처럼 스크롤).
      if (target === null || target < 0 || target >= links.length) return;

      // 스크롤 같은 원래 동작을 막고, 우리가 처리했다고 표시해요.
      event.preventDefault();
      // `!`: 범위를 위에서 확인해서 반드시 있다고 TypeScript에 알려 주는 표시예요.
      const link = links[target]!;
      // preventScroll: 초점을 옮길 때 브라우저가 멋대로 스크롤하지 않게 하고, 바로 아래에서 직접 스크롤해요.
      link.focus({ preventScroll: true });
      // 항목(<li>) 전체가 화면에 보이도록, 필요한 만큼만(nearest) 스크롤해요. 이미 보이면 움직이지 않아요.
      link.closest("li")?.scrollIntoView({ block: "nearest" });
    }

    document.addEventListener("keydown", handleKeyDown);
    // 정리 함수: 목록이 사라지면(다른 화면으로 가면) 키 듣기를 떼어 내요.
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [listRef, enabled]);
}

/**
 * 누른 키와 지금 위치로 다음에 고를 링크의 번호를 정해요. 처리하지 않을 키면 null이에요.
 *
 * @param key 누른 키 이름(event.key). 예: "ArrowDown"
 * @param current 지금 고른 링크 번호. 목록 밖이면 -1
 * @param links 목록의 링크들
 */
function nextIndex(key: string, current: number, links: HTMLAnchorElement[]): number | null {
  const inList = current !== -1;

  switch (key) {
    // ▶는 ▼와 같아요(다음 리뷰). case를 이어 쓰면 두 키가 같은 일을 해요.
    case "ArrowRight":
    case "ArrowDown":
      // 목록 안이면 다음 링크, 밖이면 화면에 보이는 첫 리뷰로 들어가요.
      // 목록이 모두 화면 위로 지나갔으면 -1이 나와서, 아래 범위 검사에서 브라우저에 맡겨요(평소처럼 아래로 스크롤).
      return inList ? current + 1 : firstVisible(links);
    // ◀는 ▲와 같아요(이전 리뷰).
    case "ArrowLeft":
    case "ArrowUp":
      // 목록 밖에서 누른 ▲·◀는 브라우저에 맡겨요(평소처럼 위로 스크롤).
      return inList ? current - 1 : null;
    case "Home":
      return inList ? 0 : null;
    case "End":
      return inList ? links.length - 1 : null;
    default:
      return null;
  }
}

/**
 * 화면에 보이거나 아직 아래쪽에 있는(아랫부분이 화면 위쪽 끝보다 아래에 있는) 첫 항목의 번호를 찾아요.
 * 목록 중간까지 스크롤해 둔 채 ▼를 눌렀을 때 맨 위로 튀어 오르지 않고, 보고 있던 곳에서 고르기를 시작하려고요.
 * 목록이 모두 화면 위로 지나갔으면(바닥글을 보는 중) -1이에요. 그때 맨 위로 끌어올리면 사용자가 놀라니까요.
 *
 * getBoundingClientRect(): 요소가 지금 화면(뷰포트)의 어디에 있는지 알려 줘요. bottom은 화면 위쪽 끝에서 요소 아래쪽까지의 거리예요.
 */
function firstVisible(links: HTMLAnchorElement[]): number {
  return links.findIndex((link) => (link.closest("li") ?? link).getBoundingClientRect().bottom > 0);
}
