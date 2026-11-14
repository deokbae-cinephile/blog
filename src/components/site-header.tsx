/**
 * @file 머리글 (site-header.tsx)
 *
 * 이 파일이 하는 일
 *   모든 화면 맨 위에 보이는 머리글이에요. 옛 단말기 프로그램의 맨 윗줄처럼
 *   왼쪽에 로고와 블로그 이름, 오른쪽에 링크를 두고 그 사이를 점선(....)으로 잇습니다.
 *
 *     [로고] DMB: 덕배의 영화 블로그  ·····························  [GitHub 아이콘] GitHub
 *
 *   왼쪽과 오른쪽은 같은 모양이에요: 아이콘 24 × 24px, 아이콘과 글자 사이 8px, 글자 16px, 누르는 높이 44px.
 *
 * 맡은 기능
 *   - 블로그 이름을 누르면 처음 화면(목록)으로 가요.
 *   - [GitHub]: 이 블로그의 소스 코드가 있는 저장소로 가요. 아이콘은 사이트에 맞춰 픽셀로 그렸어요(lib/github-mark.ts).
 *   (리뷰 추가 단추는 머리글이 아니라 화면 가운데 아래에 떠 있어요. components/floating-buttons.tsx)
 *
 * 브라우저 코드가 없는 "서버 컴포넌트"예요
 *   미리 HTML로 만들어지고 브라우저에서는 다시 돌지 않아서, 방문자가 받는 자바스크립트가 늘지 않아요.
 *
 * 누가 쓰나요?
 *   app/layout.tsx가 모든 화면 위에 이 머리글을 놓습니다.
 */


import Link from "next/link";

import { GITHUB_MARK_ROWS } from "@/lib/github-mark";
// 로고 그림(슬레이트)은 lib/logo.ts에 있어요. 머리글용은 GitHub 아이콘과 같은 12 × 12칸 그림이에요.
import { HEADER_LOGO_ROWS } from "@/lib/logo";
import { site } from "@/lib/site";

import { PixelArt } from "./pixel-art";

/** 모든 화면 맨 위의 머리글 */
export function SiteHeader() {
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
      {/* 오른쪽 GitHub 링크와 같은 모양으로 맞춰요.
          min-h-11: 누르는 높이 44px, gap-2: 아이콘과 글자 사이 8px, 글자는 기본 16px(형광 번짐도 같은 기본 세기).
          왼쪽 끝은 아래 본문과 줄을 맞추려고 안쪽 여백을 두지 않아요. shrink-0: 공간이 좁아도 이름이 찌그러지지 않게 해요. */}
      <Link href="/" className="inline-flex min-h-11 shrink-0 items-center gap-2 no-underline hover:underline">
        {/* 로고는 옆의 블로그 이름과 같은 뜻이라 꾸밈 그림으로 둬요(label 없음 → 읽지 않음). 12칸 × 2px = 24px */}
        <PixelArt rows={HEADER_LOGO_ROWS} cell={2} />
        <span>{site.headerTitle}</span>
      </Link>

      {/* 이름과 링크 사이의 점선. 꾸밈이라 읽지 않아요. 휴대폰에서는 숨겨요. */}
      <span aria-hidden="true" className="leader hidden sm:block" />

      {/* 오른쪽 링크 묶음. ml-auto: 점선이 없는 휴대폰에서도 오른쪽 끝에 붙어요(넓은 화면에서는 점선이 남는 자리를 채워요). */}
      <div className="ml-auto flex items-center gap-x-3">
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
