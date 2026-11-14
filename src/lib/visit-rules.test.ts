/**
 * @file visit-rules.ts 테스트
 *
 * "그날 이미 센 사람" 기록을 지우는 기준(previousDay)이 달·해가 바뀌는 날과 윤년에도 하루 전을 맞게 돌려주는지 확인해요.
 */

import { describe, expect, it } from "vitest";

import { previousDay } from "./visit-rules";

describe("previousDay", () => {
  it("하루 전 날짜를 YYYY-MM-DD로 돌려준다(달·해가 바뀌는 날 포함)", () => {
    expect(previousDay("2026-11-14")).toBe("2026-11-13");
    expect(previousDay("2026-12-01")).toBe("2026-11-30");
    expect(previousDay("2027-01-01")).toBe("2026-12-31");
  });

  it("윤년과 평년의 3월 1일을 구별한다", () => {
    expect(previousDay("2028-03-01")).toBe("2028-02-29");
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
  });
});
