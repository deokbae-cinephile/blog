/**
 * @file indent.ts 테스트
 *
 * 본문 글상자의 Tab·Shift+Tab이
 *   - 목록 줄에서는 커서가 어디 있든 줄 맨 앞을 들여 써서 중첩 목록을 만드는지
 *   - 목록이 아닌 줄에서는 커서 자리에 Tab을 넣는지
 *   - 여러 줄을 고르면 그 줄들을 한꺼번에 들여 쓰고/내어 쓰는지
 *   - 커서(고른 범위)가 알맞게 따라 움직이는지
 * 확인해요.
 */

import { describe, expect, it } from "vitest";

import { indentText } from "./indent";

describe("indentText", () => {
  it("목록 줄에서 Tab: 커서가 줄 끝에 있어도 줄 맨 앞에 Tab을 넣어 안쪽 목록으로 만든다", () => {
    const value = "- 가\n- 나";
    const result = indentText(value, value.length, value.length, false);
    expect(result.value).toBe("- 가\n\t- 나");
    // 커서는 같은 글자 뒤(한 칸 밀린 자리)에 남아요.
    expect([result.selectionStart, result.selectionEnd]).toEqual([value.length + 1, value.length + 1]);
    // 바꾼 범위: 둘째 줄 전체
    expect([result.from, result.to, result.replacement]).toEqual([4, 7, "\t- 나"]);
  });

  it("번호 목록(1.)도 같은 방식으로 들여 쓴다", () => {
    const value = "1. 가\n2. 나";
    expect(indentText(value, value.length, value.length, false).value).toBe("1. 가\n\t2. 나");
  });

  it("목록이 아닌 줄에서 Tab: 커서 자리에 Tab을 넣는다", () => {
    const result = indentText("가나", 1, 1, false);
    expect(result.value).toBe("가\t나");
    expect([result.selectionStart, result.selectionEnd]).toEqual([2, 2]);
  });

  it("여러 줄을 고르고 Tab: 고른 줄마다 맨 앞에 Tab을 넣고, 고른 범위도 함께 늘린다", () => {
    const value = "- 가\n- 나\n- 다";
    // "나"가 있는 줄부터 "다"가 있는 줄까지 고름
    const result = indentText(value, 4, value.length, false);
    expect(result.value).toBe("- 가\n\t- 나\n\t- 다");
    expect([result.selectionStart, result.selectionEnd]).toEqual([5, value.length + 2]);
  });

  it("고른 범위 끝이 다음 줄 맨 앞이면, 그 줄은 들여 쓰지 않는다", () => {
    const value = "가\n나\n다";
    // "가\n"까지 골랐어요(끝이 "나" 줄의 맨 앞).
    expect(indentText(value, 0, 2, false).value).toBe("\t가\n나\n다");
  });

  it("Shift+Tab: 줄 맨 앞의 Tab 하나를 지운다(커서는 지운 만큼 앞으로)", () => {
    const value = "- 가\n\t- 나";
    const result = indentText(value, value.length, value.length, true);
    expect(result.value).toBe("- 가\n- 나");
    expect([result.selectionStart, result.selectionEnd]).toEqual([value.length - 1, value.length - 1]);
  });

  it("Shift+Tab: Tab 대신 띄어쓰기로 들여 쓴 줄은 4칸까지 지운다", () => {
    expect(indentText("      - 가", 8, 8, true).value).toBe("  - 가");
    expect(indentText("  - 가", 4, 4, true).value).toBe("- 가");
  });

  it("Shift+Tab: 들여 쓰지 않은 줄은 그대로 둔다", () => {
    const result = indentText("- 가", 3, 3, true);
    expect(result.value).toBe("- 가");
    expect([result.selectionStart, result.selectionEnd]).toEqual([3, 3]);
  });

  it("Shift+Tab: 여러 줄을 고르면 줄마다 하나씩 내어 쓴다", () => {
    const value = "\t- 가\n\t\t- 나\n- 다";
    const result = indentText(value, 0, value.length, true);
    expect(result.value).toBe("- 가\n\t- 나\n- 다");
    expect([result.selectionStart, result.selectionEnd]).toEqual([0, value.length - 2]);
  });
});
