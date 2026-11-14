/**
 * @file logo.ts 테스트
 *
 * 로고 그림을 손으로 고치다가 줄 길이가 어긋나면(칸을 하나 빠뜨리면) 그림이 비뚤어져요.
 * 모든 줄의 칸 수가 같은지, 쓰는 글자가 '#'과 '.'뿐인지 확인해요.
 */

import { describe, expect, it } from "vitest";

import { GITHUB_MARK_ROWS } from "./github-mark";
import { HEADER_LOGO_ROWS, LOGO_ROWS } from "./logo";

describe("LOGO_ROWS", () => {
  it("모든 줄의 칸 수가 같다", () => {
    const widths = new Set(LOGO_ROWS.map((row) => row.length));
    expect(widths.size).toBe(1);
  });

  it("'#'(칠한 칸)과 '.'(빈칸)만 쓴다", () => {
    expect(LOGO_ROWS.every((row) => /^[#.]+$/.test(row))).toBe(true);
  });
});

describe("HEADER_LOGO_ROWS", () => {
  it("'#'과 '.'만 쓰고, 모든 줄의 칸 수가 같다", () => {
    expect(HEADER_LOGO_ROWS.every((row) => /^[#.]+$/.test(row))).toBe(true);
    expect(new Set(HEADER_LOGO_ROWS.map((row) => row.length)).size).toBe(1);
  });

  it("오른쪽 GitHub 아이콘과 칸 수(가로 × 세로)가 같아, 같은 크기로 그려진다", () => {
    expect([HEADER_LOGO_ROWS[0].length, HEADER_LOGO_ROWS.length]).toEqual([GITHUB_MARK_ROWS[0].length, GITHUB_MARK_ROWS.length]);
  });
});
