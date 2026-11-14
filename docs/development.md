# 개발 가이드

이 블로그의 코드를 처음 보는 프론트엔드 개발자를 위한 안내입니다. 코드 파일마다 맨 위에 "이 파일이 하는 일"을 적어 두었고, 줄마다 쉬운 주석을 달았으니 이 문서로 큰 그림을 잡은 뒤 파일을 열어 보세요.

## 1. 한눈에 보기

- **무엇을 만드나요?** 글쓴이 한 사람이 영화 리뷰를 쓰고 고치고 지우는 가벼운 블로그예요. 리뷰는 저장소의 Markdown 파일입니다.
- **어떻게 가볍나요?** 목록·상세 화면은 빌드할 때 HTML로 미리 만들어 둡니다(정적 생성). 방문자에게는 만든 화면을 캐시에서 그대로 주고, 서버 코드는 로그인·글쓰기·저장에만 돌아요.
- **어디서 도나요?** Cloudflare Workers예요. OpenNext 어댑터가 Next.js 앱을 Workers용으로 바꿔요(5장).
- **쓰는 기술:** Next.js 16(App Router, Proxy, Route Handler) · React 19 · TypeScript 6 · Tailwind CSS 4 · zod · unified(remark·rehype) · yaml · image-size · OpenNext Cloudflare 어댑터 · Wrangler
- **검사 도구:** ESLint(jsx-a11y) · Vitest + Testing Library · Playwright + axe

## 2. 폴더 구조

```
content/reviews/          리뷰 원고(.md). 파일 이름이 주소가 됩니다. _로 시작하는 파일은 읽지 않아요
content/templates/        원고 틀(review.md). 글쓰기 화면의 [Markdown 파일 불러오기]도 이 모양을 읽어요
public/                   포스터(posters/), 본문 사진(images/<주소>/), 앱 아이콘(icons/), 서비스 워커(sw.js),
                          Cloudflare가 정적 파일에 붙일 헤더(_headers)
src/
├─ proxy.ts               문지기: /write·/api/reviews·/api/images를 로그인 전에 막아요
├─ app/                   폴더 구조가 곧 주소예요
│  ├─ page.tsx            "/"                   영화 목록(정적)
│  ├─ reviews/[slug]/     "/reviews/<주소>"     리뷰 상세(정적, 빌드할 때 원고 수만큼)
│  ├─ login/              "/login"              글쓴이 로그인
│  ├─ write/              "/write", "/write/<주소>"  리뷰 추가·수정(요청마다 서버에서)
│  ├─ api/session/        로그인(POST)·로그아웃(DELETE)
│  ├─ api/images/         사진 한 장 올리기(POST) → GitHub blob
│  ├─ api/reviews/        리뷰 추가(POST), [slug]/ 수정(PUT)·삭제(DELETE)
│  ├─ offline/, not-found.tsx, manifest.ts, sitemap.ts, robots.ts
│  ├─ write/loading.tsx   글쓰기 화면을 준비하는 동안의 로딩 UI + 스켈레톤
│  └─ layout.tsx, globals.css, fonts/   공통 틀(포스터 SVG 필터 포함)·스타일·글꼴
├─ components/            화면 조각. 각 파일 옆에 *.test.tsx
│  ├─ review-browser.tsx  검색·장르·정렬과 목록(10편씩 무한 스크롤)
│  ├─ search-box.tsx      자동완성 검색창(콤보박스)
│  ├─ review-writer.tsx   리뷰 라이터(추가·수정 폼, Markdown 불러오기, 사진 넣기)
│  ├─ write-preview-panes.tsx, markdown-preview.tsx  본문 쓰기 칸 | 미리 보기(좁은 화면은 탭)
│  ├─ login-form.tsx, session-controls.tsx, admin-review-actions.tsx, delete-review.tsx
│  ├─ floating-buttons.tsx  가운데 아래 [+](리뷰 추가, 로그인했을 때만)와 오른쪽 아래 [맨 위로]
│  ├─ loading-status.tsx, skeleton.tsx  로딩 UI("불러오는 중▮" + 16칸 막대)와 글쓰기 스켈레톤
│  └─ poster.tsx(+ poster-image.tsx), rating.tsx, review-list-item.tsx, review-article.tsx, site-header.tsx …
├─ lib/                   화면이 아닌 코드(데이터·규칙). 각 파일 옆에 *.test.ts
│  ├─ load-reviews.ts, markdown.ts, review-schema.ts   빌드할 때 원고 읽기·검사·HTML 바꾸기
│  ├─ review-form.ts, review-file.ts                   글쓰기 칸 검사, 원고 ↔ 칸 값 바꾸기
│  ├─ review-store.ts, github.ts                       추가·수정·삭제 → GitHub 커밋
│  ├─ session.ts, password-hash.ts, admin-auth.ts      로그인 표(서명), 비밀번호 해시, 로그인 확인
│  └─ browse.ts, site.ts, genres.ts …                  검색·정렬 규칙, 블로그 정보, 장르 목록
e2e/                      E2E 테스트, 시험용 원고(fixtures/), 가짜 GitHub 서버(mock-github.mjs)
scripts/                  아이콘 만들기(make-icons.mjs), 로그인 비밀 값 만들기(admin-secrets.mjs)
open-next.config.ts       Cloudflare Workers용으로 바꾸는 설정(미리 만든 화면 캐시, 캐시 가로채기)
wrangler.jsonc            Cloudflare Workers 설정(워커 이름, 정적 파일, 이미지 최적화, 도메인)
```

