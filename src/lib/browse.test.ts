/**
 * @file browse.ts 테스트
 *
 * 처음 화면의 검색·장르 필터·정렬 규칙을 화면 없이 함수만으로 확인해요.
 * 테스트 데이터는 src/test/review-mocks.ts의 가짜 리뷰 4편이에요.
 *
 *   최신순: 겨울 정류장 → 화성 세탁소 → 필름이 끊기기 전에 → 8비트 영웅전
 *   평점순: 필름이 끊기기 전에(5) → 겨울 정류장(4.5) → 화성 세탁소(3.5) → 8비트 영웅전(2.5)
 */

import { describe, expect, it } from "vitest";

import { reviewMocks } from "@/test/review-mocks";

import {
  browse,
  countGenres,
  DEFAULT_PARAMS,
  isFiltered,
  matchesQuery,
  parseParams,
  resultStatus,
  suggest,
  toSearch,
} from "./browse";

/** 결과를 비교하기 쉽게 slug만 뽑는 도우미 */
const slugs = (list: { slug: string }[]) => list.map((review) => review.slug);

// 가짜 리뷰 4편에 이름을 붙여 둬요. `as [...]`는 "4칸이 꼭 있다"고 TypeScript에 알려 주는 표시예요.
const [winter, mars, reel, legend] = reviewMocks as [
  (typeof reviewMocks)[number],
  (typeof reviewMocks)[number],
  (typeof reviewMocks)[number],
  (typeof reviewMocks)[number],
];

describe("parseParams / toSearch", () => {
  it("주소의 조건을 읽고, 다시 같은 주소로 만든다", () => {
    const params = parseParams(new URLSearchParams("q=겨울&genre=drama&sort=rating"));
    expect(params).toEqual({ q: "겨울", genre: "드라마", sort: "rating" });
    // 한글은 주소에 쓸 수 있는 모양(%EA%B2%A8...)으로 바뀌어요.
    // 장르는 영어 이름으로 적어요(한글을 적으면 %EB%93%9C…처럼 길어져요).
    expect(toSearch(params)).toBe("?q=%EA%B2%A8%EC%9A%B8&genre=drama&sort=rating");
  });

  it("없는 장르, 모르는 정렬, 공백만 있는 검색어는 기본값으로 둔다", () => {
    expect(parseParams(new URLSearchParams("q=%20%20&genre=멜로&sort=random"))).toEqual(DEFAULT_PARAMS);
  });

  it("예전 주소처럼 한글 장르(?genre=드라마)가 와도 같은 장르로 받고, 다시 적을 때는 영어 이름으로 적는다", () => {
    const params = parseParams(new URLSearchParams(`genre=${encodeURIComponent("드라마")}`));
    expect(params.genre).toBe("드라마");
    expect(toSearch(params)).toBe("?genre=drama");
    // 영어 이름은 대소문자를 가리지 않아요.
    expect(parseParams(new URLSearchParams("genre=Drama")).genre).toBe("드라마");
  });

  it("기본값만 있으면 주소에 아무것도 붙이지 않는다", () => {
    expect(toSearch(DEFAULT_PARAMS)).toBe("");
  });
});

describe("matchesQuery", () => {
  it("제목, 원제, 감독, 출연, 한 줄 평에서 찾는다", () => {
    expect(matchesQuery(winter, "정류장")).toBe(true); // 제목
    expect(matchesQuery(winter, "winter")).toBe(true); // 원제
    expect(matchesQuery(winter, "한서윤")).toBe(true); // 감독
    expect(matchesQuery(winter, "이배우")).toBe(true); // 출연(배우)
    expect(matchesQuery(winter, "기다림")).toBe(true); // 한 줄 평
    expect(matchesQuery(winter, "화성")).toBe(false);
  });

  it("대소문자와 띄어쓰기를 가리지 않는다", () => {
    expect(matchesQuery(winter, "WINTER STOP")).toBe(true);
    expect(matchesQuery(winter, "겨울정류장")).toBe(true);
  });

  it("낱말을 여럿 쓰면 모두 들어 있어야 한다", () => {
    expect(matchesQuery(winter, "겨울 한서윤")).toBe(true);
    expect(matchesQuery(winter, "겨울 화성")).toBe(false);
  });

  it("빈 검색어는 모두 남긴다", () => {
    expect(matchesQuery(mars, "  ")).toBe(true);
  });
});

