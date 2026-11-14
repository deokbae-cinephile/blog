/**
 * @file upload-rules.ts 테스트
 *
 * 사진을 고르자마자 받을 수 있는지 알려 주는 규칙(형식·크기)과, 저장 경로 모양을 확인해요.
 */

import { describe, expect, it } from "vitest";

import { checkImage, extensionOf, MAX_IMAGE_BYTES, sniffImageType, UPLOAD_PATH, uploadProblem } from "./upload-rules";

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

describe("sniffImageType(파일 앞부분으로 그림 형식 알아내기)", () => {
  /** 글자와 숫자를 섞어 파일 앞부분을 만들어요. 글자는 한 글자에 한 바이트예요. */
  const head = (...parts: (string | number[])[]) =>
    new Uint8Array(parts.flatMap((part) => (typeof part === "string" ? part.split("").map((char) => char.charCodeAt(0)) : part)));
  /** AVIF·HEIC 모양: 상자 크기(4바이트) + "ftyp" + 주 상표 + 판 번호(4바이트) + 함께 쓰는 상표들 */
  const ftyp = (major: string, ...compatible: string[]) => head([0, 0, 0, 16 + compatible.length * 4], "ftyp", major, [0, 0, 0, 0], ...compatible);

  it.each([
    ["jpg", head([0xff, 0xd8, 0xff, 0xe0])],
    ["png", head([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a])],
    ["gif", head("GIF89a")],
    ["gif", head("GIF87a")],
    ["webp", head("RIFF", [1, 2, 3, 4], "WEBP")],
    ["avif", ftyp("avif", "mif1")],
    ["avif", ftyp("mif1", "miaf", "avif")],
  ])("%s 서명을 알아본다", (type, bytes) => {
    expect(sniffImageType(bytes)).toBe(type);
  });

  it.each([
    ["글자 파일", head("hello")],
    ["아이폰 사진(HEIC)", ftyp("heic", "mif1", "heix")],
    ["빈 파일", head()],
    ["RIFF지만 WebP가 아닌 파일(WAV)", head("RIFF", [1, 2, 3, 4], "WAVE")],
  ])("%s는 모르는 형식(undefined)", (_name, bytes) => {
    expect(sniffImageType(bytes)).toBeUndefined();
  });
});

describe("checkImage(서명과 머리까지 보고 진짜 그림인지 확인)", () => {
  const head = (...parts: (string | number[])[]) =>
    new Uint8Array(parts.flatMap((part) => (typeof part === "string" ? part.split("").map((char) => char.charCodeAt(0)) : part)));
  /** 4바이트 큰 자리부터 */
  const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  /** PNG 머리: 서명 + IHDR 덩어리(길이 13, 가로, 세로, 비트 깊이 등) + CRC */
  const png = (width: number, height: number) => head(PNG_SIGNATURE, be32(13), "IHDR", be32(width), be32(height), [8, 2, 0, 0, 0], [0, 0, 0, 0]);
  /** JPEG 머리: 시작(FFD8) + APP0(JFIF, 길이 16) + SOF0(길이 17, 정밀도, 세로, 가로) */
  const jpeg = (width: number, height: number) =>
    head([0xff, 0xd8], [0xff, 0xe0, 0, 16], "JFIF", [0, 1, 1, 0, 0, 1, 0, 1, 0, 0], [0xff, 0xc0, 0, 17, 8], [height >> 8, height & 255, width >> 8, width & 255], [3]);

  it.each([
    ["png", png(200, 300)],
    ["jpg", jpeg(1600, 1200)],
    ["gif", head("GIF89a", [200, 0, 44, 1], [0, 0, 0])],
    ["webp", head("RIFF", [22, 0, 0, 0], "WEBP", "VP8 ", Array(14).fill(0))],
    ["avif", head([0, 0, 0, 24], "ftyp", "avif", [0, 0, 0, 0], "mif1", "miaf", [0, 0, 0, 20], "ispe", Array(12).fill(1))],
  ])("머리까지 갖춘 %s는 받는다", (type, bytes) => {
    expect(checkImage(bytes)).toBe(type);
  });

  it.each([
    ["서명 8바이트뿐인 PNG", head(PNG_SIGNATURE)],
    ["가로가 0인 PNG", png(0, 300)],
    ["그림 틀(SOF) 없이 끝나는 JPEG", head([0xff, 0xd8], [0xff, 0xe0, 0, 4, 0, 0], [0xff, 0xd9])],
    ["서명뿐인 GIF", head("GIF89a")],
    ["VP8 덩어리가 없는 WebP", head("RIFF", [22, 0, 0, 0], "WEBP", "JUNK", Array(14).fill(0))],
    ["크기 상자(ispe)가 없는 AVIF", head([0, 0, 0, 16], "ftyp", "avif", [0, 0, 0, 0])],
  ])("%s는 받지 않는다", (_name, bytes) => {
    expect(checkImage(bytes)).toBeUndefined();
  });
});
