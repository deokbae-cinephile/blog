/**
 * @file 조회수 API 테스트 (app/api/views/route.ts, app/api/views/[slug]/route.ts)
 *
 * - GET /api/views: 모든 리뷰의 조회수와 총 조회수를 돌려주고, 저장해 두지 않게(no-store) 하는지
 * - POST /api/views/<주소>: 로그인하지 않은 사람이면 세고, 글쓴이(세션 쿠키)면 세지 않는지
 * - 같은 사람(접속 주소 + 브라우저)이 곧바로 다시 보면 세지 않고, 다른 사람이면 세는지
 * - 다른 사이트에서 보낸 요청(403)과 틀린 주소(400)를 막는지
 * - 빌드할 때 올라가 있지 않은 주소(404)는 세지 않고, 저장소에 줄도 만들지 않는지
 * 확인해요. 저장소는 내 컴퓨터처럼 메모리 저장소를 써요(lib/view-store.ts). 시험마다 다른 리뷰 주소를 써요.
 * 올라가 있는 리뷰 목록(DMB_REVIEW_SLUGS, 빌드할 때 next.config.ts가 넣어 줘요)은 vi.stubEnv로 정해요.
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionToken } from "@/lib/session";

import { GET as getOne, POST } from "./[slug]/route";
import { GET as getAll } from "./route";

const SECRET = "test-secret-0123456789-abcdefghij-klmnop";

/** 올라가 있는 것으로 볼 리뷰 주소들(시험마다 다른 주소를 써요) */
const PUBLISHED = ["api-alpha", "api-beta", "api-gamma", "api-delta", "api-epsilon", "api-zeta"];

/** 조회수를 세는 요청. who: 접속 주소, login: 글쓴이 세션 쿠키를 붙일지, origin: 보낸 곳 */
async function countRequest(slug: string, { who = "203.0.113.1", login = false, origin = "http://localhost" } = {}) {
  const cookie = login ? `blog_session=${await createSessionToken("deokbae", SECRET)}` : "";
  return new NextRequest(`http://localhost/api/views/${slug}`, {
    method: "POST",
    headers: { origin, cookie, "x-forwarded-for": who, "user-agent": "vitest" },
  });
}

/** [slug] 라우트에 넘길 두 번째 매개변수(params는 Promise예요) */
const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("조회수 API", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.stubEnv("ADMIN_ID", "deokbae");
    vi.stubEnv("DMB_REVIEW_SLUGS", PUBLISHED.join(","));
  });
  afterEach(() => vi.unstubAllEnvs());

  it("POST: 로그인하지 않은 사람이 보면 세고, 센 뒤의 조회수·총 조회수를 돌려준다", async () => {
    const response = await POST(await countRequest("api-alpha"), ctx("api-alpha"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ count: 1, counted: true });
  });

  it("POST: 같은 사람이 곧바로 다시 보면 세지 않고, 다른 사람이면 센다", async () => {
    await POST(await countRequest("api-beta"), ctx("api-beta"));
    expect(await (await POST(await countRequest("api-beta"), ctx("api-beta"))).json()).toMatchObject({ count: 1, counted: false });
    expect(await (await POST(await countRequest("api-beta", { who: "203.0.113.2" }), ctx("api-beta"))).json()).toMatchObject({
      count: 2,
      counted: true,
    });
  });

  it("POST: 글쓴이로 로그인했으면 세지 않고 지금 숫자만 돌려준다", async () => {
    const response = await POST(await countRequest("api-gamma", { login: true }), ctx("api-gamma"));
    expect(await response.json()).toMatchObject({ count: 0, counted: false });
  });

  it("POST: 다른 사이트에서 보낸 요청은 403, 틀린 주소는 400으로 막는다", async () => {
    expect((await POST(await countRequest("api-delta", { origin: "https://evil.example" }), ctx("api-delta"))).status).toBe(403);
    expect((await POST(await countRequest("Bad_Slug"), ctx("Bad_Slug"))).status).toBe(400);
  });

  it("POST: 올라가 있지 않은 주소는 404로 막고, 저장소에 새 줄을 만들지 않는다", async () => {
    const response = await POST(await countRequest("not-published"), ctx("not-published"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "없는 리뷰입니다." });
    const body = (await (await getAll()).json()) as { counts: Record<string, number> };
    expect(body.counts).not.toHaveProperty("not-published");
  });

  it("GET /api/views/<주소>: 세지 않고 읽기만 한다", async () => {
    await POST(await countRequest("api-epsilon"), ctx("api-epsilon"));
    const request = new NextRequest("http://localhost/api/views/api-epsilon");
    expect(await (await getOne(request, ctx("api-epsilon"))).json()).toMatchObject({ count: 1, counted: false });
    expect(await (await getOne(request, ctx("api-epsilon"))).json()).toMatchObject({ count: 1 });
  });

  it("GET /api/views: 모든 리뷰의 조회수와 총 조회수를 저장해 두지 않게(no-store) 돌려준다", async () => {
    await POST(await countRequest("api-zeta"), ctx("api-zeta"));
    const response = await getAll();
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as { counts: Record<string, number>; total: number };
    expect(body.counts["api-zeta"]).toBe(1);
    // 총 조회수는 리뷰마다의 조회수를 모두 더한 것과 같아요(이 서버에서 센 것만 있으니까요).
    expect(body.total).toBe(Object.values(body.counts).reduce((sum, count) => sum + count, 0));
  });
});
