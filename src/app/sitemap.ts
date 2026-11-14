/**
 * @file 사이트맵 (app/sitemap.ts → 주소 "/sitemap.xml")
 *
 * 이 파일이 하는 일
 *   검색엔진(구글, 네이버 등)에 "이 사이트에는 이런 페이지들이 있어요"라고 알려 주는 목록(sitemap.xml)을 만들어요.
 *   새 리뷰를 올리면 사이트맵에도 자동으로 들어가서 검색엔진이 더 빨리 찾아요.
 *
 * Next.js 약속
 *   app/sitemap.ts가 대표 내보내기(export default)로 주소 목록을 돌려주면, Next.js가 sitemap.xml 파일로 만들어 줘요.
 */

import type { MetadataRoute } from "next";

import { getReviewSummaries } from "@/lib/review-data";
import { REVIEW_DETAIL_PUBLIC, siteUrl } from "@/lib/site";

/**
 * 빌드할 때 파일로 만들어 두라고 알려 줘요. 원고는 빌드할 때만 읽어서, 요청마다 다시 만들 필요가 없어요.
 * Next.js 약속: 이 값은 이 파일에 직접 적어야 해요.
 */
export const dynamic = "force-static";

/**
 * 사이트맵 목록: 처음 화면 + 리뷰 상세 화면들
 * v3 전까지는 상세 화면을 방문자에게 열지 않아서(lib/site.ts의 REVIEW_DETAIL_PUBLIC) 처음 화면만 알려요.
 *
 * - url: 페이지의 전체 주소
 * - lastModified: 마지막으로 바뀐 날. 검색엔진이 언제 다시 와 볼지 참고해요.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const reviews = await getReviewSummaries();
  return [
    // 처음 화면. 가장 최근 리뷰를 쓴 날을 마지막으로 바뀐 날로 써요. `?.`: 리뷰가 하나도 없으면 undefined
    { url: `${siteUrl}/`, lastModified: reviews[0]?.publishedAt },
    // 리뷰마다 한 줄씩(상세를 열었을 때만). `...배열`은 배열의 항목을 펼쳐 이 목록에 이어 붙여요.
    ...(REVIEW_DETAIL_PUBLIC ? reviews.map((review) => ({ url: `${siteUrl}/reviews/${review.slug}`, lastModified: review.publishedAt })) : []),
  ];
}
