/**
 * @file share-button.tsx 테스트
 *
 * [공유하기] 단추가
 *   - 공유 창이 있으면 제목·글·리뷰 주소를 넘겨 열고, 닫으면(취소) 아무것도 하지 않는지
 *   - 공유 창이 없거나 열지 못하면 주소를 복사하고 안내하는지, 복사도 안 되면 주소를 보여 주는지
 *   - 안내 칸(role="status")이 처음부터 있는지
 * 확인해요. jsdom(가짜 브라우저)에는 공유 창이 없어서 navigator.share·clipboard를 가짜로 심어요.
 * (user-event의 setup()은 navigator.clipboard를 자기 가짜로 바꿔서, setup()을 먼저 부른 뒤에 우리 가짜를 심어요.)
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShareButton } from "./share-button";

const props = {
  url: "https://deokbae.blog/reviews/winter-stop",
  title: "겨울 정류장 리뷰",
  text: "평점 4.5 · 기다림은 끝내 도착한다",
};

/** navigator에 가짜 share·clipboard를 심어요(없애려면 undefined). */
function stubNavigator({ share, writeText }: { share?: (data: ShareData) => Promise<void>; writeText?: (text: string) => Promise<void> }) {
  Object.defineProperty(navigator, "share", { configurable: true, value: share });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: writeText ? { writeText } : undefined });
}

describe("ShareButton", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "share");
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("공유 창이 있으면 제목·글·리뷰 주소로 열고, 따로 안내하지 않는다", async () => {
    const user = userEvent.setup();
    const share = vi.fn(() => Promise.resolve());
    const writeText = vi.fn(() => Promise.resolve());
    stubNavigator({ share, writeText });
    render(<ShareButton {...props} />);

    // 안내 칸은 처음부터 있어요(비어 있음).
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    await user.click(screen.getByRole("button", { name: "공유하기" }));

    expect(share).toHaveBeenCalledWith({ title: "겨울 정류장 리뷰", text: "평점 4.5 · 기다림은 끝내 도착한다", url: props.url });
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("공유 창을 닫으면(취소) 복사하지 않고 아무것도 하지 않는다", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    stubNavigator({ share: () => Promise.reject(new DOMException("닫음", "AbortError")), writeText });
    render(<ShareButton {...props} />);

    await user.click(screen.getByRole("button", { name: "공유하기" }));

    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("공유 창을 열지 못하면(취소 말고 다른 까닭) 주소를 복사하고 알린다", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    stubNavigator({ share: () => Promise.reject(new DOMException("허락 안 됨", "NotAllowedError")), writeText });
    render(<ShareButton {...props} />);

    await user.click(screen.getByRole("button", { name: "공유하기" }));

    expect(writeText).toHaveBeenCalledWith(props.url);
    expect(screen.getByRole("status")).toHaveTextContent("링크를 복사했어요.");
  });

  it("공유 창이 없는 브라우저는 주소를 복사하고, 복사도 막혀 있으면 주소를 보여 준다", async () => {
    const user = userEvent.setup();
    stubNavigator({ writeText: () => Promise.resolve() });
    const { unmount } = render(<ShareButton {...props} />);
    await user.click(screen.getByRole("button", { name: "공유하기" }));
    expect(screen.getByRole("status")).toHaveTextContent("링크를 복사했어요.");
    unmount();

    stubNavigator({ writeText: () => Promise.reject(new Error("권한 없음")) });
    render(<ShareButton {...props} />);
    await user.click(screen.getByRole("button", { name: "공유하기" }));
    expect(screen.getByRole("status")).toHaveTextContent(`링크를 복사하지 못했어요. 이 주소를 직접 복사해 주세요: ${props.url}`);
  });
});
