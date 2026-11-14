/**
 * @file 검색엔진용 정보 (structured-data.ts)
 *
 * 이 파일이 하는 일
 *   검색엔진(구글 등)이 화면 내용을 정확히 알아보게, 정해진 모양(schema.org)의 정보를 만들어요.
 *   화면에 보이지 않는 <script type="application/ld+json"> 안에 JSON으로 넣어요(JSON-LD).
 *
 *     리뷰 상세: Review(리뷰) ── itemReviewed: Movie(영화 제목·원제·개봉 연도·감독·출연·장르·상영 시간·포스터)
 *                             ├─ reviewRating: Rating(평점 0.5~5)
 *                             └─ author: Person(덕배), datePublished(글 쓴 날)
 *     처음 화면: WebSite(사이트 이름 "DMB", 다른 이름 "덕배의 영화 블로그", 주소)
 *
 *   검색 결과에 평점이 함께 보이거나(별점 표시), 사이트 이름이 바르게 보이는 데 도움이 돼요.
 *   (보여 줄지는 검색엔진이 정해요.)
 *
 * 누가 쓰나요?
 *   app/reviews/[slug]/page.tsx(리뷰 상세), app/page.tsx(처음 화면)
 */

import type { Review } from "./review";
import { splitNames } from "./people";
import { site, siteUrl } from "./site";

/** 사이트 안 주소("/reviews/a")를 전체 주소("https://deokbae.blog/reviews/a")로 바꿔요. */
const absolute = (path: string) => `${siteUrl}${path}`;

/**
 * 리뷰 상세 화면의 검색엔진용 정보(schema.org Review)
 *
 * @param review 리뷰 한 편
 * @returns JSON으로 바꿔 <script type="application/ld+json">에 넣을 객체. 없는 항목(원제·출연 등)은 넣지 않아요.
 */
export function reviewJsonLd(review: Review) {
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    name: `${review.title} 리뷰`,
    url: absolute(`/reviews/${review.slug}`),
    inLanguage: "ko-KR",
    datePublished: review.publishedAt,
    // 한줄평을 리뷰의 짧은 설명으로 써요.
    description: review.oneLiner,
    author: { "@type": "Person", name: site.author },
    // 평점: 이 블로그는 0.5점부터 5점까지예요.
    reviewRating: { "@type": "Rating", ratingValue: review.rating, bestRating: 5, worstRating: 0.5 },
    itemReviewed: {
      "@type": "Movie",
      name: review.title,
      // ...(조건 ? { 항목 } : {}): 값이 있을 때만 그 항목을 넣어요.
      ...(review.originalTitle ? { alternateName: review.originalTitle } : {}),
      dateCreated: String(review.year),
      // 공동 감독·여러 배우는 "한서윤, 김도윤"처럼 쉼표로 적어서, 한 사람씩 나눠요(lib/people.ts).
      director: splitNames(review.director).map((name) => ({ "@type": "Person", name })),
      ...(review.cast ? { actor: splitNames(review.cast).map((name) => ({ "@type": "Person", name })) } : {}),
      genre: review.genres,
      // 상영 시간: "PT112M"은 "112분"을 나타내는 국제 표준(ISO 8601) 모양이에요.
      ...(review.runtime ? { duration: `PT${review.runtime}M` } : {}),
      ...(review.poster ? { image: absolute(review.poster) } : {}),
    },
  };
}

/** 처음 화면의 검색엔진용 정보(schema.org WebSite). 검색 결과에 사이트 이름을 바르게 보이게 도와요. */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    alternateName: site.headerTitle.replace(/^DMB: /, ""),
    url: `${siteUrl}/`,
    inLanguage: "ko-KR",
  };
}

/**
 * 객체를 <script type="application/ld+json"> 안에 넣을 글자로 바꿔요.
 * 글 속에 "</script>" 같은 글자가 있어도 스크립트가 거기서 끝나지 않게 "<"를 "<"로 바꿔요(JSON으로는 같은 글자예요).
 */
export function toJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
