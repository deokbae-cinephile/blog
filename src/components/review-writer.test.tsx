/**
 * @file review-writer.tsx 테스트
 *
 * 리뷰 라이터(추가·수정 폼)를 사용자처럼 써 보며 확인해요.
 *   - 틀린 칸이 있으면 "고칠 곳" 목록으로 알리고 초점을 옮기는지
 *   - Markdown 파일을 불러오면 칸이 바로 채워지는지
 *   - 장면 사진을 넣으면 본문에 Markdown 사진 줄이 들어가는지
 *   - 저장: 사진을 먼저 올리고, 그 번호와 함께 리뷰를 저장하는지(두 번 눌러도 한 번만)
 *   - 수정: 처음 원고 sha와 함께 PUT으로 저장하는지
 *
 * 서버 대신 fetch를 가짜로 바꿔 답을 정해요. jsdom에는 사진 미리보기 주소(URL.createObjectURL)가 없어서 흉내 내요.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
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

/** 본문 글상자. 역할(textbox)과 정확한 이름으로 찾아요("본문 보기" 탭 묶음과 겹치지 않게). */
const bodyBox = () => screen.getByRole("textbox", { name: "본문(Markdown)" });

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

describe("ReviewWriter(리뷰 추가)", () => {
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

    // 평점은 처음부터 5.0이 골라져 있어서 고칠 곳에 없어요(주소·제목·개봉 연도·감독·장르·한줄평 6개).
    const summary = await screen.findByRole("group", { name: "고칠 곳 6개" });
    expect(within(summary).queryByRole("link", { name: /^평점/ })).not.toBeInTheDocument();
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
    expect(bodyBox()).toHaveValue("## 좋았던 점");
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
    await user.type(bodyBox(), "첫 문단");
    await user.upload(screen.getByLabelText("장면 사진 넣기"), picture);
    expect(bodyBox()).toHaveValue("첫 문단\n\n![](/images/winter-stop/scene-1.png)\n\n");
    // 사진을 넣었다는 안내는 화면에는 띄우지 않고(sr-only) 화면 낭독기에만 짧게 알려요. 괄호·캡션 설명 글도 없어요.
    // 안내는 비웠다가 잠시 뒤(0.1초) 채워서 findByText로 기다려요.
    expect(await screen.findByText("사진 1장을 본문에 넣었습니다.")).toHaveClass("sr-only");
    expect(screen.queryByText(/괄호 안에 사진 설명/)).not.toBeInTheDocument();
  });

  it("같은 장수의 사진을 연달아 넣어도 안내를 비웠다가 다시 채워, 화면 낭독기가 매번 읽게 한다", async () => {
    const user = userEvent.setup();
    render(<ReviewWriter mode="create" />);
    const picture = new File(["png"], "scene.png", { type: "image/png" });
    await user.type(screen.getByLabelText(/^주소\(영문\)/), "winter-stop");

    await user.upload(screen.getByLabelText("장면 사진 넣기"), picture);
    const region = await screen.findByText("사진 1장을 본문에 넣었습니다.");

    // 안내 영역의 글자가 바뀔 때마다 기록해요(MutationObserver: 화면 요소가 바뀌면 알려 주는 브라우저 기능).
    const seen: string[] = [];
    const observer = new MutationObserver(() => seen.push(region.textContent ?? ""));
    observer.observe(region, { childList: true, characterData: true, subtree: true });
    await user.upload(screen.getByLabelText("장면 사진 넣기"), picture);
    await waitFor(() => expect(seen.at(-1)).toBe("사진 1장을 본문에 넣었습니다."));
    observer.disconnect();

    // 글이 같아도 한 번 비워졌다가("") 다시 채워져요. 글자가 바뀌어야 화면 낭독기가 새 안내로 읽어요.
    expect(seen[0]).toBe("");
    // 두 번째 사진은 다음 번호(scene-2)로 들어가요.
    expect((bodyBox() as HTMLTextAreaElement).value).toContain("![](/images/winter-stop/scene-2.png)");
  });

  it("넓은 화면에서는 [포스터 | 영화 정보(2열)] 3칸이고, 포스터 설명 칸과 본문 도움말은 없다", () => {
    const { container } = render(<ReviewWriter mode="create" />);
    const posterGroup = screen.getByRole("group", { name: "포스터" });
    const infoGroup = screen.getByRole("group", { name: "영화 정보" });
    // 포스터가 영화 정보보다 앞(왼쪽)에 놓여요. 읽는 순서도 같아요.
    expect(posterGroup.compareDocumentPosition(infoGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(posterGroup.parentElement).toHaveClass("lg:grid-cols-3");
    expect(infoGroup).toHaveClass("lg:col-span-2", "lg:grid-cols-2");
    // 주소(영문)~한줄평 10칸이 영화 정보 안에 있어요(2열 × 5행).
    expect(infoGroup.querySelectorAll(":scope > div, :scope > p").length).toBe(10);
    expect(screen.queryByLabelText(/포스터 설명/)).not.toBeInTheDocument();
    expect(bodyBox()).not.toHaveAccessibleDescription(expect.stringContaining("빈 줄로 문단"));
    expect(container.textContent).not.toContain("빈 줄로 문단을 나눕니다");
  });

  it("칸 아래 도움말은 주소(영문)에만 있고(예: shutter-island), 다른 칸에는 없다", () => {
    const { container } = render(<ReviewWriter mode="create" />);
    expect(screen.getByLabelText(/^주소\(영문\)/)).toHaveAccessibleDescription(
      "리뷰 주소와 파일 이름이 됩니다. 영어 소문자, 숫자, 하이픈(-)만 씁니다. 예: shutter-island → /reviews/shutter-island",
    );
    for (const label of [/^제목/, /^원제/, /^개봉 연도/, /^제작 국가/, /^감독/, /^상영 시간/, /^평점/, /^한줄평/]) {
      expect(screen.getByLabelText(label)).not.toHaveAccessibleDescription();
    }
    expect(screen.getByRole("group", { name: /^장르/ })).not.toHaveAccessibleDescription();
    // 예전 도움말 문구가 화면 어디에도 없어요.
    for (const text of ["숫자 네 자리", "쉼표로 나눕니다", "여러 개 고를 수 있습니다", "5점 만점", "보이는 한 문장", "600×900", "원고 틀(content"]) {
      expect(container.textContent).not.toContain(text);
    }
  });

  it("평점은 처음에 5.0이 골라져 있고 '고르세요'가 없으며, ▼ 그림은 읽지 않는 꾸밈이다", () => {
    render(<ReviewWriter mode="create" />);
    const rating = screen.getByLabelText(/^평점/);
    expect(rating).toHaveValue("5.0");
    expect(within(rating).queryByRole("option", { name: "고르세요" })).not.toBeInTheDocument();
    expect(within(rating).getAllByRole("option").map((option) => option.textContent)).toEqual(
      ["0.5", "1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"],
    );
    // ▼는 칸 옆에 겹쳐 그린 꾸밈 그림이라 화면 낭독기가 읽지 않아요. (좌우 간격이 같은지는 진짜 브라우저 E2E에서 재요)
    expect(rating.parentElement!.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("평점이 없는 원고를 불러오면 지금 평점(처음 5.0)을 그대로 둔다", async () => {
    const user = userEvent.setup();
    render(<ReviewWriter mode="create" />);
    const file = new File(["---\ntitle: 겨울 정류장\n---\n\n본문\n"], "winter-stop.md", { type: "text/markdown" });
    await user.upload(screen.getByLabelText("Markdown 파일 불러오기"), file);
    await vi.waitFor(() => expect(screen.getByLabelText(/^제목/)).toHaveValue("겨울 정류장"));
    expect(screen.getByLabelText(/^평점/)).toHaveValue("5.0");
  });

  it("본문 미리 보기: 쓴 글을 저장한 뒤의 모습(같은 변환)으로 보여 주고, 아직 올리지 않은 사진은 임시 주소로 보여 준다", async () => {
    const user = userEvent.setup();
    render(<ReviewWriter mode="create" />);
    await user.type(screen.getByLabelText(/^주소\(영문\)/), "winter-stop");
    await user.type(bodyBox(), "## 좋았던 점{enter}{enter}첫 장면");
    await user.upload(screen.getByLabelText("장면 사진 넣기"), new File(["png"], "scene.png", { type: "image/png" }));

    // 좁은 화면(시험 환경)은 탭으로 바꿔 봐요. [미리 보기] 탭을 누르면 미리 보기가 보여요.
    await user.click(screen.getByRole("tab", { name: "미리 보기" }));
    const preview = screen.getByRole("tabpanel", { name: "미리 보기" });
    expect(await within(preview).findByRole("heading", { level: 2, name: "좋았던 점" })).toBeInTheDocument();
    // 사진: 본문에는 저장될 주소(/images/…)가 적혀 있지만, 미리 보기는 고른 파일의 임시 주소(blob:)로 보여 줘요.
    await vi.waitFor(() => expect(preview.querySelector("img")).toHaveAttribute("src", "blob:preview"));
  });

  it("좁은 화면에서 [미리 보기]를 보고 있어도, 고칠 곳 목록의 본문 링크를 누르면 쓰기 칸이 보이고 본문 칸으로 초점이 간다", async () => {
    const user = userEvent.setup();
    render(<ReviewWriter mode="create" />);
    await fillRequired(user);
    // 설명이 없는 사진 줄을 넣어 본문 오류를 만들어요. ([ ]는 user.type에서 특별한 글자라 붙여 넣기로 넣어요.)
    await user.click(bodyBox());
    await user.paste("![](/images/winter-stop/scene-1.png)");
    await user.click(screen.getByRole("button", { name: "리뷰 저장" }));
    const summary = await screen.findByRole("group", { name: /^고칠 곳/ });

    await user.click(screen.getByRole("tab", { name: "미리 보기" }));
    expect(screen.queryByRole("textbox", { name: "본문(Markdown)" })).not.toBeInTheDocument();

    await user.click(within(summary).getByRole("link", { name: /^본문:/ }));
    expect(screen.getByRole("tab", { name: "Markdown 입력" })).toHaveAttribute("aria-selected", "true");
    expect(bodyBox()).toHaveFocus();
  });

  it("주소를 바꾸면 이미 넣은 사진 주소도 따라 바뀐다", async () => {
    const user = userEvent.setup();
    render(<ReviewWriter mode="create" />);
    await user.type(screen.getByLabelText(/^주소\(영문\)/), "winter");
    await user.upload(screen.getByLabelText("장면 사진 넣기"), new File(["png"], "a.png", { type: "image/png" }));
    await user.type(screen.getByLabelText(/^주소\(영문\)/), "-stop");
    expect(bodyBox()).toHaveValue("![](/images/winter-stop/scene-1.png)\n\n");
  });

  it("저장: 고른 포스터를 먼저 올리고 그 번호와 함께 리뷰를 저장한다. 저장 중에 두 번 눌러도 한 번만 저장한다", async () => {
    // 저장 답을 미뤄 두고, 그사이에 [리뷰 저장]을 두 번 눌러 봐요.
    let open: () => void = () => {};
    fakeServer(undefined, new Promise<void>((resolve) => (open = resolve)));
    const user = userEvent.setup();
    render(<ReviewWriter mode="create" />);
    // 주소(영문)를 적기 전에 포스터를 먼저 골라도 돼요. 막거나 주소부터 적으라고 하지 않아요.
    await user.upload(screen.getByLabelText("포스터 고르기"), new File(["jpg"], "poster.jpeg", { type: "image/jpeg" }));
    expect(screen.getByLabelText(/^주소\(영문\)/)).not.toHaveAccessibleDescription(expect.stringContaining("먼저"));
    // 주소를 적으면 포스터 파일 이름이 <주소>.jpg로 맞춰져요(아래 저장 요청에서 확인).
    await fillRequired(user);

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

describe("ReviewWriter(리뷰 수정)", () => {
  beforeEach(() => fakeServer({ status: 200, body: { slug: "winter-stop", commitSha: "c" } }));
  afterEach(() => vi.unstubAllGlobals());

  const SOURCE = "---\ntitle: 겨울 정류장\nyear: 2024\ndirector: 한서윤\ngenres: [드라마]\nrating: 4.5\noneLiner: 한줄\npublishedAt: 2026-11-08\n---\n\n본문\n";

  it("저장소의 원고로 칸을 채우고, 주소는 바꿀 수 없다", () => {
    render(<ReviewWriter mode="edit" slug="winter-stop" source={SOURCE} baseSha="base" />);
    expect(screen.getByLabelText(/^제목/)).toHaveValue("겨울 정류장");
    expect(screen.queryByLabelText(/^주소\(영문\)/)).not.toBeInTheDocument();
    expect(screen.getByText(/수정할 때는 바꿀 수 없습니다/)).toBeInTheDocument();
  });

  it("수정한 내용을 처음 원고 sha와 함께 PUT으로 저장한다(글 쓴 날은 그대로)", async () => {
    const user = userEvent.setup();
    render(<ReviewWriter mode="edit" slug="winter-stop" source={SOURCE} baseSha="base" />);
    await user.clear(screen.getByLabelText(/^한줄평/));
    await user.type(screen.getByLabelText(/^한줄평/), "고친 한줄평");
    await user.click(screen.getByRole("button", { name: "수정한 내용 저장" }));

    await screen.findByRole("heading", { name: "저장했습니다" });
    const [url, init] = callsTo("/api/reviews/winter-stop")[0]!;
    expect(url).toBe("/api/reviews/winter-stop");
    expect(init!.method).toBe("PUT");
    const body = JSON.parse(String(init!.body));
    expect(body.baseSha).toBe("base");
    expect(body.values).toMatchObject({ oneLiner: "고친 한줄평", publishedAt: "2026-11-08" });
  });
});
