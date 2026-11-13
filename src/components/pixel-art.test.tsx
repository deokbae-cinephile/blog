/**
 * @file pixel-art.tsx 테스트
 *
 * 컴포넌트 테스트의 기본 도구(Testing Library)
 *   - render(<컴포넌트 />) : 가상의 화면(jsdom)에 컴포넌트를 그려요.
 *   - screen.getByRole("img", { name: "필름" }) : "역할(role)이 img이고 이름이 '필름'인 요소"를 찾아요.
 *     사용자와 화면 낭독기가 보는 방식으로 찾기 때문에, 접근성까지 함께 확인하는 효과가 있어요.
 *   - container.querySelector("svg") : 그려진 HTML에서 CSS 선택자로 직접 찾아요(역할로 찾기 어려울 때만).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PixelArt } from "./pixel-art";

// 경로 명령을 만드는 pixelPath 함수의 테스트는 src/lib/pixel-path.test.ts에 있어요.

describe("PixelArt", () => {
  it("칸 크기만큼 키워 그린다", () => {
    // 3칸 × 2줄 그림을 한 칸 4px로 그리면 12px × 8px
    const { container } = render(<PixelArt rows={["###", "#.#"]} cell={4} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "12");
    expect(svg).toHaveAttribute("height", "8");
    expect(svg).toHaveAttribute("viewBox", "0 0 3 2");
  });

  it("이름이 없으면 꾸밈 그림으로 보고 화면 낭독기에서 숨긴다", () => {
    const { container } = render(<PixelArt rows={["#"]} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("이름을 주면 그 이름의 그림으로 읽힌다", () => {
    render(<PixelArt rows={["#"]} label="필름" />);
    expect(screen.getByRole("img", { name: "필름" })).toBeInTheDocument();
  });
});
