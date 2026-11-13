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
│  ├─ write/              "/write", "/write/<주소>"  새 리뷰 쓰기·고치기(요청마다 서버에서)
│  ├─ api/session/        로그인(POST)·로그아웃(DELETE)
│  ├─ api/images/         사진 한 장 올리기(POST) → GitHub blob
│  ├─ api/reviews/        새 리뷰 저장(POST), [slug]/ 고치기(PUT)·지우기(DELETE)
│  ├─ offline/, not-found.tsx, manifest.ts, sitemap.ts, robots.ts
│  └─ layout.tsx, globals.css, fonts/   공통 틀(포스터 SVG 필터 포함)·스타일·글꼴
├─ components/            화면 조각. 각 파일 옆에 *.test.tsx
│  ├─ review-browser.tsx  검색·장르·정렬과 목록(10편씩 무한 스크롤)
│  ├─ search-box.tsx      자동완성 검색창(콤보박스)
│  ├─ review-writer.tsx   리뷰 라이터(글쓰기·고치기 폼, Markdown 불러오기, 사진 넣기)
│  ├─ login-form.tsx, session-controls.tsx, admin-review-actions.tsx, delete-review.tsx
│  └─ poster.tsx, rating.tsx, review-list-item.tsx, review-article.tsx, site-header.tsx …
├─ lib/                   화면이 아닌 코드(데이터·규칙). 각 파일 옆에 *.test.ts
│  ├─ load-reviews.ts, markdown.ts, review-schema.ts   빌드할 때 원고 읽기·검사·HTML 바꾸기
│  ├─ review-form.ts, review-file.ts                   글쓰기 칸 검사, 원고 ↔ 칸 값 바꾸기
│  ├─ review-store.ts, github.ts                       저장·고치기·지우기 → GitHub 커밋
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

```
/login ─(아이디·비밀번호)─> /api/session ─> 세션 쿠키(httpOnly) + 표시 쿠키
/write ─proxy.ts 확인─> 리뷰 라이터
   [저장] ─> /api/images(사진 한 장씩 → blob) ─> /api/reviews(검사 → 커밋 하나) ─> GitHub main
                                                       └─> Cloudflare Workers Builds가 다시 빌드·배포(몇 분)
```

- 사진은 요청 하나가 하는 일(CPU·메모리)을 작게 나누려고 한 장씩(최대 4MB) 먼저 올리고, 리뷰를 저장할 때 원고와 함께 커밋 하나로 묶어요.
- 저장하기 전에 서버가 빌드 때와 같은 규칙으로 다시 검사해요(칸, 주소 겹침, 포스터·사진 파일, 그사이 다른 곳에서 고쳤는지).
- 고치기·지우기는 그 리뷰의 포스터(`<주소>.확장자`)와 사진 폴더(`public/images/<주소>/`) 가운데 더 쓰지 않는 파일도 함께 지워 저장소를 가볍게 둡니다.

## 4. 로그인과 접근 막기

- **한 사람만:** 아이디(`ADMIN_ID`)와 비밀번호 해시(`ADMIN_PASSWORD_HASH`, scrypt)는 서버 환경 변수에만 있어요.
- **로그인 표:** `내용.서명` 모양의 토큰을 `SESSION_SECRET`으로 HMAC 서명해 httpOnly 쿠키에 담아요(7일). 웹 표준 Web Crypto만 써서 어느 호스팅에서나 돌아요.
- **이중 잠금:** `src/proxy.ts`가 쓰기 화면·API 앞에서 먼저 막고, API와 글쓰기 화면이 `lib/admin-auth.ts`로 한 번 더 확인해요. Next.js 문서도 proxy만 믿지 말라고 권해요.
- **CSRF:** 쿠키는 `SameSite=Lax`이고, 쓰기 API는 `Origin`이 우리 주소일 때만 받아요.
- **화면의 단추:** 목록·상세는 정적 HTML이라, 비밀이 없는 표시 쿠키(`blog_admin=1`)로 [새 리뷰]·[고치기]·[지우기]를 보일지만 정해요. 실제 권한은 늘 서버가 확인해요.

## 5. 환경 변수와 배포(Cloudflare Workers)

블로그는 **Cloudflare Workers**에서 돌아요. OpenNext 어댑터(`@opennextjs/cloudflare`)가 `next build` 결과를 Workers용 코드(`.open-next/`)로 바꾸고, `wrangler.jsonc` 설정대로 올라가요. main에 커밋이 올라올 때마다(글쓰기 화면의 저장 포함) Cloudflare의 **Workers Builds**가 다시 빌드·배포해요. Workers Builds는 배포 횟수가 아니라 빌드 시간으로 세서(무료 한 달 3,000분), 저장할 때마다 다시 배포하는 이 블로그에 맞아요.

