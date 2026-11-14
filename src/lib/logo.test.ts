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
  it("LOGO_ROWS(같은 카메라) 위아래에 빈 줄을 하나씩 더한 그림이다", () => {
    expect(HEADER_LOGO_ROWS.slice(1, -1)).toEqual([...LOGO_ROWS]);
    expect(HEADER_LOGO_ROWS.at(0)).toMatch(/^\.+$/);
    expect(HEADER_LOGO_ROWS.at(-1)).toMatch(/^\.+$/);
  });

  it("왼쪽 끝 칸과 오른쪽 끝 칸이 색칠돼 있어, 그림 끝이 곧 요소 끝이다(머리글의 로고 ↔ 이름 간격이 그대로)", () => {
    expect(HEADER_LOGO_ROWS.some((row) => row.startsWith("#"))).toBe(true);
    expect(HEADER_LOGO_ROWS.some((row) => row.endsWith("#"))).toBe(true);
  });

  it("'#'과 '.'만 쓰고, 모든 줄의 칸 수가 같다", () => {
    expect(HEADER_LOGO_ROWS.every((row) => /^[#.]+$/.test(row))).toBe(true);
    expect(new Set(HEADER_LOGO_ROWS.map((row) => row.length)).size).toBe(1);
  });

  it("오른쪽 GitHub 아이콘과 칸 수(가로 × 세로)가 같아, 같은 크기로 그려진다", () => {
    expect([HEADER_LOGO_ROWS[0].length, HEADER_LOGO_ROWS.length]).toEqual([GITHUB_MARK_ROWS[0].length, GITHUB_MARK_ROWS.length]);
  });
});
