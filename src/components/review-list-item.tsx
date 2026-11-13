/**
 * @file 목록의 리뷰 한 편 (review-list-item.tsx)
 *
 * 이 파일이 하는 일
 *   처음 화면 목록에서 리뷰 한 편을 한 덩어리로 보여 줍니다.
 *
 *     -  ┌────┐ 겨울 정류장 ································ 4.5   ← 첫째 줄: 제목 · 평점
 *        │포스│ Winter Stop · 2024 · 감독 한서윤                  ← 둘째 줄: 원제 · 연도 · 감독
 *        │ 터 │ “버스는 오지 않아도, 기다림은 끝내 도착한다.”     ← 셋째 줄: 한줄평
 *        │2:3 │ [드라마]                                          ← 넷째 줄: 장르
 *        └────┘
 *   글 쓴 날은 화면에 보이지 않아요. 목록의 "최신순" 정렬에만 써요.
 *
 * 맡은 기능
 *   - 포스터 썸네일(2:3)을 보여 줘요. 없으면 기본 포스터예요. 형광 초록으로 바뀌어 보여요(components/poster.tsx).
 *   - 제목을 누르면 상세 화면(/reviews/<slug>)으로 가요. 항목 어디를 눌러도 갈 수 있게 누르는 영역을 넓혔어요.
 *   - 마우스를 올리거나 키보드 초점이 오면 항목 전체가 반전돼요(단말기에서 고른 줄처럼).
 *   - 맨 앞의 "-"는 목록 표시예요(번호 대신). 목록(<ul>)이 이미 "항목"이라고 알려 주므로 화면 낭독기에서는 숨겨요.
 *
 * 링크 영역을 넓히는 방법(stretched-link)
 *   항목 전체를 <a>로 감싸면 화면 낭독기가 항목 속 글자를 몽땅 링크 이름으로 읽어 버려요.
 *   그래서 링크는 제목에만 달고, CSS로 링크의 투명한 ::after 막을 항목 전체에 덮어 누르는 영역만 넓힙니다.
 *   (globals.css의 stretched-link 참고. 막의 기준이 되도록 <li>에 relative를 줍니다.)
 *
 * 누가 쓰나요?
 *   components/review-browser.tsx가 목록을 그릴 때 리뷰마다 하나씩 씁니다.
 */

import Link from "next/link";

import type { ReviewSummary } from "@/lib/review";

import { GenreTags } from "./genre-tags";
import { Poster } from "./poster";
import { Rating } from "./rating";

/** ReviewListItem이 받는 값 */
type Props = {
  /** 보여 줄 리뷰 */
  review: ReviewSummary;
};

/** 목록의 리뷰 한 편 */
export function ReviewListItem({ review }: Props) {
  // 구조 분해 할당: review.title 대신 title처럼 짧게 쓰려고 필요한 항목을 꺼내 둬요.
  const { slug, title, originalTitle, year, director, genres, rating, oneLiner, poster } = review;
  // 제목 요소의 id. 아래 <article>의 이름(aria-labelledby)으로 연결해요. slug는 겹치지 않으니 id로 쓰기 좋아요.
  const titleId = `review-${slug}`;

  return (
    // group: 자식이 "부모(group)에 마우스가 올라갔을 때"를 알 수 있게 하는 Tailwind 표시예요(group-hover:).
    // relative: 제목 링크의 투명 막(stretched-link)이 이 <li> 크기만큼 덮도록 기준을 잡아요.
    // has-[a:focus-visible]:outline-...: 안쪽 링크에 키보드 초점이 오면 <li> 둘레에 점선 테두리를 그려요.
    <li className="group relative has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-crt-fg has-[a:focus-visible]:outline-dashed">
      {/* <article>: 혼자 떼어 놓아도 뜻이 통하는 독립된 내용(리뷰 한 편)이라는 뜻의 태그예요. */}
      <article
        aria-labelledby={titleId}
        // group-hover:inverse — 부모에 마우스가 올라가면 반전, group-has-[a:focus-visible]:inverse — 키보드 초점이 와도 반전
        // grid-cols-[5rem_minmax(0,1fr)] — 휴대폰: 왼쪽 5rem 칸에 포스터, 오른쪽에 내용
        // sm:grid-cols-[1rem_6rem_minmax(0,1fr)] — 넓은 화면: "-" · 포스터 · 내용 세 칸
        // minmax(0,1fr): 남는 너비를 모두 쓰되, 긴 글자 때문에 칸이 넘치지 않게 최소 0까지 줄어들 수 있게 해요.
        className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-x-4 px-3 py-4 group-hover:inverse group-has-[a:focus-visible]:inverse sm:grid-cols-[1rem_6rem_minmax(0,1fr)]"
      >
        {/* 목록 표시 "-". <ul>이 이미 목록이라고 알려 주니 화면 낭독기에서는 숨겨요. 휴대폰에서는 자리를 아끼려고 숨겨요. */}
        <span aria-hidden="true" className="hidden text-crt-dim sm:block">
          -
        </span>

        {/* 포스터 썸네일. 바로 옆에 제목이 있어 같은 말을 두 번 읽지 않도록 꾸밈(alt="")으로 둬요. */}
        <Poster src={poster} alt="" size="thumb" />

        {/* min-w-0: 긴 제목이 칸을 밀어내지 않고 줄바꿈되게 하는 그리드·플렉스 요령이에요. */}
        <div className="min-w-0">
          {/* 첫째 줄: 제목 · 점선 · 평점 */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 id={titleId} className="glow">
              {/* stretched-link: 누르는 영역을 항목 전체로 넓혀요.
                  focus-visible:outline-none: 링크 자체의 초점 테두리는 지우고, 대신 <li> 전체에 테두리와 반전을 보여 줘요. */}
              <Link href={`/reviews/${slug}`} className="stretched-link no-underline focus-visible:outline-none">
                {title}
              </Link>
            </h3>
            <span aria-hidden="true" className="leader hidden sm:block" />
            <Rating value={rating} />
          </div>

          {/* 둘째 줄: 원제 · 연도 · 감독. 없는 값(원제가 없을 때)은 filter(Boolean)으로 빼고 " · "로 이어요. */}
          <p className="text-crt-dim">{[originalTitle, year, `감독 ${director}`].filter(Boolean).join(" · ")}</p>

          {/* 셋째 줄: 한줄평(부제 자리). 화면 낭독기에는 앞에 "한줄평:"을 붙여 무슨 글인지 알려 줘요. */}
          <p className="mt-1">
            <span className="sr-only">한줄평: </span>“{oneLiner}”
          </p>

          {/* 넷째 줄: 장르 */}
          <GenreTags genres={genres} label="장르" className="mt-2 text-crt-dim" />
        </div>
      </article>
    </li>
  );
}
