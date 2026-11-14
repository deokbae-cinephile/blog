// 리뷰 데이터 미리 만들기 (scripts/build-reviews.mjs)
//
// 이 파일이 하는 일
//   빌드 직전에 원고(content/reviews, E2E는 REVIEWS_DIR의 시험용 원고)를 읽고 검사해,
//   화면에 쓸 리뷰 데이터(본문 HTML 포함)를 .generated/reviews.json에 써요(lib/load-reviews.ts의 writeReviewsData).
//   목록·상세 화면은 이 파일만 읽어서, Markdown 변환 도구가 워커에 실리지 않아요(lib/review-data.ts).
//   원고에 고칠 곳이 있으면 고치는 방법을 모두 알리고 빌드를 멈춰요(종료 코드 1).
//
// 언제 돌아가나요?
//   package.json의 build·e2e:build가 본문 사진 사본 만들기(resize-photos.mjs) 다음, next build 전에 실행해요.
//   (원고 읽기가 사진 사본이 있는지 보고 srcset을 달아서, 사본을 먼저 만들어야 해요.) 배포의 OpenNext도 pnpm build를 불러요.
//
// 실행 방법: node --conditions=react-server scripts/build-reviews.mjs
//   --conditions=react-server: 원고 읽기 파일 맨 위의 `import "server-only"`(서버 전용 표시)가 빈 모듈로 풀리게 해요.
//   .ts 파일은 Node.js 24부터 타입 글자만 지우고 바로 실행해요(type stripping).

import path from "node:path";

import { ReviewContentError, writeReviewsData } from "../src/lib/load-reviews.ts";
import { REVIEWS_DATA_FILE } from "../src/lib/review-data.ts";

try {
  const count = await writeReviewsData(path.resolve(process.cwd(), REVIEWS_DATA_FILE));
  console.log(`리뷰 ${count}편 → ${REVIEWS_DATA_FILE}`);
} catch (error) {
  // 원고에 고칠 곳이 있으면 목록을 보여 주고 빌드를 멈춰요(다음 단계인 next build로 가지 않아요).
  if (error instanceof ReviewContentError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
