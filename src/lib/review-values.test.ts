/**
 * @file review-values.ts 테스트
 *
 * 예전 칸 모양으로 저장한 글(이 브라우저의 임시 저장본)을 불러와도, 지금 칸 모양에 맞춰지는지 확인해요.
 */

import { describe, expect, it } from "vitest";

import { EMPTY_VALUES, type ReviewFormValues, withFormDefaults } from "./review-values";

describe("withFormDefaults", () => {
  it("없는 칸(예: 나중에 생긴 출연)은 빈 값으로 채우고, 지금은 없는 칸(예: 제작 국가)은 버린다", () => {
    // 2.0.0 핫픽스 전 임시 저장본: 출연(cast) 칸이 없고 제작 국가(country) 칸이 있어요.
    const saved = { title: "겨울 정류장", director: "한서윤", country: "한국", genres: ["드라마"] } as Partial<ReviewFormValues>;
    const values = withFormDefaults(saved);
    expect(values).toEqual({ ...EMPTY_VALUES, title: "겨울 정류장", director: "한서윤", genres: ["드라마"] });
    expect(values).not.toHaveProperty("country");
    expect(values.cast).toBe("");
  });

  it("모양이 맞지 않는 값(글자 칸의 숫자, 장르의 글자)은 빈 값으로 둔다", () => {
    const saved = { year: 2024, genres: "드라마", cast: "김배우, 이배우" } as unknown as Partial<ReviewFormValues>;
    expect(withFormDefaults(saved)).toEqual({ ...EMPTY_VALUES, cast: "김배우, 이배우" });
  });

  it("처음 값(EMPTY_VALUES)을 바꾸지 않는다", () => {
    withFormDefaults({ title: "바꿔 보기", genres: ["코미디"] });
    expect(EMPTY_VALUES.title).toBe("");
    expect(EMPTY_VALUES.genres).toEqual([]);
  });
});
