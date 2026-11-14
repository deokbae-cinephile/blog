// @vitest-environment node
// ↑ 파일을 다루는 테스트라 Node.js 환경에서 돌려요.

/**
 * @file review-data.ts 테스트
 *
 * 화면이 쓰는 리뷰 데이터가
 *   - 운영 빌드에서는 빌드 직전에 만든 .generated/reviews.json만 읽는지(목록 요약, 한 편 찾기, 목록 순서의 이전·다음)
 *   - 데이터 파일이 없으면 만드는 방법을 알려 주는지
 *   - 개발 서버·시험에서는 원고 폴더를 바로 읽는지
 * 확인해요. 임시 폴더를 프로젝트 폴더처럼 쓰려고 process.cwd()를 바꿔 넣고, 모듈은 시험마다 새로 불러요(캐시 비우기).
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Review } from "./review";

/** 가짜 리뷰 한 편(목록 순서는 넣는 순서 그대로예요: 데이터 파일은 이미 최신순이에요) */
const review = (slug: string, title: string, publishedAt: string): Review => ({
  slug,
  title,
  year: 2024,
  director: "한서윤",
  genres: ["드라마"],
  rating: 4,
  oneLiner: "기다림은 끝내 도착한다",
  publishedAt,
  html: `<p>${title} 본문</p>`,
  poster: `/posters/${slug}.jpg`,
  posterSize: { width: 960, height: 1420 },
});

/** 시험마다 새로 만드는 임시 "프로젝트 폴더" */
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "review-data-"));
  vi.spyOn(process, "cwd").mockReturnValue(dir);
  // 모듈 안의 캐시(loaded)를 비우려고 다음 import에서 새로 불러요.
  vi.resetModules();
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

describe("운영 빌드: 미리 만든 데이터(.generated/reviews.json)만 읽기", () => {
  beforeEach(() => vi.stubEnv("NODE_ENV", "production"));

  it("목록 요약은 본문·포스터 크기를 빼고, 한 편 찾기와 목록 순서의 이전·다음을 돌려준다", async () => {
    const reviews = [
      review("little-forest", "리틀 포레스트", "2026-11-14T20:55:21+09:00"),
      review("phone-booth", "폰 부스", "2026-11-14T19:35:48+09:00"),
      review("shutter-island", "셔터 아일랜드", "2026-11-14T17:12:40+09:00"),
    ];
    await mkdir(path.join(dir, ".generated"));
    await writeFile(path.join(dir, ".generated/reviews.json"), JSON.stringify(reviews));
    const data = await import("./review-data");

    const summaries = await data.getReviewSummaries();
    expect(summaries.map((item) => item.slug)).toEqual(["little-forest", "phone-booth", "shutter-island"]);
    expect(summaries[0]).not.toHaveProperty("html");
    expect(summaries[0]).not.toHaveProperty("posterSize");
    expect((await data.getReviewBySlug("phone-booth"))?.html).toBe("<p>폰 부스 본문</p>");
    expect(await data.getReviewBySlug("nowhere")).toBeNull();

    // 이전 = 목록에서 바로 위(더 최근에 쓴 글), 다음 = 바로 아래(더 예전에 쓴 글)
    const middle = await data.getNeighbors("phone-booth");
    expect([middle.previous?.slug, middle.next?.slug]).toEqual(["little-forest", "shutter-island"]);
    const top = await data.getNeighbors("little-forest");
    expect([top.previous, top.next?.slug]).toEqual([null, "phone-booth"]);
    expect(await data.getNeighbors("nowhere")).toEqual({ previous: null, next: null });
  });

  it("데이터 파일이 없으면(next build만 따로 돌림) pnpm build로 만들라고 알려 준다", async () => {
    const data = await import("./review-data");
    await expect(data.getAllReviews()).rejects.toThrow("pnpm build로 빌드하세요");
  });
});

describe("개발 서버·시험: 원고 폴더를 바로 읽기", () => {
  it("lib/load-reviews.ts로 원고를 읽어 최신순으로 돌려준다(데이터 파일이 없어도 돼요)", async () => {
    vi.stubEnv("REVIEWS_DIR", path.join(dir, "reviews"));
    await mkdir(path.join(dir, "reviews"));
    const manuscript = (title: string, publishedAt: string) =>
      `---\ntitle: ${title}\nyear: 2024\ndirector: 한서윤\ngenres: [드라마]\nrating: 4\noneLiner: 한 줄 평\npublishedAt: ${publishedAt}\n---\n\n본문\n`;
    await writeFile(path.join(dir, "reviews", "older.md"), manuscript("예전 글", "2026-11-13"));
    await writeFile(path.join(dir, "reviews", "newer.md"), manuscript("최근 글", "2026-11-14T09:00:00+09:00"));
    const data = await import("./review-data");

    expect((await data.getAllReviews()).map((item) => item.slug)).toEqual(["newer", "older"]);
  });
});
