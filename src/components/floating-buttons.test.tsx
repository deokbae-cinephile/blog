/**
 * @file floating-buttons.tsx 테스트
 *
 * 화면 아래쪽에 떠 있는 단추들이
 *   - 글쓴이로 로그인했을 때만 "+"(리뷰 추가)를 보이고, 글쓰기 화면에서는 숨기는지
 *   - "+"의 이름·주소와 꾸밈 그림, "맨 위로"가 "+"와 따로 있는지
 * 확인해요. 실제 크기(44 × 44px)와 자리(가운데 아래, 오른쪽 아래)는 진짜 브라우저 E2E에서 재요(e2e/admin.spec.ts, e2e/blog.spec.ts).
 *
 * Next.js의 훅(usePathname)을 쓰는 컴포넌트는 어떻게 테스트할까요?
 *   테스트 환경에는 진짜 Next.js 라우터가 없어서 usePathname이 동작하지 않아요.
 *   그래서 vi.mock으로 "next/navigation" 모듈을 가짜로 바꿔, 우리가 정한 주소를 돌려주게 해요.
 *
 *   - vi.hoisted(() => 값) : vi.mock보다 먼저 만들어지는 값이에요. vi.mock은 파일 맨 위로 끌어올려져 실행되기 때문에,
 *     mock 안에서 쓸 값은 이렇게 만들어야 해요.
 *   - importOriginal() : 원래 모듈을 가져와요. 나머지 기능은 그대로 두고 usePathname만 바꾸려고 펼쳐(...) 써요.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FloatingButtons } from "./floating-buttons";

/** 가짜 usePathname이 돌려줄 주소. 테스트마다 바꿔 써요. */
const pathname = vi.hoisted(() => ({ current: "/" }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => pathname.current,
}));

describe("FloatingButtons", () => {
  beforeEach(() => {
    pathname.current = "/";
  });
  afterEach(() => {
    document.cookie = "blog_admin=; max-age=0; path=/";
  });

  it("로그인 전에는 + 단추가 없다", () => {
    render(<FloatingButtons />);
    expect(screen.queryByRole("link", { name: "리뷰 추가" })).not.toBeInTheDocument();
  });

  it("로그인하면 글쓰기 화면으로 가는 + 단추가 보이고, 이름은 '리뷰 추가'다", () => {
    document.cookie = "blog_admin=1; path=/";
    render(<FloatingButtons />);
    const link = screen.getByRole("link", { name: "리뷰 추가" });
    expect(link).toHaveAttribute("href", "/write");
    // 보이는 "+"는 픽셀 그림(꾸밈)이라 읽지 않아요. 8칸 × 3px = 24px
    const icon = link.querySelector("svg")!;
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect([icon.getAttribute("width"), icon.getAttribute("height")]).toEqual(["24", "24"]);
  });

  it("글쓰기 화면(/write, /write/<주소>)에서는 + 단추를 숨긴다", () => {
    document.cookie = "blog_admin=1; path=/";
    for (const path of ["/write", "/write/winter-stop"]) {
      pathname.current = path;
      const { unmount } = render(<FloatingButtons />);
      expect(screen.queryByRole("link", { name: "리뷰 추가" })).not.toBeInTheDocument();
      unmount();
    }
  });

  it("맨 위로 단추는 + 단추와 따로 있다(+ 링크 안에 들어 있지 않다)", () => {
    document.cookie = "blog_admin=1; path=/";
    // 맨 위로는 내려 읽었을 때만 보여서(hidden) 이름으로는 찾을 수 없어, 글자로 찾아요.
    render(<FloatingButtons />);
    const toTop = screen.getByText("맨 위로");
    expect(toTop.tagName).toBe("BUTTON");
    expect(screen.getByRole("link", { name: "리뷰 추가" })).not.toContainElement(toTop);
  });
});
