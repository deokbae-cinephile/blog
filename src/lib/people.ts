/**
 * @file 사람 이름 목록(감독·출연) 다루기 (people.ts)
 *
 * 이 파일이 하는 일
 *   원고의 감독(director)과 출연(cast)은 여러 사람을 쉼표로 이어 한 줄로 적어요.
 *
 *     director: 한서윤, 김도윤
 *     cast: 레오나르도 디카프리오, 마크 러팔로
 *
 *   이 줄을 한 사람씩 나누고(splitNames), 다시 깔끔하게 잇고(joinNames),
 *   그 사람으로 찾은 목록 주소(personSearchHref)를 만들어요.
 *
 * 누가 쓰나요?
 *   lib/review-schema.ts(출연 정리), lib/browse.ts(검색 추천), lib/structured-data.ts(검색엔진 정보),
 *   components/review-article.tsx(상세의 감독·배우 이름 링크)
 */

/**
 * "A, B" 한 줄을 사람마다 나눠요. 앞뒤 빈칸을 지우고, 빈 이름과 같은 이름(두 번 적음)은 빼요.
 * @example splitNames("레오나르도 디카프리오,  마크 러팔로, "); // ["레오나르도 디카프리오", "마크 러팔로"]
 */
export function splitNames(text: string | undefined): string[] {
  if (!text) return [];
  const names = text
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  // new Set(...): 같은 이름은 한 번만 남겨요(처음 나온 순서는 그대로).
  return [...new Set(names)];
}

/**
 * 사람 이름들을 "A, B" 한 줄로 이어요(원고와 화면에 쓰는 모양).
 * @example joinNames(["레오나르도 디카프리오", "마크 러팔로"]); // "레오나르도 디카프리오, 마크 러팔로"
 */
export function joinNames(names: readonly string[]): string {
  return names.join(", ");
}

/**
 * 이 사람(감독·배우)의 이름으로 찾은 처음 화면 목록 주소. 이름이 들어간 리뷰만 보여요(lib/browse.ts의 검색).
 * @example personSearchHref("마크 러팔로"); // "/?q=%EB%A7%88%ED%81%AC%20%EB%9F%AC%ED%8C%94%EB%A1%9C"
 */
export function personSearchHref(name: string): string {
  return `/?q=${encodeURIComponent(name)}`;
}
