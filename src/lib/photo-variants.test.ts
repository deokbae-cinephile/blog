/**
 * @file photo-variants.ts 테스트
 *
 * 본문 사진의 작은 사본 규칙이
 *   - 원본보다 충분히 작은 너비만 고르는지
 *   - 사본 주소·파일 이름을 원본 주소에서 맞게 만드는지(한글 파일 이름, ?·# 뒤는 떼기)
 *   - 화면 칸 너비에 맞는 sizes 글을 만드는지(한 장, 나란히, 세로로 긴 사진)
 * 확인해요.
 */

import { describe, expect, it } from "vitest";

import { photoSizes, variantFile, variantUrl, variantWidths } from "./photo-variants";

describe("variantWidths", () => {
  it("원본의 90%를 넘지 않는 너비만 고른다", () => {
    expect(variantWidths(1600)).toEqual([480, 800, 1200]);
    expect(variantWidths(900)).toEqual([480, 800]);
    expect(variantWidths(534)).toEqual([480]);
    // 원본이 작으면 사본을 만들지 않아요(거의 같은 크기라 받는 양이 별로 줄지 않아요).
    expect(variantWidths(500)).toEqual([]);
  });
});

describe("variantUrl·variantFile", () => {
  it("원본 주소 앞에 /_resized/<너비>를, 끝에 .webp를 붙인다(?·# 뒤는 떼고, %로 바꾼 글자는 그대로)", () => {
    expect(variantUrl("/images/a/scene-1.jpg", 480)).toBe("/_resized/480/images/a/scene-1.jpg.webp");
    expect(variantUrl("/images/a/scene-1.jpg?v=2#top", 800)).toBe("/_resized/800/images/a/scene-1.jpg.webp");
    expect(variantUrl("/images/%EC%9E%A5%EB%A9%B4.png", 480)).toBe("/_resized/480/images/%EC%9E%A5%EB%A9%B4.png.webp");
  });

  it("사본 파일은 public 기준 경로에 같은 규칙을 따른다", () => {
    expect(variantFile("images/a/장면.jpg", 1200)).toBe("_resized/1200/images/a/장면.jpg.webp");
  });
});

describe("photoSizes", () => {
  it("한 장: 화면 너비별 본문 칸 너비, 원본 너비, 화면 높이 80% × 비율 가운데 가장 작은 값", () => {
    expect(photoSizes({ width: 1600, height: 900 })).toBe(
      "(min-width: 1024px) min(calc(100vw - 27rem), 1600px, calc(80vh * 1.7778)), " +
        "(min-width: 640px) min(calc(100vw - 4rem), 1600px, calc(80vh * 1.7778)), " +
        "min(calc(100vw - 2rem), 1600px, calc(80vh * 1.7778))",
    );
  });

  it("나란히 놓인 사진은 640px 이상에서 칸을 둘로 나누고, 휴대폰에서는 한 장처럼 쓴다", () => {
    const sizes = photoSizes({ width: 900, height: 1600 }, true);
    expect(sizes).toContain("(min-width: 1024px) min(calc((100vw - 28.5rem) / 2), 900px, calc(80vh * 0.5625))");
    expect(sizes).toContain("(min-width: 640px) min(calc((100vw - 5.5rem) / 2), 900px");
    expect(sizes.endsWith("min(calc(100vw - 2rem), 900px, calc(80vh * 0.5625))")).toBe(true);
  });
});
