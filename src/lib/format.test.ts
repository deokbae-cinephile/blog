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

import { FACT_SEPARATOR, formatRating, joinFacts, labeled, NBSP } from "./format";

describe("formatRating", () => {
  it("평점을 소수 한 자리로 보인다", () => {
    expect(formatRating(4)).toBe("4.0"); // 정수도 .0을 붙여요.
    expect(formatRating(4.5)).toBe("4.5");
    expect(formatRating(0.5)).toBe("0.5");
  });
});

describe("joinFacts · labeled", () => {
  it("항목을 ' · '로 잇되 가운뎃점 앞은 NBSP라, 줄이 넘쳐도 가운뎃점이 줄 첫머리에 오지 않는다", () => {
    expect(FACT_SEPARATOR).toBe("\u00a0· ");
    expect(joinFacts(["Winter Stop", 2024, labeled("감독", "한서윤")])).toBe("Winter Stop\u00a0· 2024\u00a0· 감독:\u00a0한서윤");
  });

  it("없는 항목(undefined·null·빈 글자)은 빼고 잇는다", () => {
    expect(joinFacts([undefined, 2024, null, "", "한국"])).toBe(`2024${FACT_SEPARATOR}한국`);
    expect(joinFacts([])).toBe("");
  });

  it("이름표 뒤에 쌍점(:)을 붙이고, 값과의 사이는 NBSP로 붙인다(‘감독:’과 이름이 다른 줄로 떨어지지 않게)", () => {
    expect(labeled("감독", "한서윤")).toBe(`감독:${NBSP}한서윤`);
  });
});
