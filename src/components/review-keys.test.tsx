/**
 * @file review-keys.tsx 테스트
 *
 * ◀ ▶ Esc를 누르면 알맞은 주소로 이동하는지, 가로채면 안 되는 때는 가만히 있는지 확인해요.
 *
 * 테스트 환경에는 진짜 Next.js 라우터가 없어서 useRouter를 가짜로 바꿔요(vi.mock).
 * 가짜 router.push는 vi.fn()(불렸는지 기록하는 가짜 함수)이라, 어떤 주소로 이동하려 했는지 확인할 수 있어요.
 *
 * userEvent.keyboard("{ArrowLeft}"): 실제 사용자처럼 키를 누르는 흉내예요. {Alt>}는 "Alt를 누른 채로"라는 뜻이에요.
 */

import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewKeys } from "./review-keys";

/** 가짜 router.push. 테스트마다 기록을 지워요. */
const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push }),
}));

describe("ReviewKeys", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("◀는 이전 리뷰(목록에서 바로 위), ▶는 다음 리뷰(목록에서 바로 아래), Esc는 목록으로 간다", async () => {
    const user = userEvent.setup();
    render(<ReviewKeys previousHref="/reviews/above" nextHref="/reviews/below" />);

    await user.keyboard("{ArrowLeft}");
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{Escape}");

    // mock.calls: 가짜 함수가 불릴 때마다 받은 값 목록이 쌓여요.
    expect(push.mock.calls).toEqual([["/reviews/above"], ["/reviews/below"], ["/"]]);
  });

  it("앞뒤 리뷰가 없으면 ◀ ▶는 아무 일도 하지 않는다", async () => {
    const user = userEvent.setup();
    render(<ReviewKeys previousHref={null} nextHref={null} />);

    await user.keyboard("{ArrowLeft}{ArrowRight}");
    expect(push).not.toHaveBeenCalled();
  });

  it("Alt + ◀(뒤로 가기)처럼 다른 키와 함께 누르면 가로채지 않는다", async () => {
    const user = userEvent.setup();
    render(<ReviewKeys previousHref="/reviews/above" nextHref="/reviews/below" />);

    await user.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    expect(push).not.toHaveBeenCalled();
  });

  it("넓은 표 상자에 초점이 있으면 ◀ ▶는 표를 미는 데 쓰도록 둔다", async () => {
    const user = userEvent.setup();
    render(
      <>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="표 1" />
        <ReviewKeys previousHref="/reviews/above" nextHref="/reviews/below" />
      </>,
    );

    await user.tab(); // Tab으로 표 상자에 초점을 옮겨요.
    await user.keyboard("{ArrowRight}");
    expect(push).not.toHaveBeenCalled();
  });

  it("다른 곳이 먼저 처리한 Esc(예: 키보드 안내 닫기)는 건너뛴다", async () => {
    const user = userEvent.setup();
    // 캡처 단계(capture: true)에서 먼저 Esc를 받아 처리했다고 표시하는 가짜 "키보드 안내"예요.
    const closeHelp = (event: KeyboardEvent) => event.preventDefault();
    document.addEventListener("keydown", closeHelp, { capture: true });
    render(<ReviewKeys previousHref={null} nextHref={null} />);

    await user.keyboard("{Escape}");
    expect(push).not.toHaveBeenCalled();
    document.removeEventListener("keydown", closeHelp, { capture: true });
  });

  it("화면에서 사라지면 키 듣기를 그만둔다", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ReviewKeys previousHref="/reviews/above" nextHref="/reviews/below" />);

    unmount();
    await user.keyboard("{ArrowLeft}");
    expect(push).not.toHaveBeenCalled();
  });
});
