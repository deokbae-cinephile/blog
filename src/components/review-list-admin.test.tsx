/**
 * @file review-list-admin.tsx 테스트
 *
 * v3 전까지 상세 화면을 글쓴이에게도 열지 않는 동안, 목록 한 편 아래의 [수정]·[삭제]가
 *   - 글쓴이로 로그인했을 때만 보이는지(방문자에게는 아무것도 그리지 않는지)
 *   - 삭제하면 두 단추를 치우고 안내를 보이며, 초점을 그 안내로 옮기는지
 * 확인해요. 확인 창과 삭제 중 로딩은 admin-review-actions.test.tsx에서 확인해요.
 * 글쓴이 로그인은 쿠키(blog_admin=1)로 흉내 내요. jsdom에는 <dialog>의 showModal()이 없어서 vitest.setup.ts가 간단한 흉내를 넣어 둬요.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewListAdmin } from "./review-list-admin";

describe("ReviewListAdmin", () => {
  afterEach(() => {
    document.cookie = "blog_admin=; max-age=0; path=/";
    vi.unstubAllGlobals();
  });

  it("방문자에게는 아무것도 그리지 않는다", () => {
    const { container } = render(<ReviewListAdmin slug="winter-stop" title="겨울 정류장" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("글쓴이로 로그인하면 [수정](글쓰기 화면으로)·[삭제]를 한 줄에 같은 간격으로 두고, 안내 칸은 처음부터 비어 있다", () => {
    document.cookie = "blog_admin=1; path=/";
    render(<ReviewListAdmin slug="winter-stop" title="겨울 정류장" />);
    const edit = screen.getByRole("link", { name: "수정" });
    expect(edit).toHaveAttribute("href", "/write/winter-stop");
    // [수정] [삭제]는 같은 줄 묶음(flex, 간격 8px)에 바로 놓여요.
    const row = edit.parentElement!;
    expect(row).toHaveClass("flex", "gap-2");
    expect(screen.getByRole("button", { name: "삭제" }).parentElement).toBe(row);
    // 안내 칸(role="status")은 처음부터 있고(글자만 바꿔야 화면 낭독기가 읽어요), 비어 있으면 상자 모양도 여백도 없어요.
    const status = screen.getAllByRole("status").at(-1)!;
    expect(row).not.toContainElement(status);
    expect(status).toBeEmptyDOMElement();
    expect(status).toHaveAttribute("class", "");
  });

  it("삭제하면 [수정]·[삭제]를 치우고, 안내를 보이며 초점을 그 안내로 옮긴다", async () => {
    document.cookie = "blog_admin=1; path=/";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ title: "겨울 정류장", commitSha: "c" }), { status: 200 })));
    const user = userEvent.setup();
    render(<ReviewListAdmin slug="winter-stop" title="겨울 정류장" />);
    const status = screen.getAllByRole("status").at(-1)!;

    // [삭제] → 확인 창의 [삭제](두 번째 삭제 단추)
    await user.click(screen.getByRole("button", { name: "삭제" }));
    await user.click(screen.getAllByRole("button", { name: "삭제" }).at(-1)!);

    // 초점 옮기기는 화면을 그린 뒤(useEffect)에 일어나서, 될 때까지 잠깐 기다려요.
    await vi.waitFor(() => expect(status).toHaveFocus());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(status).toHaveTextContent("‘겨울 정류장’ 리뷰를 삭제했습니다. 블로그를 다시 배포하면(몇 분 뒤) 목록에서도 사라집니다.");
    // 안내는 테두리 상자로 보이고, Tab 순서에는 없어요(코드로만 초점을 옮겨요).
    expect(status).toHaveClass("border-2");
    expect(status).toHaveAttribute("tabindex", "-1");
    // 지운 리뷰는 더 고치거나 지울 수 없으니 두 단추를 치워요.
    expect(screen.queryByRole("link", { name: "수정" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
  });
});
