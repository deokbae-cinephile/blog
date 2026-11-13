/**
 * @file upload-rules.ts 테스트
 *
 * 사진을 고르자마자 받을 수 있는지 알려 주는 규칙(형식·크기)과, 저장 경로 모양을 확인해요.
 */

import { describe, expect, it } from "vitest";

import { extensionOf, MAX_IMAGE_BYTES, UPLOAD_PATH, uploadProblem } from "./upload-rules";

describe("extensionOf", () => {
  it("확장자를 소문자로 꺼내고, 없으면 빈 글자다", () => {
    expect(extensionOf("Poster.JPG")).toBe("jpg");
    expect(extensionOf("a.b.webp")).toBe("webp");
    expect(extensionOf("noext")).toBe("");
  });
});

describe("uploadProblem", () => {
  it("받을 수 있는 그림이면 문제가 없다", () => {
    expect(uploadProblem({ name: "a.jpeg", size: 1000 }, "poster")).toBeNull();
    expect(uploadProblem({ name: "a.gif", size: 1000 }, "scene")).toBeNull();
  });

  it("포스터는 GIF를 받지 않고, 아이폰 사진(HEIC)은 JPG로 바꾸라고 알려 준다", () => {
    expect(uploadProblem({ name: "a.gif", size: 1000 }, "poster")).toContain("포스터는 JPG·PNG·WebP·AVIF");
    expect(uploadProblem({ name: "IMG_0001.HEIC", size: 1000 }, "scene")).toContain("JPG로 바꿔");
  });

  it("4MB보다 크면 줄여 달라고 알려 준다", () => {
    expect(uploadProblem({ name: "big.jpg", size: MAX_IMAGE_BYTES + 1 }, "scene")).toContain("4MB보다 큽니다");
  });
});

describe("UPLOAD_PATH", () => {
  it.each(["public/posters/winter-stop.jpg", "public/images/winter-stop/scene-1.png"])("%s는 받는다", (path) => {
    expect(UPLOAD_PATH.test(path)).toBe(true);
  });

  it.each(["public/posters/winter-stop.gif", "public/images/../secret.jpg", "content/reviews/a.md", "public/images/a/b/c.jpg"])(
    "%s는 받지 않는다",
    (path) => {
      expect(UPLOAD_PATH.test(path)).toBe(false);
    },
  );
});
