# 개발 가이드

이 블로그의 코드를 처음 보는 프론트엔드 개발자를 위한 안내입니다. 코드 파일마다 맨 위에 "이 파일이 하는 일"을 적어 두었고, 줄마다 쉬운 주석을 달았으니 이 문서로 큰 그림을 잡은 뒤 파일을 열어 보세요.

## 1. 한눈에 보기

- **무엇을 만드나요?** 글쓴이 한 사람이 영화 리뷰를 쓰고 고치고 지우는 가벼운 블로그예요. 리뷰는 저장소의 Markdown 파일입니다.
- **어떻게 가볍나요?** 목록·상세 화면은 빌드할 때 HTML로 미리 만들어 둡니다(정적 생성). 방문자에게는 만든 화면을 캐시에서 그대로 주고, 서버 코드는 로그인·글쓰기·저장에만 돌아요.
- **어디서 도나요?** Cloudflare Workers예요. OpenNext 어댑터가 Next.js 앱을 Workers용으로 바꿔요(5장).
- **쓰는 기술:** Next.js 16(App Router, Proxy, Route Handler) · React 19 · TypeScript 6 · Tailwind CSS 4 · unified(remark·rehype) · yaml · image-size(빌드할 때만) · OpenNext Cloudflare 어댑터 · Wrangler
- **가볍게 지키는 규칙:** 새 라이브러리는 꼭 필요할 때만 더해요. 원고·요청 검사는 손으로 짠 함수예요(2.0.0에서 zod를 뺐어요). 워커는 올리기 전에 줄여요(`wrangler.jsonc`의 `minify`).
- **검사 도구:** ESLint(jsx-a11y) · Vitest + Testing Library · Playwright + axe

## 2. 폴더 구조

```
content/reviews/          리뷰 원고(.md). 파일 이름이 주소가 됩니다. _로 시작하는 파일은 읽지 않아요
content/templates/        원고 틀(review.md). 저장소에서 원고를 손으로 쓸 때 이 모양을 따라요
public/                   포스터(posters/), 본문 사진(images/<주소>/), 앱 아이콘(icons/), 서비스 워커(sw.js: 저장소 상한 페이지 40·파일 120·빌드 파일 200),
                          공유 미리 보기 기본 그림(og.png, 1200×630), Cloudflare가 정적 파일에 붙일 헤더(_headers),
                          본문 사진의 작은 사본(_resized/, 빌드할 때 만들어요. 저장소에는 올리지 않아요)
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
│  ├─ review-writer.tsx   리뷰 라이터(추가·수정 폼, 사진 넣기, 임시 저장)
│  ├─ write-preview-panes.tsx, markdown-preview.tsx  본문 쓰기 칸 | 미리 보기(좁은 화면은 탭, 미리 보기는 브라우저에서만 불러와요)
│  ├─ login-form.tsx, session-controls.tsx(왼쪽 아래 [로그아웃]), admin-review-actions.tsx, delete-review.tsx(삭제 확인 창·로딩)
│  ├─ review-toolbar.tsx  상세 맨 윗줄([◀ 목록으로] … [공유하기] [수정] [삭제])과 삭제한 뒤의 안내
│  ├─ review-navigation.tsx  상세에서 이전·다음 리뷰나 목록으로 옮겨 가는 동안의 로딩(링크 onNavigate·키보드 공용)
│  ├─ floating-buttons.tsx  오른쪽 아래 [맨 위로]와 그 오른쪽의 [+](리뷰 추가, 로그인했을 때만)
│  ├─ loading-status.tsx, skeleton.tsx, boot-overlay.tsx  로딩 UI, 글쓰기 스켈레톤, 첫 화면 로딩 레이어
│  ├─ intent-link.tsx     마우스를 올리거나 초점이 갈 때만 다음 화면을 미리 받는 링크(목록의 리뷰, 상세의 장르·감독·배우 이름)
│  ├─ share-button.tsx    상세의 [공유하기](휴대폰 공유 창, 없으면 주소 복사)
│  └─ poster.tsx(+ poster-image.tsx), rating.tsx, review-list-item.tsx, review-article.tsx, site-header.tsx(+ github-link.tsx) …
├─ lib/                   화면이 아닌 코드(데이터·규칙). 각 파일 옆에 *.test.ts
│  ├─ load-reviews.ts, markdown.ts, review-schema.ts   빌드 직전에 원고 읽기·검사(손으로 짠 checkFrontmatter)·HTML 바꾸기
│  ├─ review-data.ts                                   화면용 리뷰 데이터(운영 빌드는 .generated/reviews.json만 읽음), 목록 순서의 이전·다음
│  ├─ review-form.ts, review-values.ts                 글쓰기 칸 검사, 칸 값 모양(화면·서버가 함께 써요)
│  ├─ review-file.ts                                   원고 ↔ 칸 값 바꾸기(YAML, 서버에서만)
│  ├─ drafts.ts, shrink-image.ts                       임시 저장(이 브라우저의 IndexedDB), 사진 줄이기(올리기 전 브라우저에서)
│  ├─ structured-data.ts, upload-rules.ts              검색엔진용 정보(JSON-LD), 사진 올리기 규칙(파일 앞부분으로 형식 알아내기)
│  ├─ review-store.ts, github.ts                       추가·수정·삭제 → GitHub 커밋
│  ├─ review-source.ts                                 수정 화면용 원고 읽기(Markdown 변환 도구를 부르지 않아 서버 묶음이 가벼워요)
│  ├─ session.ts, password-hash.ts, admin-auth.ts      로그인 표(서명), 비밀번호 해시, 로그인 확인
│  ├─ photo-variants.ts, resize-photos.ts              본문 사진의 작은 사본 규칙(srcset·sizes), 빌드할 때 만들기(sharp)
│  └─ browse.ts, people.ts, site.ts, genres.ts, indent.ts …  검색·정렬, 감독·출연 이름 나누기, 블로그 정보, 장르, 본문 Tab 들여쓰기
e2e/                      E2E 테스트, 시험용 원고(fixtures/), 가짜 GitHub 서버(mock-github.mjs)
scripts/                  아이콘·공유 그림 만들기(make-icons.mjs), 로그인 비밀 값 만들기(admin-secrets.mjs),
                          리뷰 데이터 미리 만들기(build-reviews.mjs → .generated/reviews.json, 저장소에 안 올림),
                          본문 사진의 작은 사본 만들기(resize-photos.mjs, build·e2e:build가 next build 전에 실행)
open-next.config.ts       Cloudflare Workers용으로 바꾸는 설정(미리 만든 화면 캐시, 캐시 가로채기)
wrangler.jsonc            Cloudflare Workers 설정(시작 파일 .open-next/worker.js, 코드 줄이기, 정적 파일, 이미지 최적화, 지운 Durable Object 기록, 도메인)
```

