/**
 * @file review-writer.tsx 테스트
 *
 * 리뷰 라이터(글쓰기·고치기 폼)를 사용자처럼 써 보며 확인해요.
 *   - 틀린 칸이 있으면 "고칠 곳" 목록으로 알리고 초점을 옮기는지
 *   - Markdown 파일을 불러오면 칸이 바로 채워지는지
 *   - 장면 사진을 넣으면 본문에 Markdown 사진 줄이 들어가는지
 *   - 저장: 사진을 먼저 올리고, 그 번호와 함께 리뷰를 저장하는지(두 번 눌러도 한 번만)
 *   - 고치기: 처음 원고 sha와 함께 PUT으로 저장하는지
 *
 * 서버 대신 fetch를 가짜로 바꿔 답을 정해요. jsdom에는 사진 미리보기 주소(URL.createObjectURL)가 없어서 흉내 내요.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewWriter } from "./review-writer";

/**
 * 가짜 서버: 주소마다 답을 정하고, 받은 요청을 기록해요.
 * gate를 주면 리뷰 저장 답을 그 약속(Promise)이 풀릴 때까지 미뤄요(서버가 시간이 걸리는 상황).
 */
function fakeServer(
  reviewAnswer: { status: number; body: unknown } = { status: 201, body: { slug: "winter-stop", commitSha: "c" } },
  gate: Promise<void> = Promise.resolve(),
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url === "/api/images") {
        const form = init.body as FormData;
        return new Response(JSON.stringify({ path: form.get("path"), sha: "f".repeat(40) }), { status: 200 });
      }
      await gate;
      return new Response(JSON.stringify(reviewAnswer.body), { status: reviewAnswer.status });
    }),
  );
}

/** fetch가 받은 요청 중 주소가 맞는 것들 */
const callsTo = (url: string) => vi.mocked(fetch).mock.calls.filter(([called]) => called === url);

/** 꼭 필요한 칸을 모두 채워요. */
async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^주소\(영문\)/), "winter-stop");
  await user.type(screen.getByLabelText(/^제목/), "겨울 정류장");
  await user.type(screen.getByLabelText(/^개봉 연도/), "2024");
  await user.type(screen.getByLabelText(/^감독/), "한서윤");
  await user.click(screen.getByRole("checkbox", { name: "드라마" }));
  await user.selectOptions(screen.getByLabelText(/^평점/), "4.5");
  await user.type(screen.getByLabelText(/^한줄평/), "기다림은 끝내 도착한다.");
}

