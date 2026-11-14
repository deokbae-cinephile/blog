/**
 * @file loading-status.tsx 테스트
 *
 * 로딩 UI가
 *   - role="status"로 "불러오는 중"(또는 받은 글자)을 화면 낭독기에 알려 주는지
 *   - 깜빡이는 커서와 16칸 막대는 꾸밈이라 읽지 않는지
 * 확인해요. (움직임과 모양은 globals.css가 맡아서, 진짜 브라우저 E2E와 스크린샷으로 봐요.)
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingStatus } from "./loading-status";

describe("LoadingStatus", () => {
  it("처음 값은 '불러오는 중'이고, 상태 알림(role=status)으로 읽힌다", () => {
    render(<LoadingStatus />);
    expect(screen.getByRole("status")).toHaveTextContent(/^불러오는 중$/);
  });

  it("무엇을 불러오는지 글자를 바꿔 알릴 수 있다", () => {
    render(<LoadingStatus label="리뷰를 불러오는 중" />);
    expect(screen.getByRole("status")).toHaveTextContent(/^리뷰를 불러오는 중$/);
  });

  it("커서(▮)와 진행 막대는 꾸밈이라 화면 낭독기에서 숨긴다", () => {
    const { container } = render(<LoadingStatus />);
    expect(container.querySelector(".loading-cursor")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".loading-bar")).toHaveAttribute("aria-hidden", "true");
  });
});
