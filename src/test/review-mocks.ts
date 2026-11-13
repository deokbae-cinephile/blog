/**
 * @file 테스트용 가짜 리뷰 데이터 (review-mocks.ts)
 *
 * 이 파일이 하는 일
 *   단위 테스트(*.test.ts, *.test.tsx)에서 쓰는 가상의 리뷰 데이터를 모아 둡니다.
 *
 * 왜 실제 원고(content/reviews)를 쓰지 않을까요?
 *   글쓴이가 원고를 고치거나 지우면 테스트 결과도 바뀌어 버려요.
 *   테스트용 데이터를 따로 두면 원고가 어떻게 바뀌든 테스트는 늘 같은 결과를 기대할 수 있습니다.
 *
 * "mock(목)"은 "진짜를 흉내 낸 가짜"라는 뜻이에요.
 */

import type { Review, ReviewSummary } from "@/lib/review";

/**
 * 목록 화면 테스트용 리뷰 4편(최신순으로 적어 두었어요).
 *
 * 테스트가 기대하는 사실들:
 *   - 최신순: 겨울 정류장 → 화성 세탁소 → 필름이 끊기기 전에 → 8비트 영웅전
 *   - 평점순: 필름이 끊기기 전에(5) → 겨울 정류장(4.5) → 화성 세탁소(3.5) → 8비트 영웅전(2.5)
 *   - 드라마 장르는 2편(겨울 정류장, 필름이 끊기기 전에)
 *   - 포스터는 겨울 정류장에만 있어요(포스터가 있을 때와 없을 때를 함께 시험하려고요).
 */
export const reviewMocks: ReviewSummary[] = [
  {
    slug: "winter-stop",
    title: "겨울 정류장",
    originalTitle: "Winter Stop",
    year: 2024,
    country: "한국",
    director: "한서윤",
    runtime: 112,
    genres: ["드라마", "음악"],
    rating: 4.5,
    oneLiner: "버스는 오지 않아도, 기다림은 끝내 도착한다.",
    publishedAt: "2026-11-08",
    poster: "/posters/winter-stop.jpg",
  },
  {
    slug: "laundromat-on-mars",
    title: "화성 세탁소",
    originalTitle: "Laundromat on Mars",
    year: 2025,
    country: "미국",
    director: "데이나 휫필드",
    runtime: 98,
    genres: ["코미디"],
    rating: 3.5,
    oneLiner: "우주에서도 양말 한 짝은 사라진다.",
    publishedAt: "2026-10-30",
  },
  {
    slug: "before-the-last-reel",
    title: "필름이 끊기기 전에",
    originalTitle: "Avant la dernière bobine",
    year: 2023,
    country: "프랑스",
    director: "카미유 루셀",
    runtime: 104,
    genres: ["드라마"],
    rating: 5,
    oneLiner: "영사기가 멈춘 자리에서 영화는 관객의 기억으로 상영된다.",
    publishedAt: "2026-10-18",
  },
  {
    slug: "eight-bit-legend",
    title: "8비트 영웅전",
    originalTitle: "8-Bit Legend",
    year: 2024,
    director: "브렌트 콜",
    genres: ["액션", "모험"],
    rating: 2.5,
    oneLiner: "향수는 입장권일 뿐, 상영 시간을 책임지지 않는다.",
    publishedAt: "2026-09-10",
  },
];

/**
 * 상세 화면 테스트용, 본문(html)까지 있는 리뷰 한 편이에요.
 *
 * `...reviewMocks[0]!`는 첫 번째 목록 리뷰의 항목을 모두 펼쳐 넣는다는 뜻이에요.
 * 끝의 `!`는 "이 칸은 반드시 있어요"라고 TypeScript에 알려 주는 표시입니다(배열 칸은 비어 있을 수도 있다고 보기 때문).
 */
export const reviewDetailMock: Review = {
  ...reviewMocks[0]!,
  html: [
    "<p>폭설로 막차가 끊긴 시골 정류장에서, 서로 모르는 두 사람이 하룻밤을 함께 기다린다.</p>",
    "<h2>좋았던 점</h2>",
    "<p>대사보다 <strong>눈 내리는 소리</strong>가 먼저 들린다.</p>",
    "<blockquote><p>“버스가 안 오면, 우리가 가면 되죠.”</p></blockquote>",
  ].join(""),
};

/**
 * 무한 스크롤(10편씩 보여 주기) 테스트용으로, 리뷰를 원하는 만큼 만들어 줘요.
 * 제목은 "시험 영화 01", "시험 영화 02"...이고, 번호가 작을수록 최근에 쓴 글이에요(최신순 = 번호순).
 *
 * @param count 만들 리뷰 수
 */
export function manyReviews(count: number): ReviewSummary[] {
  return Array.from({ length: count }, (_, index) => {
    // padStart(2, "0"): 한 자리 수 앞에 0을 채워요(1 → "01"). 제목 가나다순과 번호순이 같아지게요.
    const number = String(index + 1).padStart(2, "0");
    return {
      slug: `movie-${number}`,
      title: `시험 영화 ${number}`,
      year: 2020,
      director: `감독${number}`,
      genres: ["드라마"],
      rating: 3,
      oneLiner: `한줄평 ${number}`,
      // 번호가 커질수록 하루씩 예전 날짜(2026-01-31, 2026-01-30, ...)
      publishedAt: `2026-01-${String(31 - index).padStart(2, "0")}`,
    };
  });
}
