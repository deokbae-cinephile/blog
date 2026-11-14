/**
 * @file view-rules.ts 테스트
 *
 * "방금 본 사람" 장부(RecentViews)가 같은 사람이 같은 리뷰를 10분 안에 다시 보면 "다시 봄"으로 알리고,
 * 10분이 지나거나 다른 사람·다른 리뷰면 새로 세게 하는지 확인해요.
 */

import { describe, expect, it } from "vitest";

import { RecentViews, REPEAT_WINDOW_MS } from "./view-rules";

describe("RecentViews", () => {
  it("같은 사람이 같은 리뷰를 10분 안에 다시 보면 '다시 봄'이다", () => {
    const recent = new RecentViews();
    expect(recent.isRepeat("사람A", "winter-stop", 0)).toBe(false);
    expect(recent.isRepeat("사람A", "winter-stop", REPEAT_WINDOW_MS - 1)).toBe(true);
  });

  it("10분이 지나면 다시 센다", () => {
    const recent = new RecentViews();
    recent.isRepeat("사람A", "winter-stop", 0);
    expect(recent.isRepeat("사람A", "winter-stop", REPEAT_WINDOW_MS)).toBe(false);
  });

  it("다른 사람이거나 다른 리뷰면 따로 센다", () => {
    const recent = new RecentViews();
    recent.isRepeat("사람A", "winter-stop", 0);
    expect(recent.isRepeat("사람B", "winter-stop", 1)).toBe(false);
    expect(recent.isRepeat("사람A", "whale-town", 2)).toBe(false);
  });
});
