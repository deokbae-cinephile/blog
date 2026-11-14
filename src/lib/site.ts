/**
 * @file 블로그 기본 정보 (site.ts)
 *
 * 이 파일이 하는 일
 *   블로그 이름, 소개 문구, 소스 코드 저장소처럼 여러 화면에서 함께 쓰는 "설정 값"을 한곳에 모아 둡니다.
 *
 * 왜 한곳에 모을까요?
 *   블로그 이름은 머리글, 브라우저 탭 제목, 설치 앱 이름 등 여러 곳에 나와요.
 *   곳곳에 글자를 직접 쓰면 이름을 바꿀 때 전부 찾아 고쳐야 하죠.
 *   여기에 한 번만 적고 가져다 쓰면, 이 파일만 고쳐도 모든 화면이 함께 바뀝니다.
 *
 * 누가 쓰나요?
 *   app/layout.tsx(탭 제목·검색 설명), app/manifest.ts(설치 앱 이름), components/site-header.tsx(이름·GitHub 링크),
 *   lib/github.ts(글을 저장할 저장소), app/sitemap.ts·robots.ts(전체 주소)
 */

/**
 * 블로그 정보 묶음(객체)입니다.
 *
 * 끝에 붙은 `as const`는 "이 값들은 바뀌지 않는 상수예요"라고 TypeScript에 알려 줍니다.
 * 그러면 실수로 `site.name = "다른 이름"`처럼 값을 바꾸려 할 때 타입 오류로 막아 줘요.
 */
export const site = {
  /** 블로그 이름. 머리글, 브라우저 탭 제목, 설치 앱 이름에 쓰입니다. */
  name: "DMB",
  /** 짧은 이름. 홈 화면에 설치한 앱 아이콘 아래에 보여요(길면 잘려서 짧게 둬요). */
  shortName: "DMB",
  /** 머리글 왼쪽에 보이는 이름. 탭 제목과 설치 앱 이름은 위의 짧은 이름(DMB)을 그대로 써요. */
  headerTitle: "DMB: 덕배의 영화 블로그",
  /** 글쓴이 이름. 검색엔진용 리뷰 정보(lib/structured-data.ts)의 글쓴이로 써요. */
  author: "덕배",
  /** 검색엔진과 설치 화면에 쓰이는 설명 */
  description: "본 영화마다 평점과 한줄평, 몇 줄의 감상을 남기는 가벼운 영화 리뷰 블로그입니다.",
  /**
   * 소스 코드와 리뷰 원고가 함께 들어 있는 GitHub 저장소예요.
   *   - 머리글 오른쪽의 [GitHub] 링크가 이 주소로 가요(components/site-header.tsx).
   *   - 글쓴이가 리뷰를 저장하면 서버가 이 저장소의 branch에 원고를 올려요(lib/github.ts).
   */
  repo: {
    /** 저장소 주인(GitHub 계정) */
    owner: "deokbae-cinephile",
    /** 저장소 이름 */
    name: "blog",
    /** 원고를 올릴 브랜치. 이 브랜치에 올라가면 호스팅이 블로그를 다시 배포해요. */
    branch: "main",
    /** 저장소 화면 주소 */
    url: "https://github.com/deokbae-cinephile/blog",
  },
} as const;

/**
 * 블로그가 올라가 있는 인터넷 주소(배포 주소)입니다.
 *
 * - 기본값은 이 블로그의 도메인(https://deokbae.blog)이에요.
 * - `process.env.SITE_URL`은 "환경 변수"예요. 프로그램 밖에서 넣어 주는 값이죠.
 *   다른 주소에 올릴 때만 넣어요. 넣지 않으면(또는 빈 값이면) 기본값을 써요.
 *   `A || B`는 "A가 없거나 빈 글자면 B를 쓴다"는 뜻이에요.
 * - 내 컴퓨터에서 개발할 때도 이 주소를 써요. 검색엔진에 알려 줄 대표 주소는 늘 실제 블로그를 가리켜야 하니까요.
 * - 마지막 `.replace(/\/$/, "")`는 주소 끝에 붙은 `/`를 하나 지웁니다.
 *   그래야 `${siteUrl}/reviews/...`처럼 이어 붙일 때 `//`가 생기지 않아요.
 *
 * 검색엔진 정보(대표 주소)와 사이트맵(sitemap.xml)에 넣을 "전체 주소"를 만들 때 씁니다.
 */
export const siteUrl = (process.env.SITE_URL || "https://deokbae.blog").replace(/\/$/, "");

/**
 * 공유 미리 보기 기본 그림(Open Graph). 링크를 카카오톡·메신저·SNS에 붙이면 카드에 보여요.
 * 파일은 public/og.png(1200 × 630)이고, 로고와 블로그 이름으로 scripts/make-icons.mjs(pnpm icons)가 만들어요.
 * 포스터가 있는 리뷰는 포스터를 대신 써요(app/reviews/[slug]/page.tsx).
 */
export const DEFAULT_SHARE_IMAGE = { url: "/og.png", width: 1200, height: 630, alt: site.headerTitle } as const;