## 3. 데이터 흐름

**읽기(누구나)**

```
content/reviews/*.md ──빌드 직전──> scripts/build-reviews.mjs(lib/load-reviews.ts: 검사·HTML) ──> .generated/reviews.json
                    ──next build──> lib/review-data.ts가 데이터만 읽어 정적 HTML(목록·상세) ──> 방문자
(개발 서버 pnpm dev는 lib/review-data.ts가 원고를 바로 읽어서, 원고를 고치면 새로 고침만으로 보여요.)
```

원고에 실수가 있으면 빌드가 멈추고, 어느 파일의 어디를 어떻게 고칠지 한국어로 알려 줍니다. 그래서 잘못된 글은 배포되지 않아요.

**쓰기(글쓴이만)**

방문자에게는 로그인 링크를 보이지 않아요. 글쓴이는 `/login`으로 직접 가거나, `/write`에 가면 로그인 화면으로 보내져요.

```
/login ─(아이디·비밀번호)─> /api/session ─> 세션 쿠키(httpOnly) + 표시 쿠키
/write ─proxy.ts 확인─> 리뷰 라이터
   사진 고르기 ─> 브라우저에서 줄이기(긴 변 1600px, 포스터 JPG·장면 사진 WebP)
   [임시 저장] ─> 이 브라우저의 IndexedDB(칸 값 + 사진 파일) ─> [불러오기]로 이어 쓰기
   [리뷰 저장] ─> /api/images(사진 한 장씩 → blob) ─> /api/reviews(검사 → 커밋 하나) ─> GitHub main
                                                       └─> GitHub Actions가 검사한 뒤 Cloudflare에 배포(몇 분)
```

- 사진은 고르는 순간 브라우저에서 줄여요(`lib/shrink-image.ts`). 긴 변 1600px보다 크거나 1MB보다 크면 다시 만들고, GIF(움직이는 그림)와 이미 작은 사진은 그대로예요.
  - 포스터는 JPG예요. 공유 미리 보기(카카오톡 등)에서 WebP를 못 보여 주는 곳이 있어서요(화면의 포스터는 이미지 최적화를 거쳐요).
  - 장면 사진은 본문에 그대로 보여서 가장 가벼운 WebP예요. WebP를 만들 줄 모르는 브라우저면 PNG·JPG로 만들어요.
