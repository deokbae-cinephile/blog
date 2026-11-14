/**
 * @file boot-overlay.tsx 테스트
 *
 * 첫 화면 로딩 레이어가
 *   - 가운데에 로딩 UI("불러오는 중")를 보여 주는지
 *   - 페이지를 다 받고(load) 웹 폰트가 준비되면 <html data-booted>를 붙여 걷고, 최소 0.4초는 보여 주는지
 *   - 늦어도 4초 뒤에는 걷는지
 *   - 같은 탭에서 다시 열면(sessionStorage) 처음부터 걷혀 있는지
 * 확인해요. 스크립트는 문자열이라 new Function으로 돌려 봐요. 시간은 가짜 시계(vi.useFakeTimers)로 빨리 돌려요.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BOOT_SCRIPT, BOOT_STORAGE_KEY, BootOverlay } from "./boot-overlay";

/** 레이어 스크립트를 한 번 돌려요(첫 HTML에서 한 번 도는 것처럼). */
const runBootScript = () => new Function(BOOT_SCRIPT)();
const booted = () => document.documentElement.hasAttribute("data-booted");

describe("BootOverlay", () => {
  it("화면 전체를 덮는 레이어 가운데에 '불러오는 중' 로딩 UI를 보여 준다", () => {
    const { container } = render(<BootOverlay />);
    expect(container.firstElementChild).toHaveClass("boot-overlay");
    expect(screen.getByRole("status")).toHaveTextContent("불러오는 중");
  });
});

describe("BOOT_SCRIPT", () => {
  // 웹 폰트 불러오기를 흉내 내요. 부르면 곧바로 다 받았다고 답해요.
  const fontsLoad = vi.fn(() => Promise.resolve([]));

  beforeEach(() => {
    // Date도 가짜 시계에 맞춰 흐르게 해요(스크립트가 Date.now()로 "보여 준 시간"을 재요).
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    Object.defineProperty(document, "fonts", { value: { load: fontsLoad }, configurable: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.removeAttribute("data-booted");
    sessionStorage.clear();
    fontsLoad.mockClear();
  });

  it("페이지를 다 받고 웹 폰트가 준비되면 걷고(최소 0.4초), 같은 탭에서 다시 덮지 않게 기억한다", async () => {
    runBootScript();
    expect(booted()).toBe(false);

    window.dispatchEvent(new Event("load"));
    expect(fontsLoad).toHaveBeenCalledWith("16px neodgm");
    // 글꼴은 곧바로 준비됐지만, 너무 짧게 번쩍이지 않게 0.4초까지는 보여요.
    await vi.advanceTimersByTimeAsync(399);
    expect(booted()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(booted()).toBe(true);
    expect(sessionStorage.getItem(BOOT_STORAGE_KEY)).toBe("1");
  });

  it("페이지가 늦게 와도 4초 뒤에는 걷는다", async () => {
    runBootScript();
    await vi.advanceTimersByTimeAsync(3999);
    expect(booted()).toBe(false);
    // 4초가 되는 순간 걷기를 예약하고, 바로 다음 순간(4.001초)에 걷혀요.
    await vi.advanceTimersByTimeAsync(2);
    expect(booted()).toBe(true);
  });

  it("같은 탭에서 다시 열면 처음부터 걷혀 있다", () => {
    sessionStorage.setItem(BOOT_STORAGE_KEY, "1");
    runBootScript();
    expect(booted()).toBe(true);
    expect(fontsLoad).not.toHaveBeenCalled();
  });
});
