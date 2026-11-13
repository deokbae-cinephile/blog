/**
 * @file login-form.tsx 테스트
 *
 * 로그인 폼이 빈 칸·틀린 비밀번호를 칸 옆에 알리고, 맞으면 원래 가려던 곳으로 보내는지 확인해요.
 * 서버(API) 대신 fetch를 가짜로 바꿔 답을 정해 줘요. 라우터와 주소 조건도 가짜예요.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm, safeNext } from "./login-form";

/** 가짜 라우터와 주소 조건 */
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), search: "next=%2Fwrite" }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(router.search),
}));

/** 가짜 fetch가 돌려줄 답을 정해요. */
function answer(status: number, body: unknown) {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    router.replace.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("빈 칸으로 보내면 서버에 묻지 않고 칸마다 오류를 알리고 첫 빈 칸으로 초점을 옮긴다", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.click(screen.getByRole("button", { name: "로그인" }));

    const id = screen.getByLabelText(/아이디/);
    expect(id).toHaveAttribute("aria-invalid", "true");
    // 오류 문구가 칸의 설명으로 이어져 화면 낭독기가 칸 이름 다음에 읽어요.
    expect(id).toHaveAccessibleDescription("아이디를 입력하세요.");
    expect(id).toHaveFocus();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("비밀번호가 틀리면 서버의 문구를 비밀번호 칸에 알리고 그 칸으로 초점을 옮긴다", async () => {
    const user = userEvent.setup();
    answer(401, { message: "아이디나 비밀번호가 맞지 않습니다. 다시 확인해 입력하세요." });
    render(<LoginForm />);
    await user.type(screen.getByLabelText(/아이디/), "deokbae");
    await user.type(screen.getByLabelText(/비밀번호/, { selector: "input" }), "wrong");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    const password = screen.getByLabelText(/비밀번호/, { selector: "input" });
    expect(await screen.findByText("아이디나 비밀번호가 맞지 않습니다. 다시 확인해 입력하세요.")).toBeInTheDocument();
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveFocus();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("맞으면 원래 가려던 주소(next)로 간다. 두 번 빠르게 눌러도 요청은 한 번만 간다", async () => {
    const user = userEvent.setup();
    answer(200, { ok: true });
    render(<LoginForm />);
    await user.type(screen.getByLabelText(/아이디/), "deokbae");
    await user.type(screen.getByLabelText(/비밀번호/, { selector: "input" }), "correct");
    await user.dblClick(screen.getByRole("button", { name: "로그인" }));

    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith("/write"));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/session", expect.objectContaining({ method: "POST" }));
  });

  it("[비밀번호 보기]는 눌림 상태(aria-pressed)로 켜짐·꺼짐을 알리고, 친 글자를 보인다", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    const toggle = screen.getByRole("button", { name: "비밀번호 보기" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(/비밀번호/, { selector: "input" })).toHaveAttribute("type", "text");
  });

  it("비밀번호 관리자가 채울 수 있게 autocomplete를 단다", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/아이디/)).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText(/비밀번호/, { selector: "input" })).toHaveAttribute("autocomplete", "current-password");
  });
});

describe("safeNext", () => {
  it("우리 사이트 안의 주소만 받고, 다른 사이트로 가는 주소는 처음 화면으로 바꾼다", () => {
    expect(safeNext("/write/winter-stop")).toBe("/write/winter-stop");
    expect(safeNext(null)).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
  });

  it("탭·줄바꿈이 섞여 다른 사이트 주소로 바뀔 수 있는 주소는 처음 화면으로 바꾼다", () => {
    // 주소 해석기는 탭·줄바꿈을 지워서 "/\t/evil.example"이 "//evil.example"(다른 사이트)이 돼요.
    expect(safeNext("/\t/evil.example")).toBe("/");
    expect(safeNext("/\n/evil.example")).toBe("/");
    expect(safeNext("/\r\n/evil.example")).toBe("/");
    expect(safeNext("/%2F/evil.example")).toBe("/%2F/evil.example");
  });

  it("../ 정리 뒤 //로 시작하게 되는 주소(다른 사이트)도 처음 화면으로 바꾼다", () => {
    // "/a/..//evil.example"은 정리하면 "//evil.example"이 돼요.
    expect(safeNext("/a/..//evil.example")).toBe("/");
    expect(safeNext("/./x")).toBe("/x");
  });

  it("사이트 안 주소의 검색 조건과 # 부분은 그대로 둔다", () => {
    expect(safeNext("/write?draft=1#body")).toBe("/write?draft=1#body");
  });
});
