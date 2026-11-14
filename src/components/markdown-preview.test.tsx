/**
 * @file markdown-preview.tsx 테스트
 *
 * 본문 미리 보기가
 *   - 상세 화면과 같은 변환(lib/markdown.ts)과 같은 본문 상자(.prose)로 보여 주는지
 *   - 아직 올리지 않은 사진을 임시 주소(blob:)로 바꾸고, 링크는 새 탭에서 열게 하는지
 *   - 원고 안의 HTML 태그(<script> 등)는 옮기지 않는지
 *   - 본문이 비어 있으면 안내를 보여 주는지
 * 확인해요.
 *
 * 임시 주소(URL.createObjectURL)는 시험 환경에 없어서 가짜 함수로 바꿔 둬요.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarkdownPreview } from "./markdown-preview";

describe("MarkdownPreview", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:scene");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  it("본문을 상세 화면과 같은 변환으로 .prose 상자에 보여 준다(가장 큰 제목은 h2)", async () => {
    const { container } = render(<MarkdownPreview markdown={"# 좋았던 점\n\n**굵게**"} images={new Map()} />);
    expect(await screen.findByRole("heading", { level: 2, name: "좋았던 점" })).toBeInTheDocument();
    expect(container.querySelector(".prose strong")).toHaveTextContent("굵게");
  });

  it("아직 올리지 않은 사진은 고른 파일의 임시 주소로 보여 주고, 사진 설명(캡션)도 상세 화면처럼 단다", async () => {
    const file = new File(["png"], "scene.png", { type: "image/png" });
    const { container } = render(
      <MarkdownPreview markdown={'![영사실](/images/a/scene-1.png "사십 년 된 영사기")'} images={new Map([["/images/a/scene-1.png", file]])} />,
    );
    const image = await screen.findByRole("img", { name: "영사실" });
    expect(image).toHaveAttribute("src", "blob:scene");
    expect(container.querySelector("figcaption")).toHaveTextContent("사십 년 된 영사기");
  });

  it("화면을 떠나면 만든 임시 주소를 지워 브라우저 메모리를 돌려준다", async () => {
    const file = new File(["png"], "scene.png", { type: "image/png" });
    const { unmount } = render(<MarkdownPreview markdown="![a](/images/a/scene-1.png)" images={new Map([["/images/a/scene-1.png", file]])} />);
    await screen.findByRole("img", { name: "a" });
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:scene");
  });

  it("링크는 새 탭에서 열어, 눌러도 쓰던 글을 떠나지 않는다", async () => {
    render(<MarkdownPreview markdown="[다른 리뷰](/reviews/b)" images={new Map()} />);
    const link = await screen.findByRole("link", { name: "다른 리뷰" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("원고 안의 HTML 태그는 옮기지 않는다(상세 화면과 같아요)", async () => {
    const { container } = render(<MarkdownPreview markdown={'글\n\n<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">'} images={new Map()} />);
    expect(await screen.findByText("글")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
  });

  it("변환 도구를 처음 받는 동안에는 로딩 UI와 글줄 스켈레톤을 보이고, 다 되면 미리 보기로 바뀐다", async () => {
    const { container } = render(<MarkdownPreview markdown="## 좋았던 점" images={new Map()} />);
    // 처음 그린 순간: 아직 변환 전이라 "미리 보기를 준비하는 중"을 알리고, 스켈레톤은 숨긴 꾸밈이에요.
    expect(screen.getByRole("status")).toHaveTextContent("미리 보기를 준비하는 중");
    expect(container.querySelector(".skeleton")!.closest("[aria-hidden='true']")).not.toBeNull();
    // 변환이 끝나면 로딩 UI는 사라지고 글이 보여요.
    expect(await screen.findByRole("heading", { level: 2, name: "좋았던 점" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("본문이 비어 있으면 무엇을 보여 줄지 안내한다", () => {
    render(<MarkdownPreview markdown="   " images={new Map()} />);
    expect(screen.getByText("본문을 쓰면 여기에 저장한 뒤의 모습으로 보여요.")).toBeInTheDocument();
  });
});
