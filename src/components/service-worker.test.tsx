/**
 * @file service-worker.tsx 테스트
 *
 * jsdom(가짜 브라우저)에는 서비스 워커가 없어서 navigator.serviceWorker를 가짜로 만들어 확인해요.
 *   - 운영 빌드(production)에서만 등록하는지
 *   - 맡을 범위와 주소를 맞게 넘기는지
 *   - 화면을 옮길 때마다(pathname이 바뀔 때마다) "지금 화면과 쓴 파일"을 서비스 워커에 보내는지
 *
 * usePathname은 Next.js 라우터가 있어야 동작해서, site-header.test.tsx처럼 vi.mock으로 흉내 내요.
 */

import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ServiceWorker } from "./service-worker";

/** 가짜 usePathname이 돌려줄 주소. 테스트에서 바꿔 "화면을 옮긴" 상황을 만들어요. */
const pathname = vi.hoisted(() => ({ current: "/" }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => pathname.current,
}));

/** 가짜 navigator.serviceWorker를 심고, 확인에 쓸 가짜 함수들을 돌려줘요. */
function installFakeServiceWorker() {
  const postMessage = vi.fn();
  const register = vi.fn(() => Promise.resolve({}));
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register, ready: Promise.resolve({ active: { postMessage } }) },
  });
  return { register, postMessage };
}

describe("ServiceWorker", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    pathname.current = "/";
    // 심어 둔 가짜를 지워 다른 테스트에 영향을 주지 않게 해요.
    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  it("개발·테스트 환경에서는 등록하지 않는다", () => {
    const { register, postMessage } = installFakeServiceWorker();
    render(<ServiceWorker />);
    expect(register).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("운영 빌드에서는 블로그 전체를 맡도록 등록하고, 지금 화면을 저장해 달라고 보낸다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { register, postMessage } = installFakeServiceWorker();

    const { container } = render(<ServiceWorker />);

    // 화면에는 아무것도 그리지 않아요.
    expect(container).toBeEmptyDOMElement();
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" });
    // waitFor: 비동기로 일어나는 일(준비 → 메시지)이 끝날 때까지 다시 확인해요.
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "CACHE_URLS", pages: [window.location.href] }),
      ),
    );
  });

  it("아직 받지 않은(늦게 받는) 본문 사진도 함께 저장해 달라고 보낸다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { postMessage } = installFakeServiceWorker();
    // 화면 아래쪽의 본문 사진(loading="lazy")
    document.body.insertAdjacentHTML("beforeend", '<img src="/images/a.jpg" alt="장면" loading="lazy">');

    render(<ServiceWorker />);

    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ assets: expect.arrayContaining(["http://localhost:3000/images/a.jpg"]) }),
      ),
    );
    document.querySelector("img")?.remove();
  });

  it("나중에 다 받아진 파일도 이어서 알리고, 화면을 떠나면 지켜보기를 멈춘다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { postMessage } = installFakeServiceWorker();

    // 가짜 PerformanceObserver: 넘겨받은 함수(callback)를 기억해 두었다가 테스트에서 직접 불러요.
    const observer = { callback: (() => {}) as (list: { getEntries: () => { name: string }[] }) => void, disconnect: vi.fn() };
    vi.stubGlobal(
      "PerformanceObserver",
      class {
        constructor(callback: typeof observer.callback) {
          observer.callback = callback;
        }
        observe() {}
        disconnect() {
          observer.disconnect();
        }
      },
    );

    const { unmount } = render(<ServiceWorker />);
    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));

    // 큰 포스터를 다 받은 상황
    observer.callback({ getEntries: () => [{ name: "http://localhost:3000/posters/winter-stop.jpg" }] });
    expect(postMessage).toHaveBeenLastCalledWith({
      type: "CACHE_URLS",
      pages: [],
      assets: ["http://localhost:3000/posters/winter-stop.jpg"],
    });

    unmount();
    expect(observer.disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("화면을 옮기면(링크 이동) 그 화면도 저장해 달라고 다시 보내고, 등록은 한 번만 한다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { register, postMessage } = installFakeServiceWorker();

    const { rerender } = render(<ServiceWorker />);
    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));

    // 리뷰 상세로 옮긴 상황: 경로가 바뀌어 다시 그려져요.
    pathname.current = "/reviews/winter-stop/";
    rerender(<ServiceWorker />);

    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(2));
    expect(register).toHaveBeenCalledTimes(1);
  });
});
