// @vitest-environment node

/**
 * @file 실제 원고 검사 (content.test.ts)
 *
 * 이 테스트가 하는 일
 *   실제 원고(content/reviews)와 E2E용 시험 원고(e2e/fixtures/reviews)가 모두 형식에 맞는지 확인해요.
 *   목업(가상의 영화로 쓴 견본 리뷰)은 15편, 시험 원고는 무한 스크롤(10편씩)을 시험할 수 있게 10편보다 많아야 해요.
 *
 * 왜 필요할까요?
 *   원고를 손으로 고쳐 올리면 CI가 테스트를 돌려요.
 *   원고에 실수가 있으면 이 테스트가 실패하면서 "어느 파일의 어디를 어떻게 고치라"는 메시지를 보여 줘요.
 *   (글쓰기 화면으로 저장한 원고는 저장하기 전에 같은 규칙으로 검사해요.)
 *
 * describe.each([값들])
 *   같은 묶음의 테스트를 폴더마다 한 번씩 돌려요. 이름의 %s 자리에 폴더 경로가 들어가요.
 */

import path from "node:path";
import { describe, expect, it } from "vitest";

import { loadReviews } from "./load-reviews";

describe.each([
  { dir: "content/reviews", count: 15 },
  { dir: "e2e/fixtures/reviews", count: 11 },
])("$dir", ({ dir, count }) => {
  it(`모든 원고가 형식에 맞고, ${count}편이다`, async () => {
    // 형식이 틀리면 loadReviews가 오류를 던져 테스트가 실패해요.
    const reviews = await loadReviews(path.resolve(dir));
    expect(reviews).toHaveLength(count);
  });
});

describe("content/reviews(목업 리뷰 15편)", () => {
  it("평점이 0.5부터 5 사이에 고르게 퍼져 있고, 포스터가 있는 리뷰와 없는 리뷰가 섞여 있다", async () => {
    const reviews = await loadReviews(path.resolve("content/reviews"));
    const ratings = reviews.map((review) => review.rating);
    // 가장 낮은 평점(0.5)과 높은 평점(5)이 모두 있어야 평점순 정렬과 표시를 확인하기 좋아요.
    expect(Math.min(...ratings)).toBe(0.5);
    expect(Math.max(...ratings)).toBe(5);
    // 포스터가 없는 리뷰가 있어야 기본 포스터를 확인할 수 있어요.
    expect(reviews.some((review) => review.poster)).toBe(true);
    expect(reviews.some((review) => !review.poster)).toBe(true);
  });
});
