/**
 * @file 모든 화면의 공통 틀 (app/layout.tsx)
 *
 * 이 파일이 하는 일
 *   Next.js의 "루트 레이아웃"이에요. 모든 페이지가 이 틀 안에 들어갑니다.
 *   <html>, <body>처럼 페이지마다 똑같은 뼈대와, 머리글·바닥글처럼 모든 화면에 나오는 부분을 여기서 한 번만 그려요.
 *
 *     <html>
 *       <body>
 *         [본문 바로가기]  ← 키보드 사용자를 위한 건너뛰기 링크
 *         <SiteHeader />   ← 머리글
 *         <main>{children}</main>  ← 여기에 각 페이지(목록, 상세, 404)가 들어와요
 *         <SiteFooter />   ← 바닥글
 *       </body>
 *     </html>
 *
 * 맡은 기능
 *   1. 글꼴(Neo둥근모) 불러오기
 *   2. 전역 스타일(globals.css) 불러오기
 *   3. 기본 메타데이터: 브라우저 탭 제목 규칙, 검색엔진 설명, 설치 앱 정보
 *   4. 본문 바로가기 링크(키보드로 머리글을 건너뛰기)
 *   5. 포스터·사진을 형광 초록 4단계 명암으로 바꾸는 SVG 필터
 *
 * Next.js App Router의 약속
 *   app 폴더 안의 layout.tsx, page.tsx 같은 "정해진 이름"의 파일은 Next.js가 알아서 찾아 써요.
 *   - layout.tsx: 틀, page.tsx: 페이지, not-found.tsx: 없는 주소 화면
 *   - `export const metadata`: 그 페이지의 <title>, <meta>를 정해요.
 */

import type { Metadata, Viewport } from "next";
// next/font/local: 내 프로젝트 안의 글꼴 파일을 불러오는 Next.js 도구예요.
// 글꼴을 미리 받아 두도록(preload) 설정해 주고, 다른 사이트(CDN)를 거치지 않아 빠르고 안전해요.
import localFont from "next/font/local";
import type { ReactNode } from "react";

import { ServiceWorker } from "@/components/service-worker";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { site, siteUrl } from "@/lib/site";

// 전역 스타일. 여기서 한 번 불러오면 모든 페이지에 적용돼요.
import "./globals.css";

/**
 * Neo둥근모 글꼴
 *
 * - 1990년대 DOS 시절 한글 글꼴 "둥근모꼴"을 트루타입으로 옮긴 픽셀 글꼴이에요. 레트로 단말기 느낌에 딱 맞죠.
 * - 배포 파일(fonts/neodgm.woff2)을 고치지 않고 그대로 써요. 파일 전체가 44KB로 작아요.
 *   글꼴 라이선스(SIL OFL 1.1)는 글꼴 파일과 함께 라이선스 전문을 두라고 해서, 같은 폴더의 OFL.txt는 지우지 않아요.
 * - 16px 격자로 그린 글꼴이라 16px, 32px처럼 16의 배수 크기에서 픽셀이 또렷해요.
 */
const neodgm = localFont({
  // 이 파일(layout.tsx) 기준의 상대 경로예요.
  src: "./fonts/neodgm.woff2",
  // CSS 변수 이름. globals.css에서 var(--font-neodgm)으로 이 글꼴을 써요.
  variable: "--font-neodgm",
  // swap: 글꼴을 받는 동안 기본 글꼴로 먼저 보여 주고, 다 받으면 바꿔요. 글자가 안 보이는 시간이 없어요.
  display: "swap",
  // Next.js가 크기를 맞춘 대체 글꼴을 따로 만드는 기능이에요. 픽셀 글꼴과는 잘 맞지 않아 꺼요.
  adjustFontFallback: false,
  // 글꼴을 받기 전이나 못 받았을 때 쓸 글꼴. 비슷한 고정폭(monospace) 글꼴을 써요.
  fallback: ["ui-monospace", "monospace"],
});

/**
 * 모든 페이지에 들어가는 기본 메타데이터(<head> 안의 정보)
 *
 * 페이지 파일에서 metadata를 따로 정하면 그 페이지에서는 그 값이 우선해요.
 */
export const metadata: Metadata = {
  // 대표 주소 같은 "상대 주소"를 "전체 주소"로 바꿀 때 기준이 되는 주소예요.
  metadataBase: new URL(`${siteUrl}/`),
  // 브라우저 탭 제목 규칙
  //  - default: 페이지가 제목을 정하지 않으면 "덕배의 영화 블로그"
  //  - template: 페이지가 "겨울 정류장 리뷰"라고 정하면 "겨울 정류장 리뷰 — 덕배의 영화 블로그" (%s 자리에 들어가요)
  title: { default: site.name, template: `%s — ${site.name}` },
  // 검색 결과에 보이는 설명
  description: site.description,
  applicationName: site.name,
  // Open Graph: 카카오톡·메신저 등에 링크를 붙였을 때 보이는 제목·설명이에요(그림 카드는 가볍게 하려고 만들지 않아요).
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: "ko_KR",
    title: site.name,
    description: site.description,
  },
  // 아이폰 사파리가 숫자(예: 연도)를 전화번호로 착각해 링크로 바꾸지 않게 해요.
  formatDetection: { telephone: false },
  // 아이폰·아이패드 홈 화면에 추가했을 때: 앱 창으로 열고(capable), 아이콘 아래 이름과 상단 막대 색을 정해요.
  // (설치 정보의 나머지는 app/manifest.ts, 홈 화면 아이콘은 app/apple-icon.png에 있어요.)
  appleWebApp: { capable: true, title: site.shortName, statusBarStyle: "black" },
};

