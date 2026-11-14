/**
 * @file genre-tags.tsx 테스트
 *
 * 확인할 것
 *   1. 장르가 목록(list)으로 그려지고, 꾸밈 대괄호는 읽지 않는지
 *   2. linked일 때 장르로 거른 목록 주소(/?genre=...)로 가는 링크가 생기는지
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GenreTags } from "./genre-tags";

// IntentLink(intent-link.tsx)가 쓰는 라우터를 흉내 내요. 진짜 라우터는 Next.js 앱 안에서만 있어요. 미리 받기는 아무 일도 하지 않아요.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ prefetch: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
}));

describe("GenreTags", () => {
  it("장르를 목록으로 보이고, 대괄호는 꾸밈이라 읽지 않는다", () => {
    render(<GenreTags genres={["드라마", "공포"]} label="장르" />);
    // 이름이 "장르"인 목록을 찾아요.
    const list = screen.getByRole("list", { name: "장르" });
    expect(list).toHaveTextContent("[드라마][공포]");
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["[드라마]", "[공포]"]);
    // getAllByText는 여러 개를 찾아 배열로 돌려줘요. 첫 번째 "["가 숨겨져 있는지 확인해요.
    expect(screen.getAllByText("[")[0]).toHaveAttribute("aria-hidden", "true");
  });

  it("linked면 장르로 거른 목록으로 가는 링크를 단다", () => {
    render(<GenreTags genres={["드라마"]} linked />);
    // 링크 이름은 대괄호를 뺀 "드라마"예요. 한글은 주소에 맞게 바뀌어(%EB%93%9C...) 들어가요.
    // 주소에는 장르를 영어 이름으로 적어요(드라마 → drama).
    expect(screen.getByRole("link", { name: "드라마" })).toHaveAttribute("href", "/?genre=drama");
  });
});
