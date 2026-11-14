/**
 * @file structured-data.ts 테스트
 *
 * 검색엔진용 정보(JSON-LD)가
 *   - 리뷰: 영화(제목·원제·연도·감독 여러 명·장르·국가·상영 시간·포스터), 평점(0.5~5), 글쓴이, 글 쓴 날을 담는지
 *   - 없는 항목(원제·국가·상영 시간·포스터)은 넣지 않는지
 *   - <script> 안에 넣어도 "</script>"로 끊기지 않게 바꾸는지
 * 확인해요.
 */

import { describe, expect, it } from "vitest";

import type { Review } from "./review";
import { reviewJsonLd, toJsonLd, websiteJsonLd } from "./structured-data";

const review: Review = {
  slug: "winter-stop",
  title: "겨울 정류장",
  originalTitle: "Winter Stop",
  year: 2024,
  country: "한국",
  director: "한서윤, 김도윤",
  runtime: 112,
  genres: ["드라마", "로맨스"],
  rating: 4.5,
  oneLiner: "버스는 오지 않아도, 기다림은 끝내 도착한다.",
  publishedAt: "2026-11-08",
  poster: "/posters/winter-stop.jpg",
  html: "<p>본문</p>",
};

describe("reviewJsonLd", () => {
  it("리뷰(Review)에 영화(Movie)·평점(Rating)·글쓴이를 담는다", () => {
    expect(reviewJsonLd(review)).toEqual({
      "@context": "https://schema.org",
      "@type": "Review",
      name: "겨울 정류장 리뷰",
      url: "https://deokbae.blog/reviews/winter-stop",
      inLanguage: "ko-KR",
      datePublished: "2026-11-08",
      description: "버스는 오지 않아도, 기다림은 끝내 도착한다.",
      author: { "@type": "Person", name: "덕배" },
      reviewRating: { "@type": "Rating", ratingValue: 4.5, bestRating: 5, worstRating: 0.5 },
      itemReviewed: {
        "@type": "Movie",
        name: "겨울 정류장",
        alternateName: "Winter Stop",
        dateCreated: "2024",
        director: [
          { "@type": "Person", name: "한서윤" },
          { "@type": "Person", name: "김도윤" },
        ],
        genre: ["드라마", "로맨스"],
        countryOfOrigin: { "@type": "Country", name: "한국" },
        duration: "PT112M",
        image: "https://deokbae.blog/posters/winter-stop.jpg",
      },
    });
  });

  it("없는 항목(원제·국가·상영 시간·포스터)은 넣지 않는다", () => {
    const { originalTitle, country, runtime, poster, ...required } = review;
    void [originalTitle, country, runtime, poster];
    const movie = reviewJsonLd(required).itemReviewed;
    expect(Object.keys(movie)).toEqual(["@type", "name", "dateCreated", "director", "genre"]);
  });
});

describe("websiteJsonLd · toJsonLd", () => {
  it("사이트 이름(DMB)과 다른 이름(덕배의 영화 블로그), 주소를 담는다", () => {
    expect(websiteJsonLd()).toMatchObject({ "@type": "WebSite", name: "DMB", alternateName: "덕배의 영화 블로그", url: "https://deokbae.blog/" });
  });

  it("<를 \\u003c로 바꿔 </script>로 끊기지 않게 하고, 다시 읽으면 같은 값이다", () => {
    const text = toJsonLd({ description: "</script><script>alert(1)</script>" });
    expect(text).not.toContain("<");
    expect(JSON.parse(text)).toEqual({ description: "</script><script>alert(1)</script>" });
  });
});
