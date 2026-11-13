/**
 * @file manifest.ts 테스트
 *
 * 앱으로 설치하는 데 꼭 필요한 정보가 들어 있는지 확인해요.
 * (브라우저가 설치를 허락하려면 이름, 시작 주소, 앱 창 방식, 192·512 아이콘이 있어야 해요.)
 */

import { describe, expect, it } from "vitest";

import manifest from "./manifest";

describe("manifest", () => {
  it("이름, 시작 주소, 앱 창 방식, 색을 정한다", () => {
    expect(manifest()).toMatchObject({
      name: "DMB",
      short_name: "DMB",
      lang: "ko",
      start_url: "./",
      scope: "./",
      display: "standalone",
      background_color: "#020802",
      theme_color: "#020802",
    });
  });

  it("192·512 아이콘과 모양 잘림용(maskable) 아이콘을 상대 주소로 적는다", () => {
    expect(manifest().icons).toEqual([
      { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);
  });
});
