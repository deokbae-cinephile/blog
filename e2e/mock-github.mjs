/**
 * @file E2E용 가짜 GitHub 서버 (e2e/mock-github.mjs)
 *
 * 이 파일이 하는 일
 *   E2E 테스트에서 글쓰기·고치기·지우기를 끝까지 시험하려면 GitHub 저장소가 필요해요.
 *   진짜 저장소에 시험 커밋을 올릴 수는 없으니, GitHub API처럼 답하는 작은 서버를 띄워요.
 *   블로그 서버는 환경 변수 GITHUB_API_URL로 이 서버를 가리켜요(playwright.config.ts).
 *
 * 흉내 내는 GitHub API(lib/github.ts가 쓰는 것만)
 *   GET   /repos/:주인/:이름/git/ref/heads/main        브랜치의 최신 커밋
 *   GET   /repos/:주인/:이름/git/commits/:sha          커밋의 트리
 *   GET   /repos/:주인/:이름/git/trees/:sha?recursive=1 트리의 파일 목록
 *   POST  /repos/:주인/:이름/git/blobs                 파일 내용 올리기
 *   GET   /repos/:주인/:이름/git/blobs/:sha             파일 내용 읽기
 *   POST  /repos/:주인/:이름/git/trees                 새 트리 만들기(base_tree + 바뀐 파일)
 *   POST  /repos/:주인/:이름/git/commits               새 커밋 만들기
 *   PATCH /repos/:주인/:이름/git/refs/heads/main        브랜치 옮기기
 *
 * 시험용 도구
 *   GET  /__commits : 지금까지 올라온 커밋 목록(메시지, 더한 파일, 지운 파일). 테스트가 결과를 확인할 때 써요.
 *   POST /__reset   : 저장소를 처음 모습으로 되돌려요(테스트를 여러 번 돌려도 결과가 같게).
 *   GET  /__health  : 서버가 떴는지 확인(Playwright가 이 주소가 응답할 때까지 기다려요)
 *
 * 처음 저장소에는 시험용 원고(e2e/fixtures/reviews)와 화면 조정 무늬 포스터가 들어 있어요.
 * 모든 내용은 메모리에만 있어서, 서버를 끄면 사라져요.
 *
 * 실행: node e2e/mock-github.mjs (포트는 MOCK_GITHUB_PORT, 기본 3101)
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

/** 서버 포트 */
const PORT = Number(process.env.MOCK_GITHUB_PORT ?? 3101);
/** 받아 줄 토큰. 블로그 서버의 GITHUB_CONTENT_TOKEN과 같아야 해요. */
const TOKEN = process.env.MOCK_GITHUB_TOKEN ?? "e2e-token";
/** 저장소 주소 앞부분 */
const REPO = "/repos/deokbae-cinephile/blog";

/** 파일 내용 번호(sha) → 내용(Buffer) */
const blobs = new Map();
/** 트리 번호 → 그 트리의 파일 목록(Map: 경로 → 내용 번호) */
const trees = new Map();
/** 커밋 번호 → { message, tree, parent } */
const commits = new Map();
/** 브랜치(main)가 가리키는 커밋 번호 */
let head = "";

/** 내용으로 번호를 만들어요(git처럼 같은 내용이면 같은 번호). */
const hash = (data) => createHash("sha1").update(data).digest("hex");

/** 내용을 저장하고 번호를 돌려줘요. */
function putBlob(buffer) {
  const sha = hash(buffer);
  blobs.set(sha, buffer);
  return sha;
}

/** 파일 목록으로 트리를 만들어 저장하고 번호를 돌려줘요. */
function putTree(files) {
  const sha = hash(JSON.stringify([...files].sort()));
  trees.set(sha, files);
  return sha;
}

/** 처음 저장소: 시험용 원고 + 포스터. 예전 내용은 모두 지우고 새로 만들어요. */
function seed() {
  blobs.clear();
  trees.clear();
  commits.clear();
  const files = new Map();
  const dir = path.resolve("e2e/fixtures/reviews");
  for (const name of readdirSync(dir)) {
    files.set(`content/reviews/${name}`, putBlob(readFileSync(path.join(dir, name))));
  }
  files.set("public/posters/test-pattern.png", putBlob(readFileSync(path.resolve("public/posters/test-pattern.png"))));
  const tree = putTree(files);
  head = hash(`first-commit-${tree}`);
  commits.set(head, { message: "처음 원고", tree, parent: null });
}

/** 요청 본문(JSON)을 읽어요. */
async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

/** JSON으로 답해요. */
function send(response, status, data) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

