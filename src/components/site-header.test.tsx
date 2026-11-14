/**
 * @file site-header.tsx 테스트
 *
 * 머리글이 블로그 이름(처음 화면 링크)·버전과 GitHub 아이콘 링크만 보이는지 확인해요.
 * 리뷰 추가 단추는 머리글이 아니라 화면 오른쪽 아래에 떠 있어요(floating-buttons.test.tsx).
 */

import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import packageJson from "../../package.json";
import { SiteHeader } from "./site-header";

/** 처음 화면 링크의 이름: 블로그 이름과 버전 */
const HOME = `DMB: 덕배의 영화 블로그 (v${packageJson.version})`;

describe("SiteHeader", () => {
  afterEach(() => {
    // 로그인 표시 쿠키를 지워 다음 테스트가 로그인 전 상태에서 시작하게 해요.
    document.cookie = "blog_admin=; max-age=0; path=/";
  });

  it("블로그 이름과 버전(DMB: 덕배의 영화 블로그 (v2.0.0))이 처음 화면으로 가는 링크이고, 예전 짧은 소개 문구는 없다", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: HOME })).toHaveAttribute("href", "/");
    expect(screen.queryByText("평론가를 꿈꾸는 덕배의 상영 기록")).not.toBeInTheDocument();
  });

  it("왼쪽 로고와 오른쪽 GitHub 아이콘은 같은 크기(24 × 24px)로 그리고, 둘 다 읽지 않는 꾸밈이다", () => {
    render(<SiteHeader />);
    const home = screen.getByRole("link", { name: HOME });
    const github = screen.getByRole("link", { name: "GitHub" });
    for (const link of [home, github]) {
      const icon = link.querySelector("svg")!;
      expect([icon.getAttribute("width"), icon.getAttribute("height")]).toEqual(["24", "24"]);
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
    // 아이콘이 본문 양 끝·같은 줄에 있는지는 진짜 브라우저 E2E에서 재요(e2e/blog.spec.ts).
  });

  it("이름 옆에 지금 버전(package.json)을 '(v2.0.0)'처럼 보이고, 버전도 처음 화면으로 가는 링크 안에 있다", () => {
    render(<SiteHeader />);
    const version = screen.getByText(/^\(v\d+\.\d+\.\d+\)$/);
    expect(version).toHaveTextContent(`(v${packageJson.version})`);
    // 버전을 눌러도 처음 화면으로 가요(링크 이름에도 버전이 들어가요).
    expect(screen.getByRole("link", { name: HOME })).toContainElement(version);
  });

  it("오른쪽에 소스 코드 저장소로 가는 GitHub 링크를 아이콘만 보이게 두고, 글자 'GitHub'는 화면 낭독기용으로 남긴다", () => {
    render(<SiteHeader />);
    // 링크 이름은 "GitHub"(화면 낭독기용 글자)이고, 어디로 가는지는 설명으로 알려 줘요.
    const link = screen.getByRole("link", { name: "GitHub" });
    expect(link).toHaveAccessibleDescription("이 블로그의 소스 코드 저장소(새 창)");
    expect(link).toHaveAttribute("href", "https://github.com/deokbae-cinephile/blog");
    // 새 창으로 열고, 새 창이 이 창을 건드리지 못하게 해요.
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    // 글자 "GitHub"는 화면에서 숨겨요(sr-only). 화면에는 아이콘만 보여요.
    expect(within(link).getByText("GitHub")).toHaveClass("sr-only");
    // 아이콘은 링크 이름과 같은 뜻이라 꾸밈(aria-hidden)이에요.
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("로그인해도 머리글에는 리뷰 추가 링크가 없다(오른쪽 아래의 떠 있는 + 단추로 옮겼다)", () => {
    document.cookie = "blog_admin=1; path=/";
    render(<SiteHeader />);
    expect(screen.queryByRole("link", { name: /추가|새 리뷰/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