## 3. 데이터 흐름

**읽기(누구나)**

```
content/reviews/*.md ──빌드──> lib/load-reviews.ts(검사·HTML) ──> 정적 HTML(목록·상세) ──> 방문자
```

원고에 실수가 있으면 빌드가 멈추고, 어느 파일의 어디를 어떻게 고칠지 한국어로 알려 줍니다. 그래서 잘못된 글은 배포되지 않아요.

**쓰기(글쓴이만)**

방문자에게는 로그인 링크를 보이지 않아요. 글쓴이는 `/login`으로 직접 가거나, `/write`에 가면 로그인 화면으로 보내져요.

```
/login ─(아이디·비밀번호)─> /api/session ─> 세션 쿠키(httpOnly) + 표시 쿠키
/write ─proxy.ts 확인─> 리뷰 라이터
   [저장] ─> /api/images(사진 한 장씩 → blob) ─> /api/reviews(검사 → 커밋 하나) ─> GitHub main
                                                       └─> GitHub Actions가 검사한 뒤 Cloudflare에 배포(몇 분)
```

- 사진은 요청 하나가 하는 일(CPU·메모리)을 작게 나누려고 한 장씩(최대 4MB) 먼저 올리고, 리뷰를 저장할 때 원고와 함께 커밋 하나로 묶어요.
- 저장하기 전에 서버가 빌드 때와 같은 규칙으로 다시 검사해요(칸, 주소 겹침, 포스터·사진 파일, 그사이 다른 곳에서 고쳤는지).
- 수정·삭제는 그 리뷰의 포스터(`<주소>.확장자`)와 사진 폴더(`public/images/<주소>/`) 가운데 더 쓰지 않는 파일도 함께 지워 저장소를 가볍게 둡니다. 다만 다른 리뷰 원고가 가져다 쓰는 파일은 남겨요(다른 원고를 GraphQL 요청 하나로 한꺼번에 읽어 확인해요).
- 본문 사진은 빌드와 같은 도구로 서버에서도 검사해서, `![설명][이름]` 같은 참조형 사진도 저장 전에 걸러요.

## 4. 로그인과 접근 막기

