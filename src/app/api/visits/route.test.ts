/**
 * @file 방문자 API 테스트 (app/api/visits/route.ts)
 *
 * - POST: 같은 사람은 하루에 한 번만 세고, 다음 날 다시 오면 또 세는지(누적)
 * - POST: 로그인한 글쓴이와 검색엔진 로봇은 세지 않는지, 다른 사이트에서 보낸 요청은 403인지
 * - GET: 누적 방문자 수는 로그인한 글쓴이만 볼 수 있는지(아니면 401), 저장해 두지 않게(no-store) 하는지
 * 확인해요. 저장소는 내 컴퓨터처럼 메모리 저장소를 써요(lib/visit-store.ts). 숫자는 시험마다 늘어난 만큼(차이)으로 봐요.
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionToken } from "@/lib/session";

import { GET, POST } from "./route";

const SECRET = "test-secret-0123456789-abcdefghij-klmnop";
const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/** 세기 요청. who: 접속 주소, login: 글쓴이 세션 쿠키를 붙일지, origin: 보낸 곳, agent: 브라우저 정보 */
async function visitRequest({ who = "203.0.113.1", login = false, origin = "http://localhost", agent = BROWSER } = {}) {
  const cookie = login ? `blog_session=${await createSessionToken("deokbae", SECRET)}` : "";
  return new NextRequest("http://localhost/api/visits", { method: "POST", headers: { origin, cookie, "x-forwarded-for": who, "user-agent": agent } });
}

/** 글쓴이로 누적 방문자 수를 읽어요. */
async function total(): Promise<number> {
  const cookie = `blog_session=${await createSessionToken("deokbae", SECRET)}`;
  const response = await GET(new NextRequest("http://localhost/api/visits", { headers: { cookie } }));
  return ((await response.json()) as { total: number }).total;
}

describe("방문자 API", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.stubEnv("ADMIN_ID", "deokbae");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("같은 사람은 하루에 한 번만 세고, 다른 사람은 세며, 다음 날 다시 오면 또 센다(누적)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-14T03:00:00Z")); // 한국 시간 11월 14일 낮 12시
    const before = await total();

    expect((await POST(await visitRequest({ who: "198.51.100.1" }))).status).toBe(204);
    await POST(await visitRequest({ who: "198.51.100.1" })); // 같은 날 다시: 세지 않아요
    await POST(await visitRequest({ who: "198.51.100.2" })); // 다른 사람
    expect(await total()).toBe(before + 2);

    vi.setSystemTime(new Date("2026-11-14T15:30:00Z")); // 한국 시간 11월 15일 0시 30분(다음 날)
    await POST(await visitRequest({ who: "198.51.100.1" }));
    expect(await total()).toBe(before + 3);
  });

  it("로그인한 글쓴이와 검색엔진 로봇은 세지 않는다", async () => {
    const before = await total();
    expect((await POST(await visitRequest({ who: "198.51.100.10", login: true }))).status).toBe(204);
    expect((await POST(await visitRequest({ who: "198.51.100.11", agent: "Mozilla/5.0 (compatible; Googlebot/2.1)" }))).status).toBe(204);
    expect((await POST(await visitRequest({ who: "198.51.100.12", agent: "" }))).status).toBe(204);
    expect(await total()).toBe(before);
  });

  it("다른 사이트에서 보낸 세기 요청은 403으로 막는다", async () => {
    expect((await POST(await visitRequest({ origin: "https://evil.example" }))).status).toBe(403);
  });

  it("누적 방문자 수는 로그인한 글쓴이만 볼 수 있고(아니면 401), 저장해 두지 않게 한다", async () => {
    expect((await GET(new NextRequest("http://localhost/api/visits"))).status).toBe(401);
    const cookie = `blog_session=${await createSessionToken("deokbae", SECRET)}`;
    const response = await GET(new NextRequest("http://localhost/api/visits", { headers: { cookie } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(Object.keys(await response.json())).toEqual(["total"]);
  });
});