- 사진은 요청 하나가 하는 일(CPU·메모리)을 작게 나누려고 한 장씩(최대 4MB) 먼저 올리고, 리뷰를 저장할 때 원고와 함께 커밋 하나로 묶어요. 사진 올리기 API는 파일 앞부분(서명 바이트)으로 실제 형식을 확인해요(`sniffImageType`).
- 본문 사진은 빌드할 때 작은 사본(가로 480·800·1200px WebP, 원본 너비의 90% 이하만)을 `public/_resized`에 만들어 `srcset`으로 화면 크기에 맞게 받아요.
  - 순서: `pnpm build`(배포의 OpenNext도 이것을 불러요) → `scripts/resize-photos.mjs`(`lib/resize-photos.ts`, sharp) → `scripts/build-reviews.mjs` → `next build`. 원고 읽기(`lib/load-reviews.ts`)가 사본이 정말 있는 것만 `srcset`에 넣어요.
  - `sizes`는 본문 칸 너비(1024px 이상 `100vw − 27rem`, 640px 이상 `100vw − 4rem`, 그 밖 `100vw − 2rem`)와 원본 너비, 화면 높이 80% × 비율 가운데 가장 작은 값이에요(`lib/photo-variants.ts`의 `photoSizes`). 나란히 놓인 사진은 칸을 둘로 나눠요. Chromium·Firefox·WebKit에서 `min()`이 든 `sizes`를 바르게 읽는 것을 확인했어요.
  - 실행 중인 워커는 아무 일도 하지 않아요(다른 정적 파일처럼 Cloudflare가 바로 내줘요). 깨진 사진은 빌드를 멈추지 않고 경고만 남기고 원본만 써요. 움직이는 그림(GIF, 여러 장 WebP·AVIF, 움직이는 PNG)은 사본이 첫 장만 남아 멈춰 버려서 사본을 만들지 않고 원본만 써요. 사본은 저장소에 올리지 않아요(`.gitignore`).
- 새 리뷰의 "글 쓴 날"(`publishedAt`)은 저장할 때 서버가 한국 시간 날짜와 시각까지 넣어요(`2026-11-14T19:35:48+09:00`, `lib/review-form.ts`의 `nowInSeoul`). 같은 날 쓴 리뷰끼리도 최신순이 맞아요. 날짜만 적힌 예전 원고(`2026-11-14`)도 그대로 읽고, 그날 0시로 봐요.
- 임시 저장(`lib/drafts.ts`)은 검사 없이 지금 칸 값과 고른 사진을 이 브라우저에 저장해요. 서버 코드를 늘리지 않고, 공개 저장소에 쓰다 만 글을 올리지 않으려고요.
  - 이 브라우저에서만 다시 불러올 수 있어요(다른 기기·브라우저에는 없어요). 저장할 때 "오래 보관"을 부탁해요(`navigator.storage.persist`).
  - 새 글 화면에는 새 글의 임시 저장본만, 수정 화면에는 그 리뷰의 임시 저장본만 보여요. 리뷰를 저장하면 불러온 임시 저장본은 지워요.
  - 떠날 때 묻는 경고(beforeunload)는 마지막으로 임시 저장·불러온 뒤에 바뀐 것이 있을 때만 나와요.
  - 임시 저장본에는 본문에 남아 있는 장면 사진만 담아요(본문에서 지운 사진 파일은 담지 않아요).
- 저장 로딩: [리뷰 저장]·[임시 저장]을 누르면 단추 바로 아래에 로딩 UI(커서 + 16칸 막대)가 보여요. 리뷰 저장은 "사진을 올리는 중(1/2)" → "리뷰를 저장하는 중", 임시 저장은 "임시 저장하는 중"(최소 0.4초)이에요. 안내 영역(role="status")은 늘 두고 내용만 바꿔요.
- 수정 화면은 서버가 저장소의 원고를 칸 값으로 바꿔 넘겨줘요. YAML 도구가 커서 브라우저로 보내지 않아요.
- 저장하기 전에 서버가 빌드 때와 같은 규칙으로 다시 검사해요(칸, 주소 겹침, 포스터·사진 파일, 그사이 다른 곳에서 고쳤는지).
- 수정·삭제는 그 리뷰의 포스터(`<주소>.확장자`)와 사진 폴더(`public/images/<주소>/`) 가운데 더 쓰지 않는 파일도 함께 지워 저장소를 가볍게 둡니다. 다만 다른 리뷰 원고가 가져다 쓰는 파일은 남겨요(다른 원고를 GraphQL 요청 하나로 한꺼번에 읽어 확인해요).
- 본문 사진은 빌드와 같은 도구로 서버에서도 검사해서, `![설명][이름]` 같은 참조형 사진도 저장 전에 걸러요.

**리뷰 데이터는 빌드 직전에 미리 만들어요(워커를 가볍게)**

- 목록·상세·사이트맵은 빌드할 때 미리 만드는 화면이라, 실행 중인 워커가 원고를 읽거나 Markdown을 바꿀 일이 없어요.
- 그래서 빌드 직전에 `scripts/build-reviews.mjs`가 원고를 읽고 검사해 본문 HTML까지 담은 `.generated/reviews.json`을 쓰고, 화면(`lib/review-data.ts`)은 그 파일만 읽어요. Markdown 변환 도구(unified 등)와 원고 읽기 도구(vfile·image-size 등)가 워커에 실리지 않아요.
  - 원고에 고칠 곳이 있으면 이 단계에서 목록을 모두 보여 주고 빌드를 멈춰요(예전에는 next build 도중에 멈췄어요).
  - 실행: `node --conditions=react-server scripts/build-reviews.mjs`(`server-only` 표시가 빈 모듈로 풀리게). `.ts`는 Node.js 24의 type stripping으로 바로 실행해서, 원고 읽기 쪽 파일은 import에 `.ts`까지 적어요.
  - `next build`만 따로 돌리면 데이터 파일이 없다고 알려요. 늘 `pnpm build`(또는 `pnpm e2e:build`)로 빌드해요.
