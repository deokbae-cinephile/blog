/**
 * @file GitHub 저장소에 원고 읽고 쓰기 (github.ts)
 *
 * 이 파일이 하는 일
 *   리뷰 원고(.md)와 포스터·장면 사진은 모두 GitHub 저장소에 파일로 들어 있어요.
 *   글쓴이가 글쓰기 화면에서 저장하면, 서버가 이 파일의 함수로 저장소에 "커밋"을 만들어 올려요.
 *   그러면 GitHub Actions가 바뀐 저장소를 검사한 뒤 Cloudflare에 다시 배포해서, 몇 분 뒤 새 글이 보여요.
 *
 * 왜 데이터베이스가 아니라 저장소에 저장하나요?
 *   - 원고가 그냥 Markdown 파일이라 어디서든 열어 보고 고칠 수 있어요.
 *   - 저장할 때마다 커밋 기록이 남아서, 실수로 지운 글도 기록에서 되살릴 수 있어요.
 *   - 버전 백업(태그)에 원고와 사진이 함께 들어가요. 따로 챙길 데이터베이스가 없어요.
 *
 * 쓰는 GitHub 기능(Git Data API)
 *   파일 여러 개(원고 + 포스터 + 장면 사진)를 "커밋 하나"로 한 번에 올리려고 낮은 단계의 API를 써요.
 *     1. 브랜치(main)가 가리키는 최신 커밋과 그 커밋의 파일 목록(트리)을 읽어요.      → getSnapshot
 *     2. 새 파일 내용을 blob(파일 덩어리)으로 올려요.                                 → createBlob
 *     3. "최신 트리 + 바뀐 파일"로 새 트리를 만들고, 그 트리로 새 커밋을 만들어요.        → commitChanges
 *     4. 브랜치가 새 커밋을 가리키게 옮겨요. 그사이 누가 먼저 올렸으면 1번부터 한 번 더 해요.
 *
 * 필요한 서버 설정(환경 변수)
 *   - GITHUB_CONTENT_TOKEN: 이 저장소 하나에만 "Contents: Read and write" 권한을 준 GitHub 토큰
 *   - GITHUB_REPOSITORY(없어도 됨): "주인/이름". 없으면 lib/site.ts의 repo를 써요.
 *   - GITHUB_BRANCH(없어도 됨): 없으면 lib/site.ts의 branch(main)를 써요.
 *   - GITHUB_API_URL(없어도 됨): E2E 테스트가 가짜 GitHub 서버(e2e/mock-github.mjs)를 가리킬 때만 써요.
 *   토큰은 서버에만 있고 브라우저로는 절대 보내지 않아요.
 *
 * 누가 쓰나요?
 *   lib/review-store.ts(리뷰 저장·삭제), app/api/images/route.ts(사진 올리기), app/write/[slug]/page.tsx(고칠 원고 읽기)
 */

import "server-only";

import { site } from "./site";

/** GitHub와 이야기하다 생긴 문제. status는 화면에 돌려줄 HTTP 상태 번호예요. */
export class GitHubError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

/** 저장소의 한 시점(최신 커밋) 모습: 커밋 번호, 트리 번호, 파일 목록(경로 → 파일 내용 번호 sha) */
export type RepoSnapshot = {
  commitSha: string;
  treeSha: string;
  files: ReadonlyMap<string, string>;
};

/** 파일 하나의 바뀜. sha가 null이면 그 파일을 지워요. */
export type FileChange = { path: string; sha: string | null };

/** 서버 설정을 읽어요. 토큰이 없으면 null(저장 기능을 쓸 수 없어요). */
function readConfig() {
  const token = process.env.GITHUB_CONTENT_TOKEN ?? "";
  if (token === "") return null;
  // "주인/이름"을 / 기준으로 나눠요.
  const [owner, name] = (process.env.GITHUB_REPOSITORY ?? `${site.repo.owner}/${site.repo.name}`).split("/");
  return {
    token,
    owner,
    name,
    branch: process.env.GITHUB_BRANCH ?? site.repo.branch,
    // 끝의 /는 지워 둬요. 주소를 이어 붙일 때 //가 생기지 않게요.
    api: (process.env.GITHUB_API_URL ?? "https://api.github.com").replace(/\/$/, ""),
  };
}

/** 저장 기능을 쓸 수 있게 설정되어 있는지 알려 줘요(글쓰기 화면이 안내 문구를 보여 줄 때 써요). */
export function isGitHubConfigured(): boolean {
  return readConfig() !== null;
}

/** GitHub의 실패 응답을 글쓴이가 알아듣고 고칠 수 있는 한국어 문구로 바꿔요. */
function describeFailure(status: number): string {
  if (status === 401) return "서버의 GitHub 토큰이 맞지 않거나 기한이 지났습니다. 새 토큰을 만들어 GITHUB_CONTENT_TOKEN에 넣어 주세요.";
  if (status === 403 || status === 404) {
    return "서버의 GitHub 토큰으로 저장소에 쓸 수 없습니다. 토큰에 이 저장소의 Contents: Read and write 권한을 주었는지 확인해 주세요.";
  }
  if (status >= 500) return "GitHub가 잠시 응답하지 않습니다. 잠시 뒤 다시 시도해 주세요.";
  return `GitHub가 요청을 받지 않았습니다(응답 ${status}). 잠시 뒤 다시 시도해 주세요.`;
}

