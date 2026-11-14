/**
 * @file visit-store.ts 테스트
 *
 * 방문자 저장소가
 *   - 내 컴퓨터(Cloudflare가 아닌 곳)에서는 메모리 저장소로 세고 읽는지(같은 날 같은 사람은 한 번, 어제·오늘 기록 유지)
 *   - Cloudflare에서는 Durable Object(VISIT_COUNTER)를 쓰고, 연결이 빠져 있으면 몰래 메모리로 바꾸지 않고 오류를 내는지
 * 확인해요. 메모리 저장소는 한 서버 안에서 함께 쓰여서, 숫자는 시험마다 늘어난 만큼(차이)으로 봐요.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { getVisitStore } from "./visit-store";

/** OpenNext의 getCloudflareContext를 흉내 내요(Cloudflare 시험에서 env를 바꿔 넣어요). */
const cloudflare = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ env: cloudflare.env }) }));

describe("getVisitStore: 내 컴퓨터(메모리 저장소)", () => {
  it("같은 날 같은 사람은 한 번만 세고, 다음 날에는 다시 세며, 누적은 날마다 센 수의 합이다", async () => {
    const store = getVisitStore();
    const before = (await store.visits()).total;

    expect(await store.visit("사람A", "2030-01-10")).toBe(true);
    expect(await store.visit("사람A", "2030-01-10")).toBe(false);
    expect(await store.visit("사람B", "2030-01-10")).toBe(true);
    expect(await store.visit("사람A", "2030-01-11")).toBe(true);

    expect((await store.visits()).total - before).toBe(3);
  });

  it("자정을 넘겨 늦게 도착한 어제 요청은 다시 세지 않고, 이틀이 지난 기록만 지운다", async () => {
    const store = getVisitStore();
    expect(await store.visit("사람C", "2030-02-01")).toBe(true);
    // 다음 날 요청이 먼저 처리된 뒤, 어제 요청이 늦게 도착했어요: 어제 기록이 남아 있어 다시 세지 않아요.
    expect(await store.visit("사람D", "2030-02-02")).toBe(true);
    expect(await store.visit("사람C", "2030-02-01")).toBe(false);
    // 이틀 뒤에는 2월 1일 기록이 지워져요. 그날 요청이 또 오면(아주 늦은 요청) 다시 세어지지만, 그런 일은 드물어요.
    expect(await store.visit("사람E", "2030-02-03")).toBe(true);
    expect(await store.visit("사람C", "2030-02-01")).toBe(true);
  });
});

describe("getVisitStore: Cloudflare", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    cloudflare.env = {};
  });

  it("Durable Object(VISIT_COUNTER)의 'blog' 하나를 쓴다", () => {
    vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
    const stub = { visit: vi.fn(), visits: vi.fn() };
    const namespace = { idFromName: vi.fn(() => "id-blog"), get: vi.fn(() => stub) };
    cloudflare.env = { VISIT_COUNTER: namespace };
    expect(getVisitStore()).toBe(stub);
    expect(namespace.idFromName).toHaveBeenCalledWith("blog");
    expect(namespace.get).toHaveBeenCalledWith("id-blog");
  });

  it("연결(VISIT_COUNTER)이 빠져 있으면 메모리로 몰래 바꾸지 않고 오류를 낸다", () => {
    vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
    expect(() => getVisitStore()).toThrow("VISIT_COUNTER");
  });
});
