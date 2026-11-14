/**
 * @file view-store.ts 테스트
 *
 * 조회수 저장소가
 *   - 내 컴퓨터(Cloudflare가 아닌 곳)에서는 메모리 저장소로 세고 읽는지(같은 사람 다시 보기 거르기, 총 조회수)
 *   - Cloudflare에서는 Durable Object(VIEW_COUNTER)를 쓰고, 연결이 빠져 있으면 몰래 메모리로 바꾸지 않고 오류를 내는지
 * 확인해요. 메모리 저장소는 한 서버 안에서 함께 쓰여서, 시험마다 다른 리뷰 주소를 써요.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { getViewStore } from "./view-store";

/** OpenNext의 getCloudflareContext를 흉내 내요(Cloudflare 시험에서 env를 바꿔 넣어요). */
const cloudflare = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ env: cloudflare.env }) }));

describe("getViewStore: 내 컴퓨터(메모리 저장소)", () => {
  it("세면 리뷰 조회수와 총 조회수가 오르고, 같은 사람이 곧바로 다시 보면 세지 않는다", async () => {
    const store = getViewStore();
    const before = await store.read();

    const first = await store.count("store-alpha", "사람A");
    expect(first).toEqual({ count: 1, total: before.total + 1, counted: true });
    // 같은 사람이 10분 안에 다시 봐요: 세지 않고 지금 숫자만
    expect(await store.count("store-alpha", "사람A")).toEqual({ count: 1, total: before.total + 1, counted: false });
    // 다른 사람
    expect(await store.count("store-alpha", "사람B")).toMatchObject({ count: 2, counted: true });

    expect(await store.get("store-alpha")).toMatchObject({ count: 2, counted: false });
    const after = await store.read();
    expect(after.counts["store-alpha"]).toBe(2);
    expect(after.total).toBe(before.total + 2);
    // 총 조회수 줄은 리뷰 목록(counts)에 섞이지 않아요.
    expect(after.counts).not.toHaveProperty("__total__");
  });

  it("한 번도 보지 않은 리뷰는 0이다", async () => {
    expect(await getViewStore().get("store-never")).toMatchObject({ count: 0, counted: false });
  });
});

describe("getViewStore: Cloudflare", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    cloudflare.env = {};
  });

  it("Durable Object(VIEW_COUNTER)의 'blog' 하나를 쓴다", () => {
    vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
    const stub = { count: vi.fn(), get: vi.fn(), read: vi.fn() };
    const namespace = { idFromName: vi.fn(() => "id-blog"), get: vi.fn(() => stub) };
    cloudflare.env = { VIEW_COUNTER: namespace };
    expect(getViewStore()).toBe(stub);
    expect(namespace.idFromName).toHaveBeenCalledWith("blog");
    expect(namespace.get).toHaveBeenCalledWith("id-blog");
  });

  it("연결(VIEW_COUNTER)이 빠져 있으면 메모리로 몰래 바꾸지 않고 오류를 낸다", () => {
    vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
    expect(() => getViewStore()).toThrow("VIEW_COUNTER");
  });
});
