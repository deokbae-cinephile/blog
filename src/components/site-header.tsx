/**
 * @file 머리글 (site-header.tsx)
 *
 * 이 파일이 하는 일
 *   모든 화면 맨 위에 보이는 머리글이에요. 옛 단말기 프로그램의 맨 윗줄처럼
 *   왼쪽에 로고와 블로그 이름, 오른쪽에 링크를 두고 그 사이를 점선(....)으로 잇습니다.
 *
 *     [로고] 덕배의 영화 블로그  ··························  [새 리뷰]  [GitHub 아이콘] GitHub
 *                                                          └ 로그인했을 때만
 *
 * 맡은 기능
 *   - 블로그 이름을 누르면 처음 화면(목록)으로 가요.
 *   - [GitHub]: 이 블로그의 소스 코드가 있는 저장소로 가요. 아이콘은 사이트에 맞춰 픽셀로 그렸어요(lib/github-mark.ts).
 *   - [새 리뷰]: 글쓴이로 로그인했을 때만 보여요. 글쓰기 화면(/write)으로 가요.
 *
 * 맨 위의 "use client"는 뭔가요?
 *   Next.js의 컴포넌트는 기본적으로 "서버 컴포넌트"로, 미리 HTML로 만들어지고 브라우저에서는 다시 돌지 않아요.
 *   그런데 로그인 여부(쿠키)와 지금 주소는 브라우저에서 알아야 하죠.
 *   그래서 이 파일을 "클라이언트 컴포넌트"로 표시합니다. (그래도 처음 HTML은 미리 만들어져요.)
 *
 * 누가 쓰나요?
 *   app/layout.tsx가 모든 화면 위에 이 머리글을 놓습니다.
 */

"use client";

import Link from "next/link";
// usePathname: 지금 주소의 경로 부분(예: "/", "/write")을 알려 주는 Next.js 훅이에요.
import { usePathname } from "next/navigation";

import { GITHUB_MARK_ROWS } from "@/lib/github-mark";
// 로고 그림(슬레이트)은 아이콘 스크립트와 함께 쓰려고 lib/logo.ts에 따로 두었어요.
import { LOGO_ROWS } from "@/lib/logo";
import { site } from "@/lib/site";

import { PixelArt } from "./pixel-art";
import { useIsAdmin } from "./use-is-admin";

/** 모든 화면 맨 위의 머리글 */
export function SiteHeader() {
  // 글쓴이로 로그인했는지(쿠키 표시). 미리 만든 HTML에서는 늘 false예요.
  const isAdmin = useIsAdmin();
  // 지금 글쓰기 화면에 있는지. 그 화면에서는 [새 리뷰]를 "지금 보는 페이지"로 표시해요.
  const onWritePage = usePathname() === "/write";

  return (
    // <header>는 "머리글" 영역이라는 뜻을 가진 태그예요. 화면 낭독기는 이를 "배너" 랜드마크로 알려 줍니다.
    // 화면 너비를 다 써요(풀화면). flex-wrap: 좁은 화면에서는 오른쪽 링크가 다음 줄로 내려가요.
    // id="top" + tabIndex={-1}: "맨 위로" 단추(back-to-top.tsx)가 키보드 초점을 여기로 옮겨요.
    //   tabIndex -1은 Tab 순서에는 들어가지 않고 코드로만 초점을 받을 수 있다는 뜻이에요. outline-none은 그때의 테두리를 지워요.
    <header
      id="top"
      tabIndex={-1}
      className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-6 outline-none sm:px-8 sm:pt-8 lg:px-12"
    >
      {/* glow: 형광 번짐 효과(globals.css). shrink-0: 공간이 좁아도 이름이 찌그러지지 않게 해요. */}
      <Link href="/" className="glow inline-flex shrink-0 items-center gap-3 no-underline hover:underline">
        {/* 로고는 옆의 블로그 이름과 같은 뜻이라 꾸밈 그림으로 둬요(label 없음 → 읽지 않음). */}
        <PixelArt rows={LOGO_ROWS} cell={2} />
        <span>{site.name}</span>
      </Link>

      {/* 이름과 링크 사이의 점선. 꾸밈이라 읽지 않아요. 휴대폰에서는 숨겨요. */}
      <span aria-hidden="true" className="leader hidden sm:block" />

      {/* 오른쪽 링크 묶음. ml-auto: 점선이 없는 휴대폰에서도 오른쪽 끝에 붙어요(넓은 화면에서는 점선이 남는 자리를 채워요). */}
      <div className="ml-auto flex items-center gap-x-3">
        {/* 로그인했을 때만: 새 리뷰 쓰기. aria-current="page": 지금 그 화면이면 "지금 보는 페이지"라고 알려 줘요. */}
        {isAdmin && (
          <Link href="/write" aria-current={onWritePage ? "page" : undefined} className="menu-link">
            새 리뷰
          </Link>
        )}

      {/* 소스 코드 저장소 링크. 아이콘은 글자 "GitHub"와 같은 뜻이라 꾸밈으로 둬요.
          링크 이름은 보이는 글자 그대로 "GitHub"예요(음성 명령 "GitHub 눌러"로도 부를 수 있어요, KWCAG 6.5.3).
          어디로 가는 링크인지는 설명(aria-describedby)으로 덧붙여, 화면 낭독기가 "GitHub, 링크, 이 블로그의 소스 코드 저장소"처럼 읽어요.
          설명 글은 화면에서는 숨겨요(hidden). 숨긴 글도 aria-describedby로 가리키면 읽어 줘요. */}
        <a href={site.repo.url} aria-describedby="github-link-desc" className="menu-link gap-2">
          <PixelArt rows={GITHUB_MARK_ROWS} cell={2} />
          GitHub
        </a>
      </div>
      <span id="github-link-desc" hidden>
        이 블로그의 소스 코드 저장소
      </span>
    </header>
  );
}
