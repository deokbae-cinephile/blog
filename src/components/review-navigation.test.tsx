/**
 * @file review-navigation.tsx 테스트
 *
 * 상세 화면에서 옮겨 갈 때의 로딩을 맡는 부품이
 *   - 이전·다음·목록 링크를 누르면 원래 이동 대신 로딩을 보이는 이동(router.push)으로 바꾸는지
 *   - 키보드 등에서 쓰는 이동 함수가 감싼 곳 밖에서도 그냥 옮겨 가는지
 *   - 로딩 안내 칸(role="status")이 처음부터 비어 있는 채로 있는지
 * 확인해요. 실제로 새 화면을 받는 동안 로딩이 보이는지는 진짜 브라우저 E2E(e2e/blog.spec.ts)에서 재요.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewNavigation, ReviewNavLink, useReviewNavigate } from "./review-navigation";

// Next.js 라우터를 흉내 내요. push가 몇 번, 어디로 불렸는지 기록해요.
const push = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push, prefetch: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
}));

// Next.js의 <Link>는 앱(앱 라우터) 안에서만 누름을 처리해서, 시험에서는 누르면 onNavigate만 부르는 간단한 흉내로 바꿔요.
// (진짜 <Link>도 이 앱 안에서 옮겨 갈 때 onNavigate를 불러요. 실제 브라우저 동작은 E2E에서 확인해요.)
vi.mock("next/link", () => ({
  default: ({ href, onNavigate, children, ...props }: ComponentProps<"a"> & { onNavigate?: (event: { preventDefault: () => void }) => void }) => (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onNavigate?.({ preventDefault: () => {} });
      }}
    >
      {children}
    </a>
  ),
}));

describe("ReviewNavigation · ReviewNavLink", () => {
  afterEach(() => push.mockClear());

  it("로딩 안내 칸(role=\"status\")은 처음부터 있고 비어 있다(글자만 바꿔야 화면 낭독기가 읽어요)", () => {
    render(
      <ReviewNavigation>
        <p>상세 화면</p>
      </ReviewNavigation>,
    );
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("다음 리뷰·목록 링크를 누르면 로딩을 보이는 이동(router.push)으로 옮겨 간다", async () => {
    const user = userEvent.setup();
    render(
      <ReviewNavigation>
        <ReviewNavLink href="/reviews/before-the-last-reel" target="next">
          다음 리뷰
        </ReviewNavLink>
        <ReviewNavLink href="/" target="list">
          목록으로
        </ReviewNavLink>
      </ReviewNavigation>,
    );
    // 링크 모양(href)은 그대로라 새 탭으로 열기 등 브라우저 기능은 그대로 써요.
    expect(screen.getByRole("link", { name: "다음 리뷰" })).toHaveAttribute("href", "/reviews/before-the-last-reel");

    await user.click(screen.getByRole("link", { name: "다음 리뷰" }));
    expect(push).toHaveBeenCalledWith("/reviews/before-the-last-reel");
    await user.click(screen.getByRole("link", { name: "목록으로" }));
    expect(push).toHaveBeenLastCalledWith("/");
  });

  it("감싼 곳 밖에서 쓴 이동 함수는 로딩 없이 바로 옮겨 간다(시험에서 따로 그린 화면 등)", async () => {
    const user = userEvent.setup();
    function Button() {
      const navigate = useReviewNavigate();
      return (
        <button type="button" onClick={() => navigate("/reviews/winter-stop", "previous")}>
          이전
        </button>
      );
    }
    render(<Button />);
    await user.click(screen.getByRole("button", { name: "이전" }));
    expect(push).toHaveBeenCalledWith("/reviews/winter-stop");
  });
});
