/**
 * @file offline/page.tsx 테스트
 *
 * 좋은 안내 화면인지 확인해요: 무슨 일인지(제목), 지금 할 수 있는 것(안내), 갈 곳(목록 링크)
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import OfflinePage, { metadata } from "./page";

describe("OfflinePage", () => {
  it("연결이 끊겼다고 알리고, 한 번 본 리뷰는 읽을 수 있다고 안내하며 목록 링크를 둔다", () => {
    render(<OfflinePage />);
    expect(screen.getByRole("heading", { level: 1, name: "인터넷에 연결되어 있지 않습니다" })).toBeInTheDocument();
    expect(screen.getByText(/한 번 열어 본 리뷰는 지금도 읽을 수 있습니다/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "목록으로 가기" })).toHaveAttribute("href", "/");
  });

  it("검색엔진에는 올리지 않는다", () => {
    expect(metadata.robots).toEqual({ index: false });
  });
});
