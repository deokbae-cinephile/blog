/**
 * @file skeleton.tsx 테스트
 *
 * 글쓰기 스켈레톤이
 *   - 첫 줄 자리에 받은 로딩 UI(status)를 그대로 보여 주고, 그 알림은 숨기지 않는지(aria-hidden 밖)
 *   - 막대·상자는 모두 꾸밈이라 화면 낭독기에서 숨기는지(읽을 글자도, 누를 것도 없는지)
 * 확인해요.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingStatus } from "./loading-status";
import { WriterSkeleton } from "./skeleton";

describe("WriterSkeleton", () => {
  it("받은 로딩 UI를 보여 주고, 그 알림은 화면 낭독기에서 숨기지 않는다", () => {
    render(<WriterSkeleton status={<LoadingStatus label="불러오는 중" />} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("불러오는 중");
    // 알림이 숨긴 영역(aria-hidden) 안에 있으면 읽히지 않아요.
    expect(status.closest("[aria-hidden='true']")).toBeNull();
  });

  it("막대·상자는 모두 숨긴 꾸밈이라, 읽을 글자나 누를 것이 없다", () => {
    const { container } = render(<WriterSkeleton status={<LoadingStatus />} />);
    const shapes = Array.from(container.querySelectorAll(".skeleton"));
    expect(shapes.length).toBeGreaterThan(3);
    for (const shape of shapes) expect(shape.closest("[aria-hidden='true']")).not.toBeNull();
    // 화면 낭독기에 드러나는 것은 로딩 알림 하나뿐이에요.
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
