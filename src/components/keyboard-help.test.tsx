/**
 * @file keyboard-help.tsx 테스트
 *
 * 확인하는 것
 *   - 처음에는 닫혀 있고, 단추로 여닫는다(aria-expanded, hidden)
 *   - 열린 상태를 브라우저 저장소에 기억한다
 *   - Esc로 닫고, 그 Esc는 "처리했다"고 표시해 상세 화면의 Esc(목록으로)가 함께 일어나지 않는다
 *   - 화면(주소)마다 알맞은 키를 안내한다
 *
 * 가짜 usePathname이 돌려줄 주소는 테스트마다 바꿔요(site-header.test.tsx 설명 참고).
 *
 * jsdom(가짜 브라우저)은 화면을 그리지 않아서, 요소가 그려진 상자(getClientRects)가 늘 0개예요.
 * 그래서 "안내 단추가 화면에 보이는" 상황은 getClientRects가 1개를 돌려주게 바꿔 흉내 내요.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KeyboardHelp, shortcutsFor } from "./keyboard-help";

const pathname = vi.hoisted(() => ({ current: "/" }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => pathname.current,
}));

/** 저장소에 쓰는 이름표(keyboard-help.tsx와 같아야 해요) */
const STORAGE_KEY = "blog:keyboard-help";

/** 안내를 여닫는 단추 */
const toggle = () => screen.getByRole("button", { name: "키보드 조작" });

/** 단추가 화면에 그려져 있다고(넓은 화면) 흉내 내요. */
const showOnScreen = () => vi.spyOn(HTMLButtonElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);

describe("KeyboardHelp", () => {
  beforeEach(() => {
    pathname.current = "/";
    // 테스트마다 "닫힘"에서 시작해요. 앞 테스트에서 열어 둔 상태가 남지 않게요.
    window.localStorage.setItem(STORAGE_KEY, "closed");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("처음에는 닫혀 있고, 단추로 여닫는다", async () => {
    const user = userEvent.setup();
    render(<KeyboardHelp />);

    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    // aria-controls가 가리키는 영역이 안내예요. 닫혀 있으면 hidden이라 화면 낭독기에도 보이지 않아요.
    const panel = document.getElementById(toggle().getAttribute("aria-controls")!)!;
    expect(panel).not.toBeVisible();

    await user.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(panel).toBeVisible();
    expect(screen.getByRole("heading", { name: "이 화면의 키" })).toBeInTheDocument();

    await user.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(panel).not.toBeVisible();
  });

  it("열어 둔 상태를 기억해, 다시 그려도 열려 있다", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<KeyboardHelp />);
    await user.click(toggle());
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("open");

    // 다른 화면에 갔다 오거나 다시 방문한 상황: 지우고 새로 그려요.
    unmount();
    render(<KeyboardHelp />);
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
  });

  it("열려 있을 때 Esc를 누르면 닫고, 그 Esc는 처리했다고 표시한다", async () => {
    showOnScreen();
    window.localStorage.setItem(STORAGE_KEY, "open");
    render(<KeyboardHelp />);
    expect(toggle()).toHaveAttribute("aria-expanded", "true");

    // fireEvent.keyDown은 누군가 preventDefault를 부르면 false를 돌려줘요.
    // false = "이미 처리한 키"라서 상세 화면의 Esc(목록으로 가기)는 이번에는 쉬어요.
    expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(false);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");

    // 닫힌 뒤의 Esc는 건드리지 않아요(이제 목록으로 가는 데 쓰여요).
    expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(true);
  });

  it("좁은 화면이라 안내가 숨어 있으면, 열림 상태여도 Esc를 가져가지 않는다", () => {
    // getClientRects를 바꾸지 않으면 0개 = 단추가 화면에 없음(좁은 화면에서 display: none)
    window.localStorage.setItem(STORAGE_KEY, "open");
    render(<KeyboardHelp />);

    // true = 처리하지 않음. 상세 화면이라면 이 Esc로 바로 목록에 가요.
    expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(true);
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
  });

  it("처음 화면에서는 목록을 고르는 키를 안내한다", () => {
    window.localStorage.setItem(STORAGE_KEY, "open");
    render(<KeyboardHelp />);

    // role "term": <dt>(키), role "definition": <dd>(하는 일)
    const terms = screen.getAllByRole("term").map((term) => term.textContent);
    expect(terms).toEqual(["▲위쪽 화살표▼아래쪽 화살표", "◀왼쪽 화살표▶오른쪽 화살표", "HomeEnd", "Enter", "▲위쪽 화살표▼아래쪽 화살표", "Tab"]);
    expect(screen.getAllByRole("definition").map((dd) => dd.textContent)).toEqual([
      "리뷰 고르기",
      // ◀ ▶도 리뷰 사이를 오가요(상세 화면과 같은 키).
      "이전·다음 리뷰",
      "처음·끝 리뷰",
      "고른 리뷰 열기",
      "검색창에서 추천 검색어 고르기",
      "다음 항목으로",
    ]);
  });

  it("리뷰 추가·수정 화면(/write…)에서는 키보드 조작 단추를 두지 않는다", () => {
    for (const path of ["/write", "/write/winter-stop"]) {
      pathname.current = path;
      const { unmount } = render(<KeyboardHelp />);
      expect(screen.queryByRole("button", { name: "키보드 조작" })).not.toBeInTheDocument();
      unmount();
    }
  });

  it("화면마다 다른 키를 안내한다", () => {
    expect(shortcutsFor("/reviews/winter-stop").map(({ action }) => action)).toEqual(["이전·다음 리뷰", "목록으로", "다음 항목으로"]);
    expect(shortcutsFor("/offline").map(({ action }) => action)).toEqual(["다음 항목으로"]);
  });
});
