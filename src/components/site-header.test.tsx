/**
 * @file site-header.tsx 테스트
 *
 * 머리글이 블로그 이름(처음 화면 링크)과 GitHub 링크만 보이는지 확인해요.
 * 리뷰 추가 단추는 머리글이 아니라 화면 오른쪽 아래에 떠 있어요(floating-buttons.test.tsx).
 */

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SiteHeader } from "./site-header";

describe("SiteHeader", () => {
  afterEach(() => {
    // 로그인 표시 쿠키를 지워 다음 테스트가 로그인 전 상태에서 시작하게 해요.
    document.cookie = "blog_admin=; max-age=0; path=/";
  });

  it("블로그 이름(DMB)이 처음 화면으로 가는 링크이고, 예전 짧은 소개 문구는 없다", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "DMB" })).toHaveAttribute("href", "/");
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

  it("로그인해도 머리글에는 리뷰 추가 링크가 없다(오른쪽 아래의 떠 있는 + 단추로 옮겼다)", () => {
    document.cookie = "blog_admin=1; path=/";
    render(<SiteHeader />);
    expect(screen.queryByRole("link", { name: /추가|새 리뷰/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
