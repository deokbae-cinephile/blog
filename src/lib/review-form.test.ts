/**
 * @file review-form.ts 테스트
 *
 * 글쓰기 칸 검사가 빌드할 때의 원고 검사와 같은 규칙으로, 칸 이름으로 된 문구를 돌려주는지 확인해요.
 */

import { describe, expect, it } from "vitest";

import { EMPTY_VALUES, type ReviewFormValues } from "./review-file";
import { FIELD_MESSAGES, findBodyImages, todayInSeoul, validateReviewForm } from "./review-form";

/** 꼭 필요한 칸을 모두 채운 올바른 값 */
const valid: ReviewFormValues = {
  ...EMPTY_VALUES,
  slug: "winter-stop",
  title: "겨울 정류장",
  year: "2024",
  director: "한서윤",
  genres: ["드라마"],
  rating: "4.5",
  oneLiner: "기다림은 끝내 도착한다.",
  body: "본문",
};

describe("validateReviewForm", () => {
  it("빈 칸이면 꼭 채워야 하는 칸마다 칸 이름으로 된 문구를 돌려준다", () => {
    const result = validateReviewForm(EMPTY_VALUES, { checkSlug: true, today: "2026-11-13" });
    expect(result).toEqual({
      ok: false,
      errors: {
        slug: FIELD_MESSAGES.slug,
        title: FIELD_MESSAGES.title,
        year: FIELD_MESSAGES.year,
        director: FIELD_MESSAGES.director,
        genres: FIELD_MESSAGES.genres,
        rating: FIELD_MESSAGES.rating,
        oneLiner: FIELD_MESSAGES.oneLiner,
      },
    });
  });

  it("통과하면 원고에 넣을 정보를 돌려주고, 글 쓴 날이 비어 있으면 오늘 날짜를 넣는다", () => {
    const result = validateReviewForm(valid, { checkSlug: true, today: "2026-11-13" });
    expect(result).toEqual({
      ok: true,
      frontmatter: {
        title: "겨울 정류장",
        year: 2024,
        director: "한서윤",
        genres: ["드라마"],
        rating: 4.5,
        oneLiner: "기다림은 끝내 도착한다.",
        publishedAt: "2026-11-13",
      },
    });
  });

  it("불러온 원고의 글 쓴 날과 선택 칸(원제·국가·상영 시간·포스터)은 그대로 넣는다", () => {
    const result = validateReviewForm(
      { ...valid, publishedAt: "2026-01-02", originalTitle: "Winter Stop", country: "한국", runtime: "112", poster: "winter-stop.jpg", posterAlt: "정류장" },
      { checkSlug: true, today: "2026-11-13" },
    );
    expect(result.ok && result.frontmatter).toMatchObject({
      publishedAt: "2026-01-02",
      originalTitle: "Winter Stop",
      country: "한국",
      runtime: 112,
      poster: "winter-stop.jpg",
      posterAlt: "정류장",
    });
  });

  it.each([
    ["year", "이천이십사"],
    ["year", "1500"],
    ["runtime", "0"],
    ["rating", "4.3"],
    ["rating", "0"],
  ] as const)("%s 칸의 %s는 받지 않는다", (field, value) => {
    const result = validateReviewForm({ ...valid, [field]: value }, { checkSlug: true });
    expect(result.ok === false && result.errors[field]).toBe(FIELD_MESSAGES[field]);
  });

  it("수정(checkSlug: false)에서는 주소를 검사하지 않는다", () => {
    expect(validateReviewForm({ ...valid, slug: "" }, { checkSlug: false }).ok).toBe(true);
    expect(validateReviewForm({ ...valid, slug: "겨울" }, { checkSlug: true }).ok).toBe(false);
  });

  it("본문 사진에 설명이 없거나 바깥 주소면 본문 칸에 이유를 알려 준다", () => {
    const result = validateReviewForm({ ...valid, body: "글\n\n![](/images/winter-stop/scene-1.jpg)\n\n![설명](https://example.com/a.jpg)" }, { checkSlug: true });
    expect(result.ok === false && result.errors.body).toContain("설명을 적어 주세요");
    expect(result.ok === false && result.errors.body).toContain("/로 시작하는 주소로");
  });
});

describe("findBodyImages", () => {
  it("본문의 사진 주소와 설명을 찾는다(캡션과 꺾쇠 주소도)", () => {
    expect(findBodyImages('![빛](/images/a/1.jpg "캡션") 글 ![](</images/a/2.png>)')).toEqual([
      { alt: "빛", src: "/images/a/1.jpg" },
      { alt: "", src: "/images/a/2.png" },
    ]);
  });
});

describe("todayInSeoul", () => {
  it("서버 시간대와 상관없이 한국 시간 날짜를 돌려준다", () => {
    // UTC 2026-11-12 16:00 = 한국 2026-11-13 01:00
    expect(todayInSeoul(new Date(Date.UTC(2026, 10, 12, 16)))).toBe("2026-11-13");
  });
});
