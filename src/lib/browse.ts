/**
 * @file 목록 검색·장르 필터·정렬 규칙 (browse.ts)
 *
 * 이 파일이 하는 일
 *   처음 화면의 "검색", "장르", "정렬"이 실제로 어떻게 동작하는지 정한 순수 함수들을 모아 둡니다.
 *
 * 맡은 기능
 *   1. 주소 ↔ 조건 바꾸기: `?q=겨울&genre=드라마&sort=rating` ↔ { q, genre, sort }
 *   2. 검색: 제목·원제·감독·한줄평 등에서 낱말 찾기(대소문자·띄어쓰기 무시)
 *   3. 자동완성: 검색창에 친 글자로 시작하거나 그 글자가 든 제목·원제·감독 추천하기(suggest)
 *   4. 거르기와 정렬: 장르로 거르고 최신순·평점순으로 늘어놓기
 *   5. 장르 버튼에 붙일 편수 세기, 결과 안내 문구 만들기
 *
 * "순수 함수"가 뭔가요?
 *   같은 입력을 넣으면 언제나 같은 결과를 돌려주고, 바깥의 아무것도 바꾸지 않는 함수예요.
 *   화면(React)과 떼어 놓았기 때문에 테스트하기 쉽습니다(lib/browse.test.ts).
 *
 * 누가 쓰나요?
 *   components/review-browser.tsx (처음 화면의 검색·목록 영역), components/search-box.tsx (자동완성)
 */

import { GENRES, type Genre, isGenre } from "./genres";
import { compareLatest, compareRating, type ReviewSummary } from "./review";

/** 정렬 방법: "latest"(최신순) 또는 "rating"(평점순) 둘 중 하나만 쓸 수 있어요. */
export type SortKey = "latest" | "rating";

/**
 * 목록 조건 묶음이에요. 주소의 `?q=&genre=&sort=`와 짝을 이룹니다.
 * 조건을 주소에 남기면 링크를 공유하거나 뒤로 가기를 해도 같은 목록이 보여요.
 */
export type BrowseParams = {
  /** 검색어. 없으면 빈 글자("") */
  q: string;
  /** 고른 장르. "전체"면 null */
  genre: Genre | null;
  /** 정렬 방법 */
  sort: SortKey;
};

/** 아무 조건도 없는 기본 상태: 검색어 없음, 장르 전체, 최신순 */
export const DEFAULT_PARAMS: BrowseParams = { q: "", genre: null, sort: "latest" };

/**
 * 주소의 조건을 읽는 데 필요한 모양이에요.
 * URLSearchParams(브라우저의 주소 조건 도구)와 Next.js의 useSearchParams() 결과가 모두 get()을 갖고 있어서,
 * 둘 다 받을 수 있게 "get만 있으면 된다"고 넓게 정했어요.
 */
type ParamReader = { get(name: string): string | null };

/**
 * 주소에서 목록 조건을 읽어요. 이상한 값(없는 장르, 모르는 정렬)은 무시하고 기본값을 씁니다.
 *
 * @example
 * parseParams(new URLSearchParams("q=겨울&sort=rating"));
 * // { q: "겨울", genre: null, sort: "rating" }
 */
export function parseParams(search: ParamReader): BrowseParams {
  const genre = search.get("genre");
  return {
    // `?.`는 "앞이 비어 있으면 뒤를 건너뛴다"는 뜻이에요. q가 없으면 trim()을 부르지 않고 undefined가 되고,
    // 그러면 `?? ""`가 빈 글자를 넣어 줍니다.
    q: search.get("q")?.trim() ?? "",
    // 장르 목록에 있는 이름일 때만 받아들여요. 없는 장르면 null(전체)로 둡니다.
    genre: genre && isGenre(genre) ? genre : null,
    // "rating"일 때만 평점순, 그 밖에는 모두 최신순이에요.
    sort: search.get("sort") === "rating" ? "rating" : "latest",
  };
}

/**
 * 목록 조건을 주소 뒤에 붙일 글자로 만들어요. 기본값은 주소를 지저분하게 하지 않도록 적지 않아요.
 *
 * @example
 * toSearch({ q: "겨울", genre: null, sort: "latest" }); // "?q=%EA%B2%A8%EC%9A%B8"
 * toSearch(DEFAULT_PARAMS);                              // ""
 */
export function toSearch({ q, genre, sort }: BrowseParams): string {
  // URLSearchParams는 한글·공백 같은 글자를 주소에 쓸 수 있는 모양(%EA%B2%A8...)으로 알아서 바꿔 줘요.
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (genre) params.set("genre", genre);
  if (sort !== "latest") params.set("sort", sort);
  const search = params.toString();
  // 조건이 하나라도 있으면 앞에 "?"를 붙이고, 없으면 빈 글자를 돌려줘요.
  return search ? `?${search}` : "";
}

