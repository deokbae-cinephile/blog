/**
 * @file format.ts 테스트
 *
 * 테스트 파일 읽는 법 (처음이라면 여기부터!)
 *   - describe("이름", () => { ... }) : 관련 테스트를 한 묶음으로 모아요.
 *   - it("이렇게 동작한다", () => { ... }) : 테스트 하나. 이름은 "기대하는 동작"을 문장으로 써요.
 *   - expect(실제 값).toBe(기대 값) : 실제 값이 기대 값과 같은지 확인해요. 다르면 테스트가 실패해요.
 *
 * 실행: pnpm test (전체) / pnpm test:watch (파일을 고칠 때마다 다시 실행)
 */

import { describe, expect, it } from "vitest";

import { formatRating } from "./format";

describe("formatRating", () => {
  it("평점을 소수 한 자리로 보인다", () => {
    expect(formatRating(4)).toBe("4.0"); // 정수도 .0을 붙여요.
    expect(formatRating(4.5)).toBe("4.5");
    expect(formatRating(0.5)).toBe("0.5");
  });
});
