/**
 * @file poster-image.tsx 테스트
 *
 * 포스터 그림이 오기 전에는 스켈레톤을 깔아 두고, 그림이 오면(load) 스켈레톤을 치우는지 확인해요.
 * 넘겨받은 onLoad도 그대로 불러 주는지 봐요.
 */

import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PosterImage } from "./poster-image";

describe("PosterImage", () => {
  it("그림이 오기 전에는 숨긴 스켈레톤을 깔아 두고, 그림이 오면 치운다", async () => {
    const onLoad = vi.fn();
    const { container } = render(<PosterImage src="/posters/test-pattern.png" alt="" fill sizes="64px" onLoad={onLoad} />);
    const skeleton = container.querySelector(".skeleton");
    expect(skeleton).toHaveAttribute("aria-hidden", "true");

    // next/image는 그림을 다 풀어낸 다음(decode)에 onLoad를 불러서, 조금 기다려요(waitFor).
    fireEvent.load(container.querySelector("img")!);
    await waitFor(() => expect(container.querySelector(".skeleton")).toBeNull());
    expect(onLoad).toHaveBeenCalledTimes(1);
  });
});