/**
 * 검색어나 장르로 "거르고" 있는지 알려 줘요.
 * 정렬은 순서만 바꿀 뿐 리뷰를 빼지 않으므로 여기에 넣지 않습니다.
 */
export function isFiltered({ q, genre }: BrowseParams): boolean {
  return q !== "" || genre !== null;
}

/**
 * 비교하기 좋게 글자를 다듬어요.
 * - normalize("NFC"): 한글은 같은 글자라도 컴퓨터 안에서 저장 방식이 두 가지일 수 있어요. 하나로 맞춥니다.
 * - toLocaleLowerCase("ko"): 영어를 소문자로 바꿔 대소문자를 가리지 않게 해요("WINTER" = "winter").
 * 검색(matchesQuery)과 자동완성(suggest)이 같은 방법으로 비교하려고 함께 써요.
 */
export const fold = (text: string) => text.normalize("NFC").toLocaleLowerCase("ko");

/** 공백을 모두 지워요. 띄어쓰기를 다르게 써도 찾을 수 있게 합니다. /\s+/g는 "모든 공백 덩어리"라는 정규식이에요. */
const squeeze = (text: string) => text.replace(/\s+/g, "");

/**
 * 리뷰 한 편이 검색어에 맞는지 확인해요.
 *
 * 찾는 곳: 제목, 원제, 감독, 한줄평 (+ 국가, 연도, 장르)
 * 규칙:
 *   - 대소문자를 가리지 않아요. ("winter" → "Winter Stop")
 *   - 낱말을 여럿 쓰면 모두 들어 있어야 해요. ("겨울 한서윤" → 둘 다 있는 리뷰만)
 *   - 띄어쓰기가 달라도 찾아요. ("겨울정류장" → "겨울 정류장")
 *
 * @param review 확인할 리뷰
 * @param q 검색어
 * @returns 맞으면 true
 */
export function matchesQuery(review: ReviewSummary, q: string): boolean {
  // 검색어를 다듬은 뒤 공백으로 잘라 낱말 목록을 만들어요. filter(Boolean)은 빈 낱말("")을 빼 줍니다.
  const terms = fold(q).split(/\s+/).filter(Boolean);
  // 낱말이 없으면(빈 검색어) 모든 리뷰가 맞는 것으로 봐요.
  if (terms.length === 0) return true;

  // 찾을 곳의 글자를 모두 한 줄로 이어 "건초 더미(haystack)"를 만들어요.
  // 없는 값(원제·국가가 없을 때 undefined)은 filter(Boolean)으로 뺍니다.
  const haystack = fold(
    [review.title, review.originalTitle, review.director, review.oneLiner, review.country, String(review.year), ...review.genres]
      .filter(Boolean)
      .join(" "),
  );
  // 띄어쓰기를 무시한 비교용으로 공백을 지운 판도 만들어 둬요.
  const tight = squeeze(haystack);

  // every: 모든 낱말이 조건을 만족해야 true예요.
  // 낱말이 원래 글자(haystack) 또는 공백을 지운 글자(tight)에 들어 있으면 통과입니다.
  return terms.every((term) => haystack.includes(term) || tight.includes(term));
}

/** 자동완성 추천 하나: 보여 줄 글자(value)와 그 글자가 무엇인지(kind) */
export type Suggestion = {
  /** 추천 글자. 고르면 검색창에 이 글자가 들어가고 바로 찾아요. 예: "겨울 정류장" */
  value: string;
  /** 무엇의 이름인지. 추천 옆에 작게 보여 줘요. */
  kind: "제목" | "원제" | "감독";
};

/**
 * 검색창에 친 글자로 자동완성 추천을 만들어요.
 *
 * 규칙
 *   - 리뷰의 제목·원제·감독(여러 명이면 한 사람씩) 가운데 친 글자가 들어 있는 것을 골라요(대소문자·띄어쓰기 무시).
 *   - 친 글자로 "시작하는" 추천을 앞에, 중간에 "들어 있는" 추천을 뒤에 놓아요. 같은 무리 안에서는 가나다순이에요.
 *   - 같은 글자는 한 번만 보여요(예: 감독 한 사람이 리뷰 여러 편에 나와도 추천은 하나).
 *   - 너무 길어지지 않게 limit개까지만 돌려줘요.
 *
 * @param reviews 전체 리뷰
 * @param text 검색창에 친 글자
 * @param limit 최대 추천 수. 기본 8
 * @example
 * suggest(reviews, "겨울"); // [{ value: "겨울 정류장", kind: "제목" }]
 * suggest(reviews, "han");  // [{ value: "Han River Blues", kind: "원제" }, ...]
 */
