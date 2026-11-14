/**
 * @file review-writer.tsx 임시 저장 테스트
 *
 * 글쓰기 화면의 [임시 저장]과 "임시 저장한 글" 목록이
 *   - 검사 없이(쓰다 만 글도) 칸 값과 고른 사진을 저장하고, 저장한 시각을 단추 아래에 알리는지
 *   - 새 글 화면에는 새 글 것만, 수정 화면에는 그 리뷰 것만 보이는지
 *   - [불러오기]로 칸과 사진을 채우고, 쓰던 내용이 있으면 먼저 묻는지
 *   - [삭제]는 확인한 뒤 지우고, 초점을 잃지 않게 옮기는지
 *   - 리뷰를 저장하면 불러온 임시 저장본을 지우는지
 * 확인해요. 브라우저 저장소(IndexedDB, lib/drafts.ts)는 가짜로 바꿔요. 진짜 저장소는 E2E(e2e/admin.spec.ts)에서 확인해요.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Draft, DraftSummary } from "@/lib/drafts";
import { EMPTY_VALUES } from "@/lib/review-values";

import { ReviewWriter } from "./review-writer";

/** 가짜 임시 저장소: 저장한 글을 메모리에 들고 있어요. */
const store = vi.hoisted(() => ({ drafts: new Map<string, unknown>() }));
vi.mock("@/lib/drafts", () => ({
  listDrafts: vi.fn(async () =>
    [...store.drafts.values()].map((value) => {
      const draft = value as Draft;
      return { id: draft.id, mode: draft.mode, reviewSlug: draft.reviewSlug, savedAt: draft.savedAt, title: draft.values.title.trim() } satisfies DraftSummary;
    }),
  ),
  loadDraft: vi.fn(async (id: string) => store.drafts.get(id)),
  saveDraft: vi.fn(async (draft: Draft) => {
    store.drafts.set(draft.id, draft);
  }),
  deleteDraft: vi.fn(async (id: string) => {
    store.drafts.delete(id);
  }),
}));

/** 저장해 둔 임시 글 하나를 만들어요. */
function putDraft(partial: Partial<Draft> & { id: string }): Draft {
  const draft: Draft = {
    mode: "create",
    reviewSlug: "",
    savedAt: Date.UTC(2026, 10, 14, 6, 12),
    values: { ...EMPTY_VALUES, rating: "5.0" },
    poster: null,
    scenes: [],
    imagesSlug: "",
    ...partial,
  };
  store.drafts.set(draft.id, draft);
  return draft;
}

/** 가짜 서버: 사진 올리기와 리뷰 저장에 성공으로 답해요. */
function fakeServer() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url === "/api/images") {
        const form = init.body as FormData;
        return Response.json({ path: form.get("path"), sha: "f".repeat(40) });
      }
      return Response.json({ slug: "winter-stop", commitSha: "c" }, { status: 201 });
    }),
  );
}

