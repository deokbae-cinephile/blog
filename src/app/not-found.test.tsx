/**
 * @file not-found.tsx 테스트
 *
 * 좋은 오류 화면인지 확인해요: 무슨 일인지(제목), 어떻게 하면 되는지(안내), 갈 곳(목록 링크)
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NotFoundPage from "./not-found";

describe("NotFoundPage", () => {
  it("까닭과 고치는 방법을 알리고 목록으로 가는 링크를 둔다", () => {
    render(<NotFoundPage />);
    expect(screen.getByRole("heading", { level: 1, name: "찾는 화면이 없습니다" })).toBeInTheDocument();
    expect(screen.getByText(/주소를 다시 확인하거나 목록에서 찾아 주세요/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "목록으로 가기" })).toHaveAttribute("href", "/");
  });
});