export function suggest(reviews: readonly ReviewSummary[], text: string, limit = 8): Suggestion[] {
  // 비교할 글자: 다듬고(fold) 공백을 모두 지워요. 빈 글자면 추천하지 않아요.
  const needle = squeeze(fold(text.trim()));
  if (needle === "") return [];

  // 추천 후보를 모아요. Map을 쓰면 같은 글자(value)를 한 번만 담을 수 있어요(먼저 들어온 것이 남아요).
  const candidates = new Map<string, Suggestion>();
  for (const review of reviews) {
    candidates.set(review.title, candidates.get(review.title) ?? { value: review.title, kind: "제목" });
    if (review.originalTitle) {
      candidates.set(review.originalTitle, candidates.get(review.originalTitle) ?? { value: review.originalTitle, kind: "원제" });
    }
    // 감독이 여러 명이면 "A, B"처럼 쉼표로 이어 적어요. 한 사람씩 나눠 추천해요.
    for (const name of review.director.split(",").map((part) => part.trim()).filter(Boolean)) {
      candidates.set(name, candidates.get(name) ?? { value: name, kind: "감독" });
    }
  }

  // 후보마다 "친 글자가 어디에 있는지" 재요. 없으면 -1이라 빼고, 처음(0)에 있으면 앞 무리로 보내요.
  const scored = [...candidates.values()]
    .map((suggestion) => ({ suggestion, at: squeeze(fold(suggestion.value)).indexOf(needle) }))
    .filter(({ at }) => at !== -1);

  return (
    scored
      // 정렬: 1) 시작하는 것(at === 0)이 먼저 2) 같은 무리 안에서는 가나다순
      .sort((a, b) => Number(a.at !== 0) - Number(b.at !== 0) || a.suggestion.value.localeCompare(b.suggestion.value, "ko"))
      // 앞에서부터 limit개만 남기고, 점수 묶음을 벗겨 추천만 돌려줘요.
      .slice(0, limit)
      .map(({ suggestion }) => suggestion)
  );
}

/**
 * 조건에 맞는 리뷰만 골라, 정한 순서로 늘어놓아 돌려줘요.
 *
 * filter와 sort를 이어 쓰는 "메서드 체이닝"이에요.
 *   1) filter: 장르가 맞고(전체면 통과) 검색어도 맞는 리뷰만 남겨요.
 *   2) sort: 정렬 규칙(lib/review.ts)대로 늘어놓아요.
 * filter가 새 배열을 만들어 주기 때문에, sort가 원래 배열을 바꾸지 않아 안전합니다.
 */
export function browse(reviews: readonly ReviewSummary[], params: BrowseParams): ReviewSummary[] {
  return reviews
    .filter((review) => (params.genre === null || review.genres.includes(params.genre)) && matchesQuery(review, params.q))
    .sort(params.sort === "rating" ? compareRating : compareLatest);
}

/**
 * 장르 버튼에 보일 장르와 편수를 셉니다.
 *
 * - 리뷰가 하나도 없는 장르는 버튼을 만들지 않아요(눌러도 빈 목록이니까요).
 * - 단, 지금 고른 장르는 0편이어도 남겨 둬요. 주소로 그 장르가 들어왔을 때 어떤 버튼이 골라졌는지 보여야 하거든요.
 *
 * @param reviews 전체 리뷰
 * @param selected 지금 고른 장르(없으면 null)
 * @example
 * countGenres(reviews); // [{ genre: "드라마", count: 3 }, { genre: "공포", count: 1 }, ...]
 */
export function countGenres(
  reviews: readonly ReviewSummary[],
  selected: Genre | null = null,
): { genre: Genre; count: number }[] {
  return (
    GENRES
      // 장르마다 그 장르가 붙은 리뷰 수를 셉니다.
      .map((genre) => ({ genre, count: reviews.filter((review) => review.genres.includes(genre)).length }))
      // 1편 이상이거나, 지금 고른 장르면 남겨요.
      .filter(({ genre, count }) => count > 0 || genre === selected)
  );
}

/**
 * 목록 위에 보이고 화면 낭독기가 읽어 주는 결과 안내 문구예요.
 *
 * @param total 전체 리뷰 수
 * @param found 조건에 맞는 리뷰 수
 * @param params 지금 조건
 * @example
 * resultStatus(8, 8, DEFAULT_PARAMS);                    // "전체 8편"
 * resultStatus(8, 1, { ...DEFAULT_PARAMS, q: "겨울" });  // "8편 중 1편"
 */
export function resultStatus(total: number, found: number, params: BrowseParams): string {
  return isFiltered(params) ? `${total}편 중 ${found}편` : `전체 ${total}편`;
}