- 개발 서버(`pnpm dev`)는 `lib/review-data.ts`가 원고를 바로 읽어요(`process.env.NODE_ENV !== "production"` 분기는 운영 빌드에서 통째로 빠져요).
- 글쓰기 미리 보기(`markdown-preview.tsx`)는 `next/dynamic`의 `ssr: false`로 브라우저에서만 불러와요. 서버에서 이 화면을 그릴 때 Markdown 도구가 함께 묶이지 않아요(받는 동안은 같은 로딩 화면, `preview-loading.tsx`).
- 결과: 워커 gzip 1,533KiB → 1,274KiB(−259KiB). 워커에 남은 Markdown 도구는 저장 API가 본문 사진을 빌드와 같은 규칙으로 찾는 한 벌뿐이에요(참조형 사진까지 저장 전에 거르려고 남겨요).

**방문자 수(2.0.0 핫픽스에서 모두 지웠어요)**

- 세는 코드(`/api/visits`, 화면의 세기 요청), 보이기([방문자 n명]), 저장소(Durable Object `VisitCounter`)와 그 안의 숫자까지 모두 지웠어요. `wrangler.jsonc`의 migrations v4(`deleted_classes`)가 배포될 때 데이터를 지워요(되돌릴 수 없어요).
- 쓰는 Durable Object가 없어져서 워커 시작 파일도 OpenNext 기본 파일(`.open-next/worker.js`)로 되돌렸어요(예전 `worker/index.ts`·`worker/visit-counter.ts`를 지움, `@cloudflare/workers-types`도 뺌).
- 그 자리(왼쪽 아래 [키보드 조작] 오른쪽)에는 로그인했을 때 [로그아웃]을 고정했어요(`session-controls.tsx`).

**조회수(2.0.0 핫픽스에서 모두 지웠어요)**

- 화면 표시, 서버 API(`/api/views`), 저장소(Durable Object `ViewCounter`)와 그 안의 숫자까지 모두 지웠어요. `wrangler.jsonc`의 migrations v3(`deleted_classes`)이 배포될 때 데이터를 지워요(되돌릴 수 없어요). 지운 클래스는 코드에서 내보내지 않아요.
- 그 저장소에 함께 있던 예전 방문자 수도 같이 지워졌어요(방문자 수 기능은 뒤에 모두 지웠어요, 위 참고).
- 조회수가 쓰던 빌드 때 리뷰 주소 목록(`DMB_REVIEW_SLUGS`, `lib/review-slugs.ts`)과 "방금 본 사람" 장부도 함께 지웠어요.

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
- **속도 제한 규칙(2026-11-14 설정):** Cloudflare 대시보드 → deokbae.blog → Security → WAF(보안 규칙) → Rate limiting rules의 `로그인 시도 제한`. URI Path가 `/api/session`인 요청이 IP마다 10초에 5번을 넘으면 10초 동안 막아요(429, error code 1015). 무료 플랜은 규칙 1개, 조건은 경로만, 시간은 10초로 정해져 있어요(방문자 세기 요청을 묶으려던 계획은 방문자 수 기능을 지워서 필요 없어졌어요). 세는 데 약간의 지연이 있어서 짧게 몰아친 요청 몇 개는 통과할 수 있고, 그 뒤는 서버의 실패 횟수 제한이 함께 막아요. workers.dev 주소를 모두 닫아서 모든 요청이 이 규칙을 지나요.

## 6. 화면 규칙

- **색:** `globals.css`의 변수(`--crt-*`)만 써요. 형광 초록 한 가지라, 오류·고른 것은 빨강 대신 **반전**(초록 바탕)과 모양(점선 테두리, ▶)으로 알려요.
- **글자:** Neo둥근모 16px과 32px(`text-big`)만 써요. 굵게·기울임 대신 반전과 밑줄을 써요.
- **포스터·사진:** 올린 파일의 색은 그대로 두고, 화면에서만 SVG 필터(`#crt-phosphor`, `app/layout.tsx`)로 흑백 → 4단계 명암 → 형광 초록으로 바꾸고 주사선을 덮어요. 포스터 상자는 늘 2:3이고, 없으면 기본 포스터를 보여요.
- **넓은 화면(1024px~):** 목록은 [검색 칸 16~18rem | 목록], 상세는 [포스터 | 본문(오른쪽 칸 전체)], 글쓰기는 [포스터 | 영화 정보 2열 × 5행] 3칸이에요. 검색 칸과 상세의 포스터는 키가 충분한 화면에서 스크롤해도 붙어 있어요.
- **리뷰 상세는 v3까지 닫혀 있어요(`lib/site.ts`의 `REVIEW_DETAIL_PUBLIC = false`).** 그전까지는 "한 줄 평" 위주의 목록 블로그예요.
  - 목록 제목은 방문자에게 링크가 아니에요. 방문자가 `/reviews/<주소>`로 오면 처음 화면으로 잠시 옮겨요(`proxy.ts`, 307). 사이트맵에도 상세 주소가 없어요.
  - 글쓴이(로그인)는 그대로예요: 목록 제목이 링크로 보이고, 상세에서 [수정]·[삭제]를 써요(v3 화면도 미리 봐요).
  - 키보드 안내의 목록 키는 검색창 키만 보여요(리뷰 고르기·Enter로 열기는 v3에 함께 돌아와요).
  - 서비스 워커는 화면을 네트워크에서 먼저 받고 성공한 응답만 저장해서, 옮기는 응답(307)은 저장하지 않아요.
  - v3에서 열 때: `REVIEW_DETAIL_PUBLIC`을 `true`로 바꾸고, `proxy.ts`의 matcher에서 `"/reviews/:path*"`를 빼요.