- **한 사람만:** 아이디(`ADMIN_ID`)와 비밀번호 해시(`ADMIN_PASSWORD_HASH`, scrypt)는 서버 환경 변수에만 있어요.
- **로그인 표:** `내용.서명` 모양의 토큰을 `SESSION_SECRET`으로 HMAC 서명해 httpOnly 쿠키에 담아요(7일). 웹 표준 Web Crypto만 써서 어느 호스팅에서나 돌아요.
- **이중 잠금:** `src/proxy.ts`가 쓰기 화면·API 앞에서 먼저 막고, API와 글쓰기 화면이 `lib/admin-auth.ts`로 한 번 더 확인해요. Next.js 문서도 proxy만 믿지 말라고 권해요.
- **CSRF:** 쿠키는 `SameSite=Lax`이고, 쓰기 API는 `Origin`이 우리 주소일 때만 받아요.
- **비밀번호 대입 막기:** 같은 IP에서 10분 동안 10번 틀리면, 비밀번호를 확인(계산)하기 전에 429로 막아요(`lib/login-limit.ts`). 기록은 서버 인스턴스마다 따로라, Cloudflare 속도 제한 규칙도 함께 걸어 두었어요(아래 "도메인 연결"의 속도 제한 규칙).
- **로그인 뒤 이동:** `?next=` 주소는 우리 사이트 안 주소만 받아요. 탭·줄바꿈을 섞어 다른 사이트로 보내는 주소도 막아요.
- **본문 링크:** `javascript:` 같은 위험한 방식의 링크는 HTML로 바꿀 때 주소를 지워요(`isSafeHref`).
- **화면의 단추:** 목록·상세는 정적 HTML이라, 비밀이 없는 표시 쿠키(`blog_admin=1`)로 [+](리뷰 추가)·[수정]·[삭제]를 보일지만 정해요. 실제 권한은 늘 서버가 확인해요.

## 5. 환경 변수와 배포(Cloudflare Workers)

블로그는 **Cloudflare Workers**에서 돌아요. OpenNext 어댑터(`@opennextjs/cloudflare`)가 `next build` 결과를 Workers용 코드(`.open-next/`)로 바꾸고, `wrangler.jsonc` 설정대로 올라가요. main에 커밋이 올라올 때마다(글쓰기 화면의 저장 포함) **GitHub Actions**(`.github/workflows/ci.yml`)가 검사를 돌리고, 통과하면 `deploy` 단계가 Cloudflare에 올려요. 공개 저장소의 GitHub Actions와 Cloudflare 배포는 횟수 제한이 없어서, 저장할 때마다 다시 배포하는 이 블로그에 맞아요.

| 이름 | 설명 |
|---|---|
| `ADMIN_ID` | 글쓴이 아이디 |
| `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` | `pnpm admin-secrets`가 비밀번호를 두 번 입력받아 만들어 줘요 |
| `GITHUB_CONTENT_TOKEN` | 이 저장소 하나에만 **Contents: Read and write**를 준 fine-grained 토큰 |
| `SITE_URL` | (선택) 대표 주소. 없으면 `https://deokbae.blog` |
| `GITHUB_REPOSITORY`, `GITHUB_BRANCH` | (선택) 다른 저장소·브랜치에 저장할 때만 |

로그인·저장 값 4개는 서버가 요청을 처리할 때 읽어요. 운영에서는 Cloudflare 워커의 비밀 값(Secret)으로, 내 컴퓨터에서는 `.env.local`에 넣어요.
`SITE_URL`만은 빌드할 때도 읽어요(미리 만든 화면의 대표 주소와 사이트맵에 들어가요). 다른 주소로 바꾸려면 `.github/workflows/ci.yml`의 배포 단계 `env`에 넣고 다시 배포해야 사이트맵까지 바뀌어요.

**배포 설정(처음 한 번)** — 2026-11-13에 이렇게 해 두었어요.

| 어디에 | 무엇을 |
|---|---|
| GitHub 저장소 → Settings → Secrets and variables → Actions | 비밀 값 `CLOUDFLARE_API_TOKEN`(Workers 배포 권한만 준 Cloudflare API 토큰), 변수 `CLOUDFLARE_ACCOUNT_ID`(Cloudflare 계정 번호) |
| Cloudflare 워커 `blog`의 비밀 값 | 위 표의 `ADMIN_ID`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `GITHUB_CONTENT_TOKEN` |

