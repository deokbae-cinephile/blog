/**
 * @file shrink-image.ts 테스트
 *
 * 사진 줄이기의 계산(긴 변 1600px에 맞추기, 확장자 바꾸기, 크기 글자)과
 * 줄이지 않는 때(GIF, 브라우저가 읽지 못하는 사진)를 확인해요.
 * 실제로 그림판(canvas)에 그려 WebP로 줄이는 일은 jsdom(가짜 브라우저)이 하지 못해서, 진짜 브라우저 E2E에서 확인해요
 * (e2e/admin.spec.ts의 "큰 사진은 줄여서 올린다").
 */

import { describe, expect, it } from "vitest";

import { fitWithin, formatBytes, MAX_IMAGE_SIDE, shrinkImage, withExtension } from "./shrink-image";

describe("fitWithin", () => {
  it("긴 변이 1600px를 넘으면 같은 비율로 줄인다(가로·세로 어느 쪽이 길어도)", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(1000, 3000)).toEqual({ width: 533, height: MAX_IMAGE_SIDE });
  });

  it("이미 작으면 그대로 둔다", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it("아주 가는 사진도 1px보다 작아지지 않는다", () => {
    expect(fitWithin(10000, 1)).toEqual({ width: 1600, height: 1 });
  });
});

describe("withExtension · formatBytes", () => {
  it("확장자를 바꾸거나 붙인다", () => {
    expect(withExtension("Poster.PNG", "webp")).toBe("Poster.webp");
    expect(withExtension("a.b.jpeg", "jpg")).toBe("a.b.jpg");
    expect(withExtension("scene", "webp")).toBe("scene.webp");
  });

  it("1MB 이상은 MB(소수 한 자리), 그 아래는 KB로 보인다", () => {
    expect(formatBytes(3_355_443)).toBe("3.2MB");
    expect(formatBytes(421_888)).toBe("412KB");
    expect(formatBytes(10)).toBe("1KB");
  });
});

describe("shrinkImage", () => {
  it("GIF는 움직이는 그림일 수 있어 그대로 둔다", async () => {
    const gif = new File(["GIF89a"], "loop.gif", { type: "image/gif" });
    expect(await shrinkImage(gif)).toEqual({ file: gif, shrunk: false });
  });

  it("브라우저가 읽지 못하는 사진은 그대로 둔다(사진 올리기 API가 다시 확인해요)", async () => {
    const broken = new File(["not an image"], "broken.jpg", { type: "image/jpeg" });
    expect(await shrinkImage(broken)).toEqual({ file: broken, shrunk: false });
  });
});
