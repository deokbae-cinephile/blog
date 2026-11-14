/**
 * @file review-writer.tsx 임시 저장 테스트
 *
 * 글쓰기 화면의 [임시 저장]과 "임시 저장한 글" 목록이
 *   - 검사 없이(쓰다 만 글도) 칸 값과 고른 사진을 저장하고, 저장한 시각을 단추 아래에 알리는지
 *   - 새 글 화면에는 새 글 것만, 수정 화면에는 그 리뷰 것만 보이는지
 *   - [불러오기]로 칸과 사진을 채우고, 쓰던 내용이 있으면 먼저 묻는지
 *   - [삭제]는 확인한 뒤 지우고, 초점을 잃지 않게 옮기는지
 *   - 리뷰를 저장하면 불러온 임시 저장본을 지우는지
 *   - 수정 화면: 임시 저장본을 쓴 뒤 리뷰가 바뀌었으면(원고 번호가 다름) 불러오기 전에 묻는지
 *   - 지금 쓰는 글의 임시 저장본을 지우면 다시 "저장하지 않은 내용"이 되는지(떠날 때 물음)
 *   - 임시 저장본을 읽는 동안 고친 내용을 덮어쓰지 않는지
 *   - 사진을 줄이는 동안에는 저장 단추를 막고, 늦게 끝난 예전 포스터가 나중 선택을 덮어쓰지 않는지
 * 확인해요. 브라우저 저장소(IndexedDB, lib/drafts.ts)는 가짜로 바꿔요. 진짜 저장소는 E2E(e2e/admin.spec.ts)에서 확인해요.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Draft, DraftSummary } from "@/lib/drafts";
import { EMPTY_VALUES } from "@/lib/review-values";

import { ReviewWriter } from "./review-writer";

/** 사진 줄이기를 흉내 내요. 기본은 고른 파일 그대로(바로 끝남), 시험마다 늦게 끝나게 바꿀 수 있어요. */
const shrink = vi.hoisted(() => ({ fn: null as null | ((file: File) => Promise<{ file: File; shrunk: boolean }>) }));
vi.mock("@/lib/shrink-image", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/shrink-image")>()),
  shrinkImage: (file: File) => (shrink.fn ? shrink.fn(file) : Promise.resolve({ file, shrunk: false })),
}));

