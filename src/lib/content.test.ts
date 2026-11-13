// @vitest-environment node

/**
 * @file 실제 원고 검사 (content.test.ts)
 *
 * 이 테스트가 하는 일
 *   실제 원고(content/reviews)와 E2E용 시험 원고(e2e/fixtures/reviews)가 모두 형식에 맞는지 확인해요.
 *   실제 원고는 글쓴이가 쓰고 고치고 지우면서 편수와 내용이 바뀌므로 "형식"만 봐요.
 *   시험 원고는 고정이라, 무한 스크롤(10편씩)을 시험할 수 있게 10편보다 많은지도 확인해요.
 *
 * 왜 필요할까요?
 *   원고를 손으로 고쳐 올리면 CI가 테스트를 돌려요.
 *   원고에 실수가 있으면 이 테스트가 실패하면서 "어느 파일의 어디를 어떻게 고치라"는 메시지를 보여 줘요.
 *   (글쓰기 화면으로 저장한 원고는 저장하기 전에 같은 규칙으로 검사해요.)
 *   검사에 실패하면 배포하지 않으므로, 잘못된 원고가 블로그에 올라가지 않아요.
 *
 * describe.each([값들])
 *   같은 묶음의 테스트를 폴더마다 한 번씩 돌려요. 이름의 %s 자리에 폴더 경로가 들어가요.
 */

import path from "node:path";
import { describe, expect, it } from "vitest";

import { loadReviews } from "./load-reviews";

describe.each(["content/reviews", "e2e/fixtures/reviews"])("%s", (dir) => {
  it("모든 원고가 형식에 맞는다", async () => {
    // 형식이 틀리면 loadReviews가 어느 파일의 어디가 틀렸는지 담은 오류를 던져 테스트가 실패해요.
    const reviews = await loadReviews(path.resolve(dir));
    // 폴더를 잘못 읽어 아무것도 검사하지 못한 채 통과하는 일이 없게, 원고가 한 편 이상인지도 봐요.
    expect(reviews.length).toBeGreaterThan(0);
  });
});

describe("e2e/fixtures/reviews(시험 원고)", () => {
  it("무한 스크롤(처음 10편, 이어서 10편씩)을 시험할 수 있게 10편보다 많다", async () => {
    const reviews = await loadReviews(path.resolve("e2e/fixtures/reviews"));
    expect(reviews.length).toBeGreaterThan(10);
  });
});