/** 커밋 하나를 사람이 확인하기 쉬운 모양으로: 부모 커밋 대비 더한(바뀐) 파일과 지운 파일 */
function describeCommit(sha) {
  const commit = commits.get(sha);
  const before = commit.parent ? trees.get(commits.get(commit.parent).tree) : new Map();
  const after = trees.get(commit.tree);
  return {
    message: commit.message,
    added: [...after].filter(([file, blob]) => before.get(file) !== blob).map(([file]) => file),
    deleted: [...before.keys()].filter((file) => !after.has(file)),
    // 원고(.md)는 글자 내용도 함께 보여 줘요(저장한 원고 모양을 확인하려고요).
    texts: Object.fromEntries(
      [...after].filter(([file, blob]) => file.endsWith(".md") && before.get(file) !== blob).map(([file, blob]) => [file, blobs.get(blob).toString("utf8")]),
    ),
  };
}

seed();

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${PORT}`);
  const route = url.pathname;

  // 시험용 도구
  if (route === "/__health") return send(response, 200, { ok: true });
  if (route === "/__reset" && request.method === "POST") {
    seed();
    return send(response, 200, { ok: true });
  }
  if (route === "/__commits") {
    // 처음 커밋부터 지금까지(부모를 따라 거꾸로 모은 뒤 뒤집어요)
    const list = [];
    for (let sha = head; sha && commits.get(sha).parent; sha = commits.get(sha).parent) list.push(describeCommit(sha));
    return send(response, 200, list.reverse());
  }

  // 토큰 확인: 진짜 GitHub처럼 틀리면 401
  if (request.headers.authorization !== `Bearer ${TOKEN}`) return send(response, 401, { message: "Bad credentials" });
  if (!route.startsWith(`${REPO}/git/`)) return send(response, 404, { message: "Not Found" });
  const rest = route.slice(`${REPO}/git/`.length);

  try {
    if (request.method === "GET" && rest === "ref/heads/main") return send(response, 200, { object: { sha: head } });

    if (request.method === "GET" && rest.startsWith("commits/")) {
      const commit = commits.get(rest.slice("commits/".length));
      return commit ? send(response, 200, { tree: { sha: commit.tree } }) : send(response, 404, { message: "Not Found" });
    }

    if (request.method === "GET" && rest.startsWith("trees/")) {
      const files = trees.get(rest.slice("trees/".length));
      if (!files) return send(response, 404, { message: "Not Found" });
      return send(response, 200, { truncated: false, tree: [...files].map(([file, sha]) => ({ path: file, type: "blob", sha })) });
    }

    if (request.method === "POST" && rest === "blobs") {
      const body = await readBody(request);
      return send(response, 201, { sha: putBlob(Buffer.from(body.content, body.encoding === "base64" ? "base64" : "utf8")) });
    }

    if (request.method === "GET" && rest.startsWith("blobs/")) {
      const blob = blobs.get(rest.slice("blobs/".length));
      return blob ? send(response, 200, { content: blob.toString("base64"), encoding: "base64" }) : send(response, 404, { message: "Not Found" });
    }

    if (request.method === "POST" && rest === "trees") {
      const body = await readBody(request);
      const base = trees.get(body.base_tree);
      if (!base) return send(response, 422, { message: "base_tree not found" });
      const files = new Map(base);
      for (const entry of body.tree) {
        if (entry.sha === null) files.delete(entry.path);
        else if (blobs.has(entry.sha)) files.set(entry.path, entry.sha);
        else return send(response, 422, { message: `blob ${entry.sha} not found` });
      }
      return send(response, 201, { sha: putTree(files) });
    }

    if (request.method === "POST" && rest === "commits") {
      const body = await readBody(request);
      const sha = hash(`${body.message}-${body.tree}-${body.parents[0]}-${Date.now()}-${Math.random()}`);
      commits.set(sha, { message: body.message, tree: body.tree, parent: body.parents[0] });
      return send(response, 201, { sha });
    }

    if (request.method === "PATCH" && rest === "refs/heads/main") {
      const body = await readBody(request);
      const commit = commits.get(body.sha);
      // 앞으로 감기만 받아요: 새 커밋의 부모가 지금 브랜치 끝이어야 해요(진짜 GitHub처럼 아니면 422).
      if (!commit || commit.parent !== head) return send(response, 422, { message: "Update is not a fast forward" });
      head = body.sha;
      return send(response, 200, { object: { sha: head } });
    }

    return send(response, 404, { message: "Not Found" });
  } catch (error) {
    return send(response, 500, { message: String(error) });
  }
});

server.listen(PORT, "127.0.0.1", () => console.log(`가짜 GitHub 서버: http://127.0.0.1:${PORT}`));
