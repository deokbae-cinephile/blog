# 덕배의 영화 블로그

[![CI](https://github.com/deokbae-cinephile/blog/actions/workflows/ci.yml/badge.svg)](https://github.com/deokbae-cinephile/blog/actions/workflows/ci.yml)
![version](https://img.shields.io/badge/version-1.0.0-39ff14)

## 주요 기능

| 기능 | 내용 |
|---|---|
| 1인 로그인 | 글쓴이 아이디·비밀번호로 로그인합니다. 로그인 전에는 쓰기·고치기·지우기를 할 수 없습니다(`proxy.ts` + 서버에서 한 번 더 확인) |
| 리뷰 쓰기·읽기·고치기·지우기 | 포스터와 영화 장면 사진을 함께 다룹니다. 저장하면 저장소에 커밋이 올라가고, 다시 배포되는 몇 분 뒤 블로그에 반영됩니다 |
| 리뷰 라이터 | 본문은 Markdown으로 씁니다. 원고 틀 모양의 `.md` 파일을 불러오면 칸이 바로 채워지고, 장면 사진은 본문 커서 자리에 들어갑니다 |
| 포스터·사진 | 원본 파일은 그대로 두고, 화면에서만 형광 초록 4단계 명암과 주사선으로 바꿔 보입니다(SVG 필터). 포스터는 2:3, 없으면 기본 포스터 |
| 목록 | 장르 필터, 최신순·평점순 정렬, 처음 10편 + 무한 스크롤(10편씩, [더 보기] 단추 함께) |
| 검색 | 제목·원제·감독·한줄평 검색, 자동완성 추천 층(▲▼ Enter Esc) |
| 평점·한줄평 | 5점 만점, 0.5점 단위(0점 없음) 숫자 평점과 목록 셋째 줄의 한줄평 |
| 키보드·접근성 | 옛 DOS처럼 방향키·Enter·Esc로 조작, 본문 바로가기, 화면 낭독기 안내, KWCAG 2.2·WAI-ARIA 1.2 기준 |
| 설치형 웹 앱 | 휴대폰·PC에 앱으로 설치하고, 한 번 본 리뷰는 오프라인에서도 읽습니다 |

## 기술 스택

![Next.js, React, TypeScript, Tailwind CSS, Cloudflare, pnpm, Vitest, GitHub Actions](https://skillicons.dev/icons?i=nextjs,react,ts,tailwind,cloudflare,pnpm,vitest,githubactions)

| 구분 | 사용 기술 |
|---|---|
| 프레임워크 | Next.js 16(App Router, Proxy, Route Handler), React 19, TypeScript 6 |
| 콘텐츠 | Markdown + YAML frontmatter, unified(remark·rehype), vfile-matter, yaml, zod 4, image-size |
| 저장·인증 | GitHub Git Data API(커밋 저장), Web Crypto HMAC 세션, scrypt 비밀번호 해시 |
| 스타일 | Tailwind CSS 4, CSS로 만든 CRT 효과, SVG 필터, Neo둥근모 픽셀 글꼴 |
| 설치형 웹 앱 | Web App Manifest, 직접 작성한 서비스 워커(public/sw.js) |
| 배포 | Cloudflare Workers(OpenNext 어댑터), Cloudflare Images, GitHub Actions(검사 통과 뒤 배포) |
| 품질 | ESLint 10(jsx-a11y), Vitest 5 + Testing Library, Playwright + axe, GitHub Actions |

## 시작하기

Node.js 24(`.node-version`)와 pnpm 12가 필요합니다.

```bash
corepack enable pnpm
pnpm install
cp .env.example .env.local   # 로그인·저장에 쓰는 서버 설정
pnpm admin-secrets           # 비밀번호를 정하면 ADMIN_PASSWORD_HASH, SESSION_SECRET을 만들어 줍니다
pnpm dev                     # http://localhost:3000
```

목록·상세 화면은 설정 없이도 열립니다. 로그인과 저장에는 `.env.local`의 `ADMIN_ID`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `GITHUB_CONTENT_TOKEN`이 필요합니다. 배포와 환경 변수는 [개발 가이드](docs/development.md)에 정리했습니다.

| 명령 | 설명 |
|---|---|
| `pnpm dev` | 개발 서버. 원고를 고치고 새로 고침하면 바로 보입니다 |
| `pnpm build` / `pnpm start` | 운영 빌드(목록·상세는 미리 만든 HTML) / 서버 실행 |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | 타입 검사 / ESLint / 단위 테스트(원고 형식 검사 포함) |
| `pnpm e2e` | 시험용 원고와 가짜 GitHub 서버로 실제 브라우저 검사(로그인·저장·접근성·오프라인) |
| `pnpm cf:preview` | Cloudflare Workers용으로 빌드해 내 컴퓨터의 Workers 런타임으로 띄워 보기(http://localhost:8787) |
| `pnpm admin-secrets` | 글쓴이 비밀번호 해시와 세션 열쇠 만들기 |
| `pnpm icons` | 로고(`src/lib/logo.ts`)로 탭·설치 앱 아이콘 다시 만들기 |

## 프로젝트 구조

```
content/           리뷰 원고(reviews/*.md), 원고 틀(templates/review.md)
public/            포스터(posters/), 본문 사진(images/), 앱 아이콘, 서비스 워커(sw.js), 정적 파일 헤더(_headers)
src/
├─ proxy.ts        쓰기 화면·저장 API 문지기(로그인 확인)
├─ app/            페이지와 API(폴더 = 주소): 목록, 상세, login, write, api
├─ components/     화면 조각(옆에 *.test.tsx)
└─ lib/            원고 읽기·검사, 검색·정렬, 로그인·세션, GitHub 저장
e2e/               E2E 테스트, 시험용 원고, 가짜 GitHub 서버
scripts/           아이콘 만들기, 로그인 비밀 값 만들기
open-next.config.ts, wrangler.jsonc   Cloudflare Workers 배포 설정
```
