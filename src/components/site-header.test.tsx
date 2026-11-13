/**
 * @file site-header.tsx 테스트
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

import { SiteHeader } from "./site-header";

/** 가짜 usePathname이 돌려줄 주소. 테스트마다 바꿔 써요. */
const pathname = vi.hoisted(() => ({ current: "/" }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => pathname.current,
}));

describe("SiteHeader", () => {
  beforeEach(() => {
    pathname.current = "/";
  });

  afterEach(() => {
    // 로그인 표시 쿠키를 지워 다음 테스트가 로그인 전 상태에서 시작하게 해요.
    document.cookie = "blog_admin=; max-age=0; path=/";
  });

  it("블로그 이름이 처음 화면으로 가는 링크이고, 예전 짧은 소개 문구는 없다", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "덕배의 영화 블로그" })).toHaveAttribute("href", "/");
    expect(screen.queryByText("평론가를 꿈꾸는 덕배의 상영 기록")).not.toBeInTheDocument();
  });

  it("오른쪽에 소스 코드 저장소로 가는 GitHub 링크(픽셀 아이콘 + 글자)를 둔다", () => {
    render(<SiteHeader />);
    // 이름은 보이는 글자 그대로 "GitHub"라 음성 명령("GitHub 눌러")으로도 찾을 수 있고, 어디로 가는지는 설명으로 알려 줘요.
    const link = screen.getByRole("link", { name: "GitHub" });
    expect(link).toHaveAccessibleDescription("이 블로그의 소스 코드 저장소");
    expect(link).toHaveAttribute("href", "https://github.com/deokbae-cinephile/blog");
    // 아이콘은 글자와 같은 뜻이라 꾸밈(aria-hidden)이에요.
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("로그인 전에는 [새 리뷰]가 없고, 로그인하면 글쓰기 화면으로 가는 링크가 보인다", () => {
    const { unmount } = render(<SiteHeader />);
    expect(screen.queryByRole("link", { name: "새 리뷰" })).not.toBeInTheDocument();
    unmount();

    document.cookie = "blog_admin=1; path=/";
    pathname.current = "/write";
    render(<SiteHeader />);
    const link = screen.getByRole("link", { name: "새 리뷰" });
    expect(link).toHaveAttribute("href", "/write");
    // 지금 글쓰기 화면이면 "지금 보는 페이지"라고 알려 줘요.
    expect(link).toHaveAttribute("aria-current", "page");
  });
});
