/**
 * @file admin-review-actions.tsx·delete-review.tsx 테스트
 *
 * 상세 화면의 [수정]·[삭제]가 로그인했을 때만 보이고,
 * 삭제는 확인 창(<dialog role="alertdialog">)을 거쳐 한 번만 요청하는지, 삭제하는 동안 창 안에 로딩 UI를 보이는지 확인해요.
 * 삭제한 뒤의 안내와 초점 옮기기는 맨 윗줄(review-toolbar.test.tsx)에서 확인해요.
 * jsdom에는 <dialog>의 showModal()이 없어서 vitest.setup.ts가 간단한 흉내를 넣어 둬요.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
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
    const { container } = render(<AdminReviewActions slug="winter-stop" title="겨울 정류장" onDeleted={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("[삭제]를 누르면 확인 창이 열리고, 처음 초점은 [취소]에 있다. [취소]로 닫으면 삭제하지 않는다", async () => {
    answer(200, { title: "겨울 정류장", commitSha: "c" });
    const user = userEvent.setup();
    render(<AdminReviewActions slug="winter-stop" title="겨울 정류장" onDeleted={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "삭제" }));
    const dialog = screen.getByRole("alertdialog", { name: "리뷰를 삭제할까요?" });
    expect(dialog).toHaveAttribute("open");
    // 창의 설명(aria-describedby)이 무엇을 삭제하는지 알려 줘요.
    expect(dialog).toHaveAccessibleDescription(expect.stringContaining("‘겨울 정류장’ 리뷰와 이 리뷰의 포스터·장면 사진"));

    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(dialog).not.toHaveAttribute("open");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("로그인하면 [수정](글쓰기 화면으로)과 [삭제]를 한 줄로 보인다", () => {
    render(<AdminReviewActions slug="winter-stop" title="겨울 정류장" onDeleted={vi.fn()} />);
    const edit = screen.getByRole("link", { name: "수정" });
    expect(edit).toHaveAttribute("href", "/write/winter-stop");
    // 두 단추는 옆의 [공유하기]와 같은 모양(btn-line)이고, 같은 줄 묶음 안에 있어요(안내 칸 같은 다른 줄이 없어요).
    const row = edit.parentElement!;
    expect(row).toContainElement(screen.getByRole("button", { name: "삭제" }));
    expect(within(row).queryByRole("status")).not.toBeInTheDocument();
    expect(edit).toHaveClass("btn-line");
    expect(screen.getByRole("button", { name: "삭제" })).toHaveClass("btn-line");
  });

  it("확인 창에서 [삭제]를 두 번 빠르게 눌러도 한 번만 삭제한다. 삭제하는 동안 창 안에 로딩 UI를 보이고, 끝나면 창을 닫고 알린다", async () => {
    // 서버 답을 우리가 정한 때에 보내려고, 답을 미뤄 두는 가짜 fetch를 써요(진짜 서버처럼 시간이 걸리는 상황).
    let respond: (response: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (respond = resolve))));
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(<AdminReviewActions slug="winter-stop" title="겨울 정류장" onDeleted={onDeleted} />);

    await user.click(screen.getByRole("button", { name: "삭제" }));
    const dialog = screen.getByRole("alertdialog");
    // 창 안의 안내 칸(role="status")은 처음부터 있고 비어 있어요.
    const status = within(dialog).getByRole("status");
    expect(status).toBeEmptyDOMElement();

    // 창 안의 [삭제](두 번째 삭제 단추)를 답이 오기 전에 두 번 눌러요.
    const confirm = screen.getAllByRole("button", { name: "삭제" }).at(-1)!;
    await user.dblClick(confirm);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/reviews/winter-stop", expect.objectContaining({ method: "DELETE" }));

    // 답을 기다리는 동안: 안내 칸에 로딩 UI가 보이고, 두 단추는 막혀요(aria-disabled: 초점은 누른 [삭제]에 그대로 있어요).
    expect(status).toHaveTextContent("리뷰를 삭제하는 중");
    const cancel = within(dialog).getByRole("button", { name: "취소" });
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    expect(cancel).toHaveAttribute("aria-disabled", "true");
    expect(confirm).toHaveFocus();
    // 막힌 [취소]를 눌러도 창은 닫히지 않아요.
    await user.click(cancel);
    expect(dialog).toHaveAttribute("open");
    // Esc(취소 이벤트)로도 창을 닫지 못해요. fireEvent는 막혔으면(preventDefault) false를 돌려줘요.
    expect(fireEvent(dialog, new Event("cancel", { cancelable: true }))).toBe(false);

    // 이제 서버가 "삭제했어요"라고 답해요.
    respond(new Response(JSON.stringify({ title: "겨울 정류장", commitSha: "c" }), { status: 200 }));

    await vi.waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(onDeleted).toHaveBeenCalledWith("‘겨울 정류장’ 리뷰를 삭제했습니다. 블로그를 다시 배포하면(몇 분 뒤) 목록에서도 사라집니다.");
    expect(dialog).not.toHaveAttribute("open");
    expect(status).toBeEmptyDOMElement();
  });

  it("삭제에 실패하면 창 안에 이유를 알리고, 다시 누를 수 있다", async () => {
    answer(502, { message: "GitHub가 잠시 응답하지 않습니다. 잠시 뒤 다시 시도해 주세요." });
    const user = userEvent.setup();
    render(<AdminReviewActions slug="winter-stop" title="겨울 정류장" onDeleted={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "삭제" }));
    const confirm = screen.getAllByRole("button", { name: "삭제" }).at(-1)!;
    await user.click(confirm);

    expect(await screen.findByText("GitHub가 잠시 응답하지 않습니다. 잠시 뒤 다시 시도해 주세요.")).toHaveAttribute("role", "alert");
    // 다시 누를 수 있어요(막힘 표시가 없어지고, 초점도 [삭제]에 그대로예요).
    expect(confirm).not.toHaveAttribute("aria-disabled");
    expect(confirm).toHaveFocus();
    // 로딩 UI는 사라지고, 창은 열린 채라 다시 누르거나 [취소]·Esc로 닫을 수 있어요.
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByRole("status")).toBeEmptyDOMElement();
    expect(dialog).toHaveAttribute("open");
    expect(fireEvent(dialog, new Event("cancel", { cancelable: true }))).toBe(true);
  });
});