- **머리글:** 왼쪽 [로고] 영화 한 줄 평 블로그(처음 화면 링크), 오른쪽 GitHub 아이콘. 탭 제목·설치 앱 이름·검색엔진의 사이트 이름은 "DMB"이고, 검색엔진의 다른 이름과 공유 미리 보기 그림(`public/og.png`, `pnpm icons`)에는 "영화 한 줄 평 블로그"를 써요.
  - 로고는 본문 왼쪽 끝, GitHub 아이콘은 본문 오른쪽 끝에 딱 맞고, 둘 다 24 × 24px(누르는 높이 44px)예요. 휴대폰(360px 이상)에서도 한 줄이에요.
  - 로고와 이름 사이는 12px예요. 점선 양쪽은 22px로 같아요: 이름 끝 ↔ 점선(사이 12px + 점선 왼쪽 여백 10px), 점선 끝 ↔ GitHub 아이콘(사이 12px + 링크 안쪽 여백 10px).
  - GitHub 링크는 아이콘만 보이고, 글자 "GitHub"는 화면 낭독기만 읽어요(링크 이름). 저장소는 새 창으로 열리고, 설명에 "(새 창)"을 붙여 미리 알려요.
  - 눈으로도 미리 알 수 있게, 가리키거나 초점이 가면 "이 블로그의 소스 코드 저장소(새 창)" 말풍선(`role="tooltip"`)이 떠요. Esc로 닫혀요(`github-link.tsx`, 머리글에서 브라우저 코드는 이것뿐이에요).
  - 버전은 머리글에 보이지 않아요(2.0.0 핫픽스에서 뺐어요). 버전은 `package.json`과 GitHub 릴리스에서 확인해요. 화면 코드가 `package.json`을 읽지 않아 서버 묶음에도 들어가지 않아요.
  - 탭 제목과 설치 앱 이름은 짧게 "DMB"예요.
- **목록 한 편:** [썸네일 2:3 | 제목 ····· 평점 / 원제·연도·감독: 이름 / 한 줄 평]. 장르와 출연은 목록에 보이지 않아요(상세 화면에서 보여요). 한 줄 평은 썸네일 아래 끝에 맞춰요.
  - 썸네일은 넓은 화면(640px~) 70px(예전 64px의 약 1.1배, 픽셀이 흐려지지 않게 정수로 맞춤), 휴대폰 56px이에요.
  - 평점은 넓은 화면에서 첫째 줄 오른쪽 끝, 휴대폰에서는 포스터 아래 가운데에 보여요(두 자리에 하나씩 그리고 너비에 맞는 하나만 보여요).
  - 제목이 링크일 때(글쓴이, v3 이후 모두)만 항목 전체가 누르는 영역이고 마우스를 올리면 반전돼요. 감독 이름은 늘 글자로만 둬요.
- **장르:** 가나다순(공포·다큐멘터리·드라마·로맨스·범죄·스릴러·스포츠·액션·재난·코미디). 목록의 장르 단추와 글쓰기 칸이 같은 순서예요. 주소에는 영어 이름으로 적어요(`?genre=drama`, `lib/genres.ts`의 `GENRE_SLUGS`). 예전 한글 주소(`?genre=드라마`)도 같은 장르로 열려요.
- **상세 맨 윗줄:** [◀ 목록으로] ······ [공유하기] [수정] [삭제](수정·삭제는 로그인했을 때만, `review-toolbar.tsx`). [공유하기] [수정] [삭제] 사이는 모두 8px예요.
  - 모두 같은 단추 모양(`.btn-line`, 높이 44px, [앱으로 설치]와 같아요)이라 세로 가운데가 정확히 맞아요. ◀는 [◀ 이전 리뷰]와 같은 글자이고 꾸밈이라 읽지 않아요.
  - 삭제 안내 칸(`role="status"`)은 윗줄 밖 아래에 처음부터 두고, 비어 있으면 자리를 차지하지 않아요. (예전에는 빈 안내 칸이 [수정]·[삭제] 묶음 높이를 늘려 [공유하기]만 2px 내려가 있었어요.)
  - 삭제하는 동안 확인 창 안에 로딩 UI("리뷰를 삭제하는 중")가 보이고, [취소]·[삭제]는 흐려지며 막히고, Esc로도 닫히지 않아요(목록으로도 가지 않아요). 다 지우면 [공유하기]·[수정]·[삭제]를 치우고, 윗줄 아래에 화면 너비로 안내를 보이며, 초점은 [◀ 목록으로]로 가요.
