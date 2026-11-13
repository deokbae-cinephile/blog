/**
 * @file pixel-path.ts 테스트
 *
 * 글자 그림이 기대한 SVG 경로 명령으로 바뀌는지 확인해요.
 * (명령 읽는 법은 pixel-path.ts의 설명을 보세요. 예: "M0 0h2v1h-2z" = (0,0)에서 시작하는 가로 2칸 막대)
 */

import { describe, expect, it } from "vitest";

import { pixelPath } from "./pixel-path";

describe("pixelPath", () => {
  it("이어진 칸을 가로 막대 하나로 묶는다", () => {
    // "##.#" → 0~1번 칸 막대(너비 2) + 3번 칸 막대(너비 1)
    expect(pixelPath(["##.#"], "#")).toBe("M0 0h2v1h-2zM3 0h1v1h-1z");
  });

  it("줄마다 y 좌표를 하나씩 내린다", () => {
    expect(pixelPath([".#", "#."], "#")).toBe("M1 0h1v1h-1zM0 1h1v1h-1z");
  });

  it("고른 글자만 그린다", () => {
    expect(pixelPath(["#+#"], "+")).toBe("M1 0h1v1h-1z");
  });

  it("offset만큼 옮겨 그린다(아이콘 가운데에 놓을 때)", () => {
    expect(pixelPath(["#"], "#", { x: 3, y: 2 })).toBe("M3 2h1v1h-1z");
  });
});
