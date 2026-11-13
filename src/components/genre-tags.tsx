/**
 * @file 장르 표시 컴포넌트 (genre-tags.tsx)
 *
 * 이 파일이 하는 일
 *   리뷰의 장르를 [드라마] [로맨스]처럼 대괄호로 묶어 나란히 보여 줍니다.
 *
 * 맡은 기능
 *   - 목록 화면: 장르를 글자로만 보여 줘요(항목 전체가 이미 링크라 안에 링크를 또 넣지 않아요).
 *   - 상세 화면(linked): 장르마다 "그 장르로 거른 목록"(/?genre=드라마)으로 가는 링크를 달아요.
 *
 * 접근성 포인트
 *   대괄호 [ ]는 꾸밈이라 aria-hidden으로 숨겨요. 화면 낭독기는 "드라마"만 읽습니다.
 *   장르 여러 개는 목록(<ul>, <li>)으로 만들어 "목록, 항목 2개"처럼 구조를 알려 줘요.
 *
 * 누가 쓰나요?
 *   components/review-list-item.tsx(목록), components/review-article.tsx(상세)
 */

// next/link의 Link는 Next.js의 링크예요. 페이지 전체를 새로 받지 않고 필요한 부분만 바꿔 빠르게 이동합니다.
import Link from "next/link";

import type { Genre } from "@/lib/genres";

/** GenreTags가 받는 값 */
type Props = {
  /** 보여 줄 장르 목록 */
  genres: readonly Genre[];
  /** true면 장르마다 그 장르로 거른 목록(/?genre=)으로 가는 링크를 달아요. */
  linked?: boolean;
  /** 목록의 이름. 둘레에 '장르' 같은 제목이 없을 때 화면 낭독기에 알려 줄 이름이에요. */
  label?: string;
  /** 바깥에서 더할 CSS 클래스 */
  className?: string;
};

/**
 * [드라마] [로맨스]처럼 대괄호로 묶은 장르 목록을 보여 줍니다.
 *
 * @example
 * <GenreTags genres={["드라마", "로맨스"]} label="장르" />  // 글자만
 * <GenreTags genres={["SF"]} linked />                     // 링크로
 */
export function GenreTags({ genres, linked = false, label, className = "" }: Props) {
  return (
    // aria-label은 label이 없으면(undefined) 속성 자체가 붙지 않아요.
    <ul aria-label={label} className={`flex flex-wrap gap-x-3 gap-y-1 ${className}`}>
      {/* 배열.map으로 장르마다 <li>를 하나씩 만들어요. key에는 겹치지 않는 장르 이름을 씁니다. */}
      {genres.map((genre) => {
        // 링크든 아니든 똑같이 보일 모양을 먼저 만들어 둬요. <>...</>는 "Fragment"로, 감싸는 태그 없이 여러 요소를 묶어요.
        const face = (
          <>
            <span aria-hidden="true">[</span>
            {genre}
            <span aria-hidden="true">]</span>
          </>
        );
        return (
          <li key={genre}>
            {/* 조건 ? A : B — linked가 참이면 링크(A), 아니면 글자(B)를 그려요. */}
            {linked ? (
              // encodeURIComponent: 한글을 주소에 쓸 수 있는 모양(%EB%93%9C...)으로 바꿔요.
              <Link href={`/?genre=${encodeURIComponent(genre)}`} className="term-link">
                {face}
              </Link>
            ) : (
              face
            )}
          </li>
        );
      })}
    </ul>
  );
}
