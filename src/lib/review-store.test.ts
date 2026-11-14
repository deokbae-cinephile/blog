// @vitest-environment node

/**
 * @file review-store.ts 테스트
 *
 * 추가·수정·삭제가 "어떤 파일을 더하고 지우는 커밋"을 만드는지 확인해요.
 * GitHub와 이야기하는 부분(lib/github.ts)은 가짜로 바꿔, 저장소 모습(파일 목록)을 우리가 정해 줘요.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_VALUES } from "./review-values";
import { deleteReview, isUploadPathFor, readSavePayload, ReviewStoreError, saveReview, type SavePayload } from "./review-store";

/** 가짜 저장소: 파일 경로 → 내용 번호, 그리고 내용 번호 → 글자(원고) */
const repo = vi.hoisted(() => ({ files: new Map<string, string>(), texts: new Map<string, string>(), failTexts: false }));

vi.mock("./github", async (importOriginal) => {
  const original = await importOriginal<typeof import("./github")>();
  return {
    ...original,
    // 새 blob은 "blob-1", "blob-2"처럼 번호를 붙여 돌려줘요. 원고 글자는 기억해 둬요.
    createBlob: vi.fn(async (content: Uint8Array) => {
      const sha = `blob-${repo.texts.size + 1}`;
      repo.texts.set(sha, new TextDecoder().decode(content));
      return sha;
    }),
    readTextBlob: vi.fn(async (sha: string) => repo.texts.get(sha) ?? ""),
    // 원고들을 한 번에 읽는 가짜: 저장소의 원고(.md) 글자를 돌려줘요. failTexts를 켜면 읽기에 실패해요.
    readTextFiles: vi.fn(async () => {
      if (repo.failTexts) throw new Error("원고를 읽지 못함");
      const reviews = [...repo.files].filter(([path]) => path.startsWith("content/reviews/"));
      return new Map(reviews.map(([path, sha]) => [path, repo.texts.get(sha) ?? ""] as const));
    }),
    getSnapshot: vi.fn(async () => ({ commitSha: "c1", treeSha: "t1", files: repo.files })),
    // 바꿀 파일 목록을 만든 뒤 그대로 돌려받으려고, 결과를 lastChanges에 담아 둬요.
    commitChanges: vi.fn(async (_message: string, build: (snapshot: unknown) => unknown) => {
      lastChanges = await build({ commitSha: "c1", treeSha: "t1", files: repo.files });
      return "new-commit";
    }),
  };
});

/** 마지막 커밋에 담긴 바뀐 파일 목록 */
let lastChanges: unknown;

/** 저장소에 원고를 하나 넣어 둬요. */
function seedReview(slug: string, text: string) {
  const sha = `seed-${slug}`;
  repo.files.set(`content/reviews/${slug}.md`, sha);
  repo.texts.set(sha, text);
  return sha;
}

/** 꼭 필요한 칸을 채운 저장 요청 */
const payload = (values: Partial<SavePayload["values"]> = {}, uploads: SavePayload["uploads"] = []): SavePayload => ({
  values: {
    ...EMPTY_VALUES,
    slug: "winter-stop",
    title: "겨울 정류장",
    year: "2024",
    director: "한서윤",
    genres: ["드라마"],
    rating: "4.5",
    oneLiner: "기다림은 끝내 도착한다.",
    body: "본문",
    ...values,
  },
  uploads,
});

const SHA = "a".repeat(40);

beforeEach(() => {
  repo.files = new Map();
  repo.texts = new Map();
  repo.failTexts = false;
  lastChanges = undefined;
});

describe("readSavePayload(저장 요청 모양 확인)", () => {
  it("약속한 모양이면 그대로 받고, 모르는 항목은 뺀다", () => {
    const sent = { ...payload({}, [{ path: "public/posters/winter-stop.jpg", sha: SHA, extra: 1 } as never]), baseSha: SHA, extra: "x" };
    const read = readSavePayload({ ...sent, values: { ...sent.values, extra: "x" } });
    expect(read).toEqual({ ...payload({}, [{ path: "public/posters/winter-stop.jpg", sha: SHA }]), baseSha: SHA });
    // 새 글처럼 baseSha가 없어도 돼요.
    expect(readSavePayload(payload())).toEqual(payload());
  });

  it.each([
    ["JSON이 객체가 아님", null],
    ["칸 값이 없음", { uploads: [] }],
    ["글자 칸에 숫자", { ...payload(), values: { ...payload().values, year: 2024 } }],
    ["칸이 빠짐", { ...payload(), values: { ...payload().values, title: undefined } }],
    ["장르가 목록이 아님", { ...payload(), values: { ...payload().values, genres: "드라마" } }],
    ["장르가 너무 많음", { ...payload(), values: { ...payload().values, genres: Array(21).fill("드라마") } }],
    ["본문이 20만 글자 넘음", { ...payload(), values: { ...payload().values, body: "가".repeat(200_001) } }],
    ["올린 사진 목록이 아님", { ...payload(), uploads: "x" }],
    ["올린 사진이 51장", payload({}, Array(51).fill({ path: "p", sha: SHA }))],
    ["올린 사진의 sha가 글자가 아님", payload({}, [{ path: "p", sha: 1 } as never])],
    ["baseSha가 글자가 아님", { ...payload(), baseSha: 1 }],
  ])("%s이면 null", (_name, input) => {
    expect(readSavePayload(input)).toBeNull();
  });
});

