/**
 * @file github-link.tsx 테스트
 *
 * 머리글의 GitHub 아이콘 링크가
 *   - 새 창으로 열리고, 화면 낭독기에는 "(새 창)"을 늘 설명으로 알려 주는지
 *   - 마우스를 올리거나 초점이 갈 때 안내 말풍선(role="tooltip")이 보이고, 치우거나 Esc를 누르면 닫히는지
 * 확인해요.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { GitHubLink } from "./github-link";

const TIP = "이 블로그의 소스 코드 저장소(새 창)";

describe("GitHubLink", () => {
  it("새 창으로 여는 GitHub 링크이고, 말풍선이 닫혀 있어도 '(새 창)' 설명은 늘 붙어 있다", () => {
    render(<GitHubLink />);
    const link = screen.getByRole("link", { name: "GitHub" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAccessibleDescription(TIP);
    // 처음에는 말풍선이 숨어 있어요(화면에도, 접근성 트리에도 없음).
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("마우스를 올리면 말풍선이 보이고, 말풍선 위로 옮겨도 그대로이며, 묶음 밖으로 치우면 닫힌다", async () => {
    const user = userEvent.setup();
    render(<GitHubLink />);
    const link = screen.getByRole("link", { name: "GitHub" });

    await user.hover(link);
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent(TIP);

    // 링크 → 말풍선으로 옮겨도 닫히지 않아요(같은 묶음 안).
    await user.hover(tip);
    expect(screen.getByRole("tooltip")).toBeVisible();

    await user.unhover(tip);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("초점이 가면 보이고, Esc를 누르면 초점은 그대로 둔 채 닫힌다(Esc는 '처리했어요' 표시)", async () => {
    const user = userEvent.setup();
    render(<GitHubLink />);
    const link = screen.getByRole("link", { name: "GitHub" });

    await user.tab();
    expect(link).toHaveFocus();
    expect(screen.getByRole("tooltip")).toBeVisible();

    // fireEvent는 처리 여부(preventDefault)를 돌려줘요: false면 누군가 "처리했어요" 표시를 했다는 뜻이에요.
    const notHandled = fireEvent.keyDown(link, { key: "Escape" });
    expect(notHandled).toBe(false);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(link).toHaveFocus();

    // 닫힌 뒤의 Esc는 가져가지 않아요(상세 화면의 Esc가 그대로 동작해요).
    expect(fireEvent.keyDown(link, { key: "Escape" })).toBe(true);
  });

  it("마우스로 가리키기만 해도(초점은 다른 곳) Esc로 닫힌다", async () => {
    const user = userEvent.setup();
    render(<GitHubLink />);
    await user.hover(screen.getByRole("link", { name: "GitHub" }));
    expect(screen.getByRole("tooltip")).toBeVisible();

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
