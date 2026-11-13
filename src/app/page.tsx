/**
 * @file 처음 화면 = 영화 목록 (app/page.tsx → 주소 "/")
 *
 * 이 파일이 하는 일
 *   블로그에 들어오면 처음 보이는 화면이에요. 검색·장르·정렬과 영화 목록을 보여 줍니다.
 *
 * Next.js 약속: app 폴더의 page.tsx
 *   app/page.tsx는 주소 "/"의 페이지가 돼요. (app/reviews/[slug]/page.tsx는 "/reviews/..."가 되고요.)
 *   폴더 구조가 곧 주소 구조예요.
 *
 * 서버 컴포넌트
 *   이 컴포넌트는 "use client"가 없으니 서버 컴포넌트예요. 빌드할 때 한 번 실행돼서 HTML로 만들어져요.
 *   그래서 서버에서만 되는 일(원고 파일 읽기)을 여기서 할 수 있어요.
 *   읽은 목록을 클라이언트 컴포넌트(ReviewBrowser)에 넘기면, 브라우저에서 검색·필터가 동작해요.
 *
 * 흐름
 *   빌드 → getReviewSummaries()로 원고 읽기 → <ReviewBrowser>에 넘기기 → HTML 완성
 */

import type { Metadata } from "next";

import { ReviewBrowser } from "@/components/review-browser";
import { getReviewSummaries } from "@/lib/load-reviews";
import { site } from "@/lib/site";

/**
 * 이 페이지의 메타데이터
 * canonical(대표 주소): "/?genre=공포"처럼 조건만 다른 주소가 여러 개여도 검색엔진에는 "/"가 대표라고 알려 줘요.
 * 제목은 따로 정하지 않아 layout.tsx의 기본값("DMB")을 써요.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * 처음 화면 컴포넌트
 *
 * `async`: 원고 읽기를 기다려야(await) 해서 비동기 함수예요. 서버 컴포넌트는 async로 만들 수 있어요.
 */
export default async function HomePage() {
  // 모든 리뷰의 목록 정보(본문 제외, 최신순)를 읽어요.
  const reviews = await getReviewSummaries();

  return (
    <>
      {/* 페이지의 가장 큰 제목(h1). 눈에 보이는 제목은 머리글의 블로그 이름이 대신해서, 화면에서는 숨기고(sr-only)
          화면 낭독기 사용자가 제목으로 페이지를 알아볼 수 있게 해요. 한 페이지에 h1은 하나만 둡니다. */}
      <h1 className="sr-only">{site.name}</h1>
      <ReviewBrowser reviews={reviews} />
    </>
  );
}
