/**
 * @file 리뷰 데이터의 모양과 정렬 규칙 (review.ts)
 *
 * 이 파일이 하는 일
 *   1. 리뷰 한 편이 어떤 정보를 갖는지 "타입"으로 정합니다(ReviewSummary, Review).
 *   2. 리뷰를 어떤 순서로 늘어놓을지 정렬 규칙을 정합니다(compareLatest, compareRating).
 *
 * 타입이 왜 필요할까요?
 *   리뷰 데이터는 원고 읽기(lib/load-reviews.ts) → 목록 화면 → 상세 화면으로 여기저기 전달돼요.
 *   모양을 타입으로 정해 두면, 예를 들어 `review.raiting`처럼 이름을 잘못 쓴 순간 편집기가 바로 알려 줍니다.
 *
 * 누가 쓰나요?
 *   거의 모든 화면과 lib 파일이 이 타입을 가져다 씁니다.
 */

import type { Genre } from "./genres";
// ↑ `import type`은 "타입만 가져온다"는 뜻이에요. 실행할 때는 사라지므로 화면 코드 크기에 영향이 없습니다.

/**
 * 목록과 검색에 쓰는 리뷰 정보예요(본문은 빠져 있습니다).
 *
 * 왜 본문을 뺄까요?
 *   처음 화면에는 리뷰 전체 목록이 브라우저로 전달되는데, 본문까지 실으면 데이터가 무거워져요.
 *   목록에는 제목·평점·한줄평만 있으면 충분하니 가볍게 둡니다.
 *
 * 이름 뒤의 `?`(예: originalTitle?)는 "없어도 되는 값"이라는 표시입니다.
 */
export type ReviewSummary = {
  /** 원고 파일 이름(확장자 제외). 주소가 됩니다. 예: winter-stop → /reviews/winter-stop */
  slug: string;
  /** 한국어 제목 */
  title: string;
  /** 원제(없어도 됨) */
  originalTitle?: string;
  /** 개봉 연도 */
  year: number;
  /** 제작 국가(없어도 됨) */
  country?: string;
  /** 감독. 여러 명이면 쉼표로 이어 적어요. */
  director: string;
  /** 상영 시간(분, 없어도 됨) */
  runtime?: number;
  /** 장르 목록. lib/genres.ts에 있는 이름만 쓸 수 있어요. */
  genres: Genre[];
  /** 평점. 0.5부터 5까지 0.5 단위(0점은 없어요) */
  rating: number;
  /** 한줄평 */
  oneLiner: string;
  /** 글 쓴 날(YYYY-MM-DD). 화면에는 보이지 않고, 목록의 "최신순" 정렬과 이전·다음 리뷰 순서에만 써요. */
  publishedAt: string;
  /**
   * 포스터 이미지 주소(없어도 됨). 예: "/posters/winter-stop.jpg"
   * 원고에는 파일 이름(winter-stop.jpg)만 적고, 원고를 읽을 때 이 주소로 바꿔 둬요(lib/load-reviews.ts).
   * 없으면 화면에는 기본 포스터가 보여요(components/poster.tsx).
   */
  poster?: string;
  /** 포스터 대체 텍스트(없어도 됨). 없으면 "영화 ‘제목’ 포스터"를 써요. */
  posterAlt?: string;
};

/**
 * 상세 화면에 쓰는, 본문까지 있는 리뷰예요.
 *
 * `A & { ... }`는 "A의 모든 항목에 { } 안의 항목을 더한 타입"이라는 뜻입니다(교차 타입).
 */
export type Review = ReviewSummary & {
  /** 원고 본문(Markdown)을 HTML로 바꾼 글자 */
  html: string;
  /**
   * 포스터의 가로·세로(px). 포스터가 있을 때만 있어요(원고를 읽을 때 파일에서 재요).
   * 공유 미리 보기(og:image:width·height)에 알려 주면, 메신저·SNS가 링크를 처음 받았을 때도 포스터를 바로 보여 줘요.
   * 목록에는 쓰지 않아서 목록용 요약(ReviewSummary)에는 넣지 않아요(lib/load-reviews.ts의 toSummary).
   */
  posterSize?: { width: number; height: number };
};

/** 정렬에 필요한 항목만 골라 둔 타입. `Pick<T, "a" | "b">`는 T에서 a, b만 뽑아 만든 타입이에요. */
type Sortable = Pick<ReviewSummary, "publishedAt" | "title" | "rating">;

/**
 * 글 쓴 날 글자를 견줄 수 있는 시각(1970년부터의 ms)으로 바꿔요.
 * 날짜만 있으면(예전 원고) 그날 한국 시간 0시로 봐요. 그래서 같은 날 시각까지 적힌 글보다 뒤(더 예전)로 가요.
 * @example publishedTime("2026-11-14T19:35:48+09:00") > publishedTime("2026-11-14T17:12:40+09:00"); // true
 */
export function publishedTime(publishedAt: string): number {
  return Date.parse(publishedAt.length === 10 ? `${publishedAt}T00:00:00+09:00` : publishedAt);
}

/**
 * "최신순" 정렬 규칙: 최근에 쓴 글이 앞에 옵니다. 같은 날 쓴 글은 시각으로 가르고(새 리뷰는 시각까지 적혀요),
 * 시각까지 같으면(날짜만 적힌 예전 원고끼리) 제목 가나다순이에요.
 *
 * 정렬 규칙 함수(비교 함수)를 읽는 법
 *   배열의 `.sort(규칙)`은 두 항목 a, b를 규칙에 넣어 보고, 돌아온 숫자로 순서를 정해요.
 *   - 음수가 나오면 a를 앞에
 *   - 양수가 나오면 b를 앞에
 *   - 0이면 순서를 그대로 둡니다
 *
 * @example
 * reviews.sort(compareLatest); // 2026-11-14 19:35 글 → 2026-11-14 17:12 글 → 2026-10-30 글 → ...
 */
export function compareLatest(a: Sortable, b: Sortable): number {
  // 1) 쓴 시각을 숫자(ms)로 바꿔 b − a: 큰 값, 즉 최근에 쓴 글이 앞에 옵니다(내림차순).
  //    (글자로 견주면 "2026-11-14"와 "2026-11-14T…"처럼 모양이 다른 값을 바르게 가르지 못해요.)
  // 2) `||`는 왼쪽이 0(=같음)일 때만 오른쪽을 계산해요. 시각까지 같을 때만 제목으로 한 번 더 비교하는 거죠.
  //    "ko"는 한국어 규칙(가나다순)으로 비교하라는 뜻입니다.
  return publishedTime(b.publishedAt) - publishedTime(a.publishedAt) || a.title.localeCompare(b.title, "ko");
}

/**
 * "평점순" 정렬 규칙: 평점이 높은 글이 앞에 와요. 평점이 같으면 최신순으로 정합니다.
 */
export function compareRating(a: Sortable, b: Sortable): number {
  // b.rating - a.rating: b가 더 크면 양수 → b가 앞으로. 즉 평점이 높은 쪽이 앞에 옵니다.
  // 평점이 같으면(0) `||` 오른쪽의 최신순 규칙으로 넘어가요.
  return b.rating - a.rating || compareLatest(a, b);
}
