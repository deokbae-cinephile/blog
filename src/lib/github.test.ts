// @vitest-environment node

/**
 * @file github.ts 테스트
 *
 * 진짜 GitHub에 요청을 보내지 않고, fetch를 가짜로 바꿔(vi.stubGlobal) 주고받는 순서와 내용을 확인해요.
 *   - 최신 커밋 → 트리 읽기 → 새 트리 → 새 커밋 → 브랜치 옮기기 순서로 부르는지
 *   - 그사이 다른 커밋이 올라와 브랜치를 못 옮기면(422) 한 번 더 시도하는지
 *   - 실패 응답을 글쓴이가 고칠 수 있는 한국어 문구로 바꾸는지
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { commitChanges, createBlob, getSnapshot, GitHubError, isGitHubConfigured, readTextBlob } from "./github";

/** 가짜 fetch가 받은 요청 기록: [방법, 주소 뒷부분, 보낸 내용] */
let calls: [string, string, unknown][];
/** 브랜치 옮기기(PATCH)에 몇 번 실패시킬지 */
let refFailures: number;

/** 주소와 방법에 따라 GitHub처럼 답하는 가짜 fetch */
function fakeGitHub(url: string, init: RequestInit = {}) {
  const method = init.method ?? "GET";
  const path = url.replace("https://api.github.com/repos/deokbae-cinephile/blog", "");
  const body = init.body ? JSON.parse(String(init.body)) : undefined;
  calls.push([method, path, body]);
  const json = (data: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status }));

  if (path === "/git/ref/heads/main") return json({ object: { sha: `commit-${calls.length}` } });
  if (path.startsWith("/git/commits/")) return json({ tree: { sha: "base-tree" } });
  if (path === "/git/trees/base-tree?recursive=1") {
    return json({ truncated: false, tree: [{ path: "content/reviews/a.md", type: "blob", sha: "sha-a" }, { path: "content", type: "tree", sha: "t" }] });
  }
  if (path === "/git/blobs" && method === "POST") return json({ sha: "new-blob" }, 201);
  if (path.startsWith("/git/blobs/")) return json({ content: Buffer.from("한글 원고").toString("base64"), encoding: "base64" });
  if (path === "/git/trees" && method === "POST") return json({ sha: "new-tree" }, 201);
  if (path === "/git/commits" && method === "POST") return json({ sha: "new-commit" }, 201);
  if (path === "/git/refs/heads/main" && method === "PATCH") {
    if (refFailures > 0) {
      refFailures -= 1;
      return json({ message: "Update is not a fast forward" }, 422);
    }
    return json({ object: { sha: "new-commit" } });
  }
  return json({ message: "Not Found" }, 404);
}

describe("github", () => {
  beforeEach(() => {
    calls = [];
    refFailures = 0;
    vi.stubEnv("GITHUB_CONTENT_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn(fakeGitHub));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("토큰이 있으면 설정된 것으로 보고, 요청에 토큰과 API 판 번호를 붙인다", async () => {
    expect(isGitHubConfigured()).toBe(true);
    await getSnapshot();
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-token", "X-GitHub-Api-Version": "2022-11-28" });
  });

  it("최신 커밋의 파일 목록(폴더 제외)을 읽는다", async () => {
    const snapshot = await getSnapshot();
    expect(snapshot.treeSha).toBe("base-tree");
    expect([...snapshot.files]).toEqual([["content/reviews/a.md", "sha-a"]]);
  });

  it("글자 파일은 UTF-8로 읽고, 파일 내용은 base64로 올린다", async () => {
    expect(await readTextBlob("sha-a")).toBe("한글 원고");
    expect(await createBlob(new TextEncoder().encode("hi"))).toBe("new-blob");
    expect(calls.at(-1)).toEqual(["POST", "/git/blobs", { content: Buffer.from("hi").toString("base64"), encoding: "base64" }]);
  });

  it("바뀐 파일을 커밋 하나로 올린다(지울 파일은 sha: null)", async () => {
    const sha = await commitChanges("리뷰 쓰기: 겨울", () => [
      { path: "content/reviews/b.md", sha: "blob-b" },
      { path: "content/reviews/a.md", sha: null },
    ]);
    expect(sha).toBe("new-commit");
    expect(calls.map(([method, path]) => `${method} ${path}`)).toEqual([
      "GET /git/ref/heads/main",
      "GET /git/commits/commit-1",
      "GET /git/trees/base-tree?recursive=1",
      "POST /git/trees",
      "POST /git/commits",
      "PATCH /git/refs/heads/main",
    ]);
    expect(calls[3]![2]).toEqual({
      base_tree: "base-tree",
      tree: [
        { path: "content/reviews/b.md", mode: "100644", type: "blob", sha: "blob-b" },
        { path: "content/reviews/a.md", mode: "100644", type: "blob", sha: null },
      ],
    });
    // 남의 커밋을 덮어쓰지 않게 force: false로 옮겨요.
    expect(calls[5]![2]).toEqual({ sha: "new-commit", force: false });
  });

  it("그사이 다른 커밋이 올라와 브랜치를 못 옮기면(422) 최신 모습으로 한 번 더 시도한다", async () => {
    refFailures = 1;
    const build = vi.fn(() => [{ path: "content/reviews/b.md", sha: "blob-b" }]);
    expect(await commitChanges("고치기", build)).toBe("new-commit");
    // 바꿀 파일 목록도 최신 모습으로 다시 만들어요.
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("두 번 모두 못 옮기면 포기하고 알린다", async () => {
    refFailures = 2;
    await expect(commitChanges("고치기", () => [])).rejects.toBeInstanceOf(GitHubError);
  });

  it.each([
    [401, "토큰이 맞지 않거나 기한이 지났습니다"],
    [403, "Contents: Read and write 권한"],
    [404, "Contents: Read and write 권한"],
    [500, "잠시 뒤 다시 시도해 주세요"],
  ])("GitHub가 %i로 답하면 고치는 방법을 알려 준다", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status }))));
    await expect(getSnapshot()).rejects.toThrow(message);
  });

  it("GitHub에 닿지 못하면 502로, 토큰이 없으면 503으로 알린다", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("fetch failed"))));
    await expect(getSnapshot()).rejects.toMatchObject({ status: 502 });

    vi.stubEnv("GITHUB_CONTENT_TOKEN", "");
    expect(isGitHubConfigured()).toBe(false);
    await expect(getSnapshot()).rejects.toMatchObject({ status: 503 });
  });
});
