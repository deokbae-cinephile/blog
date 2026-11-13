/**
 * @file 화면에 보일 글자 모양 맞추기 (format.ts)
 *
 * 이 파일이 하는 일
 *   데이터(평점 숫자)를 화면에 보이기 좋은 글자로 바꾸는 작은 함수를 모아 둡니다.
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
