/**
 * @file 장르 목록 (genres.ts)
 *
 * 이 파일이 하는 일
 *   리뷰에 붙일 수 있는 장르를 정해 둡니다.
 *
 * 맡은 기능
 *   1. 원고 검사: 원고에 목록에 없는 장르(오타 포함)를 쓰면 빌드할 때 알려 줍니다(lib/review-schema.ts).
 *   2. 장르 필터: 처음 화면의 장르 버튼이 이 순서대로 놓입니다(lib/browse.ts).
 *      글쓰기 화면의 장르 고르기 칸도 이 순서예요(components/review-writer.tsx).
 *   3. 주소 검사: 주소에 `?genre=없는장르`가 들어와도 무시합니다(isGenre).
 *
 * 왜 장르를 미리 정해 둘까요?
 *   글쓴이가 어떤 글에는 "공포", 다른 글에는 "호러"라고 쓰면 장르 필터가 둘로 갈라지죠.
 *   쓸 수 있는 이름을 정해 두면 이런 실수를 빌드 단계에서 잡을 수 있어요.
 *
 * 새 장르가 필요하면?
 *   아래 배열에 이름을 더하면 돼요. 글쓰기 화면(components/review-writer.tsx)의 장르 칸에도 저절로 나타나요.
 */

/**
 * 쓸 수 있는 장르 이름들. 장르 필터에도 이 순서대로 보입니다.
 *
 * `as const`를 붙이면 TypeScript가 이 배열을 "string 여러 개"가 아니라
 * "정확히 이 글자들만 들어 있는, 바뀌지 않는 목록"으로 기억해요.
 * 바로 아래의 Genre 타입을 만들 수 있는 것도 이 덕분입니다.
 */
export const GENRES = [
  "드라마",
  "코미디",
  "액션",
  "스릴러",
  "범죄",
  "미스터리",
  "공포",
  "다큐멘터리",
  "음악",
  "전쟁",
  "역사",
  "모험",
  "서부",
] as const;

/**
 * 장르 하나를 나타내는 타입이에요.
 *
 * 읽는 법: `(typeof GENRES)[number]`
 *   - `typeof GENRES`는 "GENRES 배열의 타입"
 *   - `[number]`는 "그 배열의 아무 칸에 들어 있는 값의 타입"
 *   → 결과는 "드라마" | "코미디" | ... | "서부" 처럼 목록 안의 글자 중 하나만 허락하는 타입이 됩니다.
 */
export type Genre = (typeof GENRES)[number];

/**
 * 어떤 글자가 장르 목록에 있는지 확인합니다.
 *
 * 반환 타입의 `value is Genre`는 "타입 가드"라고 불러요.
 * `if (isGenre(text)) { ... }` 안쪽에서는 TypeScript가 text를 그냥 string이 아니라 Genre로 대해 줍니다.
 *
 * @param value 확인할 글자 (예: 주소의 ?genre= 값)
 * @returns 목록에 있으면 true
 * @example
 * isGenre("드라마"); // true
 * isGenre("멜로");   // false
 */
export function isGenre(value: string): value is Genre {
  // GENRES는 "정해진 글자만 든 배열" 타입이라 includes에 아무 string이나 넣으면 타입 오류가 나요.
  // 그래서 잠깐 "string 배열"로 바꿔(as readonly string[]) 비교합니다.
  return (GENRES as readonly string[]).includes(value);
}
