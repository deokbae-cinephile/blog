/**
 * @file 검색엔진 안내문 (app/robots.ts → 주소 "/robots.txt")
 *
 * 이 파일이 하는 일
 *   검색엔진 로봇에게 "글쓴이 화면 말고는 살펴봐도 좋아요, 사이트맵은 여기 있어요"라고 알려 주는 robots.txt를 만들어요.
 *
 * Next.js 약속
 *   app/robots.ts가 대표 내보내기로 규칙을 돌려주면, Next.js가 robots.txt 파일로 만들어 줘요.
 */

import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

/** 빌드하면서 파일로 만들어 두라는 표시예요(app/sitemap.ts와 같아요). */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    // userAgent "*": 모든 검색엔진 로봇에게, allow "/": 모든 페이지를 허락해요.
    // 로그인·글쓰기 화면과 API는 글쓴이만 쓰는 곳이라 검색엔진이 모으지 않게 해요.
    rules: { userAgent: "*", allow: "/", disallow: ["/login", "/write", "/api/"] },
    // 사이트맵 주소
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