- 비밀 값 바꾸기: `pnpm exec wrangler login` 뒤 `pnpm exec wrangler secret put ADMIN_PASSWORD_HASH`처럼 하나씩 넣거나, Cloudflare 대시보드 → Workers & Pages → blog → Settings → Variables and Secrets에서 바꿔요. 비밀번호를 바꿀 때는 `pnpm admin-secrets`로 새 해시를 만들어요.
- `GITHUB_CONTENT_TOKEN`은 기한(1년)이 있어요. 기한이 지나면 저장이 실패하니, 같은 권한으로 새로 만들어 바꿔 넣어요.
- 배포는 GitHub Actions에 맡겨요. 내 컴퓨터에서 `opennextjs-cloudflare deploy`로 직접 올리면, OpenNext가 `.env.local` 같은 `.env` 파일의 값을 워커 코드에 기본값으로 함께 넣어서 시험용 값(가짜 GitHub 주소 등)이 운영 워커에 실릴 수 있어요.
- 처음 배포한 주소는 `https://blog.deokbae.workers.dev`였고, 아래 "도메인 연결"로 `deokbae.blog`를 붙이면서 닫았어요.

**무료 플랜 한도와 이 블로그** — 요청 하나에 CPU 10ms, 하루 요청 10만 건, 이미지 변환 한 달 5,000개(넘으면 새 변환만 실패하고 요금은 없어요). 아래는 내 컴퓨터의 Workers 런타임(workerd)으로 잰 값이에요(2026-11).

| 요청 | CPU(데워진 뒤) | 워커가 막 깨어난 첫 요청 |
|---|---|---|
| 목록·상세·로그인 화면(미리 만든 화면) | 약 3ms | 약 10ms |
| 로그인(비밀번호 확인, scrypt) | 약 30ms | 약 220ms |
| 추가·수정 화면 | 약 9~13ms | 약 50~130ms |
| 추가·수정·삭제 / 사진 한 장(3.5MB) | 약 7~12ms / 약 20ms | 약 10~30ms |

- 방문자 화면은 한도 안이에요. `open-next.config.ts`의 캐시 가로채기 덕분에 첫 요청도 Next.js 서버를 불러오지 않아요.
- 글쓴이 기능은 한도를 넘어요. Cloudflare는 가끔 넘는 요청은 봐주지만, 계속 넘으면 그 요청을 오류 1102로 끊어요. 혼자 가끔 쓰는 정도라 무료로 시작하고, 로그인·저장이 1102로 자주 막히면 **Workers Paid(월 5달러, 요청당 CPU 30초)**로 올리세요. 코드는 고치지 않아도 돼요.
- 대시보드 → blog → Observability에서 요청별 CPU 시간과 "Exceeded CPU Time Limits"를 볼 수 있어요.
- `src/proxy.ts`는 Node.js 런타임에서 돌고, OpenNext는 이를 "실험 기능"으로 지원해요(빌드할 때 경고가 떠요). 혹시 막혀도 API와 글쓰기 화면이 로그인을 한 번 더 확인해서 잠금은 그대로예요.

**내 컴퓨터에서 Workers처럼 띄워 보기** — `pnpm cf:preview`는 Workers용으로 빌드한 뒤 Cloudflare의 Workers 런타임으로 http://localhost:8787 에 띄워요. `.env.local`을 읽고, 아래 8장의 가짜 GitHub 서버와 함께 쓰면 저장까지 시험할 수 있어요.

**도메인 연결(deokbae.blog)** — 2026-11-14에 연결했어요. 도메인은 호스팅케이알(hosting.kr)에 등록돼 있고, DNS는 Cloudflare가 맡아요(무료 플랜은 네임서버를 통째로 옮기는 방식만 돼요).

| 어디에 | 무엇을 |
|---|---|
| 호스팅케이알 → 도메인 관리 → deokbae.blog → 네임서버 주소변경 | 1차 `damiete.ns.cloudflare.com`, 2차 `lovisa.ns.cloudflare.com` |
| Cloudflare 계정 | 영역(zone) `deokbae.blog`(Free). 예전 GitHub Pages 기록은 가져오지 않았어요 |
| `wrangler.jsonc`의 `routes` | `deokbae.blog`, `www.deokbae.blog`를 Custom Domain으로. 배포할 때 DNS 기록과 HTTPS 인증서가 자동으로 만들어져요 |

