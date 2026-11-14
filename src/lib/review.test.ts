/**
 * @file review.ts 테스트
 *
 * "최신순" 정렬 규칙(compareLatest)이
 *   - 같은 날 쓴 글끼리는 시각으로 가르는지(나중에 쓴 글이 앞)
 *   - 날짜만 적힌 예전 원고는 그날 0시로 봐서, 같은 날 시각까지 적힌 글보다 뒤에 오는지
 *   - 시각까지 같으면 제목 가나다순인지
 * 확인해요.
 */

import { describe, expect, it } from "vitest";

import { compareLatest, publishedTime } from "./review";

/** 정렬에 필요한 항목만 있는 가짜 리뷰 */
const item = (title: string, publishedAt: string) => ({ title, publishedAt, rating: 4 });

describe("compareLatest", () => {
  it("같은 날 쓴 글은 나중에 쓴 글이 앞에 온다(제목 순서와 상관없이)", () => {
    const shutter = item("셔터 아일랜드", "2026-11-14T17:12:40+09:00");
    const phone = item("폰 부스", "2026-11-14T19:35:48+09:00");
    expect([shutter, phone].sort(compareLatest).map((review) => review.title)).toEqual(["폰 부스", "셔터 아일랜드"]);
  });

  it("날짜만 적힌 원고는 그날 0시로 보고, 날짜가 다르면 최근 날짜가 앞이며, 시각까지 같으면 가나다순이다", () => {
    const reviews = [
      item("나 예전 글", "2026-11-13"),
      item("다 날짜만", "2026-11-14"),
      item("가 날짜만", "2026-11-14"),
      item("라 저녁", "2026-11-14T20:00:00+09:00"),
    ];
    expect(reviews.sort(compareLatest).map((review) => review.title)).toEqual(["라 저녁", "가 날짜만", "다 날짜만", "나 예전 글"]);
  });
});

describe("publishedTime", () => {
  it("날짜만 있으면 한국 시간 0시, 시각이 있으면 그 순간(ms)이다", () => {
    expect(publishedTime("2026-11-14")).toBe(Date.parse("2026-11-13T15:00:00Z"));
    expect(publishedTime("2026-11-14T19:35:48+09:00")).toBe(Date.parse("2026-11-14T10:35:48Z"));
  });
});
