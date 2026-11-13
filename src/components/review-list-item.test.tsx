/**
 * @file review-list-item.tsx 테스트
 *
 * <li>는 목록(<ul>, <ol>) 안에서만 쓸 수 있는 태그라, 테스트에서도 <ul>로 감싸 그려요(HTML 규칙 지키기).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { reviewMocks } from "@/test/review-mocks";

import { ReviewListItem } from "./review-list-item";

// 가짜 리뷰 중 첫 번째(겨울 정류장)와 네 번째(8비트 영웅전)를 써요. 빈칸(, ,)은 건너뛴다는 뜻이에요.
const [winter, , , legend] = reviewMocks;

/** <ul>로 감싸 리뷰 항목 하나를 그리는 도우미 */
const renderItem = (review = winter!) =>
  render(
    <ul>
      <ReviewListItem review={review} />
    </ul>,
  );

describe("ReviewListItem", () => {
  it("제목이 상세 화면으로 가는 링크이고, 리뷰 한 편이 제목 이름의 article이다", () => {
    renderItem();
    expect(screen.getByRole("link", { name: "겨울 정류장" })).toHaveAttribute("href", "/reviews/winter-stop");
    expect(screen.getByRole("article", { name: "겨울 정류장" })).toBeInTheDocument();
  });

  it("원제·연도·감독과 장르, 숫자 평점, 맨 아래 한줄평을 보이고, 쓴 날은 보이지 않는다", () => {
    renderItem();
    expect(screen.getByText("Winter Stop · 2024 · 감독 한서윤")).toBeInTheDocument();
    // 평점은 별 그림 없이 숫자만 보이고, 화면 낭독기에는 무엇의 숫자인지 알려 줘요.
    expect(screen.getByText("4.5")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("평점 5점 만점에 4.5점")).toBeInTheDocument();
    expect(screen.getByText(/버스는 오지 않아도/)).toHaveTextContent("한줄평: “버스는 오지 않아도, 기다림은 끝내 도착한다.”");
    expect(screen.getByRole("list", { name: "장르" })).toHaveTextContent("[드라마][로맨스]");
    // 쓴 날(2026-11-08)은 최신순 정렬에만 쓰고 화면에는 보이지 않아요.
    expect(screen.queryByText(/2026/)).not.toBeInTheDocument();
  });

  it("원제가 없으면 연도와 감독만 보인다", () => {
    renderItem({ ...legend!, originalTitle: undefined });
    expect(screen.getByText("2024 · 감독 브렌트 콜")).toBeInTheDocument();
  });

  it("포스터 썸네일은 제목과 같은 말이라 꾸밈(alt=\"\")으로 그린다", () => {
    const { container } = renderItem();
    expect(container.querySelector("img")?.getAttribute("src")).toContain(encodeURIComponent("/posters/winter-stop.jpg"));
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("포스터가 없으면 기본 포스터를 그린다", () => {
    const { container } = renderItem(legend!);
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.querySelector(".poster-frame svg")).toBeInTheDocument();
  });

  it("앞에 '-'나 번호 없이 썸네일부터 시작하고, 한줄평은 글 칸 맨 아래에 붙는다", () => {
    const { container } = renderItem();
    expect(screen.queryByText("-")).not.toBeInTheDocument();
    expect(screen.queryByText("01")).not.toBeInTheDocument();
    // article의 첫 자식이 썸네일(포스터 상자)이에요.
    expect(container.querySelector("article")?.firstElementChild).toHaveClass("poster-frame");
    // 한줄평은 mt-auto로 글 칸(세로로 쌓는 flex) 맨 아래에 붙어요.
    expect(screen.getByText(/버스는 오지 않아도/).closest("p")).toHaveClass("mt-auto");
  });
});
