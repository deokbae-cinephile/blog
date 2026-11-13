/**
 * @file admin-review-actions.tsx·delete-review.tsx 테스트
 *
 * 상세 화면의 [수정]·[삭제]가 로그인했을 때만 보이고,
 * 삭제는 확인 창(<dialog role="alertdialog">)을 거쳐 한 번만 요청하는지 확인해요.
 * jsdom에는 <dialog>의 showModal()이 없어서 vitest.setup.ts가 간단한 흉내를 넣어 둬요.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminReviewActions } from "./admin-review-actions";

/** 가짜 서버의 답을 정해요. */
function answer(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

describe("AdminReviewActions", () => {
  beforeEach(() => {
    document.cookie = "blog_admin=1; path=/";
  });
  afterEach(() => {
    document.cookie = "blog_admin=; max-age=0; path=/";
    vi.unstubAllGlobals();
  });

  it("로그인 전에는 아무것도 그리지 않는다", () => {
    document.cookie = "blog_admin=; max-age=0; path=/";
    const { container } = render(<AdminReviewActions slug="winter-stop" title="겨울 정류장" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("[삭제]를 누르면 확인 창이 열리고, 처음 초점은 [취소]에 있다. [취소]로 닫으면 삭제하지 않는다", async () => {
    answer(200, { title: "겨울 정류장", commitSha: "c" });
    const user = userEvent.setup();
    render(<AdminReviewActions slug="winter-stop" title="겨울 정류장" />);

    await user.click(screen.getByRole("button", { name: "삭제" }));
    const dialog = screen.getByRole("alertdialog", { name: "리뷰를 삭제할까요?" });
    expect(dialog).toHaveAttribute("open");
    // 창의 설명(aria-describedby)이 무엇을 삭제하는지 알려 줘요.
    expect(dialog).toHaveAccessibleDescription(expect.stringContaining("‘겨울 정류장’ 리뷰와 이 리뷰의 포스터·장면 사진"));

    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(dialog).not.toHaveAttribute("open");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("확인 창에서 [삭제]를 두 번 빠르게 눌러도 한 번만 삭제하고, 삭제한 뒤에는 안내와 [목록으로]로 초점을 옮긴다", async () => {
    // 서버 답을 우리가 정한 때에 보내려고, 답을 미뤄 두는 가짜 fetch를 써요(진짜 서버처럼 시간이 걸리는 상황).
    let respond: (response: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (respond = resolve))));
    const user = userEvent.setup();
    render(<AdminReviewActions slug="winter-stop" title="겨울 정류장" />);

    await user.click(screen.getByRole("button", { name: "삭제" }));
    const dialog = screen.getByRole("alertdialog");
    // 창 안의 [삭제](두 번째 삭제 단추)를 답이 오기 전에 두 번 눌러요.
    const confirm = screen.getAllByRole("button", { name: "삭제" }).at(-1)!;
    await user.dblClick(confirm);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/reviews/winter-stop", expect.objectContaining({ method: "DELETE" }));

    // 이제 서버가 "삭제했어요"라고 답해요.
    respond(new Response(JSON.stringify({ title: "겨울 정류장", commitSha: "c" }), { status: 200 }));

    // 초점 옮기기는 화면을 그린 뒤(useEffect)에 일어나서, 될 때까지 잠깐 기다려요.
    await vi.waitFor(() => expect(screen.getByRole("link", { name: "목록으로" })).toHaveFocus());
    expect(screen.getByText(/‘겨울 정류장’ 리뷰를 삭제했습니다/)).toHaveAttribute("role", "status");
    expect(dialog).not.toHaveAttribute("open");
    // 삭제한 리뷰는 더 수정할 수 없으니 [수정]도 사라져요.
    expect(screen.queryByRole("link", { name: "수정" })).not.toBeInTheDocument();
  });

  it("삭제에 실패하면 창 안에 이유를 알리고, 다시 누를 수 있다", async () => {
    answer(502, { message: "GitHub가 잠시 응답하지 않습니다. 잠시 뒤 다시 시도해 주세요." });
    const user = userEvent.setup();
    render(<AdminReviewActions slug="winter-stop" title="겨울 정류장" />);

    await user.click(screen.getByRole("button", { name: "삭제" }));
    const confirm = screen.getAllByRole("button", { name: "삭제" }).at(-1)!;
    await user.click(confirm);

    expect(await screen.findByText("GitHub가 잠시 응답하지 않습니다. 잠시 뒤 다시 시도해 주세요.")).toHaveAttribute("role", "alert");
    expect(confirm).toBeEnabled();
  });
});
