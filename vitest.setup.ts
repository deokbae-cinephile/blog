/**
 * @file 단위 테스트 준비 (vitest.setup.ts)
 *
 * 모든 테스트 파일보다 먼저 한 번 실행돼요(vitest.config.mts의 setupFiles).
 */

// toBeInTheDocument(), toHaveAttribute() 같은 "화면용 확인 함수"를 expect에 더해요.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// 테스트가 하나 끝날 때마다 그려 둔 화면을 치워요. 다음 테스트가 깨끗한 화면에서 시작해요.
// (Vitest의 globals 설정을 쓰지 않아 Testing Library가 자동으로 치우지 못해서, 여기서 직접 등록해요.)
afterEach(cleanup);

// jsdom(가짜 브라우저)은 화면을 실제로 그리지 않아서 스크롤 기능인 scrollIntoView가 없어요.
// 목록을 방향키로 고를 때(use-list-keys.ts) 부르므로, 아무 일도 하지 않는 가짜를 넣어 둬요.
if (typeof window !== "undefined") {
  Element.prototype.scrollIntoView = vi.fn();
}

// jsdom에는 <dialog>의 showModal()과 close()가 아직 없어요. 리뷰 지우기 확인 창(delete-review.tsx)을 시험하려고
// "열림(open 속성) 붙이기·떼기 + close 이벤트 알리기"만 하는 간단한 흉내를 넣어 둬요.
if (typeof window !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

// jsdom(가짜 브라우저)에는 matchMedia가 없어요. 앱 설치 안내(install-prompt.tsx)가
// "앱으로 열었는지"를 matchMedia로 확인하므로, 늘 "아니요(matches: false)"라고 답하는 가짜를 넣어 둬요.
// 다른 답이 필요한 테스트는 그 테스트 안에서 window.matchMedia를 바꿔 써요.
// 서버 코드 테스트(맨 위에 `@vitest-environment node`를 적은 파일)에는 window가 없으니 건너뛰어요.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
