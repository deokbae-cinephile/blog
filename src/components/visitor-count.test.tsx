/**
 * @file visitor-count.tsx 테스트
 *
 * - 방문자(로그인하지 않음): 화면에 아무것도 그리지 않고, 그날 처음이면 세기 요청(POST)을 한 번 보내고 날짜를 기억하는지
 *   같은 날 다시 열면 보내지 않는지
 * - 글쓴이(로그인 표시 쿠키): 세기 요청을 보내지 않고, 누적 방문자 수를 받아 "방문자 1,234명"으로 보이는지
 * 확인해요. fetch는 가짜로 바꿔 어떤 요청을 보냈는지 봐요.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VisitorCount } from "./visitor-count";

/** 가짜 서버: 세기(POST)는 204, 읽기(GET)는 누적 방문자 수 */
function fakeVisitsApi(total = 1234) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "POST" ? new Response(null, { status: 204 }) : Response.json({ total }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("VisitorCount", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = "blog_admin=; max-age=0; path=/";
  });

  it("방문자에게는 아무것도 보이지 않고, 그날 처음이면 한 번 세고 날짜를 기억한다", async () => {
    const fetchMock = fakeVisitsApi();
    const { container, unmount } = render(<VisitorCount />);
    expect(container).toBeEmptyDOMElement();
    await vi.waitFor(() => expect(localStorage.getItem("dmb:visit-day")).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    expect(fetchMock).toHaveBeenCalledWith("/api/visits", expect.objectContaining({ method: "POST" }));
    unmount();

    // 같은 날 다시 열면 보내지 않아요.
    fetchMock.mockClear();
    render(<VisitorCount />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("글쓴이에게는 세지 않고 누적 방문자 수를 '방문자 1,234명'으로 보인다", async () => {
    document.cookie = "blog_admin=1; path=/";
    const fetchMock = fakeVisitsApi(1234);
    render(<VisitorCount />);
    expect(await screen.findByText("방문자 1,234명")).toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "POST")).toBe(true);
    expect(localStorage.getItem("dmb:visit-day")).toBeNull();
  });

  it("숫자를 받지 못하면 '방문자 –명'으로 남는다", async () => {
    document.cookie = "blog_admin=1; path=/";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    render(<VisitorCount />);
    expect(screen.getByText("방문자 –명")).toBeInTheDocument();
  });
});
