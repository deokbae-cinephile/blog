/**
 * @file review-list-item.tsx 테스트
 *
 * <li>는 목록(<ul>, <ol>) 안에서만 쓸 수 있는 태그라, 테스트에서도 <ul>로 감싸 그려요(HTML 규칙 지키기).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { reviewMocks } from "@/test/review-mocks";

import { ReviewListItem } from "./review-list-item";

// IntentLink(intent-link.tsx)가 쓰는 라우터를 흉내 내요. 진짜 라우터는 Next.js 앱 안에서만 있어요. 미리 받기는 아무 일도 하지 않아요.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ prefetch: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
}));

// 가짜 리뷰 중 첫 번째(겨울 정류장)와 네 번째(8비트 영웅전)를 써요. 빈칸(, ,)은 건너뛴다는 뜻이에요.
const [winter, , , legend] = reviewMocks;

/**
 * <ul>로 감싸 리뷰 항목 하나를 그리는 도우미
 * linked: 제목을 상세 화면 링크로 둘지. v3 전까지 방문자는 false(기본), 글쓴이는 true예요(components/review-browser.tsx).
 */
const renderItem = (review = winter!, linked = false) =>
  render(
    <ul>
      <ReviewListItem review={review} linked={linked} />
    </ul>,
  );

describe("ReviewListItem", () => {
  it("v3 전 방문자(linked=false): 제목은 링크가 아닌 글자이고, 항목은 반전되지 않는다. 리뷰 한 편은 제목 이름의 article이다", () => {
    renderItem();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "겨울 정류장" })).toBeInTheDocument();
    const article = screen.getByRole("article", { name: "겨울 정류장" });
    // 누를 곳이 없어서 마우스를 올려도 반전되지 않아요.
    expect(article.className).not.toContain("group-hover:inverse");
    // [더 보기]로 불러온 뒤 코드로 초점을 옮길 수 있게 tabIndex -1이에요(Tab 순서에는 없어요).
    expect(article).toHaveAttribute("tabindex", "-1");
  });

  it("글쓴이(linked=true): 제목이 상세 화면으로 가는 링크이고, 항목 전체가 누르는 영역이라 마우스를 올리면 반전된다", () => {
    renderItem(winter!, true);
    expect(screen.getByRole("link", { name: "겨울 정류장" })).toHaveAttribute("href", "/reviews/winter-stop");
    expect(screen.getByRole("link", { name: "겨울 정류장" })).toHaveClass("stretched-link");
    expect(screen.getByRole("article", { name: "겨울 정류장" })).toHaveClass("group-hover:inverse");
    // 항목 안의 링크는 제목 하나뿐이에요(감독 이름은 글자).
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("둘째 줄에는 원제·연도·감독:만 보이고, 장르·출연·쓴 날·조회수는 보이지 않는다. 숫자 평점과 맨 아래 한 줄 평을 보인다", () => {
    renderItem();
    // 감독 뒤에는 쌍점(:)을 붙여요. 장르 태그와 출연은 목록에서 뺐어요(상세 화면에서 보여요).
    expect(screen.getByText("Winter Stop · 2024 · 감독: 한서윤")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "장르" })).not.toBeInTheDocument();
    expect(screen.queryByText(/출연|김배우/)).not.toBeInTheDocument();
    // 조회수는 2.0.0 핫픽스에서 화면에서 뺐어요.
    expect(screen.queryByText(/조회/)).not.toBeInTheDocument();
    // 쓴 날(2026-11-08)은 최신순 정렬에만 쓰고 화면에는 보이지 않아요.
    expect(screen.queryByText(/2026/)).not.toBeInTheDocument();
    // 평점은 별 그림 없이 숫자만 보이고, 화면 낭독기에는 무엇의 숫자인지 알려 줘요.
    expect(screen.getAllByText("4.5")[0]).toHaveAttribute("aria-hidden", "true");
    expect(screen.getAllByText("평점 5점 만점에 4.5점").length).toBeGreaterThan(0);
    expect(screen.getByText(/버스는 오지 않아도/)).toHaveTextContent("한 줄 평: “버스는 오지 않아도, 기다림은 끝내 도착한다.”");
  });

  it("평점은 넓은 화면에서 첫째 줄 오른쪽 끝, 휴대폰에서는 포스터 아래에 하나씩 둔다(화면 너비에 맞는 하나만 보인다)", () => {
    const { container } = renderItem();
    const ratings = screen.getAllByText("평점 5점 만점에 4.5점").map((sr) => sr.parentElement!);
    expect(ratings).toHaveLength(2);
    const [underPoster, firstLine] = ratings as [HTMLElement, HTMLElement];
    // 휴대폰용: 포스터 바로 아래(같은 왼쪽 칸), 640px 이상에서는 숨겨요.
    expect(underPoster).toHaveClass("sm:hidden");
    expect(underPoster.previousElementSibling).toHaveClass("poster-frame");
    // 넓은 화면용: 제목과 같은 첫째 줄 오른쪽 끝, 640px보다 좁으면 숨겨요.
    expect(firstLine).toHaveClass("max-sm:hidden", "ml-auto");
    expect(firstLine.parentElement).toContainElement(screen.getByRole("heading", { level: 3 }));
    expect(container.querySelector("article")?.firstElementChild).toContainElement(underPoster);
  });

  it("원제가 없으면 연도·감독만 보인다", () => {
    renderItem({ ...legend!, originalTitle: undefined });
    expect(screen.getByText("2024 · 감독: 브렌트 콜")).toBeInTheDocument();
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

  it("앞에 '-'나 번호 없이 썸네일부터 시작하고, 한 줄 평은 글 칸 맨 아래에 붙는다", () => {
    const { container } = renderItem();
    expect(screen.queryByText("-")).not.toBeInTheDocument();
    expect(screen.queryByText("01")).not.toBeInTheDocument();
    // article의 첫 칸(왼쪽 칸)이 썸네일(포스터 상자)부터 시작해요.
    expect(container.querySelector("article")?.firstElementChild?.firstElementChild).toHaveClass("poster-frame");
    // 한 줄 평은 mt-auto로 글 칸(세로로 쌓는 flex) 맨 아래에 붙어요.
    expect(screen.getByText(/버스는 오지 않아도/).closest("p")).toHaveClass("mt-auto");
  });
});
