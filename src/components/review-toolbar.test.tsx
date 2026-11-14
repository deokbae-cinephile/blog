/**
 * @file review-toolbar.tsx 테스트
 *
 * 상세 화면 맨 윗줄([◀ 목록으로] … [공유하기] [수정] [삭제])이
 *   - 모든 단추를 같은 모양(btn-line)으로 한 줄에 두는지(안내 칸이 줄 안에 끼어 [공유하기]만 내려가지 않는지)
 *   - 삭제한 뒤에는 오른쪽 단추를 치우고, 윗줄 아래에 안내를 보이며, [목록으로]로 초점을 옮기는지
 * 확인해요. 실제 화면에서의 세로 위치는 E2E(e2e/review.spec.ts)에서 재요.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewToolbar } from "./review-toolbar";

// [◀ 목록으로](ReviewNavLink)가 옮겨 갈 때 쓰는 Next.js 라우터를 흉내 내요. 진짜 라우터는 Next.js 앱 안에서만 있어요.
const push = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push, prefetch: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
}));

const props = {
  slug: "winter-stop",
  title: "겨울 정류장",
  shareUrl: "https://deokbae.blog/reviews/winter-stop",
  shareTitle: "겨울 정류장 리뷰",
  shareText: "평점 4.5 · 버스는 오지 않아도, 기다림은 끝내 도착한다.",
};

/** 맨 윗줄 아래의 삭제 안내 칸. 공유 단추·확인 창에도 안내 칸이 있어서, 문서 순서상 맨 마지막 칸을 골라요. */
const toolbarStatus = () => screen.getAllByRole("status").at(-1)!;

describe("ReviewToolbar", () => {
  afterEach(() => {
    document.cookie = "blog_admin=; max-age=0; path=/";
    vi.unstubAllGlobals();
  });

  it("[◀ 목록으로]는 처음 화면으로 가는 단추 모양 링크이고, ◀는 꾸밈이라 이름에서 빠진다", () => {
    render(<ReviewToolbar {...props} />);
    const back = screen.getByRole("link", { name: "목록으로" });
    expect(back).toHaveAttribute("href", "/");
    // [앱으로 설치]·[공유하기]와 같은 단추 모양이에요.
    expect(back).toHaveClass("btn-line");
    // ◀는 아래쪽 [◀ 이전 리뷰]와 같은 글자이고, 화면 낭독기에서는 숨겨요.
    expect(within(back).getByText("◀")).toHaveAttribute("aria-hidden", "true");
  });

  it("로그인 전에는 [공유하기]만, 로그인하면 [공유하기]·[수정]·[삭제]를 [목록으로]와 같은 줄에 둔다. 삭제 안내 칸은 그 줄 밖에 비어 있다", () => {
    const { unmount } = render(<ReviewToolbar {...props} />);
    expect(screen.getByRole("button", { name: "공유하기" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "수정" })).not.toBeInTheDocument();
    unmount();

    document.cookie = "blog_admin=1; path=/";
    render(<ReviewToolbar {...props} />);
    const row = screen.getByRole("link", { name: "목록으로" }).parentElement!;
    const share = screen.getByRole("button", { name: "공유하기" });
    const edit = screen.getByRole("link", { name: "수정" });
    const remove = screen.getByRole("button", { name: "삭제" });
    for (const control of [share, edit, remove]) {
      expect(row).toContainElement(control);
      expect(control).toHaveClass("btn-line");
    }
    // [공유하기] [수정] [삭제] 사이는 모두 같은 간격(8px)이에요. [수정]·[삭제]도 묶음 없이 오른쪽 묶음에 바로 놓여요.
    const actions = edit.parentElement!;
    expect(actions).toHaveClass("gap-2");
    expect(actions).toContainElement(share);
    expect(remove.parentElement).toBe(actions);
    // 예전에는 비어 있는 안내 칸이 [수정]·[삭제] 묶음 아래에 한 줄을 더 만들어, 묶음 높이가 달라지며 [공유하기]만 내려가 보였어요.
    // 이제 안내 칸은 줄 밖에 있고, 비어 있으면 상자 모양도 여백도 없어요.
    const status = toolbarStatus();
    expect(row).not.toContainElement(status);
    expect(status).toBeEmptyDOMElement();
    expect(status).toHaveAttribute("class", "");
  });

  it("삭제하면 [공유하기]·[수정]·[삭제]를 치우고, 윗줄 아래에 안내를 보이며 [목록으로]로 초점을 옮긴다", async () => {
    document.cookie = "blog_admin=1; path=/";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ title: "겨울 정류장", commitSha: "c" }), { status: 200 })));
    const user = userEvent.setup();
    render(<ReviewToolbar {...props} />);
    // 안내 칸은 처음부터 있어요(글자만 바꿔야 화면 낭독기가 읽어요).
    const status = toolbarStatus();

    await user.click(screen.getByRole("button", { name: "삭제" }));
    await user.click(screen.getAllByRole("button", { name: "삭제" }).at(-1)!);

    // 초점 옮기기는 화면을 그린 뒤(useEffect)에 일어나서, 될 때까지 잠깐 기다려요.
    await vi.waitFor(() => expect(screen.getByRole("link", { name: "목록으로" })).toHaveFocus());
    expect(status).toHaveTextContent("‘겨울 정류장’ 리뷰를 삭제했습니다. 블로그를 다시 배포하면(몇 분 뒤) 목록에서도 사라집니다.");
    // 안내는 윗줄 아래에 화면 너비로, 테두리 상자로 보여요.
    expect(status).toHaveClass("mt-4", "border-2");
    // 삭제한 리뷰는 더 공유하거나 수정할 수 없으니 오른쪽 단추를 모두 치워요.
    expect(screen.queryByRole("button", { name: "공유하기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "수정" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
  });
});