- 처음 주소 `https://blog.deokbae.workers.dev`와 버전 미리보기 주소는 닫았어요(`wrangler.jsonc`의 `"workers_dev": false`, `"preview_urls": false`). 블로그 주소는 `https://deokbae.blog` 하나예요. `www.deokbae.blog`도 같은 블로그를 보여 주고, 화면마다 대표 주소를 `https://deokbae.blog/...`로 알려요.
- **속도 제한 규칙(2026-11-14 설정):** Cloudflare 대시보드 → deokbae.blog → Security → WAF → Rate limiting rules의 `로그인 시도 제한`. URI Path가 `/api/session`인 요청이 IP마다 10초에 5번을 넘으면 10초 동안 막아요(429, error code 1015). 무료 플랜은 규칙 1개, 조건은 경로만, 시간은 10초로 정해져 있어요. 세는 데 약간의 지연이 있어서 짧게 몰아친 요청 몇 개는 통과할 수 있고, 그 뒤는 서버의 실패 횟수 제한이 함께 막아요. workers.dev 주소를 모두 닫아서 모든 요청이 이 규칙을 지나요.

## 6. 화면 규칙

- **색:** `globals.css`의 변수(`--crt-*`)만 써요. 형광 초록 한 가지라, 오류·고른 것은 빨강 대신 **반전**(초록 바탕)과 모양(점선 테두리, ▶)으로 알려요.
- **글자:** Neo둥근모 16px과 32px(`text-big`)만 써요. 굵게·기울임 대신 반전과 밑줄을 써요.
- **포스터·사진:** 원본 파일은 그대로 두고, 화면에서만 SVG 필터(`#crt-phosphor`, `app/layout.tsx`)로 흑백 → 4단계 명암 → 형광 초록으로 바꾸고 주사선을 덮어요. 포스터 상자는 늘 2:3이고, 없으면 기본 포스터를 보여요.
- **넓은 화면(1024px~):** 목록은 [검색 칸 16~18rem | 목록], 상세는 [포스터 | 본문(오른쪽 칸 전체)], 글쓰기는 [포스터 | 영화 정보 2열 × 5행] 3칸이에요. 검색 칸과 상세의 포스터는 키가 충분한 화면에서 스크롤해도 붙어 있어요.
- **머리글:** 왼쪽 [로고] DMB: 덕배의 영화 블로그, 오른쪽 [GitHub]. 두 쪽은 아이콘(24 × 24px)·간격·글자 모양이 같아요. 탭 제목과 설치 앱 이름은 짧게 "DMB"예요.
- **목록 한 편:** [썸네일 2:3 | 제목·평점 / 원제·연도·감독·장르 / 한줄평]. 한줄평은 썸네일 아래 끝에 맞춰요.
- **장르:** 가나다순(공포·다큐멘터리·드라마·로맨스·범죄·스릴러·스포츠·액션·재난·코미디). 목록의 장르 단추와 글쓰기 칸이 같은 순서예요.
- **상세 머리 안내판:** 장르(제목 위) → 제목 → 원제·연도·국가·상영 시간·감독, 오른쪽에 큰 평점.
- **떠 있는 단추:** 로그인했을 때 화면 가운데 아래에 44 × 44px [+](리뷰 추가), 오른쪽 아래에 [맨 위로](내려 읽었을 때). 글쓰기 화면에서는 [+]를 숨겨요.
- **로딩·스켈레톤:**
  - 로딩 UI는 옛 DOS 프로그램처럼 "불러오는 중▮"(1초에 한 번 깜빡이는 커서)과 칸이 하나씩 차오르는 16칸 막대예요(`role="status"`).
  - 글쓰기 화면을 준비하는 동안(`app/write/loading.tsx`) 글쓰기 모양의 스켈레톤을 그리고, 제목 자리에 로딩 UI를 놓아 내용이 들어와도 화면이 밀리지 않아요. 저장소에서 원고를 읽는 수정 화면에서 자주 보여요.
  - 목록·상세에는 `loading.tsx`를 두지 않아요. 미리 만든 화면이라 기다릴 일이 거의 없는데, 두면 Next.js가 HTML 맨 앞에 로딩 화면을 넣고 내용을 잠시 뒤 바꿔 넣어서 열 때마다 스켈레톤이 번쩍이거든요.
  - 포스터는 그림이 오기 전까지 액자 안에 스켈레톤을 깔고, 오면 치워요. 미리 보기는 변환 도구를 처음 받는 동안 로딩 UI와 글줄 스켈레톤을 보여요.
  - 스켈레톤은 눈이 편하도록 움직이지 않는 옅은 초록 칸이에요(테두리·지나가는 빛 없음). 꾸밈이라 `aria-hidden`이에요.
  - 움직이는 것은 로딩 UI의 커서·막대뿐이고, 동작 줄이기(`prefers-reduced-motion`)를 켜면 그것도 멈춰요.