| 이름 | 설명 |
|---|---|
| `ADMIN_ID` | 글쓴이 아이디 |
| `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` | `pnpm admin-secrets`가 비밀번호를 두 번 입력받아 만들어 줘요 |
| `GITHUB_CONTENT_TOKEN` | 이 저장소 하나에만 **Contents: Read and write**를 준 fine-grained 토큰 |
| `SITE_URL` | (선택) 대표 주소. 없으면 `https://deokbae.blog` |
| `GITHUB_REPOSITORY`, `GITHUB_BRANCH` | (선택) 다른 저장소·브랜치에 저장할 때만 |

모두 서버가 요청을 처리할 때 읽는 값이라, 빌드 변수는 따로 넣지 않아도 돼요. 내 컴퓨터에서는 `.env.local`에 넣어요.

**처음 배포하기**

1. Cloudflare 대시보드 → Workers & Pages → **Create application** → **GitHub**에서 `deokbae-cinephile/blog`를 고릅니다.
2. 이름은 `blog`(`wrangler.jsonc`의 `name`과 다르면 빌드가 실패해요), Build command는 `pnpm exec opennextjs-cloudflare build`, Deploy command는 `pnpm exec opennextjs-cloudflare deploy`로 넣고 **Save and Deploy**를 눌러요.
3. Settings → Build → Branch control에서 **Enable Preview Builds**를 꺼요. main이 아닌 브랜치의 미리보기 빌드는 화면 캐시를 채우지 않아 목록이 깨지고 빌드 시간만 써요.
4. Settings → **Variables and Secrets** → Add로 위 네 값을 **Secret**으로 넣고 Deploy를 눌러 반영해요.
5. `https://blog.<계정 이름>.workers.dev`에서 확인한 뒤 아래 "도메인 연결"로 `deokbae.blog`를 붙여요.

> 내 컴퓨터에서 `opennextjs-cloudflare deploy`로 직접 올리지 마세요. OpenNext는 `.env.local` 같은 `.env` 파일의 값을 워커 코드에 기본값으로 함께 넣어서, 시험용 값(가짜 GitHub 주소 등)이 운영 워커에 실릴 수 있어요. 배포는 Workers Builds에 맡겨요.

**무료 플랜 한도와 이 블로그** — 요청 하나에 CPU 10ms, 하루 요청 10만 건, 이미지 변환 한 달 5,000개(넘으면 새 변환만 실패하고 요금은 없어요). 아래는 내 컴퓨터의 Workers 런타임(workerd)으로 잰 값이에요(2026-11).

| 요청 | CPU(데워진 뒤) | 워커가 막 깨어난 첫 요청 |
|---|---|---|
| 목록·상세·로그인 화면(미리 만든 화면) | 약 3ms | 약 10ms |
| 로그인(비밀번호 확인, scrypt) | 약 30ms | 약 220ms |
| 글쓰기·고치기 화면 | 약 9~13ms | 약 50~130ms |
| 저장·고치기·지우기 / 사진 한 장(3.5MB) | 약 7~12ms / 약 20ms | 약 10~30ms |

- 방문자 화면은 한도 안이에요. `open-next.config.ts`의 캐시 가로채기 덕분에 첫 요청도 Next.js 서버를 불러오지 않아요.
- 글쓴이 기능은 한도를 넘어요. Cloudflare는 가끔 넘는 요청은 봐주지만, 계속 넘으면 그 요청을 오류 1102로 끊어요. 혼자 가끔 쓰는 정도라 무료로 시작하고, 로그인·저장이 1102로 자주 막히면 **Workers Paid(월 5달러, 요청당 CPU 30초)**로 올리세요. 코드는 고치지 않아도 돼요.
- 대시보드 → blog → Observability에서 요청별 CPU 시간과 "Exceeded CPU Time Limits"를 볼 수 있어요.
- `src/proxy.ts`는 Node.js 런타임에서 돌고, OpenNext는 이를 "실험 기능"으로 지원해요(빌드할 때 경고가 떠요). 혹시 막혀도 API와 글쓰기 화면이 로그인을 한 번 더 확인해서 잠금은 그대로예요.

**내 컴퓨터에서 Workers처럼 띄워 보기** — `pnpm cf:preview`는 Workers용으로 빌드한 뒤 Cloudflare의 Workers 런타임으로 http://localhost:8787 에 띄워요. `.env.local`을 읽고, 아래 8장의 가짜 GitHub 서버와 함께 쓰면 저장까지 시험할 수 있어요.

**도메인 연결(deokbae.blog)** — 도메인은 호스팅케이알(hosting.kr)에 등록돼 있고 네임서버도 호스팅케이알이에요(2026-11-13 기준, 지금은 GitHub Pages를 가리키는 기록만 있어요). 워커에 도메인을 붙이려면 DNS를 Cloudflare로 옮겨야 해요(무료 플랜은 네임서버를 통째로 옮기는 방식만 돼요).

