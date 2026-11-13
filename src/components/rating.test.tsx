/**
 * @file rating.tsx 테스트
 *
 * 평점이 별 그림 없이 숫자로 보이고, 화면 낭독기에는 무엇의 숫자인지 알려 주는지 확인해요.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Rating } from "./rating";

describe("Rating", () => {
  it("숫자를 소수 한 자리로 보이고, 화면 낭독기에는 '평점 5점 만점에 4점'처럼 읽힌다", () => {
    const { container } = render(<Rating value={4} />);
    expect(screen.getByText("4.0")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("평점 5점 만점에 4.0점")).toHaveClass("sr-only");
    // 별 그림(svg)은 더 그리지 않아요.
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("가장 낮은 평점 0.5도 그대로 보인다(0점은 없다)", () => {
    render(<Rating value={0.5} />);
    expect(screen.getByText("0.5")).toBeInTheDocument();
  });
});