describe("ReviewWriter(새 리뷰)", () => {
  beforeEach(() => {
    fakeServer();
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("틀린 칸이 있으면 저장하지 않고, '고칠 곳' 목록에 초점을 옮기고 칸마다 오류를 단다", async () => {
    const user = userEvent.setup();
    render(<ReviewWriter mode="create" />);
    await user.click(screen.getByRole("button", { name: "리뷰 저장" }));

    const summary = await screen.findByRole("group", { name: "고칠 곳 7개" });
    await vi.waitFor(() => expect(summary).toHaveFocus());
    // 목록의 항목은 그 칸으로 가는 링크예요.
    expect(within(summary).getByRole("link", { name: /^제목: 제목을 입력하세요/ })).toHaveAttribute("href", expect.stringMatching(/-title$/));
    expect(screen.getByLabelText(/^제목/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/^제목/)).toHaveAccessibleDescription("제목을 입력하세요. 예: 겨울 정류장");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Markdown 파일을 불러오면 칸이 바로 채워지고, 주소는 파일 이름으로, 쓰지 않는 항목은 알려 준다", async () => {
    const user = userEvent.setup();
    render(<ReviewWriter mode="create" />);
    const file = new File(
      ["---\ntitle: 겨울 정류장\nyear: 2024\ndirector: 한서윤\ngenres: [드라마]\nrating: 4.5\noneLiner: 한줄\nwatchedAt: 2026-11-06\n---\n\n## 좋았던 점\n"],
      "winter-stop.md",
      { type: "text/markdown" },
    );
    await user.upload(screen.getByLabelText("Markdown 파일 불러오기"), file);

    await vi.waitFor(() => expect(screen.getByLabelText(/^제목/)).toHaveValue("겨울 정류장"));
    expect(screen.getByLabelText(/^주소\(영문\)/)).toHaveValue("winter-stop");
    expect(screen.getByLabelText(/^평점/)).toHaveValue("4.5");
    expect(screen.getByRole("checkbox", { name: "드라마" })).toBeChecked();
    expect(screen.getByLabelText(/^본문/)).toHaveValue("## 좋았던 점");
    expect(screen.getByText(/winter-stop.md을\(를\) 불러와 칸을 채웠습니다/)).toHaveTextContent("watchedAt");
  });

  it("원고 모양이 아닌 파일을 불러오면 고치는 방법을 알린다", async () => {
    const user = userEvent.setup();
    render(<ReviewWriter mode="create" />);
    await user.upload(screen.getByLabelText("Markdown 파일 불러오기"), new File(["그냥 글"], "note.md", { type: "text/markdown" }));
    expect(await screen.findByRole("alert", { name: "" })).toBeDefined();
    expect(screen.getByText(/note.md: 원고 맨 위에 --- 로 감싼 정보 영역이 없습니다/)).toBeInTheDocument();
  });

  it("주소를 적기 전에는 장면 사진을 넣을 수 없고, 적은 뒤에는 본문 커서 자리에 사진 줄이 들어간다", async () => {
    const user = userEvent.setup();
    render(<ReviewWriter mode="create" />);
    const picture = new File(["png"], "Scene.PNG", { type: "image/png" });

    await user.upload(screen.getByLabelText("장면 사진 넣기"), picture);
    expect(screen.getByLabelText(/^주소\(영문\)/)).toHaveAccessibleDescription(expect.stringContaining("사진을 넣기 전에 주소(영문)를 먼저"));

    await user.type(screen.getByLabelText(/^주소\(영문\)/), "winter-stop");
    await user.type(screen.getByLabelText(/^본문/), "첫 문단");
    await user.upload(screen.getByLabelText("장면 사진 넣기"), picture);
    expect(screen.getByLabelText(/^본문/)).toHaveValue("첫 문단\n\n![](/images/winter-stop/scene-1.png)\n\n");
    expect(screen.getByText(/사진 1장을 본문에 넣었습니다/)).toBeInTheDocument();
  });

  it("주소를 바꾸면 이미 넣은 사진 주소도 따라 바뀐다", async () => {
    const user = userEvent.setup();
    render(<ReviewWriter mode="create" />);
    await user.type(screen.getByLabelText(/^주소\(영문\)/), "winter");
    await user.upload(screen.getByLabelText("장면 사진 넣기"), new File(["png"], "a.png", { type: "image/png" }));
    await user.type(screen.getByLabelText(/^주소\(영문\)/), "-stop");
    expect(screen.getByLabelText(/^본문/)).toHaveValue("![](/images/winter-stop/scene-1.png)\n\n");
  });

  it("저장: 고른 포스터를 먼저 올리고 그 번호와 함께 리뷰를 저장한다. 저장 중에 두 번 눌러도 한 번만 저장한다", async () => {
    // 저장 답을 미뤄 두고, 그사이에 [리뷰 저장]을 두 번 눌러 봐요.
    let open: () => void = () => {};
    fakeServer(undefined, new Promise<void>((resolve) => (open = resolve)));
    const user = userEvent.setup();
    render(<ReviewWriter mode="create" />);
    await fillRequired(user);
    await user.upload(screen.getByLabelText("포스터 고르기"), new File(["jpg"], "poster.jpeg", { type: "image/jpeg" }));

    const save = screen.getByRole("button", { name: "리뷰 저장" });
    await user.dblClick(save);
    // 저장하는 동안에는 단추 글자가 바뀌고 누를 수 없어요.
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "저장하는 중…" })).toBeDisabled());
    open();

    const saved = await screen.findByRole("heading", { name: "저장했습니다" });
    await vi.waitFor(() => expect(saved).toHaveFocus());
    expect(callsTo("/api/images")).toHaveLength(1);
    expect(callsTo("/api/reviews")).toHaveLength(1);
    const request = JSON.parse(String(callsTo("/api/reviews")[0]![1]!.body));
    expect(request.values).toMatchObject({ slug: "winter-stop", title: "겨울 정류장", poster: "winter-stop.jpg", genres: ["드라마"] });
    expect(request.uploads).toEqual([{ path: "public/posters/winter-stop.jpg", sha: "f".repeat(40) }]);
    expect(screen.getByRole("link", { name: "이 리뷰 보기" })).toHaveAttribute("href", "/reviews/winter-stop");
  });

  it("서버가 칸 오류로 돌려보내면 그 칸에 알리고, 다시 저장할 수 있다", async () => {
    fakeServer({ status: 409, body: { message: "같은 주소의 리뷰가 이미 있습니다.", errors: { slug: "이미 같은 주소의 리뷰가 있습니다." } } });
    const user = userEvent.setup();
    render(<ReviewWriter mode="create" />);
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "리뷰 저장" }));

    expect(await screen.findByRole("group", { name: "고칠 곳 1개" })).toHaveTextContent("주소(영문): 이미 같은 주소의 리뷰가 있습니다.");
    expect(screen.getByRole("button", { name: "리뷰 저장" })).toBeEnabled();
  });
});

describe("ReviewWriter(고치기)", () => {
  beforeEach(() => fakeServer({ status: 200, body: { slug: "winter-stop", commitSha: "c" } }));
  afterEach(() => vi.unstubAllGlobals());

  const SOURCE = "---\ntitle: 겨울 정류장\nyear: 2024\ndirector: 한서윤\ngenres: [드라마]\nrating: 4.5\noneLiner: 한줄\npublishedAt: 2026-11-08\n---\n\n본문\n";

  it("저장소의 원고로 칸을 채우고, 주소는 바꿀 수 없다", () => {
    render(<ReviewWriter mode="edit" slug="winter-stop" source={SOURCE} baseSha="base" />);
    expect(screen.getByLabelText(/^제목/)).toHaveValue("겨울 정류장");
    expect(screen.queryByLabelText(/^주소\(영문\)/)).not.toBeInTheDocument();
    expect(screen.getByText(/고치기에서는 바꿀 수 없습니다/)).toBeInTheDocument();
  });

  it("고친 내용을 처음 원고 sha와 함께 PUT으로 저장한다(글 쓴 날은 그대로)", async () => {
    const user = userEvent.setup();
    render(<ReviewWriter mode="edit" slug="winter-stop" source={SOURCE} baseSha="base" />);
    await user.clear(screen.getByLabelText(/^한줄평/));
    await user.type(screen.getByLabelText(/^한줄평/), "고친 한줄평");
    await user.click(screen.getByRole("button", { name: "고친 내용 저장" }));

    await screen.findByRole("heading", { name: "저장했습니다" });
    const [url, init] = callsTo("/api/reviews/winter-stop")[0]!;
    expect(url).toBe("/api/reviews/winter-stop");
    expect(init!.method).toBe("PUT");
    const body = JSON.parse(String(init!.body));
    expect(body.baseSha).toBe("base");
    expect(body.values).toMatchObject({ oneLiner: "고친 한줄평", publishedAt: "2026-11-08" });
  });
});
