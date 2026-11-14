/**
 * @file 상세 화면의 키보드 조작 (review-keys.tsx)
 *
 * 이 파일이 하는 일
 *   리뷰 상세 화면에서 옛 DOS 프로그램처럼 키 하나로 화면을 넘겨요.
 *
 *     ◀(왼쪽 화살표)  : 이전 리뷰(처음 화면 목록에서 바로 위 = 더 최근에 쓴 글)
 *     ▶(오른쪽 화살표): 다음 리뷰(목록에서 바로 아래 = 더 예전에 쓴 글)
 *   목록 화면의 ▲ ▼(◀ ▶)와 같은 방향이에요: 위로 가면 이전, 아래로 가면 다음.
 *     Esc             : 목록(처음 화면)으로
 *
 *   화면 아래의 "◀ 이전 리뷰 / 다음 리뷰 ▶" 링크, 위의 "◀ 목록으로" 링크와 같은 곳으로 가요.
 *   ▲ ▼는 건드리지 않아서 평소처럼 글을 위아래로 스크롤해요.
 *
 * 화면에는 아무것도 그리지 않아요
 *   이 컴포넌트는 키를 "듣기"만 하고 아무것도 그리지 않아요(null을 돌려줘요).
 *   이렇게 기능만 가진 컴포넌트를 두면, 서버 컴포넌트(review-article.tsx) 안에 브라우저 기능을 끼워 넣을 수 있어요.
 *
 * 키를 가로채지 않는 때 (lib/keyboard.ts)
 *   - Alt + ◀(뒤로 가기)처럼 다른 키와 함께 누를 때
 *   - 본문의 넓은 표 상자에 초점이 있을 때(◀ ▶로 표를 옆으로 밀어 봐야 하니까요)
 *   - 다른 곳에서 이미 처리한 키일 때(예: 키보드 안내가 열려 있으면 Esc는 먼저 안내를 닫아요)
 *
 * 누가 쓰나요?
 *   components/review-article.tsx
 */

"use client";

// useRouter: 코드에서 다른 주소로 이동할 때 쓰는 Next.js 훅이에요. router.push("/주소")는 <Link>를 누른 것과 같아요.
import { useRouter } from "next/navigation";
// useLayoutEffect: 화면을 바꾼 "바로 그 순간"(브라우저가 그리기 전)에 할 일을 맡기는 React 훅이에요.
import { useLayoutEffect } from "react";

import { isPlainKeyPress, keepsOwnKeys } from "@/lib/keyboard";

/** ReviewKeys가 받는 값 */
type Props = {
  /** 이전 리뷰(목록에서 바로 위) 주소. 없으면 null이고, ◀를 눌러도 아무 일도 없어요. */
  previousHref: string | null;
  /** 다음 리뷰(목록에서 바로 아래) 주소. 없으면 null */
  nextHref: string | null;
};

/** 상세 화면의 키보드 조작(◀ ▶ Esc). 화면에는 아무것도 그리지 않아요. */
export function ReviewKeys({ previousHref, nextHref }: Props) {
  const router = useRouter();

  // 왜 useEffect가 아니라 useLayoutEffect일까요?
  //   useEffect는 화면을 그린 "뒤" 조금 있다가 실행돼요. 그래서 새 리뷰가 화면에 보인 직후 아주 짧은 틈에는
  //   키 듣기가 아직 붙지 않아, 그때 누른 ◀ ▶를 놓칠 수 있어요.
  //   useLayoutEffect는 화면이 바뀌는 바로 그 순간에 실행돼서, 새 화면이 보일 때는 이미 키를 듣고 있어요.
  useLayoutEffect(() => {
    /** 키를 누를 때마다 실행돼요. */
    function handleKeyDown(event: KeyboardEvent) {
      // 우리 차례가 아니면(다른 키와 함께 눌렀거나, 입력란·표 상자 안이거나, 이미 처리된 키) 그냥 둬요.
      if (!isPlainKeyPress(event) || keepsOwnKeys(event.target)) return;

      // 누른 키(event.key)에 따라 갈 곳을 정해요. 해당하지 않는 키면 null이에요.
      const href = event.key === "ArrowLeft" ? previousHref : event.key === "ArrowRight" ? nextHref : event.key === "Escape" ? "/" : null;
      if (href === null) return;

      // 브라우저의 원래 동작(가로 스크롤 등)을 막고, 우리가 처리했다고 표시해요.
      event.preventDefault();
      router.push(href);
    }

    // document(문서 전체)에 키 듣기를 걸어요. 어디에 초점이 있든 키 누름은 결국 document까지 올라와요(이벤트 버블링).
    document.addEventListener("keydown", handleKeyDown);
    // 정리 함수: 다른 화면으로 가서 이 컴포넌트가 사라지면 키 듣기를 떼어 내요. 안 떼면 다른 화면에서도 ◀ ▶가 동작해 버려요.
    return () => document.removeEventListener("keydown", handleKeyDown);
    // [ ] 안의 값이 바뀌면(다른 리뷰로 넘어가면) 정리한 뒤 새 주소로 다시 걸어요.
  }, [router, previousHref, nextHref]);

  return null;
}
