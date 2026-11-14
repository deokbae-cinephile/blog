/**
 * @file 화면이 쓰는 리뷰 데이터 (review-data.ts)
 *
 * 이 파일이 하는 일
 *   목록·상세 화면과 사이트맵에 리뷰 데이터를 줘요: 전체 목록, 목록용 요약, 한 편 찾기, 이전·다음 리뷰 찾기.
 *
 *     빌드 직전  content/reviews/*.md ──scripts/build-reviews.mjs(lib/load-reviews.ts: 검사·HTML 바꾸기)──> .generated/reviews.json
 *     next build                                         이 파일이 .generated/reviews.json만 읽어요 ──> 정적 HTML(목록·상세)
 *     개발 서버(pnpm dev)                                 이 파일이 lib/load-reviews.ts로 원고를 바로 읽어요(고치면 바로 보이게)
 *
 * 왜 나눴나요?
 *   원고를 HTML로 바꾸는 도구(unified·remark·rehype 등)는 크지만, 목록·상세는 빌드할 때 미리 만들어 두는 화면이라
 *   실행 중인 워커가 그 도구를 쓸 일이 없어요. 화면 코드가 미리 만든 데이터만 읽으면 워커에 도구가 실리지 않아 가벼워져요.
 *   운영 빌드에서는 아래 개발 서버용 분기(process.env.NODE_ENV !== "production")가 통째로 빠져서 lib/load-reviews.ts를 부르지 않아요.
 *
 * 누가 쓰나요?
 *   app/page.tsx(목록), app/reviews/[slug]/page.tsx(상세), app/sitemap.ts
 */

import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Review, ReviewSummary } from "./review";

/** 빌드 직전에 만드는 리뷰 데이터 파일(프로젝트 기준 경로, 저장소에는 올리지 않아요). scripts/build-reviews.mjs가 써요. */
export const REVIEWS_DATA_FILE = ".generated/reviews.json";

/** 한 번 읽은 결과를 담아 두는 곳(캐시). 빌드할 때 화면을 여러 장 만들어도 파일은 한 번만 읽어요. */
let loaded: Promise<Review[]> | undefined;

/**
 * 모든 리뷰를 돌려줍니다(최신순).
 *
 * - 운영 빌드(production): 빌드 직전에 만든 .generated/reviews.json을 읽어요. 없으면 만드는 방법을 알려 줘요.
 * - 개발 서버(pnpm dev)·시험: 원고를 고치면 새로 고침만 해도 보이게 매번 원고를 바로 읽어요(lib/load-reviews.ts).
 */
export function getAllReviews(): Promise<Review[]> {
  // NODE_ENV는 빌드할 때 글자로 박혀서, 운영 빌드에서는 이 분기와 그 안의 import가 통째로 빠져요(워커에 실리지 않아요).
  if (process.env.NODE_ENV !== "production") {
    return import("./load-reviews").then(({ loadReviews, reviewsDir }) => loadReviews(reviewsDir()));
  }
  // `A ??= B`는 "A가 비어 있을 때만 B를 넣는다"는 뜻이에요. 두 번째부터는 담아 둔 결과를 그대로 씁니다.
  loaded ??= readReviewsData();
  return loaded;
}

/** .generated/reviews.json을 읽어요. 파일이 없으면(빌드 스크립트를 건너뛴 next build) 고치는 방법을 알려 줘요. */
async function readReviewsData(): Promise<Review[]> {
  // turbopackIgnore: 빌드 도구가 이 파일을 서버 묶음에 넣지 않게 해요(빌드할 때만 읽는 파일이에요).
  const file = path.resolve(/*turbopackIgnore: true*/ process.cwd(), REVIEWS_DATA_FILE);
  try {
    return JSON.parse(await readFile(file, "utf8")) as Review[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    throw new Error(
      `리뷰 데이터 파일(${REVIEWS_DATA_FILE})이 없습니다. next build만 따로 돌리지 말고 pnpm build로 빌드하세요(scripts/build-reviews.mjs가 먼저 만들어요).`,
    );
  }
}

/**
 * 리뷰에서 본문(html)과 포스터 크기를 뺀 목록용 정보만 남깁니다.
 * 처음 화면은 목록 전체를 브라우저로 보내므로 본문을 빼 가볍게 해요.
 */
function toSummary(review: Review): ReviewSummary {
  // 구조 분해: html·포스터 크기(상세 화면에서만 써요)는 따로 꺼내고, 나머지 항목은 모두 summary에 모아요.
  const { html, posterSize, ...summary } = review;
  // 둘은 쓰지 않는다고 분명히 해 둡니다. (안 쓰는 변수가 있다는 린트 경고를 피하는 관용 표현이에요.)
  void html;
  void posterSize;
  return summary;
}

/** 목록용 요약(최신순) */
export async function getReviewSummaries(): Promise<ReviewSummary[]> {
  return (await getAllReviews()).map(toSummary);
}

/** 주소(slug)로 리뷰 한 편을 찾아요. 없으면 null */
export async function getReviewBySlug(slug: string): Promise<Review | null> {
  // find는 조건에 맞는 첫 항목을, 없으면 undefined를 돌려줘요. `?? null`로 "없음"을 null로 통일합니다.
  return (await getAllReviews()).find((review) => review.slug === slug) ?? null;
}

/**
 * 상세 화면의 이전·다음 리뷰. 처음 화면 목록(최신순)의 순서를 그대로 따라요.
 *
 *     목록(최신순)     1. 리틀 포레스트  ← previous(이전 리뷰, 목록에서 바로 위 = 더 최근에 쓴 글)
 *                      2. 폰 부스        ← 지금 보는 리뷰
 *                      3. 셔터 아일랜드  ← next(다음 리뷰, 목록에서 바로 아래 = 더 예전에 쓴 글)
 *
 * @param slug 지금 보는 리뷰의 주소
 * @returns previous·next(목록용 요약). 맨 위·맨 아래라 없으면 null
 */
export async function getNeighbors(slug: string): Promise<{ previous: ReviewSummary | null; next: ReviewSummary | null }> {
  const reviews = await getAllReviews();
  // findIndex는 조건에 맞는 항목의 위치(0부터)를, 없으면 -1을 돌려줘요.
  const index = reviews.findIndex((review) => review.slug === slug);
  if (index === -1) return { previous: null, next: null };

  // 배열 범위를 벗어난 칸(맨 앞의 앞, 맨 뒤의 뒤)은 undefined가 나와요.
  const previous = reviews[index - 1];
  const next = reviews[index + 1];
  return { previous: previous ? toSummary(previous) : null, next: next ? toSummary(next) : null };
}
