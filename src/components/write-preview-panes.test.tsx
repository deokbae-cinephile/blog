/**
 * @file write-preview-panes.tsx 테스트
 *
 * 본문 쓰기 칸과 미리 보기가
 *   - 좁은 화면: WAI-ARIA 탭 패턴(tablist·tab·tabpanel, aria-selected true/false, aria-controls, hidden)과
 *     ← → Home End 이동, roving tabindex를 지키는지
 *   - 넓은 화면: 탭 없이 둘 다 보이고, 미리 보기는 이름 있는 스크롤 영역(키보드로 초점 받기)인지
 * 확인해요.
 *
 * 화면 너비는 어떻게 바꾸나요?
 *   시험 환경(jsdom)에는 진짜 화면이 없어서 vitest.setup.ts가 matchMedia를 "늘 맞지 않음(좁은 화면)"으로 흉내 내요.
 *   넓은 화면 시험에서만 vi.spyOn으로 "맞음"을 돌려주게 바꿔요.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type PaneView, WritePreviewPanes } from "./write-preview-panes";

/** 실제 화면처럼 지금 보이는 쪽을 기억하는 시험용 틀 */
function Harness({ initial = "input" }: { initial?: PaneView }) {
  const [view, setView] = useState<PaneView>(initial);
  return (
    <WritePreviewPanes
      view={view}
      onViewChange={setView}
      input={
        <label>
          본문(Markdown)
          <textarea />
        </label>
      }
      preview={<p>미리 본 글</p>}
    />
  );
}

describe("WritePreviewPanes: 좁은 화면(탭)", () => {
  it("탭 두 개(Markdown 입력·미리 보기)와 탭 내용이 서로 이어지고, 고르지 않은 쪽은 숨긴다", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist", { name: "본문 보기" })).toBeInTheDocument();
    const inputTab = screen.getByRole("tab", { name: "Markdown 입력" });
    const previewTab = screen.getByRole("tab", { name: "미리 보기" });
    // aria-selected는 true/false를 모두 적어요.
    expect(inputTab).toHaveAttribute("aria-selected", "true");
    expect(previewTab).toHaveAttribute("aria-selected", "false");

    // 탭이 가리키는 내용(aria-controls)이 그 탭을 이름으로 가져요(aria-labelledby).
    const inputPanel = document.getElementById(inputTab.getAttribute("aria-controls")!)!;
    const previewPanel = document.getElementById(previewTab.getAttribute("aria-controls")!)!;
    expect(inputPanel).toHaveAttribute("role", "tabpanel");
    expect(inputPanel).toHaveAccessibleName("Markdown 입력");
    expect(inputPanel).toHaveAttribute("tabindex", "0");
    expect(inputPanel).toBeVisible();
    // 보이지 않는 쪽은 hidden으로 숨겨 화면 낭독기에도 나오지 않아요.
    expect(previewPanel).toHaveAttribute("hidden");
    expect(screen.queryByText("미리 본 글")).not.toBeVisible();
  });

  it("탭을 누르면 그 쪽을 보여 준다", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("tab", { name: "미리 보기" }));
    expect(screen.getByRole("tab", { name: "미리 보기" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "미리 보기" })).toBeVisible();
    expect(screen.getByText("미리 본 글")).toBeVisible();
    expect(screen.queryByRole("tabpanel", { name: "Markdown 입력" })).not.toBeInTheDocument();
  });

  it("← → Home End로 탭을 옮기면 바로 그 쪽을 보여 주고, Tab 순서에는 고른 탭 하나만 든다(roving tabindex)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const inputTab = screen.getByRole("tab", { name: "Markdown 입력" });
    const previewTab = screen.getByRole("tab", { name: "미리 보기" });
    expect(inputTab).not.toHaveAttribute("tabindex");
    expect(previewTab).toHaveAttribute("tabindex", "-1");

    inputTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(previewTab).toHaveFocus();
    expect(previewTab).toHaveAttribute("aria-selected", "true");
    expect(previewTab).not.toHaveAttribute("tabindex");
    expect(inputTab).toHaveAttribute("tabindex", "-1");

    // 끝에서 → 를 한 번 더 누르면 처음으로 돌아가요.
    await user.keyboard("{ArrowRight}");
    expect(inputTab).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(previewTab).toHaveFocus();
    await user.keyboard("{Home}");
    expect(inputTab).toHaveFocus();
    await user.keyboard("{End}");
    expect(previewTab).toHaveFocus();
    expect(screen.getByRole("tabpanel", { name: "미리 보기" })).toBeVisible();
  });
});

describe("WritePreviewPanes: 넓은 화면(나란히)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("탭 역할 없이 두 쪽이 다 보이고, 미리 보기는 이름 있는 스크롤 영역이다", () => {
    // 넓은 화면 조건("(min-width: 64rem)")이 맞는다고 흉내 내요.
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query === "(min-width: 64rem)",
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    render(<Harness />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument();
    // 두 쪽 모두 hidden이 아니에요(좁은 화면용 숨김은 CSS max-lg:hidden이 맡아요).
    expect(screen.getByLabelText("본문(Markdown)")).toBeVisible();
    const region = screen.getByRole("region", { name: "미리 보기" });
    expect(region).toBeVisible();
    // 글이 길면 안에서 스크롤해서, 키보드로도 스크롤할 수 있게 초점을 받아요.
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toHaveClass("lg:overflow-y-auto");
  });
});
