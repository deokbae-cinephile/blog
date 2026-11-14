/**
 * @file 목록의 리뷰 한 편 (review-list-item.tsx)
 *
 * 이 파일이 하는 일
 *   처음 화면 목록에서 리뷰 한 편을 한 덩어리로 보여 줍니다.
 *
 *     ┌────┐ 겨울 정류장 [드라마] [로맨스] ················ 4.5   ← 첫째 줄: 제목 + 장르 태그 · 평점
 *     │포스│ Winter Stop · 2024 · 감독 한서윤 · 출연 김태리      ← 둘째 줄: 원제 · 연도 · 감독 · 출연(글자만)
 *     │ 터 │
 *     │2:3 │ “버스는 오지 않아도, 기다림은 끝내 도착한다.”     ← 한줄평: 썸네일 아래 끝에 맞춰요
 *     └────┘
 *   글 쓴 날은 화면에 보이지 않아요. 목록의 "최신순" 정렬에만 써요.
 *
 * 맡은 기능
 *   - 포스터 썸네일(2:3)을 맨 앞에 보여 줘요. 없으면 기본 포스터예요. 형광 초록으로 바뀌어 보여요(components/poster.tsx).
 *   - 글자 칸은 썸네일과 같은 높이로 늘어나고, 한줄평은 그 아래 끝(썸네일 아래 끝과 같은 높이)에 붙어요.
 *     글이 길어 썸네일보다 높아지면(좁은 화면 등) 한줄평은 자연스럽게 이어서 놓여요.
 *   - 제목을 누르면 상세 화면(/reviews/<slug>)으로 가요. 항목 어디를 눌러도 갈 수 있게 누르는 영역을 넓혔어요.
 *   - 마우스를 올리거나 키보드 초점이 오면 항목 전체가 반전돼요(단말기에서 고른 줄처럼).
 *
 * 링크 영역을 넓히는 방법(stretched-link)
 *   항목 전체를 <a>로 감싸면 화면 낭독기가 항목 속 글자를 몽땅 링크 이름으로 읽어 버려요.
 *   그래서 링크는 제목에만 달고, CSS로 링크의 투명한 ::after 막을 항목 전체에 덮어 누르는 영역만 넓힙니다.
 *   (globals.css의 stretched-link 참고. 막의 기준이 되도록 <li>에 relative를 줍니다.)
 *
 * 누가 쓰나요?
 *   components/review-browser.tsx가 목록을 그릴 때 리뷰마다 하나씩 씁니다.
 */

import { joinFacts, labeled } from "@/lib/format";
import type { ReviewSummary } from "@/lib/review";


import { GenreTags } from "./genre-tags";
import { IntentLink } from "./intent-link";
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
  const { slug, title, originalTitle, year, director, cast, genres, rating, oneLiner, poster } = review;
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
        // grid-cols-[3.5rem_minmax(0,1fr)] — 휴대폰: 왼쪽 3.5rem 칸에 썸네일, 오른쪽에 글자
        // sm:grid-cols-[4rem_minmax(0,1fr)] — 넓은 화면: 썸네일 4rem
        // items-stretch: 글자 칸이 썸네일과 같은 높이로 늘어나요(한줄평을 아래 끝에 붙이려고).
        // minmax(0,1fr): 남는 너비를 모두 쓰되, 긴 글자 때문에 칸이 넘치지 않게 최소 0까지 줄어들 수 있게 해요.
        className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-stretch gap-x-4 px-3 py-3 group-hover:inverse group-has-[a:focus-visible]:inverse sm:grid-cols-[4rem_minmax(0,1fr)]"
      >
        {/* 포스터 썸네일. 바로 옆에 제목이 있어 같은 말을 두 번 읽지 않도록 꾸밈(alt="")으로 둬요.
            self-start: 글이 썸네일보다 길어도(좁은 화면) 썸네일은 늘어나지 않고 2:3 비율을 지켜요. */}
        <Poster src={poster} alt="" size="thumb" className="self-start" />

        {/* 글자 칸. flex-col: 줄을 위에서 아래로 쌓고, 한줄평은 mt-auto로 맨 아래에 붙여요.
            min-w-0: 긴 제목이 칸을 밀어내지 않고 줄바꿈되게 하는 그리드·플렉스 요령이에요. */}
        <div className="flex min-w-0 flex-col">
          {/* 첫째 줄: 제목 + 장르 태그 · 점선 · 평점(상세 화면처럼 제목과 장르를 함께 보여요) */}
          <div className="flex flex-wrap items-center gap-x-3">
            <h3 id={titleId} className="glow">
              {/* stretched-link: 누르는 영역을 항목 전체로 넓혀요(마우스를 항목 어디에 올려도 이 링크에 올린 것이에요).
                  focus-visible:outline-none: 링크 자체의 초점 테두리는 없애고, 대신 <li> 전체에 테두리와 반전을 보여 줘요.
                  IntentLink: 목록에 보이기만 해서는 상세 화면을 미리 받지 않고, 마우스를 올리거나 초점이 갈 때만 받아요. */}
              <IntentLink href={`/reviews/${slug}`} className="stretched-link no-underline focus-visible:outline-none">
                {title}
              </IntentLink>
            </h3>
            {/* 장르 태그: 제목 바로 옆. 목록 한 편 전체가 상세로 가는 링크라, 장르는 링크 없이 글자로만 둬요(링크 안에 링크를 둘 수 없어요).
                text-crt-dim: 제목보다 덜 눈에 띄는 보조 글자색. 좁은 화면에서 자리가 모자라면 다음 줄로 넘어가요(flex-wrap). */}
            <GenreTags genres={genres} label="장르" className="text-crt-dim" />
            <span aria-hidden="true" className="leader hidden sm:block" />
            {/* ml-auto: 점선이 없는 휴대폰에서도 평점이 오른쪽 끝에 붙어요. */}
            <Rating value={rating} className="ml-auto" />
          </div>

          {/* 둘째 줄: 원제 · 연도 · 감독 · 출연. 없는 값(원제·출연이 없을 때)은 빼고 " · "로 이어요(lib/format.ts의 joinFacts).
              가운뎃점은 앞 항목에 붙어서, 휴대폰에서 줄이 넘쳐도 "· 감독 …"처럼 가운뎃점으로 시작하는 줄이 생기지 않아요.
              감독·배우 이름은 글자로만 둬요. 목록 한 편 전체가 상세로 가는 링크라(이름을 눌러도 상세로 가요), 이름으로 찾기는 상세 화면에서 해요. */}
          <p className="mt-1 text-crt-dim">
            {joinFacts([originalTitle, year, labeled("감독", director), cast ? labeled("출연", cast) : undefined])}
          </p>

          {/* 한줄평. mt-auto: 남는 높이를 위에 두어 글자 칸 맨 아래(썸네일 아래 끝)에 붙어요.
              pt-2: 썸네일이 글보다 낮을 때(좁은 화면)에도 둘째 줄과 붙지 않게 조금 띄워요.
              화면 낭독기에는 앞에 "한줄평:"을 붙여 무슨 글인지 알려 줘요. */}
          <p className="mt-auto pt-2">
            <span className="sr-only">한줄평: </span>“{oneLiner}”
          </p>
        </div>
      </article>
    </li>
  );
}