describe("browse", () => {
  it("기본은 최근에 쓴 글부터 보인다", () => {
    expect(slugs(browse(reviewMocks, DEFAULT_PARAMS))).toEqual([winter.slug, mars.slug, reel.slug, legend.slug]);
  });

  it("장르로 거른다", () => {
    expect(slugs(browse(reviewMocks, { ...DEFAULT_PARAMS, genre: "드라마" }))).toEqual([winter.slug, reel.slug]);
  });

  it("평점이 높은 순으로 정렬한다", () => {
    expect(slugs(browse(reviewMocks, { ...DEFAULT_PARAMS, sort: "rating" }))).toEqual([
      reel.slug,
      winter.slug,
      mars.slug,
      legend.slug,
    ]);
  });

  it("검색어와 장르를 함께 쓴다", () => {
    expect(slugs(browse(reviewMocks, { q: "영사기", genre: "드라마", sort: "latest" }))).toEqual([reel.slug]);
    expect(browse(reviewMocks, { q: "영사기", genre: "코미디", sort: "latest" })).toEqual([]);
  });
});

describe("countGenres", () => {
  it("리뷰가 있는 장르만 장르 목록 순서로 센다", () => {
    expect(countGenres(reviewMocks)).toEqual([
      { genre: "드라마", count: 2 },
      { genre: "로맨스", count: 1 },
      { genre: "액션", count: 1 },
      { genre: "재난", count: 1 },
      { genre: "코미디", count: 1 },
    ]);
  });

  it("지금 고른 장르는 0편이어도 남긴다", () => {
    // toContainEqual: 배열 안에 이 내용과 같은 항목이 있는지 확인해요.
    expect(countGenres(reviewMocks, "공포")).toContainEqual({ genre: "공포", count: 0 });
  });
});

describe("isFiltered / resultStatus", () => {
  it("정렬만 바꾼 것은 거른 것이 아니다", () => {
    expect(isFiltered({ ...DEFAULT_PARAMS, sort: "rating" })).toBe(false);
    expect(isFiltered({ ...DEFAULT_PARAMS, q: "겨울" })).toBe(true);
  });

  it("결과 안내 문구를 만든다", () => {
    expect(resultStatus(8, 8, DEFAULT_PARAMS)).toBe("전체 8편");
    expect(resultStatus(8, 1, { ...DEFAULT_PARAMS, genre: "로맨스" })).toBe("8편 중 1편");
    expect(resultStatus(8, 0, { ...DEFAULT_PARAMS, q: "없음" })).toBe("8편 중 0편");
  });
});

describe("suggest(자동완성 추천)", () => {
  it("친 글자로 시작하는 제목을 추천한다", () => {
    expect(suggest(reviewMocks, "겨울")).toEqual([{ value: "겨울 정류장", kind: "제목" }]);
  });

  it("대소문자와 띄어쓰기를 가리지 않고, 원제와 감독도 추천한다", () => {
    expect(suggest(reviewMocks, "winterstop")).toEqual([{ value: "Winter Stop", kind: "원제" }]);
    expect(suggest(reviewMocks, "한서")).toEqual([{ value: "한서윤", kind: "감독" }]);
  });

  it("시작하는 추천이 먼저, 중간에 들어 있는 추천이 뒤에 온다", () => {
    // "전"은 "8비트 영웅전"의 끝에, "전에"는 "필름이 끊기기 전에"의 중간에 있어요. 둘 다 시작하지 않아 가나다순이에요.
    // "8"로 시작하는 원제·제목은 앞에 와요.
    const values = suggest(reviewMocks, "8").map((item) => item.value);
    expect(values).toEqual(["8-Bit Legend", "8비트 영웅전"]);
  });

  it("같은 글자는 한 번만, 최대 개수까지만 추천한다", () => {
    const reviews = [...reviewMocks, { ...reviewMocks[0]!, slug: "again" }];
    expect(suggest(reviews, "겨울")).toHaveLength(1);
    expect(suggest(reviewMocks, "e", 2)).toHaveLength(2);
  });

  it("공동 감독은 한 사람씩 나눠 추천한다", () => {
    const reviews = [{ ...reviewMocks[0]!, director: "박감독, 최감독" }];
    expect(suggest(reviews, "감독").map((item) => item.value)).toEqual(["박감독", "최감독"]);
  });

  it("출연 배우도 한 사람씩 나눠 '출연'으로 추천한다", () => {
    expect(suggest(reviewMocks, "배우")).toEqual([
      { value: "김배우", kind: "출연" },
      { value: "이배우", kind: "출연" },
    ]);
    // 띄어 쓴 이름도 붙여 쳐서 찾을 수 있어요.
    const reviews = [{ ...reviewMocks[0]!, cast: "레오나르도 디카프리오, 마크 러팔로" }];
    expect(suggest(reviews, "마크러")).toEqual([{ value: "마크 러팔로", kind: "출연" }]);
  });

  it("빈 글자나 맞는 것이 없으면 추천하지 않는다", () => {
    expect(suggest(reviewMocks, "  ")).toEqual([]);
    expect(suggest(reviewMocks, "없는영화")).toEqual([]);
  });
});
