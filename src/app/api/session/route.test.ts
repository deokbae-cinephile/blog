// @vitest-environment node

/**
 * @file 로그인·로그아웃 API 테스트 (app/api/session/route.ts)
 *
 * Route Handler는 그냥 함수라서, 요청(NextRequest)을 만들어 넣고 돌아온 응답을 확인하면 돼요.
 * 비밀번호 해시와 세션 열쇠는 테스트용 값을 환경 변수에 넣어 써요.
 */

import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { hashPassword } from "@/lib/password-hash";

import { DELETE, POST } from "./route";

const SECRET = "test-secret-0123456789-abcdefghij-klmnop";
let hash: string;

/** 로그인 요청을 만들어요. origin: 요청을 보낸 사이트(기본은 우리 사이트) */
const loginRequest = (body: unknown, origin = "http://localhost") =>
  new NextRequest("http://localhost/api/session", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/session (로그인)", () => {
  beforeAll(async () => {
    hash = await hashPassword("correct horse");
  });
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.stubEnv("ADMIN_ID", "deokbae");
    vi.stubEnv("ADMIN_PASSWORD_HASH", hash);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("아이디·비밀번호가 맞으면 세션 쿠키(httpOnly)와 로그인 표시 쿠키를 굽는다", async () => {
    const response = await POST(loginRequest({ id: "deokbae", password: "correct horse" }));
    expect(response.status).toBe(200);
    const cookies = response.headers.getSetCookie();
    expect(cookies.find((cookie) => cookie.startsWith("blog_session="))).toMatch(/HttpOnly/i);
    expect(cookies.find((cookie) => cookie.startsWith("blog_session="))).toMatch(/SameSite=lax/i);
    expect(cookies.find((cookie) => cookie.startsWith("blog_admin="))).toMatch(/^blog_admin=1;/);
    expect(cookies.find((cookie) => cookie.startsWith("blog_admin="))).not.toMatch(/HttpOnly/i);
  });

  it("틀리면 쿠키 없이 401과 다시 입력하라는 문구를 돌려준다(무엇이 틀렸는지는 알려 주지 않는다)", async () => {
    for (const body of [{ id: "deokbae", password: "wrong" }, { id: "someone", password: "correct horse" }, {}]) {
      const response = await POST(loginRequest(body));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ message: "아이디나 비밀번호가 맞지 않습니다. 다시 확인해 입력하세요." });
      expect(response.headers.getSetCookie()).toEqual([]);
    }
  });

  it("서버에 로그인 설정이 없으면 503과 설정할 값을 알려 준다", async () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", "");
    const response = await POST(loginRequest({ id: "deokbae", password: "correct horse" }));
    expect(response.status).toBe(503);
    expect((await response.json()).message).toContain("ADMIN_PASSWORD_HASH");
  });

  it("다른 사이트에서 보낸 요청은 받지 않는다(CSRF 막기)", async () => {
    const response = await POST(loginRequest({ id: "deokbae", password: "correct horse" }, "https://evil.example"));
    expect(response.status).toBe(403);
  });
});

describe("DELETE /api/session (로그아웃)", () => {
  it("로그인 쿠키 두 개를 지운다", async () => {
    const response = await DELETE(new NextRequest("http://localhost/api/session", { method: "DELETE", headers: { origin: "http://localhost" } }));
    expect(response.status).toBe(200);
    const cookies = response.headers.getSetCookie().join("\n");
    expect(cookies).toContain("blog_session=;");
    expect(cookies).toContain("blog_admin=;");
  });
});
