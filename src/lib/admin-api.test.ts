// @vitest-environment node

/**
 * @file admin-api.ts 테스트
 *
 * 화면이 서버 API를 부를 때, 서버의 여러 답을 같은 모양(ApiResult)으로 바꾸는지 확인해요.
 * 진짜 서버 대신 fetch를 가짜로 바꿔(vi.stubGlobal) 원하는 답을 돌려줘요.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteReview, login } from "./admin-api";

/** 가짜 fetch가 돌려줄 답을 정해요. */
function answer(body: string, status: number) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status })));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin-api", () => {
  it("성공 답(JSON)은 ok: true와 내용으로 돌려준다", async () => {
    answer(JSON.stringify({ commitSha: "c1", title: "겨울 정류장" }), 200);
    expect(await deleteReview("winter-stop")).toEqual({ ok: true, data: { commitSha: "c1", title: "겨울 정류장" } });
  });

  it("성공 답을 끝까지 받지 못하면(JSON이 끊김) 성공으로 넘기지 않고, 먼저 확인하라고 알린다", async () => {
    answer('{"commitSha":"c1","sl', 201);
    const result = await deleteReview("winter-stop");
    expect(result).toMatchObject({ ok: false, status: 201, message: expect.stringContaining("먼저 확인") });
  });

  it("실패 답은 서버가 보낸 문구와 칸별 오류를 꺼내고, 문구가 없으면 기본 문구를 쓴다", async () => {
    answer(JSON.stringify({ message: "아이디나 비밀번호가 맞지 않습니다.", errors: { id: "확인" } }), 401);
    expect(await login("a", "b")).toEqual({ ok: false, status: 401, message: "아이디나 비밀번호가 맞지 않습니다.", errors: { id: "확인" } });

    answer("<html>오류</html>", 502);
    expect(await login("a", "b")).toMatchObject({ ok: false, status: 502, message: expect.stringContaining("응답 502") });
  });

  it("서버에 닿지 못하면 status 0과 연결 확인 문구를 돌려준다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    expect(await login("a", "b")).toMatchObject({ ok: false, status: 0, message: expect.stringContaining("인터넷 연결") });
  });
});
