/**
 * @file 화면에 보일 글자 모양 맞추기 (format.ts)
 *
 * 이 파일이 하는 일
 *   데이터(평점 숫자, 정보 줄 항목)를 화면에 보이기 좋은 글자로 바꾸는 작은 함수를 모아 둡니다.
 *
 * 왜 따로 둘까요?
 *   평점을 "4.5"로 보이는 곳이 목록, 상세 화면, 탭 제목 설명 등 여러 군데예요.
 *   함수로 만들어 두면 모양을 바꾸고 싶을 때 이 파일만 고치면 됩니다.
 */

/**
 * 평점을 소수 한 자리로 보입니다. 평점이 0.5 단위라 한 자리면 충분해요.
 *
 * @param value 평점 숫자 (0.5 ~ 5)
 * @returns 소수 한 자리 글자
 * @example
 * formatRating(4);   // "4.0"
 * formatRating(4.5); // "4.5"
 */
export function formatRating(value: number): string {
  // toFixed(1)은 숫자를 "소수 첫째 자리까지 쓴 글자"로 바꿉니다. 4 → "4.0"
  return value.toFixed(1);
}

/** 줄바꿈되지 않는 빈칸(NBSP). 이 빈칸 앞뒤 글자는 늘 같은 줄에 있어요. */
export const NBSP = "\u00a0";

/**
 * 정보 줄 항목 사이의 구분자 " · ".
 * 가운뎃점 앞 빈칸을 NBSP로 붙여서, 줄이 넘칠 때 "·"는 앞 항목 끝에 남고 다음 줄은 항목으로 시작해요.
 * (보통 빈칸이면 휴대폰에서 "· 조회 12"처럼 가운뎃점으로 시작하는 줄이 생겨요.)
 */
export const FACT_SEPARATOR = `${NBSP}· `;

/**
 * 이름표가 붙은 정보 항목을 만들어요. 이름표와 값 사이를 NBSP로 붙여, 줄바꿈으로 둘이 떨어지지 않게 해요.
 *
 * @example
 * labeled("감독", "한서윤"); // "감독 한서윤"(가운데 빈칸은 NBSP)
 */
export function labeled(label: string, value: string): string {
  return `${label}${NBSP}${value}`;
}

/**
 * 정보 줄 항목들을 " · "(FACT_SEPARATOR)로 이어요. 없는 항목(원제가 없을 때의 undefined 등)은 빼요.
 *
 * @example
 * joinFacts(["Winter Stop", 2024, undefined, labeled("감독", "한서윤")]); // "Winter Stop · 2024 · 감독 한서윤"
 */
export function joinFacts(parts: ReadonlyArray<string | number | null | undefined>): string {
  // filter: undefined·null·빈 글자는 빼요(연도·상영 시간은 0이 될 일이 없어요).
  return parts.filter((part) => part !== undefined && part !== null && part !== "").join(FACT_SEPARATOR);
}
