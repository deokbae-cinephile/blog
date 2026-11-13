/**
 * @file stored-value.ts 테스트
 *
 * 저장하고 읽기, 같은 글자면 같은 객체 돌려주기, 바뀌면 알리기, 저장소를 못 쓸 때 기억하기를 확인해요.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createStoredValue } from "./stored-value";

/** 시험용: 숫자 목록을 JSON 글자로 저장해요. 깨진 글자면 빈 목록이에요. */
const makeStore = () =>
  createStoredValue<number[]>(
    "test:numbers",
    (raw) => {
      try {
        const value: unknown = JSON.parse(raw ?? "[]");
        return Array.isArray(value) ? value : [];
      } catch {
        return [];
      }
    },
    (value) => JSON.stringify(value),
  );

describe("createStoredValue", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("저장한 값을 읽고, 글자가 그대로면 같은 객체를 돌려준다", () => {
    const store = makeStore();
    expect(store.get()).toEqual([]);
    store.set([1, 2]);
    expect(window.localStorage.getItem("test:numbers")).toBe("[1,2]");
    // toBe: 같은 객체인지(=== 비교) 확인해요. useSyncExternalStore가 끝없이 다시 그리지 않으려면 꼭 필요해요.
    expect(store.get()).toBe(store.get());
    expect(store.get()).toEqual([1, 2]);
  });

  it("깨진 글자는 읽기 함수가 기본값으로 바꾼다", () => {
    window.localStorage.setItem("test:numbers", "{깨짐");
    expect(makeStore().get()).toEqual([]);
  });

  it("값을 바꾸면 등록한 화면에 알리고, 등록을 풀면 더는 알리지 않는다", () => {
    const store = makeStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set([1]);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.set([2]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("다른 탭에서 저장소를 바꾸면(storage 이벤트) 알린다", () => {
    const store = makeStore();
    const listener = vi.fn();
    store.subscribe(listener);
    window.dispatchEvent(new StorageEvent("storage", { key: "test:numbers" }));
    window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("다른 탭에서 값을 지우면 지운 대로(기본값으로) 읽는다", () => {
    const store = makeStore();
    store.set([1]);
    window.localStorage.removeItem("test:numbers");
    expect(store.get()).toEqual([]);
  });

  it("저장에 실패하면 저장소의 예전 값보다 방금 정한 값을 쓴다", () => {
    window.localStorage.setItem("test:numbers", "[1]");
    const store = makeStore();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("저장 공간이 가득 참");
    });
    store.set([2]);
    expect(store.get()).toEqual([2]);
  });

  it("저장에 실패했다가 다시 성공하면, 다른 탭의 변경을 다시 읽는다", () => {
    const store = makeStore();
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new Error("저장 공간이 가득 참");
    });
    store.set([1]); // 실패
    store.set([2]); // 성공(이번에는 진짜 setItem이 돌아요)
    expect(setItem).toHaveBeenCalledTimes(2);

    // 다른 탭이 값을 바꾼 상황
    window.localStorage.setItem("test:numbers", "[3]");
    expect(store.get()).toEqual([3]);
  });

  it("저장소를 쓸 수 없으면 이번 방문 동안 기억해 둔다", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("저장소를 쓸 수 없음");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("저장소를 쓸 수 없음");
    });
    const store = makeStore();
    store.set([7]);
    expect(store.get()).toEqual([7]);
  });
});