- **상세 머리 안내판:** 장르(제목 위) → 제목 → 원제·연도·상영 시간·감독: 이름·출연: 이름, 오른쪽에 큰 평점. 제작 국가는 2.0.0 핫픽스에서 출연으로 바꿨어요.
- **상세에서 옮겨 갈 때의 로딩:** [◀ 이전 리뷰]·[다음 리뷰 ▶]·[◀ 목록으로]를 누르거나 키보드 ◀ ▶ Esc로 옮겨 갈 때, 새 화면을 받는 동안 화면 가운데에 로딩 UI("다음 리뷰를 불러오는 중" 등)를 보여요(`review-navigation.tsx`: Next.js `<Link>`의 `onNavigate` + React `useTransition`). 미리 받아 0.1초 안에 끝나면 번쩍이지 않게 0.1초 뒤부터 보여요(`.nav-loading`).
  - 이전·다음 리뷰 단추에 마우스를 올리면 [◀ 목록으로]처럼 아이콘·글자가 모두 같은 반전 색이 돼요(보조 글자색에 `group-hover:text-inherit`).
  - 감독·배우 이름은 한 사람씩 링크예요. 누르면 그 이름으로 찾은 처음 화면 목록(`/?q=이름`, `lib/people.ts`의 `personSearchHref`)으로 가요.
  - 링크 이름은 보이는 이름 그대로이고(KWCAG 6.5.3), 화면 낭독기에는 설명(`aria-describedby`) "이 감독의 리뷰 찾기"·"이 배우의 리뷰 찾기"를 덧붙여요.
- **출연(`cast`):** 원고에는 `cast: 레오나르도 디카프리오, 마크 러팔로`처럼 쉼표로 이어 적어요(YAML 목록 `[A, B]`도 받아요). 읽을 때 빈칸을 다듬고 같은 이름은 한 번만 남겨 "A, B"로 맞춰요(`lib/review-schema.ts`). 한 작품에 5명까지예요(`lib/people.ts`의 `MAX_CAST`, 넘으면 원고 검사와 글쓰기 칸 검사가 몇 명을 지울지 알려요). 검색·자동완성(한 사람씩, "출연"), 검색엔진 정보(`actor`)에도 들어가요. 예전 `country`(제작 국가)를 적으면 "알 수 없는 항목"으로 알려요.
- **떠 있는 단추:** 오른쪽 아래 구석에 로그인했을 때 44 × 44px [+](리뷰 추가)가 있고, 내려 읽으면 [맨 위로]가 그 왼쪽에 붙어요. 글쓰기 화면에서는 [+]와 왼쪽 아래 "키보드 조작" 단추를 숨겨요.
- **왼쪽 아래 고정 줄:** [키보드 조작](640px 이상, 글쓰기 화면 제외) [로그아웃](로그인했을 때만, 같은 떠 있는 단추 모양 `.btn-float`). 키보드 안내 창은 단추 위에 떠서 열려도 [로그아웃]이 움직이지 않아요. 휴대폰·글쓰기 화면에서는 [로그아웃]만 왼쪽 끝에 보여요. 로그아웃에 실패하면 단추 위에 안내 상자(`role="alert"`)가 떠요.
- **첫 화면 로딩 레이어:** 처음 열 때 화면 전체를 덮고 가운데에 로딩 UI를 보여요. 페이지와 웹 폰트(neodgm)를 받으면 걷히고(최소 0.4초, 늦어도 4초), 같은 탭에서는 다시 덮지 않아요. 자바스크립트가 꺼져 있으면 보이지 않고, 스크립트가 돌지 않아도 6초 뒤 CSS가 걷어요.
- **검색창:** 글쓰기 화면의 입력 칸과 같은 모양(`.field`)이에요.
- **정렬:** 최신순·평점순 두 가지예요. 최신순은 글 쓴 날의 시각까지 봐서, 같은 날 쓴 리뷰도 나중에 쓴 글이 앞에 와요(`lib/review.ts`의 `compareLatest`). 날짜만 적힌 예전 원고는 그날 0시로 보고, 시각까지 같으면 제목 가나다순이에요. 조회수는 2.0.0 핫픽스에서 모두 지웠어요.
- **링크 미리 받기:** 목록의 리뷰 링크와 상세의 장르 링크는 화면에 보이기만 해서는 다음 화면을 미리 받지 않고, 마우스를 올리거나 초점이 가거나 손가락이 닿을 때 받아요(`intent-link.tsx`). 목록 10편이면 요청 15개(약 31KB)가 줄어요.
- **공유하기:** 상세 맨 윗줄 오른쪽 [공유하기]는 휴대폰(과 지원하는 컴퓨터)의 공유 창으로 리뷰의 대표 주소·제목·평점과 한 줄 평을 보내요(`share-button.tsx`, Web Share API). 공유 창이 없으면 주소를 복사하고 `role="status"`로 알려요. 공유 창을 닫으면 아무 일도 하지 않아요. 포스터 파일을 따로 보내지 않는 까닭은, 앱에 따라 그림만 가고 링크가 빠지기 때문이에요. 받는 쪽은 링크의 공유 미리 보기로 포스터를 보여 줘요.
- **공유 미리 보기·검색엔진:** 링크를 붙이면 포스터(없으면 `public/og.png`)가 카드에 보여요. 포스터의 가로·세로(`og:image:width`·`height`)도 알려서, 메신저가 링크를 처음 받았을 때도 포스터를 바로 그려요. 리뷰 상세에는 검색엔진용 리뷰 정보(JSON-LD: 영화·평점·글쓴이), 처음 화면에는 사이트 이름 정보(WebSite)를 넣어요(`lib/structured-data.ts`). 그림은 미리 만든 파일이라 워커가 그리지 않아요(`next/og`는 워커를 크게 키워서 쓰지 않아요).
- **정보 줄의 가운뎃점:** 항목 사이 " · "의 앞 빈칸과 "감독: 한서윤"의 쌍점 뒤 빈칸은 줄바꿈되지 않는 빈칸(NBSP, `lib/format.ts`의 `joinFacts`·`labeled`)이에요. 휴대폰에서 줄이 넘쳐도 가운뎃점으로 시작하는 줄이 생기지 않고, 이름표와 값이 떨어지지 않아요. 감독·출연 뒤에는 목록과 상세 모두 쌍점(:)을 붙여요.
- **로딩·스켈레톤:**
  - 로딩 UI는 옛 DOS 프로그램처럼 "불러오는 중▮"(1초에 한 번 깜빡이는 커서)과 칸이 하나씩 차오르는 16칸 막대예요(`role="status"`).
  - 글쓰기 화면을 준비하는 동안(`app/write/loading.tsx`) 글쓰기 모양의 스켈레톤을 그리고, 제목 자리에 로딩 UI를 놓아 내용이 들어와도 화면이 밀리지 않아요. 저장소에서 원고를 읽는 수정 화면에서 자주 보여요.
  - 목록·상세에는 `loading.tsx`를 두지 않아요. 미리 만든 화면이라 기다릴 일이 거의 없는데, 두면 Next.js가 HTML 맨 앞에 로딩 화면을 넣고 내용을 잠시 뒤 바꿔 넣어서 열 때마다 스켈레톤이 번쩍이거든요.
  - 포스터는 그림이 오기 전까지 액자 안에 스켈레톤을 깔고, 오면 치워요. 미리 보기는 변환 도구를 처음 받는 동안 로딩 UI와 글줄 스켈레톤을 보여요.
  - 스켈레톤은 눈이 편하도록 움직이지 않는 옅은 초록 칸이에요(테두리·지나가는 빛 없음). 꾸밈이라 `aria-hidden`이에요.
  - 움직이는 것은 로딩 UI의 커서·막대뿐이고, 동작 줄이기(`prefers-reduced-motion`)를 켜면 그것도 멈춰요.
