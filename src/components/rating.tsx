/**
 * @file 평점 표시 (rating.tsx)
 *
 * 이 파일이 하는 일
 *   평점(0.5 ~ 5점)을 숫자로만 보여 줘요. 예: 4.5
 *   (예전에는 픽셀 별 다섯 개를 그렸지만, 가볍고 읽기 쉽게 숫자만 남겼어요.)
 *
 * 접근성 포인트
 *   화면에는 "4.5"만 보이지만, 숫자만 들으면 무엇인지 모를 수 있어요.
 *   그래서 화면 낭독기에는 숨겨 둔 글(sr-only) "평점 5점 만점에 4.5점"을 읽어 주고,
 *   눈에 보이는 숫자는 aria-hidden으로 숨겨 같은 정보를 두 번 읽지 않게 했어요.
 *
 * 누가 쓰나요?
 *   components/review-list-item.tsx(목록), components/review-article.tsx(상세)
 */

import { formatRating } from "@/lib/format";

/** Rating이 받는 값 */
type Props = {
  /** 평점. 0.5부터 5까지, 0.5 단위 */
  value: number;
  /** 바깥에서 더할 CSS 클래스 */
  className?: string;
};

/**
 * 평점을 숫자로 보여 줘요.
 *
 * @example
 * <Rating value={4.5} /> // 화면: 4.5 / 화면 낭독기: 평점 5점 만점에 4.5점
 */
export function Rating({ value, className = "" }: Props) {
  // 4 → "4.0"처럼 소수 한 자리 글자로 바꿔 둬요(lib/format.ts).
  const text = formatRating(value);

  return (
    // whitespace-nowrap: 숫자가 줄바꿈으로 갈라지지 않게 해요.
    <span className={`whitespace-nowrap ${className}`}>
      {/* sr-only: 화면에는 보이지 않고 화면 낭독기만 읽는 글이에요(Tailwind 기본 클래스). */}
      <span className="sr-only">{`평점 5점 만점에 ${text}점`}</span>
      <span aria-hidden="true">{text}</span>
    </span>
  );
}
