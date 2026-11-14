/**
 * @file intent-link.tsx 테스트
 *
 * 누를 뜻을 보일 때만 미리 받는 링크가
 *   - 그려지기만 해서는 미리 받지 않고(router.prefetch를 부르지 않고)
 *   - 마우스를 올리거나, 키보드 초점이 가거나, 손가락이 닿으면 그 주소를 미리 받는지
 *   - 넘겨받은 이벤트 처리(onMouseEnter 등)도 그대로 부르는지
 * 확인해요. 라우터(next/navigation의 useRouter)는 가짜로 바꿔, 미리 받기 요청을 기록해요.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntentLink } from "./intent-link";

const router = vi.hoisted(() => ({ prefetch: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => router,
}));

describe("IntentLink", () => {
  beforeEach(() => router.prefetch.mockClear());

  it("그려지기만 해서는 미리 받지 않는다", () => {
    render(<IntentLink href="/reviews/winter-stop">겨울 정류장</IntentLink>);
    expect(screen.getByRole("link", { name: "겨울 정류장" })).toHaveAttribute("href", "/reviews/winter-stop");
    expect(router.prefetch).not.toHaveBeenCalled();
  });

  it.each([
    ["마우스를 올리면", fireEvent.mouseEnter],
    ["키보드 초점이 가면", fireEvent.focus],
    ["손가락이 닿으면", fireEvent.touchStart],
  ])("%s 그 주소를 미리 받는다", (_name, act) => {
    render(<IntentLink href="/reviews/winter-stop">겨울 정류장</IntentLink>);
    act(screen.getByRole("link"));
    expect(router.prefetch).toHaveBeenCalledWith("/reviews/winter-stop");
  });

  it("넘겨받은 이벤트 처리도 그대로 부른다", () => {
    const onFocus = vi.fn();
    render(
      <IntentLink href="/" onFocus={onFocus}>
        목록
      </IntentLink>,
    );
    fireEvent.focus(screen.getByRole("link"));
    expect(onFocus).toHaveBeenCalledTimes(1);
  });
});