- **글쓰기 화면:**
  - 칸 아래 도움말은 주소에만 둬요. 예시는 괄호 안에 적어요: "… 하이픈(-)만 씁니다. (예: shutter-island → /reviews/shutter-island)". 나머지는 틀렸을 때 오류 문구가 고치는 방법을 알려요.
  - 꼭 적어야 하는 칸은 이름 옆에 "*"를 보여요(예: "제목 *"). 폼 위에 "* 표시는 꼭 적어야 하는 칸입니다."로 뜻을 알려요. 화면 낭독기는 *를 읽지 않고 입력 칸의 `required`로 "필수"를 알려요(장르 묶음은 숨긴 글자 "(필수)").
  - 단추 줄은 [리뷰 저장] [임시 저장] [취소]예요. 임시 저장한 글이 있으면 폼 맨 위에 "임시 저장한 글 (N)" 목록과 [불러오기]·[삭제]가 보여요(예전 [Markdown 파일 불러오기] 자리, 2.0.0에서 불러오기는 없앴어요).
  - [포스터 고르기]·[포스터 빼기]는 포스터와 같은 너비예요. 포스터를 고르기 전에는 상세 화면과 같은 기본 포스터(빈 필름 그림 + NO POSTER)가 보여요(그림은 꾸밈, 화면 낭독기에는 "고른 포스터 없음"). 평점은 처음에 5.0이 골라져 있고, ▼는 왼쪽 글자 여백(12px)과 같은 간격으로 놓여요.
  - 영화 정보는 주소·제목·원제·개봉 연도·감독·출연·상영 시간(분)·장르·평점·한 줄 평이에요. 예전 칸 모양으로 임시 저장한 글도 지금 칸에 맞춰 불러와요(`lib/review-values.ts`의 `withFormDefaults`: 없는 칸은 빈 값, 사라진 칸은 버림).
  - 수정 화면의 주소는 바꿀 수 없어요. "주소: /reviews/<주소>" 다음 줄에 "(수정할 때는 바꿀 수 없습니다)"를 보여요.
  - 본문은 [Markdown 입력 | 미리 보기]로 나란히 보여요. 미리 보기는 상세 화면과 같은 변환(`lib/markdown.ts`)을 쓰고, 아직 올리지 않은 사진은 임시 주소(blob:)로 보여요. 좁은 화면은 같은 두 쪽을 탭으로 바꿔 봐요.

