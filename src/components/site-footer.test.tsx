/**
 * @file site-footer.tsx 테스트
 *
 * <footer>는 화면 낭독기에서 "contentinfo"(콘텐츠 정보) 역할을 가져요. 그 역할로 찾아 내용을 확인해요.
 * 바닥글 안의 키보드 조작 안내가 지금 주소(usePathname)를, 로그아웃이 라우터(useRouter)를 써서 가짜를 넣어 줘요.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SiteFooter } from "./site-footer";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("SiteFooter", () => {
  it("위쪽 점선 아래 가운데에 저작권 줄('© 2026. deokbae All rights reserved.')을 둔다", () => {
    render(<SiteFooter />);
    const copyright = within(screen.getByRole("contentinfo")).getByText("© 2026. deokbae All rights reserved.");
    expect(copyright.tagName).toBe("P");
    expect(copyright).toHaveClass("text-center");
    // 저작권 줄을 감싼 칸의 위쪽 테두리가 점선이에요(목록·상세의 점선과 같은 2px 점선, 선 색).
    expect(copyright.parentElement).toHaveClass("border-t-2", "border-dotted", "border-crt-line");
  });

  it("감상 안내 문구도, 글쓴이 로그인 링크도 없다", () => {
    render(<SiteFooter />);
    const footer = screen.getByRole("contentinfo");
    expect(footer).not.toHaveTextContent("주관적인 감상");
    expect(within(footer).queryByRole("link", { name: /로그인/ })).not.toBeInTheDocument();
  });

  it("떠 있는 키보드 조작 단추를 바닥글 안에 둔다(아이콘 없이 글자만)", () => {
    render(<SiteFooter />);
    const button = within(screen.getByRole("contentinfo")).getByRole("button", { name: "키보드 조작" });
    expect(button).toHaveTextContent(/^키보드 조작$/);
  });
});