1. Cloudflare 대시보드 → **Add a domain**에 `deokbae.blog`를 넣고 Free 플랜을 고릅니다. 기존 DNS 기록을 읽어 와요.
2. 읽어 온 기록 가운데 GitHub Pages를 가리키는 것(`A 185.199.108~111.153`, `www CNAME deokbae-cinephile.github.io`)을 지워요. 그 자리에 워커용 기록이 새로 만들어져요(CNAME이 남아 있는 이름에는 워커를 붙일 수 없어요).
3. Cloudflare가 알려 준 네임서버 두 개를 호스팅케이알 관리 화면의 네임서버 변경에 넣어요. Cloudflare에서 도메인이 Active가 되면 끝이에요(몇 분~하루).
4. `wrangler.jsonc`의 `"routes"` 줄 앞 `//`를 지우고 main에 올려요. 다음 배포 때 Cloudflare가 DNS 기록과 HTTPS 인증서를 알아서 만들어요.
5. (선택) www 주소도 받으려면 `www`에 프록시(주황 구름) DNS 기록을 하나 두고, Rules → Redirect Rules의 "Redirect from WWW to root" 템플릿으로 `deokbae.blog`에 넘겨요.

## 6. 화면 규칙

- **색:** `globals.css`의 변수(`--crt-*`)만 써요. 형광 초록 한 가지라, 오류·고른 것은 빨강 대신 **반전**(초록 바탕)과 모양(점선 테두리, ▶)으로 알려요.
- **글자:** Neo둥근모 16px과 32px(`text-big`)만 써요. 굵게·기울임 대신 반전과 밑줄을 써요.
- **포스터·사진:** 원본 파일은 그대로 두고, 화면에서만 SVG 필터(`#crt-phosphor`, `app/layout.tsx`)로 흑백 → 4단계 명암 → 형광 초록으로 바꾸고 주사선을 덮어요. 포스터 상자는 늘 2:3이고, 없으면 기본 포스터를 보여요.
- **넓은 화면(1024px~):** 목록은 [검색 칸 16~18rem | 목록], 상세는 [포스터·정보표 | 본문(오른쪽 칸 전체)]. 검색 칸과 정보표는 키가 충분한 화면에서 스크롤해도 붙어 있어요.

## 7. 키보드와 접근성

- 목록: ▲▼ 리뷰 고르기, Home·End 처음·끝, Enter 열기. 검색창: ▲▼ 추천 고르기, Enter 찾기, Esc 추천 닫기(APG 콤보박스).
- 상세: ◀▶ 이전·다음 리뷰, Esc 목록으로. 한 글자 단축키는 쓰지 않아요(KWCAG 6.1.4).
- 무한 스크롤은 [n편 더 보기] 단추와 함께 써요. 단추로 불러오면(또는 단추에 초점이 있을 때 저절로 불러오면) 새로 나온 첫 리뷰로 초점이 가요.
- 폼: 칸마다 보이는 이름과 "(필수)", 틀린 칸에 `aria-invalid` + 오류 문구(`aria-describedby`·`aria-errormessage`), 저장할 때 "고칠 곳" 목록으로 초점 이동.
- 지우기 확인은 네이티브 `<dialog>`(`role="alertdialog"`)이고, 처음 초점은 [취소]예요.

## 8. 테스트

| 명령 | 내용 |
|---|---|
| `pnpm test` | 단위 테스트. 원고 형식(content.test.ts), 로그인 표·비밀번호, proxy, API, 저장 로직, 화면 조각 |
| `pnpm e2e` | 시험용 원고로 빌드해 진짜 브라우저로 확인. 가짜 GitHub 서버(`e2e/mock-github.mjs`)를 함께 띄워 로그인 → 글쓰기 → 커밋 → 고치기 → 지우기까지 시험해요 |

내 컴퓨터에서 글쓰기 화면을 써 보고 싶으면, 가짜 GitHub 서버를 띄우고(`node e2e/mock-github.mjs`) `.env.local`에 `GITHUB_API_URL=http://127.0.0.1:3101`과 `GITHUB_CONTENT_TOKEN=e2e-token`을 넣으면 진짜 저장소를 건드리지 않고 저장해 볼 수 있어요. `pnpm dev`와 `pnpm cf:preview` 모두 같은 방법으로 돼요.

CI(GitHub Actions)는 Node.js 서버(`pnpm build` → `pnpm start`)로 검사하고, Workers용 빌드는 배포할 때 Workers Builds가 해요. Workers용 빌드가 실패하면 배포되지 않고 이전 버전이 그대로 남아요.
