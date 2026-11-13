/**
 * @file choice-chips.tsx 테스트
 *
 * 칩 모양이어도 진짜 라디오 단추처럼 동작하는지 확인해요.
 *   - 묶음 이름(legend)이 그룹의 이름이 된다
 *   - 고른 칩은 checked, 누르면 onChange가 불린다
 *   - disabled 묶음은 누를 수 없다
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Choice, ChoiceGroup } from "./choice-chips";

describe("ChoiceGroup / Choice", () => {
  it("묶음 이름이 붙은 라디오 그룹이고, 고른 칩은 checked이며 누르면 알린다", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChoiceGroup legend="인광 색">
        <Choice name="color" checked onChange={() => {}}>
          초록
        </Choice>
        <Choice name="color" checked={false} onChange={onChange}>
          앰버
        </Choice>
      </ChoiceGroup>,
    );

    // <fieldset> + <legend>는 이름 있는 "group"이에요.
    expect(screen.getByRole("group", { name: "인광 색" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "초록" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "앰버" }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("disabled 묶음의 칩은 누를 수 없다", () => {
    render(
      <ChoiceGroup legend="정렬" disabled>
        <Choice name="sort" checked onChange={() => {}}>
          최신순
        </Choice>
      </ChoiceGroup>,
    );
    expect(screen.getByRole("radio", { name: "최신순" })).toBeDisabled();
  });
});