describe("isUploadPathFor", () => {
  it("이 리뷰의 포스터·장면 사진 경로만 받는다", () => {
    expect(isUploadPathFor("public/posters/winter-stop.jpg", "winter-stop")).toBe(true);
    expect(isUploadPathFor("public/images/winter-stop/scene-1.png", "winter-stop")).toBe(true);
    // 다른 리뷰의 파일은 건드릴 수 없어요.
    expect(isUploadPathFor("public/posters/other.jpg", "winter-stop")).toBe(false);
    expect(isUploadPathFor("public/images/other/scene-1.png", "winter-stop")).toBe(false);
  });
});

describe("saveReview(추가)", () => {
  it("원고와 올린 포스터를 커밋 하나로 더한다", async () => {
    const result = await saveReview(
      "create",
      "winter-stop",
      payload({ poster: "winter-stop.jpg" }, [{ path: "public/posters/winter-stop.jpg", sha: SHA }]),
    );
    expect(result).toEqual({ commitSha: "new-commit", slug: "winter-stop" });
    expect(lastChanges).toEqual([
      { path: "content/reviews/winter-stop.md", sha: "blob-1" },
      { path: "public/posters/winter-stop.jpg", sha: SHA },
    ]);
    // 원고에는 지금 날짜와 시각(한국 시간)이 글 쓴 날로 들어가요(같은 날 쓴 글끼리도 최신순이 맞게).
    expect(repo.texts.get("blob-1")).toMatch(/^---\ntitle: 겨울 정류장\n[\s\S]*publishedAt: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00\nposter: winter-stop.jpg\n---\n\n본문\n$/);
  });

  it("칸이 틀리면 커밋하지 않고 칸별 문구와 함께 422로 알린다", async () => {
    await expect(saveReview("create", "winter-stop", payload({ title: "" }))).rejects.toMatchObject({
      status: 422,
      errors: { title: "한글 제목을 입력하세요. 예: 겨울 정류장" },
    });
    expect(lastChanges).toBeUndefined();
  });

  it("같은 주소의 리뷰가 이미 있으면 409와 주소 칸 문구로 알린다", async () => {
    seedReview("winter-stop", "---\ntitle: 예전\n---\n");
    const error = await saveReview("create", "winter-stop", payload()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ReviewStoreError);
    expect(error).toMatchObject({ status: 409, errors: { slug: expect.stringContaining("이미 같은 주소") } });
  });

  it("본문 사진이 저장소에도 올린 목록에도 없으면 본문 칸에 알린다", async () => {
    const error = await saveReview("create", "winter-stop", payload({ body: "![빛](/images/winter-stop/scene-1.jpg)" })).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ status: 422, errors: { body: expect.stringContaining("/images/winter-stop/scene-1.jpg") } });
  });

  it("참조형 사진(![설명][이름])도 빌드와 같은 규칙으로 검사해, 바깥 주소면 저장하지 않는다", async () => {
    const body = "![장면][a]\n\n[a]: https://example.com/a.jpg";
    const error = await saveReview("create", "winter-stop", payload({ body })).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ status: 422, errors: { body: expect.stringContaining("/로 시작하는 주소") } });
    expect(lastChanges).toBeUndefined();
  });

  it("다른 리뷰의 경로로 올린 파일은 받지 않는다", async () => {
    await expect(
      saveReview("create", "winter-stop", payload({}, [{ path: "public/posters/other.jpg", sha: SHA }])),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("saveReview(수정)", () => {
  const OLD = "---\ntitle: 겨울\nposter: winter-stop.jpg\n---\n\n![a](/images/winter-stop/old.jpg)\n";

  it("그사이 다른 곳에서 고쳤으면(처음 sha와 다르면) 덮어쓰지 않는다", async () => {
    seedReview("winter-stop", OLD);
    await expect(saveReview("update", "winter-stop", { ...payload(), baseSha: "different" })).rejects.toMatchObject({ status: 409 });
  });

  it("없는 리뷰를 고치려 하면 404로 알린다", async () => {
    await expect(saveReview("update", "winter-stop", payload())).rejects.toMatchObject({ status: 404 });
  });

  it("처음 불러온 원고 번호(baseSha) 없이 고치려 하면 덮어쓰지 않고 400으로 알린다", async () => {
    seedReview("winter-stop", OLD);
    await expect(saveReview("update", "winter-stop", payload())).rejects.toMatchObject({ status: 400 });
    expect(lastChanges).toBeUndefined();
  });

  it("다른 리뷰 원고가 쓰는 예전 포스터와 장면 사진은 지우지 않는다", async () => {
    const sha = seedReview("winter-stop", OLD);
    repo.files.set("public/posters/winter-stop.jpg", "p1");
    repo.files.set("public/images/winter-stop/old.jpg", "i1");
    // 다른 리뷰가 이 리뷰의 포스터와 장면 사진을 가져다 써요.
    seedReview("other", "---\ntitle: 다른 리뷰\nposter: winter-stop.jpg\n---\n\n![빌린 장면](/images/winter-stop/old.jpg)\n");

    await saveReview("update", "winter-stop", { ...payload({ poster: "", body: "새 본문" }), baseSha: sha });
    expect(lastChanges).toEqual([{ path: "content/reviews/winter-stop.md", sha: expect.stringMatching(/^blob-/) }]);
  });

  it("다른 리뷰 원고가 %6F처럼 인코딩해 적은 사진 주소도 알아보고 지우지 않는다", async () => {
    const sha = seedReview("winter-stop", OLD);
    repo.files.set("public/images/winter-stop/old.jpg", "i1");
    seedReview("other", "---\ntitle: 다른 리뷰\n---\n\n![빌린 장면](/images/winter-stop/%6Fld.jpg)\n");

    await saveReview("update", "winter-stop", { ...payload({ poster: "", body: "새 본문" }), baseSha: sha });
    expect(lastChanges).toEqual([{ path: "content/reviews/winter-stop.md", sha: expect.stringMatching(/^blob-/) }]);
  });

  it("다른 리뷰 원고를 읽지 못하면 안전하게 아무 파일도 지우지 않는다", async () => {
    const sha = seedReview("winter-stop", OLD);
    repo.files.set("public/images/winter-stop/old.jpg", "i1");
    repo.failTexts = true;

    await saveReview("update", "winter-stop", { ...payload({ poster: "", body: "새 본문" }), baseSha: sha });
    expect(lastChanges).toEqual([{ path: "content/reviews/winter-stop.md", sha: expect.stringMatching(/^blob-/) }]);
  });

  it("더 쓰지 않는 이 리뷰의 예전 포스터와 장면 사진은 지운다", async () => {
    const sha = seedReview("winter-stop", OLD);
    repo.files.set("public/posters/winter-stop.jpg", "p1");
    repo.files.set("public/images/winter-stop/old.jpg", "i1");
    repo.files.set("public/images/winter-stop/keep.jpg", "i2");
    // 다른 리뷰의 파일은 그대로 둬야 해요.
    repo.files.set("public/images/other/old.jpg", "i3");

    await saveReview("update", "winter-stop", {
      ...payload({ poster: "", body: "![남길 사진](/images/winter-stop/keep.jpg)" }),
      baseSha: sha,
    });

    expect(lastChanges).toEqual([
      // 새 원고 blob(가짜 저장소가 붙인 번호라 모양만 확인해요)
      { path: "content/reviews/winter-stop.md", sha: expect.stringMatching(/^blob-/) },
      { path: "public/posters/winter-stop.jpg", sha: null },
      { path: "public/images/winter-stop/old.jpg", sha: null },
    ]);
  });
});

describe("deleteReview", () => {
  it("원고와 이 리뷰의 포스터·장면 사진을 지운다(다른 리뷰와 함께 쓰는 포스터는 남긴다)", async () => {
    seedReview("winter-stop", "---\ntitle: 겨울 정류장\nposter: winter-stop.jpg\n---\n");
    repo.files.set("public/posters/winter-stop.jpg", "p1");
    repo.files.set("public/images/winter-stop/a.jpg", "i1");

    expect(await deleteReview("winter-stop")).toEqual({ commitSha: "new-commit", title: "겨울 정류장" });
    expect(lastChanges).toEqual([
      { path: "content/reviews/winter-stop.md", sha: null },
      { path: "public/posters/winter-stop.jpg", sha: null },
      { path: "public/images/winter-stop/a.jpg", sha: null },
    ]);

    seedReview("alpha", "---\ntitle: 알파\nposter: test-pattern.png\n---\n");
    repo.files.set("public/posters/test-pattern.png", "p2");
    await deleteReview("alpha");
    expect(lastChanges).toEqual([{ path: "content/reviews/alpha.md", sha: null }]);
  });

  it("다른 리뷰 원고가 쓰는 사진은 남기고, 쓰지 않는 사진만 지운다", async () => {
    seedReview("winter-stop", "---\ntitle: 겨울 정류장\n---\n");
    repo.files.set("public/images/winter-stop/shared.jpg", "i1");
    repo.files.set("public/images/winter-stop/alone.jpg", "i2");
    seedReview("other", "---\ntitle: 다른 리뷰\n---\n\n![함께 쓰는 장면](/images/winter-stop/shared.jpg)\n");

    await deleteReview("winter-stop");
    expect(lastChanges).toEqual([
      { path: "content/reviews/winter-stop.md", sha: null },
      { path: "public/images/winter-stop/alone.jpg", sha: null },
    ]);
  });

  it("없는 리뷰를 지우려 하면 404로 알린다", async () => {
    await expect(deleteReview("nothing")).rejects.toMatchObject({ status: 404 });
  });
});
