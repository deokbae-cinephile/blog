/**
 * @file 머리글 (site-header.tsx)
 *
 * 이 파일이 하는 일
 *   모든 화면 맨 위에 보이는 머리글이에요. 옛 단말기 프로그램의 맨 윗줄처럼
 *   왼쪽에 로고와 블로그 이름, 오른쪽에 링크를 두고 그 사이를 점선(....)으로 잇습니다.
 *
 *     [로고] DMB: 덕배의 영화 블로그 (v2.0.0)  ·····························  [GitHub 아이콘]
 *
 *   이름 옆의 (v2.0.0)은 지금 버전이에요(lib/version.ts가 package.json에서 읽어요). 링크 밖에 둬서, 링크 이름은 블로그 이름만 읽어요.
 *
 *   왼쪽 로고와 오른쪽 GitHub 아이콘은 같은 크기(24 × 24px)이고, 누르는 높이도 44px로 같아요.
 *   로고는 본문 왼쪽 끝에, GitHub 아이콘은 본문 오른쪽 끝에 딱 맞춰요. 휴대폰에서도 줄을 바꾸지 않고 첫 줄 오른쪽 끝에 있어요.
 *   GitHub 링크는 아이콘만 보이고, 글자 "GitHub"는 화면 낭독기만 읽어요(링크 이름).
 *
 * 맡은 기능
 *   - 블로그 이름을 누르면 처음 화면(목록)으로 가요.
 *   - [GitHub]: 이 블로그의 소스 코드가 있는 저장소로 가요. 아이콘은 사이트에 맞춰 픽셀로 그렸어요(lib/github-mark.ts).
 *   (리뷰 추가 단추는 머리글이 아니라 화면 오른쪽 아래, 맨 위로 단추 오른쪽에 떠 있어요. components/floating-buttons.tsx)
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
import { APP_VERSION } from "@/lib/version";

import { PixelArt } from "./pixel-art";

/** 모든 화면 맨 위의 머리글 */
export function SiteHeader() {
  return (
    // <header>는 "머리글" 영역이라는 뜻을 가진 태그예요. 화면 낭독기는 이를 "배너" 랜드마크로 알려 줍니다.
    // 화면 너비를 다 써요(풀화면). 줄을 바꾸지 않아요(flex-wrap 없음): GitHub 아이콘이 늘 첫 줄 오른쪽 끝에 있어요.
    // sm:gap-x-3: 넓은 화면에서 이름 · 점선 · 아이콘 사이 12px. 휴대폰에서는 점선이 없고, 아이콘 링크의 안쪽 여백(10px)이 사이를 띄워요.
    // id="top" + tabIndex={-1}: "맨 위로" 단추(back-to-top.tsx)가 키보드 초점을 여기로 옮겨요.
    //   tabIndex -1은 Tab 순서에는 들어가지 않고 코드로만 초점을 받을 수 있다는 뜻이에요. outline-none은 그때의 테두리를 지워요.
    <header
      id="top"
      tabIndex={-1}
      className="flex w-full items-center px-4 pt-6 outline-none sm:gap-x-3 sm:px-8 sm:pt-8 lg:px-12"
    >
      {/* 이름 링크와 버전을 한 묶음으로 둬요. gap-x-2: 이름과 버전 사이 8px(글자 한 칸 너비)
          min-w-0 + flex-wrap: 아주 좁은 화면(약 340px 아래)에서는 아이콘을 밀어내지 않고, 이 묶음 안에서 버전이 다음 줄로 내려가요. */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-2">
        {/* min-h-11: 누르는 높이 44px(오른쪽 GitHub 링크와 같아요). gap-2: 로고와 이름 사이 8px.
            왼쪽 끝은 아래 본문과 줄을 맞추려고 안쪽 여백을 두지 않아요. */}
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 no-underline hover:underline">
          {/* 로고는 옆의 블로그 이름과 같은 뜻이라 꾸밈 그림으로 둬요(label 없음 → 읽지 않음). 12칸 × 2px = 24px */}
          <PixelArt rows={HEADER_LOGO_ROWS} cell={2} />
          <span>{site.headerTitle}</span>
        </Link>
        {/* 지금 버전. 보조 글자색(text-crt-dim)으로 이름보다 덜 눈에 띄게 해요. */}
        <span className="text-crt-dim">(v{APP_VERSION})</span>
      </div>

      {/* 이름과 링크 사이의 점선. 꾸밈이라 읽지 않아요. 휴대폰에서는 숨겨요. */}
      <span aria-hidden="true" className="leader hidden sm:block" />

      {/* 소스 코드 저장소 링크. 화면에는 GitHub 아이콘만 보여요.
          링크 이름은 화면 낭독기용 글자(sr-only) "GitHub"예요. 아이콘은 이 이름과 같은 뜻이라 꾸밈으로 둬요(읽지 않음).
          어디로 가는 링크인지는 설명(aria-describedby)으로 덧붙여, 화면 낭독기가 "GitHub, 링크, 이 블로그의 소스 코드 저장소"처럼 읽어요.
          설명 글은 화면에서는 숨겨요(hidden). 숨긴 글도 aria-describedby로 가리키면 읽어 줘요.
          menu-link: 누르는 높이 44px, 좌우 안쪽 여백 10px → 아이콘 24px와 합쳐 44 × 44px.
          -mr-2.5: 오른쪽 안쪽 여백(10px)만큼 바깥으로 당겨, 아이콘 오른쪽 끝을 본문 오른쪽 끝에 딱 맞춰요(누르는 영역은 그대로예요).
          ml-auto: 점선이 없는 휴대폰에서도 오른쪽 끝에 붙어요. shrink-0: 좁아도 찌그러지지 않아요.
          self-start: 아주 좁은 화면에서 왼쪽 묶음이 두 줄이 되어도 아이콘은 첫 줄(오른쪽 위)에 있어요. */}
      <a
        href={site.repo.url}
        aria-describedby="github-link-desc"
        className="menu-link -mr-2.5 ml-auto shrink-0 self-start"
      >
        <PixelArt rows={GITHUB_MARK_ROWS} cell={2} />
        <span className="sr-only">GitHub</span>
      </a>
      <span id="github-link-desc" hidden>
        이 블로그의 소스 코드 저장소
      </span>
    </header>
  );
}
