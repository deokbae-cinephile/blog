/**
 * @file genres.ts 테스트
 *
 * 장르 목록이
 *   - 정한 10가지이고, 가나다순으로 놓였는지(장르 필터와 글쓰기 화면이 이 순서를 그대로 써요)
 *   - isGenre가 목록에 있는 이름만 받아 주는지
 * 확인해요.
 */

import { describe, expect, it } from "vitest";

import { GENRES, isGenre } from "./genres";

describe("GENRES", () => {
  it("정한 10가지 장르를 가나다순으로 둔다", () => {
    expect(GENRES).toEqual(["공포", "다큐멘터리", "드라마", "로맨스", "범죄", "스릴러", "스포츠", "액션", "재난", "코미디"]);
    // localeCompare(…, "ko"): 한국어 사전 순서로 두 글자를 비교해요. 정렬한 결과가 원래 목록과 같으면 가나다순이에요.
    expect([...GENRES].sort((a, b) => a.localeCompare(b, "ko"))).toEqual([...GENRES]);
  });
});

describe("isGenre", () => {
  it("목록에 있는 이름만 장르로 받아 준다", () => {
    expect(isGenre("공포")).toBe(true);
    expect(isGenre("SF")).toBe(false);
    expect(isGenre("")).toBe(false);
  });
});
