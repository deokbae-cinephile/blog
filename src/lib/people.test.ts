/**
 * @file people.ts 테스트
 *
 * 감독·출연의 "A, B" 한 줄을 사람마다 나누고, 다시 잇고, 그 사람으로 찾은 목록 주소를 만드는지 확인해요.
 */

import { describe, expect, it } from "vitest";

import { joinNames, MAX_CAST, personSearchHref, splitNames } from "./people";

describe("splitNames", () => {
  it("쉼표로 나누고 앞뒤 빈칸을 지운다", () => {
    expect(splitNames("레오나르도 디카프리오,  마크 러팔로")).toEqual(["레오나르도 디카프리오", "마크 러팔로"]);
  });

  it("빈 이름과 두 번 적은 이름은 뺀다(처음 나온 순서는 그대로)", () => {
    expect(splitNames(" , 마크 러팔로,,레오나르도 디카프리오, 마크 러팔로 ,")).toEqual(["마크 러팔로", "레오나르도 디카프리오"]);
  });

  it("한 사람이면 한 칸, 없으면 빈 목록이다", () => {
    expect(splitNames("한서윤")).toEqual(["한서윤"]);
    expect(splitNames("")).toEqual([]);
    expect(splitNames("  ,  ")).toEqual([]);
    expect(splitNames(undefined)).toEqual([]);
  });
});

describe("joinNames", () => {
  it("이름들을 쉼표와 빈칸 하나로 잇는다", () => {
    expect(joinNames(["레오나르도 디카프리오", "마크 러팔로"])).toBe("레오나르도 디카프리오, 마크 러팔로");
    expect(joinNames(["한서윤"])).toBe("한서윤");
  });
});

describe("personSearchHref", () => {
  it("그 이름으로 찾은 처음 화면 주소를 만든다(빈칸·한글은 주소에 쓸 수 있게 바꾼다)", () => {
    const href = personSearchHref("마크 러팔로");
    expect(href).toBe("/?q=%EB%A7%88%ED%81%AC%20%EB%9F%AC%ED%8C%94%EB%A1%9C");
    // 목록 화면이 읽는 검색어(q)로 되돌리면 원래 이름이에요.
    expect(new URLSearchParams(href.slice(2)).get("q")).toBe("마크 러팔로");
  });

  it("주소에서 뜻이 있는 글자(&, #, +)도 이름 그대로 전한다", () => {
    expect(new URLSearchParams(personSearchHref("A&B #1+").slice(2)).get("q")).toBe("A&B #1+");
  });
});

describe("MAX_CAST", () => {
  it("한 작품의 출연 배우는 5명까지다", () => {
    expect(MAX_CAST).toBe(5);
  });
});
