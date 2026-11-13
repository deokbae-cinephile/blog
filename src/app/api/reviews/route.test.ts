// @vitest-environment node

/**
 * @file 리뷰 추가·수정·삭제 API 테스트 (app/api/reviews/route.ts, app/api/reviews/[slug]/route.ts)
 *
 * API가 로그인과 보낸 내용의 모양을 확인하고, 실제 일은 lib/review-store.ts에 맡기는지 봐요.
 * 저장 함수는 가짜로 바꿔서, 받은 값과 돌려줄 결과를 우리가 정해요.
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_VALUES } from "@/lib/review-file";
import { deleteReview, ReviewStoreError, saveReview } from "@/lib/review-store";
import { createSessionToken } from "@/lib/session";

import { DELETE, PUT } from "./[slug]/route";
import { POST } from "./route";

vi.mock("@/lib/review-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/review-store")>()),
  saveReview: vi.fn(async (_mode: string, slug: string) => ({ commitSha: "c", slug })),
  deleteReview: vi.fn(async () => ({ commitSha: "c", title: "겨울 정류장" })),
}));

const SECRET = "test-secret-0123456789-abcdefghij-klmnop";
/** 올바른 모양의 저장 요청 내용 */
const body = { values: { ...EMPTY_VALUES, slug: "winter-stop", title: "겨울 정류장" }, uploads: [] };

/** 요청을 만들어요. login: 세션 쿠키를 붙일지 */
async function request(method: string, url: string, data?: unknown, login = true) {
  const cookie = login ? `blog_session=${await createSessionToken("deokbae", SECRET)}` : "";
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { origin: "http://localhost", cookie, "content-type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

/** [slug] 라우트에 넘길 두 번째 매개변수(params는 Promise예요) */
const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("리뷰 API", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.stubEnv("ADMIN_ID", "deokbae");
    vi.mocked(saveReview).mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("POST: 새 리뷰를 칸에 적은 주소로 저장하고 201로 답한다", async () => {
    const response = await POST(await request("POST", "/api/reviews", body));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ commitSha: "c", slug: "winter-stop" });
    expect(saveReview).toHaveBeenCalledWith("create", "winter-stop", expect.objectContaining({ uploads: [] }));
  });

  it("로그인하지 않았거나 다른 사이트에서 보낸 요청은 저장하지 않는다", async () => {
    expect((await POST(await request("POST", "/api/reviews", body, false))).status).toBe(401);
    const forged = new NextRequest("http://localhost/api/reviews", { method: "POST", headers: { origin: "https://evil.example" }, body: "{}" });
    expect((await POST(forged)).status).toBe(403);
    expect(saveReview).not.toHaveBeenCalled();
  });

  it("보낸 내용의 모양이 틀리면 400", async () => {
    expect((await POST(await request("POST", "/api/reviews", { values: { title: 1 } }))).status).toBe(400);
  });

  it("저장소 쪽에서 막히면 그 상태 번호와 칸별 문구를 그대로 돌려준다", async () => {
    vi.mocked(saveReview).mockRejectedValueOnce(new ReviewStoreError(409, "같은 주소의 리뷰가 이미 있습니다.", { slug: "이미 있어요" }));
    const response = await POST(await request("POST", "/api/reviews", body));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: "같은 주소의 리뷰가 이미 있습니다.", errors: { slug: "이미 있어요" } });
  });

  it("PUT: 수정은 칸의 주소가 아니라 화면 주소(slug)로 저장한다", async () => {
    const response = await PUT(await request("PUT", "/api/reviews/winter-stop", { ...body, values: { ...body.values, slug: "other" }, baseSha: "s" }), ctx("winter-stop"));
    expect(response.status).toBe(200);
    expect(saveReview).toHaveBeenCalledWith("update", "winter-stop", expect.objectContaining({ baseSha: "s" }));
  });

  it("DELETE: 리뷰를 지우고 제목을 돌려준다", async () => {
    const response = await DELETE(await request("DELETE", "/api/reviews/winter-stop"), ctx("winter-stop"));
    expect(await response.json()).toEqual({ commitSha: "c", title: "겨울 정류장" });
    expect(deleteReview).toHaveBeenCalledWith("winter-stop");
  });
});
