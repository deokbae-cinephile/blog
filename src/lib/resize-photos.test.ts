// @vitest-environment node
// ↑ 파일과 sharp(그림 도구)를 다루는 테스트라 Node.js 환경에서 돌려요.

/**
 * @file resize-photos.ts 테스트
 *
 * 임시 public 폴더에 진짜 그림을 만들어 두고, 빌드 직전의 사본 만들기가
 *   - 원본보다 작은 너비의 WebP 사본만 만드는지(GIF·작은 사진은 건너뜀, 하위 폴더·한글 이름 포함)
 *   - 휴대폰 사진의 돌림 표시를 따라 세로 사진을 세로로 줄이는지
 *   - 예전 사본을 지우고 새로 만드는지, 사진 폴더가 없으면 조용히 넘어가는지
 * 확인해요.
 */

import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resizePhotos } from "./resize-photos";

/** 테스트마다 새로 만드는 임시 public 폴더 */
let publicDir: string;

beforeEach(async () => {
  publicDir = await mkdtemp(path.join(tmpdir(), "resize-"));
});

afterEach(async () => {
  await rm(publicDir, { recursive: true, force: true });
});

/** 한 가지 색으로 칠한 그림을 만들어 public 아래 경로(relative)에 저장해요. */
async function makeImage(relative: string, width: number, height: number, format: "jpeg" | "png" | "webp" | "gif", orientation?: number) {
  const file = path.join(publicDir, relative);
  await mkdir(path.dirname(file), { recursive: true });
  let image = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } })[format]();
  // 휴대폰 사진처럼 "돌려서 보여 줘"(EXIF orientation) 표시를 넣어요.
  if (orientation) image = image.withMetadata({ orientation });
  await image.toFile(file);
}

/** 사본의 가로·세로·형식 */
async function info(relative: string) {
  const { width, height, format } = await sharp(path.join(publicDir, relative)).metadata();
  return { width, height, format };
}

describe("resizePhotos", () => {
  it("원본보다 작은 너비의 WebP 사본만 만들고, GIF와 작은 사진은 건너뛴다(하위 폴더·한글 이름 포함)", async () => {
    await makeImage("images/winter-stop/scene-1.jpg", 1600, 900, "jpeg");
    await makeImage("images/winter-stop/장면.png", 1000, 500, "png");
    await makeImage("images/winter-stop/tiny.webp", 300, 200, "webp");
    await makeImage("images/winter-stop/moving.gif", 1600, 900, "gif");

    // GIF는 세지 않아요(사본을 만들지 않는 형식). 1600px → 3개, 1000px → 2개(480·800), 300px → 없음
    expect(await resizePhotos(publicDir)).toEqual({ photos: 3, variants: 5, failed: [] });

    expect(await info("_resized/480/images/winter-stop/scene-1.jpg.webp")).toEqual({ width: 480, height: 270, format: "webp" });
    expect(await info("_resized/1200/images/winter-stop/scene-1.jpg.webp")).toEqual({ width: 1200, height: 675, format: "webp" });
    expect(await info("_resized/800/images/winter-stop/장면.png.webp")).toEqual({ width: 800, height: 400, format: "webp" });
    await expect(access(path.join(publicDir, "_resized/1200/images/winter-stop/장면.png.webp"))).rejects.toThrow();
    await expect(access(path.join(publicDir, "_resized/480/images/winter-stop/tiny.webp.webp"))).rejects.toThrow();
    await expect(access(path.join(publicDir, "_resized/480/images/winter-stop/moving.gif.webp"))).rejects.toThrow();
  });

  it("돌림 표시(orientation 6: 90도)가 있는 사진은 보이는 모양(세로)대로 줄인다", async () => {
    // 저장된 모양은 가로 1600 × 세로 900이지만, 90도 돌려 보여 주면 가로 900 × 세로 1600이에요.
    await makeImage("images/phone/portrait.jpg", 1600, 900, "jpeg", 6);
    expect(await resizePhotos(publicDir)).toEqual({ photos: 1, variants: 2, failed: [] });
    expect(await info("_resized/480/images/phone/portrait.jpg.webp")).toEqual({ width: 480, height: 853, format: "webp" });
  });

  it("예전 사본은 지우고 새로 만들며, 사진 폴더가 없으면 아무것도 만들지 않는다", async () => {
    const stale = path.join(publicDir, "_resized/480/images/gone/old.jpg.webp");
    await mkdir(path.dirname(stale), { recursive: true });
    await writeFile(stale, "지운 사진의 사본");

    expect(await resizePhotos(publicDir)).toEqual({ photos: 0, variants: 0, failed: [] });
    await expect(access(stale)).rejects.toThrow();
  });

  it("깨진 사진은 건너뛰고 적어 두며, 다른 사진의 사본은 그대로 만든다(빌드를 멈추지 않게)", async () => {
    await makeImage("images/a/good.jpg", 1000, 600, "jpeg");
    await mkdir(path.join(publicDir, "images/a"), { recursive: true });
    await writeFile(path.join(publicDir, "images/a/broken.jpg"), "그림이 아닌 글자");

    expect(await resizePhotos(publicDir)).toEqual({ photos: 2, variants: 2, failed: ["images/a/broken.jpg"] });
  });
});
