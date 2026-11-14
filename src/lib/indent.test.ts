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

  it("글이 줄바꿈으로 시작하고 커서가 맨 앞(0)이면, 첫 줄(빈 줄)을 다룬다(다음 줄을 건드리거나 줄바꿈을 늘리지 않는다)", () => {
    const outdented = indentText("\n\t- 가", 0, 0, true);
    expect(outdented.value).toBe("\n\t- 가");
    expect([outdented.selectionStart, outdented.selectionEnd]).toEqual([0, 0]);
    // 들여쓰기는 빈 첫 줄의 커서 자리에 Tab을 넣어요.
    expect(indentText("\n- 가", 0, 0, false).value).toBe("\t\n- 가");
  });

  it("Shift+Tab: 고른 범위 끝이 마지막 줄의 들여쓰기 한가운데면, 끝은 그 줄 맨 앞에 남는다(고른 범위가 접히지 않는다)", () => {
    // 끝(5)은 둘째 줄 "    B"의 띄어쓰기 4칸 중 2칸 뒤예요. 지운 뒤에는 둘째 줄 맨 앞(2)이에요.
    const result = indentText("\tA\n    B", 0, 5, true);
    expect(result.value).toBe("A\nB");
    expect([result.selectionStart, result.selectionEnd]).toEqual([0, 2]);
  });
});