- **글쓰기 화면:**
  - 칸 아래 도움말은 주소(영문)에만 둬요(예: shutter-island → /reviews/shutter-island). 나머지는 틀렸을 때 오류 문구가 고치는 방법을 알려요.
  - [포스터 고르기]·[포스터 빼기]는 포스터와 같은 너비예요. 평점은 처음에 5.0이 골라져 있고, ▼는 왼쪽 글자 여백(12px)과 같은 간격으로 놓여요.
  - 본문은 [Markdown 입력 | 미리 보기]로 나란히 보여요. 미리 보기는 상세 화면과 같은 변환(`lib/markdown.ts`)을 쓰고, 아직 올리지 않은 사진은 임시 주소(blob:)로 보여요. 좁은 화면은 같은 두 쪽을 탭으로 바꿔 봐요.

## 7. 키보드와 접근성

- 목록: ▲▼(또는 ◀▶) 이전·다음 리뷰 고르기, Home·End 처음·끝, Enter 열기. 검색창: ▲▼ 추천 고르기, Enter 찾기, Esc 추천 닫기(APG 콤보박스).
- 상세: ◀▶ 이전·다음 리뷰, Esc 목록으로. 한 글자 단축키는 쓰지 않아요(KWCAG 6.1.4).
- 무한 스크롤은 [n편 더 보기] 단추와 함께 써요. 단추로 불러오면(또는 단추에 초점이 있을 때 저절로 불러오면) 새로 나온 첫 리뷰로 초점이 가요.
- 폼: 칸마다 보이는 이름과 "(필수)", 틀린 칸에 `aria-invalid` + 오류 문구(`aria-describedby`·`aria-errormessage`), 저장할 때 "고칠 곳" 목록으로 초점 이동.
- 본문 탭(좁은 화면): APG 탭 패턴(`tablist`·`tab`·`tabpanel`, ← → Home End, roving tabindex). 넓은 화면의 미리 보기는 키보드로 스크롤할 수 있는 이름 있는 영역(`region`)이에요.
- 삭제 확인은 네이티브 `<dialog>`(`role="alertdialog"`)이고, 처음 초점은 [취소]예요.

## 8. 테스트

| 명령 | 내용 |
|---|---|
| `pnpm test` | 단위 테스트. 원고 형식(content.test.ts), 로그인 표·비밀번호, proxy, API, 저장 로직, 화면 조각 |
| `pnpm e2e` | 시험용 원고로 빌드해 진짜 브라우저로 확인. 가짜 GitHub 서버(`e2e/mock-github.mjs`)를 함께 띄워 로그인 → 추가 → 커밋 → 수정 → 삭제까지 시험해요. 가짜 서버의 `POST /__delay?ms=`로 답을 늦춰 로딩 화면도 시험해요 |

다른 프로그램이 E2E 포트(3100·3101)를 쓰고 있으면 Playwright가 그 서버를 블로그로 잘못 쓸 수 있어요. 그럴 때는 `E2E_PORT=3760 MOCK_GITHUB_PORT=3761 pnpm e2e`처럼 비어 있는 포트로 돌려요.

내 컴퓨터에서 글쓰기 화면을 써 보고 싶으면, 가짜 GitHub 서버를 띄우고(`node e2e/mock-github.mjs`) `.env.local`에 `GITHUB_API_URL=http://127.0.0.1:3101`과 `GITHUB_CONTENT_TOKEN=e2e-token`을 넣으면 진짜 저장소를 건드리지 않고 저장해 볼 수 있어요. `pnpm dev`와 `pnpm cf:preview` 모두 같은 방법으로 돼요.

CI(GitHub Actions)의 검사(`check`)는 Node.js 서버(`pnpm build` → `pnpm start`)로 하고, Workers용 빌드는 검사가 통과한 뒤 배포(`deploy`) 단계에서 해요. 검사나 Workers용 빌드가 실패하면 배포되지 않고 이전 버전이 그대로 남아요.
