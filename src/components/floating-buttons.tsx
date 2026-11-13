/**
 * @file 화면 오른쪽 아래에 떠 있는 단추들 (floating-buttons.tsx)
 *
 * 이 파일이 하는 일
 *   화면 오른쪽 아래 구석에 단추를 띄워요(스크롤해도 그 자리에 있어요).
 *
 *       ┌────────┐
 *       │ 맨 위로 │  ← 조금 내려 읽었을 때만(back-to-top.tsx)
 *       └────────┘
 *       ┌────────┐
 *       │        │
 *       │   +    │  ← 글쓴이로 로그인했을 때만: 리뷰 추가(/write)
 *       │        │     너비는 "맨 위로"와 같고, 높이도 너비와 같은 정사각형이에요.
 *       └────────┘
 *
 *   "+"는 늘 맨 아래 같은 자리에 있고, "맨 위로"가 나타나면 그 위에 붙어요(누르려던 "+"가 움직이지 않게요).
 *   글쓰기 화면(/write…)에서는 "+"를 숨겨요. 이미 쓰고 있으니까요.
 *
 * 접근성
 *   "+"는 그림 글자라 화면 낭독기에서는 숨기고, 대신 화면에 보이지 않는 "리뷰 추가"를 링크 이름으로 읽어 줘요.
 *
 * 누가 쓰나요?
 *   components/site-footer.tsx(바닥글)가 모든 화면에 놓아요.
 */

"use client";

import Link from "next/link";
// usePathname: 지금 주소의 경로 부분(예: "/", "/write")을 알려 주는 Next.js 훅이에요.
import { usePathname } from "next/navigation";

import { BackToTop } from "./back-to-top";
import { PixelArt } from "./pixel-art";
import { useIsAdmin } from "./use-is-admin";

/** "+" 그림(8×8 칸). GitHub 아이콘처럼 픽셀로 그려 사이트 모양에 맞춰요. 칸 하나 5px → 40px */
const PLUS_ROWS = ["...##...", "...##...", "...##...", "########", "########", "...##...", "...##...", "...##..."] as const;

/** 화면 오른쪽 아래의 떠 있는 단추들 */
export function FloatingButtons() {
  // 글쓴이로 로그인했는지(쿠키 표시). 미리 만든 HTML에서는 늘 false예요.
  const isAdmin = useIsAdmin();
  // 글쓰기 화면(/write, /write/<주소>)에서는 "+"를 숨겨요.
  const onWritePage = usePathname().startsWith("/write");
  const showAdd = isAdmin && !onWritePage;

  return (
    <>
      {/* "+"가 떠 있으면 바닥글 마지막 줄을 가리지 않게, 그 높이만큼 빈자리를 둬요. 꾸밈이라 읽지 않아요. */}
      {showAdd && <div aria-hidden="true" className="h-24" />}

      {/* fixed right-4 bottom-4: 화면 오른쪽 아래에 떠 있어요. z-[52]: CRT 화면 효과 막보다 위라서 또렷해요.
          flex-col items-end gap-2: 단추를 위아래로 쌓고 오른쪽 끝을 맞춰요. print:hidden: 인쇄할 때는 빼요. */}
      <div className="fixed right-4 bottom-4 z-[52] flex flex-col items-end gap-2 print:hidden">
        <BackToTop />
        {showAdd && (
          // w-24 h-24: 너비 6rem("맨 위로"와 같아요), 높이도 6rem인 정사각형. no-underline: 링크 밑줄을 없애요.
          <Link href="/write" className="btn-float h-24 w-24 justify-center no-underline">
            {/* 픽셀 "+" 그림은 꾸밈이라 읽지 않고(label 없음), 대신 화면에 보이지 않는 "리뷰 추가"를 이름으로 읽어요. */}
            <PixelArt rows={PLUS_ROWS} cell={5} />
            <span className="sr-only">리뷰 추가</span>
          </Link>
        )}
      </div>
    </>
  );
}