## 7. 키보드와 접근성

- 목록: ▲▼(또는 ◀▶) 이전·다음 리뷰 고르기, Home·End 처음·끝, Enter 열기(제목이 링크일 때만: 글쓴이, v3 이후 모두). 검색창: ▲▼ 추천 고르기, Enter 찾기, Esc 추천 닫기(APG 콤보박스).
- 상세: ◀▶ 이전·다음 리뷰(처음 화면 목록 순서: ◀ 이전 = 목록에서 바로 위, ▶ 다음 = 바로 아래), Esc 목록으로. 링크 [◀ 이전 리뷰]·[다음 리뷰 ▶]도 같은 순서예요. 한 글자 단축키는 쓰지 않아요(KWCAG 6.1.4).
- 무한 스크롤은 [n편 더 보기] 단추와 함께 써요. 단추로 불러오면(또는 단추에 초점이 있을 때 저절로 불러오면) 새로 나온 첫 리뷰로 초점이 가요(제목이 링크면 링크로, 아니면 리뷰 한 편 `article`로, 점선 테두리).
- 폼: 칸마다 보이는 이름과 꼭 적어야 하는 칸의 "*"(뜻은 폼 위 안내, 입력 칸은 `required`), 틀린 칸에 `aria-invalid` + 오류 문구(`aria-describedby`·`aria-errormessage`), 저장할 때 "고칠 곳" 목록으로 초점 이동.
- 본문 글상자: Tab은 다음 칸으로 넘어가지 않고 들여쓰기(목록 줄이면 줄 맨 앞, 아니면 커서 자리에 Tab 문자), Shift+Tab은 내어쓰기예요. Markdown은 Tab을 4칸으로 읽어 `-`·`1.` 목록 모두 한 번에 안쪽 목록이 돼요. 글상자에서 빠져나갈 때는 Esc를 누른 다음 Tab이에요.
- 본문 탭(좁은 화면): APG 탭 패턴(`tablist`·`tab`·`tabpanel`, ← → Home End, roving tabindex). 넓은 화면의 미리 보기는 키보드로 스크롤할 수 있는 이름 있는 영역(`region`)이에요.
- 삭제 확인은 네이티브 `<dialog>`(`role="alertdialog"`)이고, 처음 초점은 [취소]예요. 삭제하는 동안은 창 안의 안내 칸(`role="status"`)에 로딩 UI를 보이고, 지운 뒤에는 누른 단추가 사라지므로 초점을 [◀ 목록으로]로 옮겨요.
  - 삭제하는 동안 [취소]·[삭제]는 `disabled`가 아니라 `aria-disabled`로 막아요. `disabled`로 막으면 누른 단추에서 초점이 문서 전체로 빠져요.
- 화면 위에 창(`<dialog>`)이 떠 있으면 초점이 어디에 있든 화면 단축키(◀ ▶, Esc 목록으로)를 쉬어요(`lib/keyboard.ts`의 `keepsOwnKeys`). 창을 띄운 채 Esc를 눌러 목록으로 가 버리지 않게요.

## 8. 테스트

| 명령 | 내용 |
|---|---|
| `pnpm test` | 단위 테스트. 원고 형식(content.test.ts), 로그인 표·비밀번호, proxy, API, 저장 로직, 화면 조각 |
| `pnpm e2e` | 시험용 원고로 빌드해 진짜 브라우저로 확인. 가짜 GitHub 서버(`e2e/mock-github.mjs`)를 함께 띄워 로그인 → 추가 → 커밋 → 수정 → 삭제까지 시험해요. 가짜 서버의 `POST /__delay?ms=`로 답을 늦춰 로딩 화면도 시험해요 |

다른 프로그램이 E2E 포트(3100·3101)를 쓰고 있으면 Playwright가 그 서버를 블로그로 잘못 쓸 수 있어요. 그럴 때는 `E2E_PORT=3760 MOCK_GITHUB_PORT=3761 pnpm e2e`처럼 비어 있는 포트로 돌려요.

내 컴퓨터에서 글쓰기 화면을 써 보고 싶으면, 가짜 GitHub 서버를 띄우고(`node e2e/mock-github.mjs`) `.env.local`에 `GITHUB_API_URL=http://127.0.0.1:3101`과 `GITHUB_CONTENT_TOKEN=e2e-token`을 넣으면 진짜 저장소를 건드리지 않고 저장해 볼 수 있어요. `pnpm dev`와 `pnpm cf:preview` 모두 같은 방법으로 돼요.

CI(GitHub Actions)의 검사(`check`)는 Node.js 서버(`pnpm build` → `pnpm start`)로 하고, Workers용 빌드는 검사가 통과한 뒤 배포(`deploy`) 단계에서 해요. 검사나 Workers용 빌드가 실패하면 배포되지 않고 이전 버전이 그대로 남아요.
