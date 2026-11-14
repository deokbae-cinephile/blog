/**
 * @file app/write/loading.tsx 테스트
 *
 * 리뷰 추가·수정 화면을 불러오는 동안 "글쓰기 화면을 불러오는 중"을 상태 알림(role=status)으로 알리고,
 * 글쓰기 화면 모양의 스켈레톤을 함께 그리는지 확인해요.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import WriteLoading from "./loading";

describe("글쓰기 로딩 화면", () => {
  it("'글쓰기 화면을 불러오는 중'을 알리고, 스켈레톤을 함께 그린다", () => {
    const { container } = render(<WriteLoading />);
    expect(screen.getByRole("status")).toHaveTextContent(/^글쓰기 화면을 불러오는 중$/);
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(3);
  });
});
