/**
 * @file 누를 뜻을 보일 때만 미리 받는 링크 (intent-link.tsx)
 *
 * 이 파일이 하는 일
 *   Next.js의 <Link>는 화면에 보이기만 해도 그 화면의 데이터를 미리 받아요(prefetch).
 *   목록처럼 링크가 많은 곳에서는 스크롤할 때마다 요청이 늘어서(10편이면 요청 10개 이상),
 *   여기서는 "누를 뜻"을 보일 때만 미리 받아요.
 *
 *     마우스를 올림(mouseenter) · 키보드 초점이 감(focus) · 손가락이 닿음(touchstart) → 그때 한 번 미리 받기
 *
 *   마우스를 올리고 누르기까지 보통 0.1초 넘게 걸려서, 누를 때는 이미 받아 둔 경우가 많아요(바로 넘어가요).
 *   prefetch={false}만 쓰면 마우스를 올려도 미리 받지 않아서(Next.js 16), 그 일을 여기서 직접 해요(router.prefetch).
 *
 * 누가 쓰나요?
 *   components/review-list-item.tsx(목록의 리뷰 링크), components/genre-tags.tsx(상세 화면의 장르 링크)
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, FocusEvent, MouseEvent, TouchEvent } from "react";

/** IntentLink가 받는 값: <Link>와 같아요. 단, 주소(href)는 글자로만 받아요(미리 받을 주소로 그대로 써요). */
type Props = Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & { href: string };

/** 누를 뜻을 보일 때(마우스 올림·초점·손가락 닿음)만 다음 화면을 미리 받는 링크 */
export function IntentLink({ href, onMouseEnter, onFocus, onTouchStart, ...props }: Props) {
  const router = useRouter();
  // 같은 주소를 여러 번 불러도 Next.js가 이미 받은 것은 다시 받지 않아요.
  const prefetch = () => router.prefetch(href);

  return (
    <Link
      {...props}
      href={href}
      // 화면에 보이기만 해서는 미리 받지 않아요.
      prefetch={false}
      onMouseEnter={(event: MouseEvent<HTMLAnchorElement>) => {
        prefetch();
        onMouseEnter?.(event);
      }}
      onFocus={(event: FocusEvent<HTMLAnchorElement>) => {
        prefetch();
        onFocus?.(event);
      }}
      onTouchStart={(event: TouchEvent<HTMLAnchorElement>) => {
        prefetch();
        onTouchStart?.(event);
      }}
    />
  );
}
