/**
 * @file back-to-top.tsx 테스트
 *
 * jsdom(가짜 브라우저)은 실제로 스크롤하지 않아요. 그래서
 *   - 스크롤 위치(window.scrollY)는 값을 직접 넣고 "scroll" 이벤트를 일으켜 흉내 내요.
 *   - window.scrollTo는 vi.spyOn으로 바꿔, 어떻게 불렸는지만 확인해요.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BackToTop } from "./back-to-top";

/** 스크롤 위치를 바꾸고 "scroll" 이벤트를 일으켜요. act: 그로 인한 화면 바뀜이 끝날 때까지 기다려요. */
function scrollTo(y: number) {
  act(() => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: y });
    fireEvent.scroll(window);
  });
}

describe("BackToTop", () => {
  beforeEach(() => {
    // 가짜 scrollTo: 아무 일도 하지 않고 불린 기록만 남겨요.
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    scrollTo(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("맨 위에서는 숨어 있고, 400px 넘게 내려가면 보인다", () => {
    render(<BackToTop />);
    // hidden 속성으로 숨긴 단추는 화면 낭독기에도 없는 것으로 쳐서, 역할(role)로 찾으면 나오지 않아요.
    expect(screen.queryByRole("button", { name: "맨 위로" })).not.toBeInTheDocument();

    scrollTo(401);
    expect(screen.getByRole("button", { name: "맨 위로" })).toBeVisible();

    scrollTo(100);
    expect(screen.queryByRole("button", { name: "맨 위로" })).not.toBeInTheDocument();
  });

  it("누르면 맨 위로 부드럽게 올라가고, 초점을 머리글로 옮긴다", async () => {
    const user = userEvent.setup();
    render(
      <>
        <header id="top" tabIndex={-1}>
          머리글
        </header>
        <BackToTop />
      </>,
    );
    scrollTo(800);

    await user.click(screen.getByRole("button", { name: "맨 위로" }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(screen.getByRole("banner")).toHaveFocus();
  });

  it("'동작 줄이기'를 켠 사용자에게는 움직임 없이 바로 올라간다", async () => {
    const user = userEvent.setup();
    // matchMedia가 "동작 줄이기 켜짐"이라고 답하게 바꿔요(vitest.setup.ts의 기본값은 늘 꺼짐).
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) => ({ matches: query === "(prefers-reduced-motion: reduce)", media: query }) as MediaQueryList,
    );
    render(<BackToTop />);
    scrollTo(800);

    await user.click(screen.getByRole("button", { name: "맨 위로" }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
});