/**
 * 저장소 API에 요청을 보내고 JSON 답을 돌려줘요. 실패하면 GitHubError를 던져요.
 *
 * @param path "/git/..."처럼 저장소 주소 뒤에 붙일 경로
 * @param init 요청 방법(method)과 보낼 내용(body). 없으면 GET
 */
async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  return send<T>((config) => `${config.api}/repos/${config.owner}/${config.name}${path}`, init);
}

/**
 * GitHub API에 요청을 보내는 공통 부분이에요. 저장소 API(call)와 GraphQL(readTextFiles)이 함께 써요.
 *
 * @param url 설정을 받아 요청 주소를 만드는 함수
 * @param init 요청 방법(method)과 보낼 내용(body). 없으면 GET
 */
async function send<T>(url: (config: NonNullable<ReturnType<typeof readConfig>>) => string, init: { method?: string; body?: unknown }): Promise<T> {
  const config = readConfig();
  if (!config) throw new GitHubError(503, "서버에 GitHub 토큰(GITHUB_CONTENT_TOKEN)이 없어 저장할 수 없습니다. .env.example을 보고 설정해 주세요.");

  let response: Response;
  try {
    response = await fetch(url(config), {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        // GitHub가 권하는 API 판 번호. 답의 모양이 갑자기 바뀌지 않게 정해 둬요.
        "X-GitHub-Api-Version": "2022-11-28",
        // GitHub API는 User-Agent(누가 보낸 요청인지)가 없는 요청을 거절해요.
        // Node.js의 fetch는 알아서 붙이지만 Cloudflare Workers의 fetch는 붙이지 않아서 직접 적어요.
        "User-Agent": "deokbae-blog",
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      // 저장소의 최신 상태가 필요해서, 예전에 받은 답을 다시 쓰지 않아요.
      cache: "no-store",
    });
  } catch {
    // 인터넷이 끊기는 등 GitHub에 닿지 못했어요.
    throw new GitHubError(502, "GitHub에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  }
  if (!response.ok) throw new GitHubError(response.status, describeFailure(response.status));
  return (await response.json()) as T;
}

/** GraphQL로 폴더 안 파일들의 글자를 한꺼번에 받는 질의. 그림 같은 파일은 text가 null로 와요. */
const TREE_TEXTS_QUERY = `query($owner: String!, $name: String!, $expression: String!) {
  repository(owner: $owner, name: $name) {
    object(expression: $expression) {
      ... on Tree { entries { name type object { ... on Blob { text } } } }
    }
  }
}`;

/** TREE_TEXTS_QUERY의 답 모양 */
type TreeTextsAnswer = {
  data?: { repository?: { object?: { entries?: { name: string; type: string; object?: { text?: string | null } | null }[] } | null } | null };
  errors?: unknown[];
};

/**
 * 커밋 하나에서 폴더 안 글자 파일들을 한 번에 읽어요(GraphQL 요청 하나).
 *
 * 왜 한 번에 읽나요?
 *   파일마다 따로 요청하면 리뷰가 많아질수록 요청도 늘어요. Cloudflare Workers 무료 플랜은
 *   요청 하나를 처리하는 동안 바깥으로 보낼 수 있는 요청이 50개까지라, 한 번에 읽어야 안전해요.
 *
 * @param commitSha 읽을 커밋 번호(getSnapshot의 commitSha)
 * @param dir 폴더 경로. 예: "content/reviews"
 * @returns 파일 경로 → 글자. 바로 아래 파일만 담고, 글자로 읽을 수 없는 파일은 빼요.
 */
export async function readTextFiles(commitSha: string, dir: string): Promise<Map<string, string>> {
  const answer = await send<TreeTextsAnswer>((config) => `${config.api}/graphql`, {
    method: "POST",
    body: {
      query: TREE_TEXTS_QUERY,
      variables: { owner: readConfig()?.owner, name: readConfig()?.name, expression: `${commitSha}:${dir}` },
    },
  });
  // GraphQL은 실패해도 200으로 답하고 errors에 이유를 담아요.
  if (answer.errors?.length) throw new GitHubError(502, "GitHub가 원고 목록을 돌려주지 않았습니다. 잠시 뒤 다시 시도해 주세요.");
  const files = new Map<string, string>();
  for (const entry of answer.data?.repository?.object?.entries ?? []) {
    const text = entry.object?.text;
    if (entry.type === "blob" && typeof text === "string") files.set(`${dir}/${entry.name}`, text);
  }
  return files;
}

/** 브랜치 이름(설정이 없으면 기본값). 주소에 넣을 때 쓰려고 따로 꺼내 둬요. */
function branch(): string {
  return readConfig()?.branch ?? site.repo.branch;
}

/**
 * 브랜치의 최신 커밋과, 그 커밋에 들어 있는 모든 파일 목록을 읽어요.
 *
 * recursive=1: 폴더 안의 폴더까지 한 번에 받아요. 블로그 저장소는 작아서 한 번이면 충분해요.
 * truncated: 파일이 너무 많아 목록이 잘렸다는 표시예요. 잘린 목록으로 저장하면 위험해서 멈춰요.
 */
export async function getSnapshot(): Promise<RepoSnapshot> {
  const ref = await call<{ object: { sha: string } }>(`/git/ref/heads/${branch()}`);
  const commit = await call<{ tree: { sha: string } }>(`/git/commits/${ref.object.sha}`);
  const tree = await call<{ tree: { path: string; type: string; sha: string }[]; truncated: boolean }>(
    `/git/trees/${commit.tree.sha}?recursive=1`,
  );
  if (tree.truncated) throw new GitHubError(500, "저장소의 파일이 너무 많아 목록을 다 받지 못했습니다.");
  // 폴더(type "tree")는 빼고 파일(type "blob")만 "경로 → sha" 표로 담아요.
  const files = new Map(tree.tree.filter((entry) => entry.type === "blob").map((entry) => [entry.path, entry.sha] as const));
  return { commitSha: ref.object.sha, treeSha: commit.tree.sha, files };
}

/**
 * 파일 내용 번호(sha)로 글자 파일(원고)을 읽어요.
 * GitHub는 내용을 base64로 줘서, Buffer로 풀어 UTF-8 글자로 바꿔요.
 */
export async function readTextBlob(sha: string): Promise<string> {
  const blob = await call<{ content: string; encoding: string }>(`/git/blobs/${sha}`);
  return Buffer.from(blob.content, "base64").toString("utf8");
}

/**
 * 파일 내용을 blob으로 올리고, 그 내용의 번호(sha)를 돌려줘요.
 * 아직 어떤 커밋에도 들어가지 않은 상태라 저장소 화면에는 보이지 않아요. commitChanges가 커밋에 넣어야 보여요.
 *
 * @param content 파일 내용(바이트). 글자 파일도 그림 파일도 base64로 바꿔 보내요.
 */
export async function createBlob(content: Uint8Array): Promise<string> {
  const blob = await call<{ sha: string }>("/git/blobs", {
    method: "POST",
    body: { content: Buffer.from(content).toString("base64"), encoding: "base64" },
  });
  return blob.sha;
}

/**
 * 바뀐 파일들을 커밋 하나로 만들어 브랜치에 올려요.
 *
 * buildChanges에 최신 저장소 모습(snapshot)을 넘겨주면, 그걸 보고 바꿀 파일 목록을 돌려줘야 해요.
 * 그사이 다른 커밋이 먼저 올라가 브랜치를 옮기지 못하면(422), 최신 모습으로 한 번 더 시도해요.
 * buildChanges가 오류를 던지면(예: 주소가 겹침) 커밋하지 않고 그 오류를 그대로 던져요.
 *
 * @param message 커밋 메시지. 예: "리뷰 쓰기: 겨울 정류장"
 * @param buildChanges 최신 모습을 받아 바꿀 파일 목록을 돌려주는 함수
 * @returns 새 커밋의 번호(sha)
 */
export async function commitChanges(
  message: string,
  buildChanges: (snapshot: RepoSnapshot) => FileChange[] | Promise<FileChange[]>,
): Promise<string> {
  // 최대 두 번 시도해요.
  for (let attempt = 1; ; attempt += 1) {
    const snapshot = await getSnapshot();
    const changes = await buildChanges(snapshot);

    // 새 트리: 최신 트리(base_tree)에 바뀐 파일만 덮어써요. sha: null은 "이 경로의 파일을 지워요"라는 뜻이에요.
    // mode "100644"는 "보통 파일"이라는 git의 표시예요.
    const tree = await call<{ sha: string }>("/git/trees", {
      method: "POST",
      body: {
        base_tree: snapshot.treeSha,
        tree: changes.map(({ path, sha }) => ({ path, mode: "100644", type: "blob", sha })),
      },
    });
    // 새 커밋: 부모는 방금 읽은 최신 커밋이에요.
    const commit = await call<{ sha: string }>("/git/commits", {
      method: "POST",
      body: { message, tree: tree.sha, parents: [snapshot.commitSha] },
    });

    try {
      // 브랜치를 새 커밋으로 옮겨요. force: false — 그사이 올라온 남의 커밋을 덮어쓰지 않아요.
      await call(`/git/refs/heads/${branch()}`, { method: "PATCH", body: { sha: commit.sha, force: false } });
      return commit.sha;
    } catch (error) {
      // 422: 그사이 다른 커밋이 올라와서 "앞으로 감기"가 안 됐어요. 한 번만 처음부터 다시 해 봐요.
      if (attempt < 2 && error instanceof GitHubError && error.status === 422) continue;
      throw error;
    }
  }
}
