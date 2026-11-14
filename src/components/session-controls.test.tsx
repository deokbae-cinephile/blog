/**
 * @file session-controls.tsx 테스트
 *
 * 로그인 전에는 아무것도 보이지 않고(로그인 링크 없음), 로그인 뒤에만 [로그아웃]이 보이는지,
 * 로그아웃하면 서버에 한 번만 묻고 처음 화면으로 가는지 확인해요.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionControls } from "./session-controls";

/** 가짜 라우터 */
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => router,
}));

describe("SessionControls", () => {
  afterEach(() => {
    document.cookie = "blog_admin=; max-age=0; path=/";
    vi.unstubAllGlobals();
  });

  it("로그인 전에는 로그인 링크도 로그아웃 단추도 없이 아무것도 그리지 않는다", () => {
    const { container } = render(<SessionControls />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("link", { name: /로그인/ })).not.toBeInTheDocument();
  });

  it("로그인 뒤에는 [로그아웃]이 보이고, 두 번 눌러도 한 번만 요청하고 처음 화면으로 간다", async () => {
    document.cookie = "blog_admin=1; path=/";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        // 서버가 쿠키를 지운 것처럼 흉내 내요.
        document.cookie = "blog_admin=; max-age=0; path=/";
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );
    const user = userEvent.setup();
    render(<SessionControls />);

    await user.dblClick(screen.getByRole("button", { name: "로그아웃" }));
    await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith("/"));
    expect(fetch).toHaveBeenCalledTimes(1);
    // 쿠키가 사라졌다고 알려 받아 [로그아웃]이 사라지고, 로그인 링크도 보이지 않아요.
    await vi.waitFor(() => expect(screen.queryByRole("button", { name: "로그아웃" })).not.toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /로그인/ })).not.toBeInTheDocument();
  });
});
