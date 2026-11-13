// @vitest-environment node

/**
 * @file palette.ts 테스트
 *
 * lib/palette.ts의 색 값이 globals.css의 기본 인광 색(:root)과 같은지 확인해요.
 * 한쪽만 고치면 공유 카드·앱 아이콘과 화면의 색이 어긋나니, 둘을 함께 고치라고 알려 줘요.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { GREEN_PHOSPHOR } from "./palette";

describe("GREEN_PHOSPHOR", () => {
  it("globals.css :root의 기본 색과 같다", async () => {
    const css = await readFile(path.resolve("src/app/globals.css"), "utf8");
    // 첫 번째 ":root {" 덩어리(기본 색 묶음)만 잘라 봐요.
    const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
    const value = (name: string) => new RegExp(`--${name}: (#[0-9a-f]{6});`).exec(root)?.[1];

    expect(value("phosphor")).toBe(GREEN_PHOSPHOR.phosphor);
    expect(value("phosphor-dim")).toBe(GREEN_PHOSPHOR.dim);
    expect(value("phosphor-line")).toBe(GREEN_PHOSPHOR.line);
    expect(value("screen")).toBe(GREEN_PHOSPHOR.screen);
    expect(value("ink")).toBe(GREEN_PHOSPHOR.ink);
  });
});