/** 나중에 풀 수 있는 약속(Promise)을 만들어요. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

/** 떠날 때 묻는지: beforeunload 이벤트를 보내 막혔는지(preventDefault) 봐요. */
function asksBeforeLeaving() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

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
    shrink.fn = null;
  });

  it("[임시 저장]은 검사 없이 쓰다 만 글을 저장하고, 저장한 시각을 단추 아래에 알리고, 목록에 보인다", async () => {
    const user = userEvent.setup();
    render(<ReviewWriter mode="create" />);
    await user.type(screen.getByLabelText(/^제목/), "쓰다 만 리뷰");
    await user.click(screen.getByRole("button", { name: "임시 저장" }));

    // 틀린 칸(주소 등)이 있어도 "고칠 곳" 목록 없이 저장해요.
    // 결과 글자는 단추 아래의 늘 있는 안내 영역(role="status") 안에 보여요.
    expect((await screen.findByText(/에 임시 저장했습니다\. 이 브라우저에 저장했고/)).closest("[role='status']")).toBeInTheDocument();
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

  it("수정 화면: 임시 저장할 때 원고 번호를 적고, 그사이 리뷰가 바뀌었으면 불러오기 전에 덮어쓴다고 묻는다", async () => {
    const user = userEvent.setup();
    const parsed = { ok: true as const, values: { ...EMPTY_VALUES, title: "겨울 정류장", rating: "4.5" } };
    const { unmount } = render(<ReviewWriter mode="edit" slug="winter-stop" parsed={parsed} baseSha="sha-a" />);
    await user.click(screen.getByRole("button", { name: "임시 저장" }));
    await waitFor(() => expect(store.drafts.size).toBe(1));
    expect(([...store.drafts.values()][0] as Draft).baseSha).toBe("sha-a");
    unmount();

    // 그사이 리뷰가 바뀌어(원고 번호 sha-b) 수정 화면을 다시 열었어요.
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ReviewWriter mode="edit" slug="winter-stop" parsed={{ ...parsed, values: { ...parsed.values, title: "바뀐 제목" } }} baseSha="sha-b" />);
    const list = await screen.findByRole("region", { name: "임시 저장한 글 (1)" });
    await user.click(within(list).getByRole("button", { name: "불러오기" }));
    expect(confirm).toHaveBeenLastCalledWith(expect.stringContaining("리뷰가 다른 곳에서 바뀌었습니다"));
    expect(screen.getByLabelText(/^제목/)).toHaveValue("바뀐 제목");

    // 알고 불러오면 임시 저장본 내용으로 바뀌어요.
    confirm.mockReturnValue(true);
    await user.click(within(list).getByRole("button", { name: "불러오기" }));
    await waitFor(() => expect(screen.getByLabelText(/^제목/)).toHaveValue("겨울 정류장"));
  });

  it("지금 쓰는 글의 임시 저장본을 지우면, 다시 저장하지 않은 내용이 되어 떠날 때 묻는다", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ReviewWriter mode="create" />);
    await user.type(screen.getByLabelText(/^제목/), "쓰던 글");
    expect(asksBeforeLeaving()).toBe(true);
    await user.click(screen.getByRole("button", { name: "임시 저장" }));
    await screen.findByText(/에 임시 저장했습니다/);
    // 임시 저장했으니 떠나도 잃는 것이 없어요.
    expect(asksBeforeLeaving()).toBe(false);

    const list = await screen.findByRole("region", { name: "임시 저장한 글 (1)" });
    await user.click(within(list).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(store.drafts.size).toBe(0));
    // 하나뿐인 저장본을 지웠으니, 화면의 글은 다시 어디에도 저장되지 않았어요.
    await waitFor(() => expect(asksBeforeLeaving()).toBe(true));
  });

  it("임시 저장본을 읽는 동안 글을 고치면, 고친 내용을 덮어쓰지 않고 불러오기를 멈춘다", async () => {
    const user = userEvent.setup();
    putDraft({ id: "d1", values: { ...EMPTY_VALUES, title: "임시 저장본" } });
    const { loadDraft } = await import("@/lib/drafts");
    const reading = deferred<Draft | undefined>();
    vi.mocked(loadDraft).mockImplementationOnce(() => reading.promise);
    render(<ReviewWriter mode="create" />);
    const list = await screen.findByRole("region", { name: "임시 저장한 글 (1)" });

    await user.click(within(list).getByRole("button", { name: "불러오기" }));
    // 읽는 동안 제목을 적어요.
    await user.type(screen.getByLabelText(/^제목/), "새로 쓴 제목");
    reading.resolve(store.drafts.get("d1") as Draft);
    expect(await screen.findByText("임시 저장한 글을 읽는 동안 글이 바뀌어서 불러오지 않았습니다. 다시 눌러 주세요.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^제목/)).toHaveValue("새로 쓴 제목");
  });

  it("사진을 줄이는 동안에는 저장 단추를 막고, 늦게 끝난 예전 포스터가 나중에 고른 포스터를 덮어쓰지 않는다", async () => {
    const user = userEvent.setup();
    const jobs = new Map<string, ReturnType<typeof deferred<{ file: File; shrunk: boolean }>>>();
    shrink.fn = (file) => {
      const job = deferred<{ file: File; shrunk: boolean }>();
      jobs.set(file.name, job);
      return job.promise;
    };
    const first = new File(["a"], "first.png", { type: "image/png" });
    const second = new File(["b"], "second.png", { type: "image/png" });
    render(<ReviewWriter mode="create" />);
    await user.type(screen.getByLabelText(/^주소\(영문\)/), "winter-stop");

    await user.upload(screen.getByLabelText("포스터 고르기"), first);
    // 줄이는 동안: 두 저장 단추가 막혀요.
    expect(screen.getByRole("button", { name: "리뷰 저장" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "임시 저장" })).toBeDisabled();
    await user.upload(screen.getByLabelText("포스터 고르기"), second);

    // 나중에 고른 포스터가 먼저 끝나고, 먼저 고른 포스터가 늦게 끝나요.
    jobs.get("second.png")!.resolve({ file: second, shrunk: false });
    expect(await screen.findByText(/포스터로 second\.png을\(를\) 골랐습니다/)).toBeInTheDocument();
    jobs.get("first.png")!.resolve({ file: first, shrunk: false });
    await waitFor(() => expect(screen.getByRole("button", { name: "리뷰 저장" })).toBeEnabled());
    // 마지막 선택(second)이 그대로예요.
    expect(screen.queryByText(/포스터로 first\.png을\(를\) 골랐습니다/)).not.toBeInTheDocument();
    expect(URL.createObjectURL).toHaveBeenLastCalledWith(second);
  });

  it("장면 사진을 줄이는 사이 주소 칸을 비우면, 사진 줄을 넣지 않고 주소를 먼저 적으라고 알린다", async () => {
    const user = userEvent.setup();
    const job = deferred<{ file: File; shrunk: boolean }>();
    shrink.fn = () => job.promise;
    const scene = new File(["png"], "scene.png", { type: "image/png" });
    render(<ReviewWriter mode="create" />);
    await user.type(screen.getByLabelText(/^주소\(영문\)/), "winter-stop");
    await user.upload(screen.getByLabelText("장면 사진 넣기"), scene);
    // 줄이는 사이 주소를 지워요.
    await user.clear(screen.getByLabelText(/^주소\(영문\)/));
    job.resolve({ file: scene, shrunk: false });
    await waitFor(() => expect(screen.getByLabelText(/^주소\(영문\)/)).toHaveAccessibleDescription(/사진을 넣기 전에 주소\(영문\)를 먼저 적어 주세요/));
    expect(screen.getByRole("textbox", { name: "본문(Markdown)" })).toHaveValue("");
  });

  it("사진을 줄이는 동안에는 임시 저장본을 불러오지 못한다(줄이던 사진이 섞이지 않게)", async () => {
    const user = userEvent.setup();
    putDraft({ id: "d1", values: { ...EMPTY_VALUES, title: "임시 저장본" } });
    const job = deferred<{ file: File; shrunk: boolean }>();
    shrink.fn = () => job.promise;
    render(<ReviewWriter mode="create" />);
    const list = await screen.findByRole("region", { name: "임시 저장한 글 (1)" });
    await user.type(screen.getByLabelText(/^주소\(영문\)/), "winter-stop");
    await user.upload(screen.getByLabelText("장면 사진 넣기"), new File(["png"], "scene.png", { type: "image/png" }));
    expect(within(list).getByRole("button", { name: "불러오기" })).toBeDisabled();
    job.resolve({ file: new File(["png"], "scene.png", { type: "image/png" }), shrunk: false });
    await waitFor(() => expect(within(list).getByRole("button", { name: "불러오기" })).toBeEnabled());
  });

  it("[임시 저장]하는 동안 단추 아래에 '임시 저장하는 중' 로딩 UI를 보이고, 끝나면 결과 글자로 바뀐다", async () => {
    const user = userEvent.setup();
    const { saveDraft } = await import("@/lib/drafts");
    const writing = deferred<void>();
    vi.mocked(saveDraft).mockImplementationOnce(async (draft: Draft) => {
      await writing.promise;
      store.drafts.set(draft.id, draft);
    });
    render(<ReviewWriter mode="create" />);
    await user.type(screen.getByLabelText(/^제목/), "로딩 시험");
    await user.click(screen.getByRole("button", { name: "임시 저장" }));

    const loading = await screen.findByText("임시 저장하는 중");
    expect(loading.closest("[role='status']")).toBeInTheDocument();
    // 진행 안내는 폼 밖에 있어요(저장하는 동안 aria-busy인 폼 안의 바뀜은 화면 낭독기가 미룰 수 있어서요).
    expect(loading.closest("form")).toBeNull();
    // 임시 저장하는 동안에는 [리뷰 저장]도 막혀요(한 번에 하나만 저장해요).
    expect(screen.getByRole("button", { name: "임시 저장" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "리뷰 저장" })).toBeDisabled();
    writing.resolve();
    // 적어도 0.4초는 보인 뒤 결과 글자로 바뀌어요.
    expect(await screen.findByText(/에 임시 저장했습니다/, undefined, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.queryByText("임시 저장하는 중")).not.toBeInTheDocument();
  });

  it("임시 저장본에는 본문에 남아 있는 장면 사진만 담는다(본문에서 지운 사진 파일은 담지 않는다)", async () => {
    const user = userEvent.setup();
    render(<ReviewWriter mode="create" />);
    await user.type(screen.getByLabelText(/^주소\(영문\)/), "winter-stop");
    await user.upload(screen.getByLabelText("장면 사진 넣기"), [
      new File(["a"], "a.png", { type: "image/png" }),
      new File(["b"], "b.png", { type: "image/png" }),
    ]);
    const body = screen.getByRole("textbox", { name: "본문(Markdown)" });
    await waitFor(() => expect(body).toHaveValue("![](/images/winter-stop/scene-1.png)\n\n![](/images/winter-stop/scene-2.png)\n\n"));
    // 둘째 사진 줄을 지워요(글자 [ 는 user.type이 키 이름으로 읽어서 값을 바로 넣어요).
    fireEvent.change(body, { target: { value: "![첫 사진](/images/winter-stop/scene-1.png)" } });
    await user.click(screen.getByRole("button", { name: "임시 저장" }));
    await screen.findByText(/에 임시 저장했습니다/, undefined, { timeout: 2000 });
    const saved = [...store.drafts.values()][0] as Draft;
    expect(saved.scenes.map(([path]) => path)).toEqual(["/images/winter-stop/scene-1.png"]);
  });
});