/**
 * 화면(뷰포트) 설정
 * - themeColor: 휴대폰 브라우저 주소창 색을 화면 배경색(거의 검정)에 맞춰요.
 * - colorScheme: 이 사이트는 어두운 화면이라고 알려 줘요. 스크롤바 같은 기본 요소도 어둡게 그려져요.
 */
export const viewport: Viewport = {
  themeColor: "#020802",
  colorScheme: "dark",
};

/**
 * 포스터·사진을 형광 초록으로 칠하는 SVG 필터의 마지막 단계(회색 → 초록) 값이에요.
 *
 * 행렬은 한 줄이 결과 색 하나(R, G, B, A)예요. 앞 단계에서 회색(R=G=B)이 된 그림에
 * 빨강·초록·파랑을 각각 형광 초록 #39FF14의 비율만큼 곱하면 초록으로 칠해져요.
 *   빨강 57/255 ≈ 0.224, 초록 1, 파랑 20/255 ≈ 0.078
 */
const PHOSPHOR_TINT = "0.224 0 0 0 0  0 1 0 0 0  0 0 0.078 0 0  0 0 0 1 0";

/**
 * 루트 레이아웃 컴포넌트
 *
 * `export default`: 이 파일의 "대표" 내보내기예요. Next.js는 layout.tsx의 대표 내보내기를 틀로 씁니다.
 *
 * @param children 지금 주소에 맞는 페이지(app/page.tsx 등)가 들어오는 자리
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // lang="ko": 이 페이지의 기본 언어는 한국어예요. 화면 낭독기가 한국어 발음으로 읽어요.
    // neodgm.variable: --font-neodgm 변수를 정의하는 클래스를 붙여요.
    <html lang="ko" className={neodgm.variable}>
      {/* flex flex-col: 머리글·본문·바닥글을 세로로 쌓아요. 본문(main)이 남는 높이를 모두 차지해서(flex-1),
          글이 짧은 화면(404 등)에서도 바닥글이 화면 맨 아래에 붙어요. */}
      <body className="flex flex-col">
        {/* 본문 바로가기: 키보드 Tab을 처음 누르면 나타나는 링크예요. 머리글을 건너뛰고 본문으로 바로 가요.
            평소에는 화면 위로 숨겨 두었다가(-translate-y-[200%]) 초점을 받으면 내려와요(focus-visible:translate-y-0).
            z-[60]: 화면 효과 막(globals.css의 z-index 50, 51)보다 위에 둬서 어두운 그늘에 가리지 않게 해요. */}
        <a
          href="#main"
          className="inverse fixed top-3 left-3 z-[60] -translate-y-[200%] px-3 py-2 no-underline focus-visible:translate-y-0"
        >
          본문 바로가기
        </a>

        {/* 포스터·사진을 형광 초록 4단계 명암으로 바꾸는 SVG 필터예요. CSS에서 filter: url(#crt-phosphor)로 불러 써요(globals.css).
            원본 그림 파일은 그대로 두고 화면에 그릴 때만 바꿔요.
            그림을 그리는 SVG가 아니라 "필터 정의"만 담은 상자라서 크기를 0으로 두고 화면 낭독기에서도 숨겨요.
            (display: none으로 숨기면 몇몇 브라우저에서 필터까지 사라져서, 크기 0 + absolute로 숨깁니다.) */}
        <svg aria-hidden="true" width="0" height="0" className="absolute">
          {/* colorInterpolationFilters="sRGB": 색 계산을 화면 색 공간(sRGB) 그대로 해서 결과 색이 예측한 대로 나와요. */}
          <filter id="crt-phosphor" colorInterpolationFilters="sRGB">
            {/* 1단계: 흑백으로. 빨강·초록·파랑에 사람 눈이 느끼는 밝기 비율(0.2126, 0.7152, 0.0722)을 곱해 더해요.
                세 줄 모두 같은 식이라 R=G=B, 즉 회색이 돼요. */}
            <feColorMatrix
              type="matrix"
              values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"
            />
            {/* 2단계: 밝기를 4단계로 줄여요(discrete = 계단식). 0~25%는 0.04, 25~50%는 0.3, 50~75%는 0.62, 75~100%는 1이 돼요. */}
            <feComponentTransfer>
              <feFuncR type="discrete" tableValues="0.04 0.3 0.62 1" />
              <feFuncG type="discrete" tableValues="0.04 0.3 0.62 1" />
              <feFuncB type="discrete" tableValues="0.04 0.3 0.62 1" />
            </feComponentTransfer>
            {/* 3단계: 회색을 형광 초록으로 칠해요(위의 PHOSPHOR_TINT 설명 참고). */}
            <feColorMatrix type="matrix" values={PHOSPHOR_TINT} />
          </filter>
        </svg>

        <SiteHeader />

        {/* <main>: 페이지의 주요 내용이라는 뜻이에요. id="main"은 위 바로가기 링크의 목적지예요.
            tabIndex={-1}: 원래 초점을 받지 않는 요소지만, 바로가기로 왔을 때 초점을 받을 수 있게 해요(Tab 순서에는 안 들어가요).
            outline-none: 그때 생기는 초점 테두리는 지워요(단추가 아니라 본문 영역이라서요). */}
        <main id="main" tabIndex={-1} className="w-full flex-1 px-4 pt-10 outline-none sm:px-8 lg:px-12">
          {children}
        </main>

        <SiteFooter />

        {/* 서비스 워커 등록(앱 설치·오프라인 읽기). 화면에는 아무것도 그리지 않아요. */}
        <ServiceWorker />
      </body>
    </html>
  );
}
