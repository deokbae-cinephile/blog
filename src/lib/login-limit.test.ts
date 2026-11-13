// @vitest-environment node

/**
 * @file login-limit.ts 테스트
 *
 * 로그인 실패 횟수 제한이 "10분 동안 10번 틀리면 막고, 시간이 지나거나 성공하면 풀리는지" 확인해요.
 * 시각(now)을 직접 넣어 줘서 10분을 기다리지 않고 시험해요. 테스트마다 다른 곳(IP)을 써서 서로 섞이지 않게 해요.
 */

import { describe, expect, it } from "vitest";

import { checkLoginAllowed, clearLoginFailures, clientKey, MAX_FAILURES, recordLoginFailure, WINDOW_MS } from "./login-limit";

describe("login-limit", () => {
  it(`${MAX_FAILURES}번 틀릴 때까지는 받고, 그 뒤로는 가장 오래된 실패가 10분을 넘길 때까지 막는다`, () => {
    const key = "198.51.100.1";
    const start = 1_000_000;
    for (let index = 0; index < MAX_FAILURES - 1; index += 1) recordLoginFailure(key, start + index * 1000);
    expect(checkLoginAllowed(key, start + 10_000)).toEqual({ ok: true });

    recordLoginFailure(key, start + 20_000);
    // 첫 실패(start)가 시간 창을 벗어나는 때까지 남은 초를 알려 줘요.
    expect(checkLoginAllowed(key, start + 30_000)).toEqual({ ok: false, retryAfter: (WINDOW_MS - 30_000) / 1000 });
    // 첫 실패가 10분을 넘기면 다시 받아요.
    expect(checkLoginAllowed(key, start + WINDOW_MS)).toEqual({ ok: true });
  });

  it("로그인에 성공해 기록을 지우면 다시 처음부터 센다", () => {
    const key = "198.51.100.2";
    for (let index = 0; index < MAX_FAILURES; index += 1) recordLoginFailure(key, 5_000 + index);
    expect(checkLoginAllowed(key, 6_000).ok).toBe(false);
    clearLoginFailures(key);
    expect(checkLoginAllowed(key, 6_000)).toEqual({ ok: true });
  });

  it("다른 곳(IP)의 실패는 따로 센다", () => {
    for (let index = 0; index < MAX_FAILURES; index += 1) recordLoginFailure("198.51.100.3", 7_000 + index);
    expect(checkLoginAllowed("198.51.100.4", 8_000)).toEqual({ ok: true });
  });

  it("요청한 곳은 cf-connecting-ip, x-forwarded-for의 첫 주소, unknown 순서로 알아낸다", () => {
    expect(clientKey(new Headers({ "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "10.0.0.1" }))).toBe("203.0.113.9");
    expect(clientKey(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});
