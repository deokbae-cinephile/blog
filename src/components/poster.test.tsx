/**
 * @file poster.tsx 테스트
 *
 * 확인할 것
 *   1. 형광 초록 필터 클래스가 붙는지(원본 파일은 그대로, 화면에서만 바뀌어요)
 *   2. 이미지 최적화를 거쳐 줄인 파일 주소(/_next/image?url=...)를 쓰는지
 *   3. 대체 텍스트: 상세 화면은 읽히고, 목록 썸네일(alt="")은 꾸밈으로 숨는지
 *   4. 포스터가 없으면 기본 포스터를 보이는지(상세 화면에서는 "포스터 없음"이라고 읽어요)
 *   5. 상자는 늘 가로 2 : 세로 3 비율인지
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Poster } from "./poster";

describe("Poster", () => {
  it("대체 텍스트와 함께 포스터를 그리고, 초록 필터 클래스를 붙인다", () => {
    render(<Poster src="/posters/winter-stop.jpg" alt="영화 ‘겨울 정류장’ 포스터" size="large" />);
    const image = screen.getByRole("img", { name: "영화 ‘겨울 정류장’ 포스터" });
    expect(image).toHaveClass("poster-image");
    // next/image가 화면 크기에 맞게 줄인 파일을 받도록 최적화 주소를 만들어요. 원본 주소는 url= 뒤에 들어가요.
    expect(image.getAttribute("src")).toContain(encodeURIComponent("/posters/winter-stop.jpg"));
  });

  it("목록 썸네일처럼 alt를 비우면 꾸밈 그림이 되어 이름 있는 그림으로 읽히지 않는다", () => {
    const { container } = render(<Poster src="/posters/winter-stop.jpg" alt="" size="thumb" />);
    // 대체 텍스트가 빈 img는 역할이 "presentation"이 되어 img 역할로 찾을 수 없어요.
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("포스터가 없으면 상세 화면에는 기본 포스터를 '포스터 없음'이라는 이름과 함께 보인다", () => {
    const { container } = render(<Poster alt="영화 ‘겨울 정류장’ 포스터" size="large" />);
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "영화 ‘겨울 정류장’ 포스터(포스터 없음)" })).toHaveTextContent("NO POSTER");
  });

  it("목록 썸네일의 기본 포스터는 꾸밈이라 읽지 않는다", () => {
    const { container } = render(<Poster alt="" size="thumb" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });

  it("상자는 가로 2 : 세로 3 비율이고, 썸네일은 목록 번호 대신 크게(80~96px) 그린다", () => {
    const { container } = render(<Poster alt="" size="thumb" />);
    expect(container.firstElementChild).toHaveClass("aspect-[2/3]", "w-20", "sm:w-24");
  });
});
