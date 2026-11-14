/**
 * @file genres.ts 테스트
 *
 * 장르 목록이
 *   - 정한 10가지이고, 가나다순으로 놓였는지(장르 필터와 글쓰기 화면이 이 순서를 그대로 써요)
 *   - isGenre가 목록에 있는 이름만 받아 주는지
 * 확인해요.
 */

import { describe, expect, it } from "vitest";

import { GENRE_SLUGS, genreFromParam, GENRES, genreSlug, isGenre } from "./genres";

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

describe("장르 영어 주소 이름(GENRE_SLUGS)", () => {
  it("모든 장르에 겹치지 않는 영어 소문자 이름이 있다", () => {
    const slugs = GENRES.map((genre) => genreSlug(genre));
    expect(slugs.every((slug) => /^[a-z]+$/.test(slug))).toBe(true);
    expect(new Set(slugs).size).toBe(GENRES.length);
    expect(Object.keys(GENRE_SLUGS)).toEqual([...GENRES]);
  });

  it("주소 값을 장르로 바꾼다: 영어 이름(대소문자 무시)과 예전 한글 이름을 받고, 없는 값은 null", () => {
    expect(genreFromParam("drama")).toBe("드라마");
    expect(genreFromParam("HORROR")).toBe("공포");
    expect(genreFromParam("드라마")).toBe("드라마");
    expect(genreFromParam("melo")).toBeNull();
    expect(genreFromParam("")).toBeNull();
    expect(genreFromParam(null)).toBeNull();
  });
});
