// @vitest-environment node

/**
 * @file 사진 올리기 API 테스트 (app/api/images/route.ts)
 *
 * 로그인했는지, 경로·크기·형식이 맞는지 확인한 뒤에만 GitHub에 blob을 올리는지 봐요.
 * GitHub에 올리는 함수(createBlob)는 가짜로 바꿔요.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBlob } from "@/lib/github";
import { createSessionToken } from "@/lib/session";
import { MAX_IMAGE_BYTES } from "@/lib/upload-rules";

import { POST } from "./route";

vi.mock("@/lib/github", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/github")>()),
  createBlob: vi.fn(async () => "b".repeat(40)),
}));

const SECRET = "test-secret-0123456789-abcdefghij-klmnop";

/** 사진 올리기 요청을 만들어요. login: 세션 쿠키를 붙일지 */
async function uploadRequest(file: Blob, filePath: string, login = true) {
  const form = new FormData();
  form.append("file", file, path.basename(filePath));
  form.append("path", filePath);
  const cookie = login ? `blog_session=${await createSessionToken("deokbae", SECRET)}` : "";
  return new NextRequest("http://localhost/api/images", { method: "POST", headers: { origin: "http://localhost", cookie }, body: form });
}

/** 진짜 PNG 그림(시험용 화면 조정 무늬) */
const png = async () => new Blob([await readFile(path.resolve("public/posters/test-pattern.png"))], { type: "image/png" });

describe("POST /api/images", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.stubEnv("ADMIN_ID", "deokbae");
    vi.mocked(createBlob).mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("로그인했고 형식이 맞으면 blob으로 올리고 경로와 번호를 돌려준다", async () => {
    const response = await POST(await uploadRequest(await png(), "public/images/winter-stop/scene-1.png"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ path: "public/images/winter-stop/scene-1.png", sha: "b".repeat(40) });
    expect(createBlob).toHaveBeenCalledOnce();
  });

  it("로그인하지 않았으면 401", async () => {
    const response = await POST(await uploadRequest(await png(), "public/images/winter-stop/scene-1.png", false));
    expect(response.status).toBe(401);
    expect(createBlob).not.toHaveBeenCalled();
  });

  it("저장 경로가 규칙에 맞지 않으면 400", async () => {
    const response = await POST(await uploadRequest(await png(), "public/images/../secret.png"));
    expect(response.status).toBe(400);
  });

  it("4MB보다 크면 413", async () => {
    const big = new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)], { type: "image/png" });
    const response = await POST(await uploadRequest(big, "public/images/winter-stop/scene-1.png"));
    expect(response.status).toBe(413);
  });

  it("그림이 아니거나 확장자와 실제 형식이 다르면 415", async () => {
    const text = new Blob(["그림이 아니에요"], { type: "image/png" });
    expect((await POST(await uploadRequest(text, "public/images/winter-stop/scene-1.png"))).status).toBe(415);
    // 진짜 PNG를 .jpg라고 우겨도 받지 않아요.
    expect((await POST(await uploadRequest(await png(), "public/images/winter-stop/scene-1.jpg"))).status).toBe(415);
    expect(createBlob).not.toHaveBeenCalled();
  });
});