describe("ReviewWriter 임시 저장", () => {
  beforeEach(() => {
    store.drafts.clear();
    fakeServer();
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("[임시 저장]은 검사 없이 쓰다 만 글을 저장하고, 저장한 시각을 단추 아래에 알리고, 목록에 보인다", async () => {
    const user = userEvent.setup();
    render(<ReviewWriter mode="create" />);
    await user.type(screen.getByLabelText(/^제목/), "쓰다 만 리뷰");
    await user.click(screen.getByRole("button", { name: "임시 저장" }));

    // 틀린 칸(주소 등)이 있어도 "고칠 곳" 목록 없이 저장해요.
    expect(await screen.findByText(/에 임시 저장했습니다\. 이 브라우저에 저장했고/)).toHaveAttribute("role", "status");
    expect(screen.queryByRole("group", { name: /고칠 곳/ })).not.toBeInTheDocument();
    const saved = [...store.drafts.values()] as Draft[];
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ mode: "create", reviewSlug: "", values: { title: "쓰다 만 리뷰" } });

    const list = await screen.findByRole("region", { name: "임시 저장한 글 (1)" });
    expect(within(list).getByText("쓰다 만 리뷰")).toBeInTheDocument();
    expect(within(list).getByText(/지금 쓰는 글/)).toBeInTheDocument();
    // [불러오기]의 이름은 보이는 글자 그대로, 어느 글인지는 설명으로 덧붙여요.
    expect(within(list).getByRole("button", { name: "불러오기" })).toHaveAccessibleDescription(/쓰다 만 리뷰/);

    // 다시 [임시 저장]하면 새 글이 아니라 같은 글을 새 내용으로 바꿔요.
    await user.type(screen.getByLabelText(/^제목/), " 2");
    await user.click(screen.getByRole("button", { name: "임시 저장" }));
    await waitFor(() => expect((([...store.drafts.values()][0] as Draft).values.title)).toBe("쓰다 만 리뷰 2"));
    expect(store.drafts.size).toBe(1);
  });

  it("새 글 화면에는 새 글의 임시 저장본만, 수정 화면에는 그 리뷰의 임시 저장본만 보인다", async () => {
    putDraft({ id: "new-1", values: { ...EMPTY_VALUES, title: "새 글" } });
    putDraft({ id: "edit-1", mode: "edit", reviewSlug: "winter-stop", values: { ...EMPTY_VALUES, title: "겨울 고치는 중" } });
    putDraft({ id: "edit-2", mode: "edit", reviewSlug: "other", values: { ...EMPTY_VALUES, title: "다른 리뷰" } });

    const { unmount } = render(<ReviewWriter mode="create" />);
    const createList = await screen.findByRole("region", { name: "임시 저장한 글 (1)" });
    expect(within(createList).getByText("새 글")).toBeInTheDocument();
    unmount();

    render(
      <ReviewWriter
        mode="edit"
        slug="winter-stop"
        parsed={{ ok: true, values: { ...EMPTY_VALUES, title: "겨울 정류장", rating: "4.5" } }}
        baseSha="base"
      />,
    );
    const editList = await screen.findByRole("region", { name: "임시 저장한 글 (1)" });
    expect(within(editList).getByText("겨울 고치는 중")).toBeInTheDocument();
  });

  it("[불러오기]는 칸과 포스터를 채우고, 쓰던 내용이 있으면 먼저 묻는다(취소하면 그대로)", async () => {
    const user = userEvent.setup();
    const posterFile = new File(["png"], "poster.png", { type: "image/png" });
    putDraft({
      id: "d1",
      values: { ...EMPTY_VALUES, slug: "winter-stop", title: "겨울 정류장", rating: "4.5", poster: "winter-stop.png", body: "![](/images/winter-stop/scene-1.png)" },
      poster: { file: posterFile, extension: "png" },
      scenes: [["/images/winter-stop/scene-1.png", new File(["png"], "scene.png", { type: "image/png" })]],
      imagesSlug: "winter-stop",
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ReviewWriter mode="create" />);
    await user.type(screen.getByLabelText(/^제목/), "쓰던 글");
    const list = await screen.findByRole("region", { name: "임시 저장한 글 (1)" });

    // 쓰던 내용이 있어서 먼저 물어요. 취소하면 그대로예요.
    await user.click(within(list).getByRole("button", { name: "불러오기" }));
    expect(confirm).toHaveBeenCalledWith("지금 쓰던 내용을 지우고 임시 저장한 글을 불러올까요?");
    expect(screen.getByLabelText(/^제목/)).toHaveValue("쓰던 글");

    confirm.mockReturnValue(true);
    await user.click(within(list).getByRole("button", { name: "불러오기" }));
    await waitFor(() => expect(screen.getByLabelText(/^제목/)).toHaveValue("겨울 정류장"));
    expect(screen.getByLabelText(/^주소\(영문\)/)).toHaveValue("winter-stop");
    expect(screen.getByLabelText(/^평점/)).toHaveValue("4.5");
    expect(screen.getByRole("textbox", { name: "본문(Markdown)" })).toHaveValue("![](/images/winter-stop/scene-1.png)");
    expect(screen.getByText(/임시 저장한 글을 불러왔습니다/)).toHaveAttribute("role", "status");
    // 포스터 미리보기는 새로 만든 임시 주소예요.
    expect(URL.createObjectURL).toHaveBeenCalledWith(posterFile);
  });

  it("[삭제]는 확인한 뒤 지우고, 목록이 비면 초점을 [임시 저장] 단추로 옮긴다", async () => {
    const user = userEvent.setup();
    putDraft({ id: "d1", values: { ...EMPTY_VALUES, title: "지울 글" } });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ReviewWriter mode="create" />);
    const list = await screen.findByRole("region", { name: "임시 저장한 글 (1)" });

    await user.click(within(list).getByRole("button", { name: "삭제" }));
    expect(window.confirm).toHaveBeenCalledWith("임시 저장한 글 ‘지울 글’을(를) 지울까요? 지우면 되돌릴 수 없습니다.");
    await waitFor(() => expect(screen.queryByRole("region", { name: /임시 저장한 글/ })).not.toBeInTheDocument());
    expect(store.drafts.size).toBe(0);
    expect(screen.getByText("임시 저장한 글 ‘지울 글’을(를) 지웠습니다.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "임시 저장" })).toHaveFocus());
  });

  it("불러온 임시 저장본으로 리뷰를 저장하면, 그 임시 저장본을 지운다", async () => {
    const user = userEvent.setup();
    putDraft({
      id: "d1",
      values: {
        ...EMPTY_VALUES,
        slug: "winter-stop",
        title: "겨울 정류장",
        year: "2024",
        director: "한서윤",
        genres: ["드라마"],
        rating: "4.5",
        oneLiner: "기다림은 끝내 도착한다.",
      },
    });
    render(<ReviewWriter mode="create" />);
    const list = await screen.findByRole("region", { name: "임시 저장한 글 (1)" });
    await user.click(within(list).getByRole("button", { name: "불러오기" }));
    await waitFor(() => expect(screen.getByLabelText(/^제목/)).toHaveValue("겨울 정류장"));

    await user.click(screen.getByRole("button", { name: "리뷰 저장" }));
    await screen.findByRole("heading", { name: "저장했습니다" });
    await waitFor(() => expect(store.drafts.size).toBe(0));
  });
});
