/**
 * @file review-article.tsx 테스트
 *
 * 상세 화면에 리뷰 정보가 빠짐없이, 그리고 올바른 구조(제목, 정보표, 이동 링크)로 나오는지 확인해요.
 *   - role "term": <dt>(정보표의 이름 칸)
 *   - role "navigation": <nav>
 *
 * 상세 화면의 키보드 조작(review-keys.tsx)이 Next.js의 useRouter를 써서, 가짜 라우터를 넣어 줘요.
 * (키 조작 자체는 review-keys.test.tsx, 수정·삭제는 admin-review-actions.test.tsx에서 확인해요.)
 */

import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { reviewDetailMock, reviewMocks } from "@/test/review-mocks";

import { ReviewArticle } from "./review-article";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

// 두 번째(화성 세탁소)와 세 번째(필름이 끊기기 전에) 가짜 리뷰를 앞뒤 리뷰로 써요.
const [, mars, reel] = reviewMocks;

/** 앞뒤 리뷰 없이 상세 화면을 그리는 도우미 */
const renderAlone = (review = reviewDetailMock) => render(<ReviewArticle review={review} newer={null} older={null} />);

describe("ReviewArticle", () => {
  afterEach(() => {
    // 로그인 표시 쿠키를 지워, 다음 테스트가 로그인 전 상태에서 시작하게 해요.
    document.cookie = "blog_admin=; max-age=0; path=/";
  });

  it("영화 제목(h1)과, 감독까지 이어 쓴 한 줄 정보를 보인다", () => {
    renderAlone();
    expect(screen.getByRole("heading", { level: 1, name: "겨울 정류장" })).toBeInTheDocument();
    expect(screen.getByText("Winter Stop · 2024 · 한국 · 112분 · 감독 한서윤")).toBeInTheDocument();
  });

  it("포스터가 있으면 제목으로 만든 대체 텍스트와 함께 크게 보인다", () => {
    renderAlone();
    const poster = screen.getByRole("img", { name: "영화 ‘겨울 정류장’ 포스터" });
    expect(poster.getAttribute("src")).toContain(encodeURIComponent("/posters/winter-stop.jpg"));
  });

  it("posterAlt를 적었으면 그 설명을 대체 텍스트로 쓴다", () => {
    renderAlone({ ...reviewDetailMock, posterAlt: "눈 내리는 정류장에 앉은 두 사람" });
    expect(screen.getByRole("img", { name: "눈 내리는 정류장에 앉은 두 사람" })).toBeInTheDocument();
  });

  it("포스터가 없으면 같은 자리에 기본 포스터를 보인다", () => {
    renderAlone({ ...reviewDetailMock, poster: undefined });
    expect(screen.getByRole("img", { name: "영화 ‘겨울 정류장’ 포스터(포스터 없음)" })).toHaveTextContent("NO POSTER");
  });

  it("머리 안내판에 장르(제목 위)와 큰 평점(오른쪽)을 두고, 정보표와 쓴 날은 없다", () => {
    const { container } = renderAlone();
    const header = container.querySelector("article > header")!;
    const genres = within(header as HTMLElement).getByRole("list", { name: "장르" });
    const title = within(header as HTMLElement).getByRole("heading", { level: 1 });
    // compareDocumentPosition: 장르 목록이 제목보다 앞(위)에 있는지 확인해요.
    expect(genres.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 평점은 안내판 안에 크게(text-big) 있어요. 화면 낭독기는 "평점 5점 만점에 4.5점"으로 읽어요.
    const rating = within(header as HTMLElement).getByText("평점 5점 만점에 4.5점");
    expect(rating.closest("p")).toHaveClass("text-big");
    // 예전의 정보표(감독·장르·평점)와 쓴 날은 없어요.
    expect(screen.queryAllByRole("term")).toHaveLength(0);
    expect(screen.queryByText("2026.11.08")).not.toBeInTheDocument();
  });

  it("장르는 그 장르로 거른 목록으로 가는 링크다", () => {
    renderAlone();
    expect(screen.getByRole("link", { name: "로맨스" })).toHaveAttribute("href", `/?genre=${encodeURIComponent("로맨스")}`);
  });

  it("한줄평은 화면 낭독기에 '한줄평:'을 붙여 읽히고, 본문 HTML도 보인다", () => {
    renderAlone();
    // 정규식(/버스는 오지 않아도/)으로 찾으면 글자 일부만 맞아도 찾아져요.
    expect(screen.getByText(/버스는 오지 않아도/)).toHaveTextContent("한줄평: “버스는 오지 않아도, 기다림은 끝내 도착한다.”");
    expect(screen.getByRole("heading", { level: 2, name: "좋았던 점" })).toBeInTheDocument();
  });

  it("본문은 글줄 폭을 줄이지 않고 오른쪽 칸을 다 쓴다(풀 페이지)", () => {
    const { container } = renderAlone();
    // 예전에는 max-w-[46rem]으로 글줄 폭을 줄였어요. 이제는 어디에도 없어요.
    expect(container.querySelector("[class*='max-w-']")).not.toBeInTheDocument();
  });

  it("이전·다음 리뷰로 가는 링크를 단다(꾸밈 화살표는 이름에서 빠진다)", () => {
    render(<ReviewArticle review={reviewDetailMock} newer={mars!} older={reel!} />);
    const nav = screen.getByRole("navigation", { name: "다른 리뷰" });
    expect(within(nav).getByRole("link", { name: "이전 리뷰 필름이 끊기기 전에" })).toHaveAttribute(
      "href",
      "/reviews/before-the-last-reel",
    );
    expect(within(nav).getByRole("link", { name: "다음 리뷰 화성 세탁소" })).toHaveAttribute(
      "href",
      "/reviews/laundromat-on-mars",
    );
  });

  it("다른 리뷰가 없으면 이동 영역을 두지 않는다", () => {
    renderAlone();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("로그인 전에는 수정·삭제가 없고, 로그인하면 보인다", () => {
    const { unmount } = renderAlone();
    expect(screen.queryByRole("link", { name: "수정" })).not.toBeInTheDocument();
    unmount();

    // 로그인 표시 쿠키(서버가 로그인할 때 구워 줘요)를 흉내 내요.
    document.cookie = "blog_admin=1; path=/";
    renderAlone();
    expect(screen.getByRole("link", { name: "수정" })).toHaveAttribute("href", "/write/winter-stop");
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });
});
