/**
 * @file review-views.tsx 테스트
 *
 * 상세 화면의 조회수가
 *   - 처음에는 "조회 –"이고, 로그인하지 않은 사람이면 한 번 세고(POST) 센 숫자를 보이는지
 *   - 같은 탭에서 이미 센 리뷰면 다시 세지 않고 읽기만(GET) 하는지
 *   - 서버가 거른 방문(counted: false, 다른 탭에서 방금 봤을 때)도 이 탭에 기억해 다시 세지 않는지
 *   - 다른 리뷰로 바뀌면 이전 리뷰의 숫자를 보이지 않는지
 *   - 글쓴이(로그인 표시 쿠키)면 세지 않고 읽기만 하는지
 *   - API가 실패하면 "–"로 남는지
 * 확인해요. fetch는 가짜로 바꿔, 어떤 요청을 보냈는지 봐요.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewViews } from "./review-views";

/** 가짜 fetch: 조회수 API처럼 답해요(POST면 센 것으로, GET이면 읽기만). counted: false면 POST도 서버가 거른 것처럼 답해요. */
function fakeViewsApi(count: number, ok = true, { counted = true } = {}) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    ok ? Response.json({ count, total: count, counted: counted && init?.method === "POST" }) : new Response("", { status: 503 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ReviewViews", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = "blog_admin=; max-age=0; path=/";
  });

  it("로그인하지 않은 사람이 열면 한 번 세고(POST), 센 숫자를 보이고, 같은 탭에서 센 것을 기억한다", async () => {
    const fetchMock = fakeViewsApi(1234);
    render(<ReviewViews slug="winter-stop" />);
    // 처음(미리 만든 HTML)에는 숫자를 몰라요.
    expect(screen.getByText("· 조회 –", { exact: false })).toBeInTheDocument();
    expect(await screen.findByText("· 조회 1,234", { exact: false })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/views/winter-stop", expect.objectContaining({ method: "POST" }));
    expect(sessionStorage.getItem("dmb:viewed:winter-stop")).toBe("1");
  });

  it("같은 탭에서 이미 센 리뷰면(새로 고침·뒤로 가기) 다시 세지 않고 읽기만 한다", async () => {
    sessionStorage.setItem("dmb:viewed:winter-stop", "1");
    const fetchMock = fakeViewsApi(5);
    render(<ReviewViews slug="winter-stop" />);
    expect(await screen.findByText("· 조회 5", { exact: false })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/views/winter-stop", expect.not.objectContaining({ method: "POST" }));
  });

  it("글쓴이로 로그인했으면(표시 쿠키) 세지 않고 읽기만 한다", async () => {
    document.cookie = "blog_admin=1; path=/";
    const fetchMock = fakeViewsApi(7);
    render(<ReviewViews slug="whale-town" />);
    expect(await screen.findByText("· 조회 7", { exact: false })).toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "POST")).toBe(true);
    expect(sessionStorage.getItem("dmb:viewed:whale-town")).toBeNull();
  });

  it("다른 탭에서 방금 봐서 서버가 거른 방문(counted: false)도 이 탭에 기억해, 다시 열 때 세지 않는다", async () => {
    const fetchMock = fakeViewsApi(3, true, { counted: false });
    const { unmount } = render(<ReviewViews slug="winter-stop" />);
    expect(await screen.findByText("· 조회 3", { exact: false })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/views/winter-stop", expect.objectContaining({ method: "POST" }));
    expect(sessionStorage.getItem("dmb:viewed:winter-stop")).toBe("1");
    // 같은 탭에서 다시 열면(새로 고침) 읽기만 해요.
    unmount();
    fetchMock.mockClear();
    render(<ReviewViews slug="winter-stop" />);
    expect(await screen.findByText("· 조회 3", { exact: false })).toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "POST")).toBe(true);
  });

  it("다른 리뷰로 바뀌면 이전 리뷰의 숫자를 보이지 않는다(새 숫자를 받지 못해도 '–')", async () => {
    fakeViewsApi(5);
    const { rerender } = render(<ReviewViews slug="winter-stop" />);
    expect(await screen.findByText("· 조회 5", { exact: false })).toBeInTheDocument();
    // 다음 리뷰의 조회수는 받지 못해요(서버 문제).
    const fetchMock = fakeViewsApi(0, false);
    rerender(<ReviewViews slug="whale-town" />);
    expect(screen.getByText("· 조회 –", { exact: false })).toBeInTheDocument();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByText("· 조회 –", { exact: false })).toBeInTheDocument();
  });

  it("API가 실패하면 '–'로 남는다", async () => {
    const fetchMock = fakeViewsApi(0, false);
    render(<ReviewViews slug="winter-stop" />);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByText("· 조회 –", { exact: false })).toBeInTheDocument();
  });
});
