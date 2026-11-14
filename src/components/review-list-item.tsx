/**
 * @file 목록의 리뷰 한 편 (review-list-item.tsx)
 *
 * 이 파일이 하는 일
 *   처음 화면 목록에서 리뷰 한 편을 한 덩어리로 보여 줍니다.
 *
 *     넓은 화면(640px~)
 *     ┌────┐ 겨울 정류장 ······································ 4.5   ← 첫째 줄: 제목 · 점선 · 평점
 *     │포스│ Winter Stop · 2024 · 한서윤                          ← 둘째 줄: 원제 · 연도 · 감독(이름만, 2줄까지 …)
 *     │ 터 │
 *     │2:3 │ “버스는 오지 않아도, 기다림은 끝내 도착한다.”          ← 한 줄 평: 썸네일 아래 끝에 맞춰요
 *     └────┘ [수정] [삭제]                                        ← 글쓴이로 로그인했을 때만(상세를 열지 않은 동안)
 *
 *     휴대폰(~639px): 평점은 포스터 아래에 놓이고, 한 줄 평은 둘째 줄 바로 아래(4px)에 붙어요.
 *     ┌────┐ 겨울 정류장
 *     │포스│ Winter Stop · 2024 · 한서윤
 *     │ 터 │ “버스는 오지 않아도, 기다림은 끝내 도착한다.”
 *     └────┘
 *      4.5
 *
 *   글 쓴 날은 화면에 보이지 않아요. 목록의 "최신순" 정렬에만 써요.
 *   장르와 출연은 목록에 보이지 않아요(상세 화면에서 보여요. 2.0.0 핫픽스에서 뺐어요). 감독은 이름표("감독:") 없이 이름만 둬요.
 *
 * 맡은 기능
 *   - 포스터 썸네일(2:3)을 맨 앞에 보여 줘요. 없으면 기본 포스터예요. 형광 초록으로 바뀌어 보여요(components/poster.tsx).
 *   - 평점은 넓은 화면에서 첫째 줄 오른쪽 끝, 휴대폰에서는 포스터 아래에 보여요.
 *     (두 자리에 하나씩 그려 두고 화면 너비에 맞는 하나만 보여요. 숨긴 쪽은 display: none이라 화면 낭독기도 한 번만 읽어요.)
 *   - 글자 칸은 썸네일과 같은 높이로 늘어나고, 한 줄 평은 그 아래 끝(썸네일 아래 끝과 같은 높이)에 붙어요.
 *     글이 길어 썸네일보다 높아지면(좁은 화면 등) 한 줄 평은 자연스럽게 이어서 놓여요.
 *   - 상세 화면을 열었을 때(linked: v3 이후)만 제목이 링크예요.
 *     누르면 상세 화면(/reviews/<slug>)으로 가요. 항목 어디를 눌러도 갈 수 있게 누르는 영역을 넓혔어요.
 *     마우스를 올리거나 키보드 초점이 오면 항목 전체가 반전돼요(단말기에서 고른 줄처럼).
 *   - 링크가 아닐 때(v3 전, 글쓴이도 같아요)는 제목이 글자로만 있고, 반전되지 않아요. "한 줄 평" 위주로 읽는 목록이에요.
 *     이때 글쓴이로 로그인했으면 한 편마다 아래에 [수정]·[삭제]가 보여요(review-list-admin.tsx).
 *
 * 링크 영역을 넓히는 방법(stretched-link)
 *   항목 전체를 <a>로 감싸면 화면 낭독기가 항목 속 글자를 몽땅 링크 이름으로 읽어 버려요.
 *   그래서 링크는 제목에만 달고, CSS로 링크의 투명한 ::after 막을 항목 전체에 덮어 누르는 영역만 넓힙니다.
 *   (globals.css의 stretched-link 참고. 막의 기준이 되도록 <li>에 relative를 줍니다.)
 *
 * 누가 쓰나요?
 *   components/review-browser.tsx가 목록을 그릴 때 리뷰마다 하나씩 씁니다.
 */

import { joinFacts } from "@/lib/format";
import type { ReviewSummary } from "@/lib/review";

import { IntentLink } from "./intent-link";
import { Poster } from "./poster";
import { Rating } from "./rating";
import { ReviewListAdmin } from "./review-list-admin";

/** ReviewListItem이 받는 값 */
type Props = {
  /** 보여 줄 리뷰 */
  review: ReviewSummary;
  /** 제목을 상세 화면으로 가는 링크로 둘지(상세를 열 수 있을 때만 true. components/review-browser.tsx가 정해요) */
  linked: boolean;
};

/** 목록의 리뷰 한 편 */
export function ReviewListItem({ review, linked }: Props) {
  // 구조 분해 할당: review.title 대신 title처럼 짧게 쓰려고 필요한 항목을 꺼내 둬요.
  const { slug, title, originalTitle, year, director, rating, oneLiner, poster } = review;
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
        // tabIndex -1: Tab 순서에는 넣지 않고, [더 보기]로 불러온 뒤 코드로 초점을 옮길 수만 있게 해요(링크가 없을 때 review-browser.tsx).
        tabIndex={-1}
        // group-hover:inverse — 부모에 마우스가 올라가면 반전, group-has-[a:focus-visible]:inverse — 키보드 초점이 와도 반전
        //   (제목이 링크일 때만. 링크가 아니면 누를 곳이 없어 반전하지 않아요.)
        // focus-visible:outline-*: 코드로 이 항목에 초점을 옮기면 점선 테두리로 보여 줘요.
        // grid-cols-[3.5rem_minmax(0,1fr)] — 휴대폰: 왼쪽 3.5rem 칸에 썸네일, 오른쪽에 글자
        // sm:grid-cols-[4.375rem_minmax(0,1fr)] — 넓은 화면: 썸네일 4.375rem(70px)
        // items-stretch: 글자 칸이 썸네일과 같은 높이로 늘어나요(한 줄 평을 아래 끝에 붙이려고).
        // minmax(0,1fr): 남는 너비를 모두 쓰되, 긴 글자 때문에 칸이 넘치지 않게 최소 0까지 줄어들 수 있게 해요.
        className={`grid grid-cols-[3.5rem_minmax(0,1fr)] items-stretch gap-x-4 px-3 py-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crt-fg focus-visible:outline-dashed sm:grid-cols-[4.375rem_minmax(0,1fr)] ${
          linked ? "group-hover:inverse group-has-[a:focus-visible]:inverse" : ""
        }`}
      >
        {/* 왼쪽 칸: 포스터 썸네일, 휴대폰에서는 그 아래에 평점.
            포스터는 바로 옆에 제목이 있어 같은 말을 두 번 읽지 않도록 꾸밈(alt="")으로 둬요.
            self-start: 글이 썸네일보다 길어도(좁은 화면) 왼쪽 칸은 늘어나지 않고 포스터는 2:3 비율을 지켜요.
            justify-items-center: 평점 숫자를 포스터 가운데 아래에 놓아요. gap-2: 포스터와 평점 사이 8px. */}
        <div className="grid content-start justify-items-center gap-2 self-start">
          <Poster src={poster} alt="" size="thumb" />
          {/* sm:hidden: 640px 이상에서는 숨겨요(그때는 첫째 줄 오른쪽 끝의 평점이 보여요). */}
          <Rating value={rating} className="sm:hidden" />
        </div>

        {/* 글자 칸. flex-col: 줄을 위에서 아래로 쌓고, 한 줄 평은 mt-auto로 맨 아래에 붙여요.
            min-w-0: 긴 제목이 칸을 밀어내지 않고 줄바꿈되게 하는 그리드·플렉스 요령이에요. */}
        <div className="flex min-w-0 flex-col">
          {/* 첫째 줄: 제목 · 점선 · 평점(평점은 640px 이상에서만. 휴대폰은 포스터 아래) */}
          <div className="flex flex-wrap items-center gap-x-3">
            <h3 id={titleId} className="glow">
              {/* 상세를 열 수 있을 때만 링크예요.
                  stretched-link: 누르는 영역을 항목 전체로 넓혀요(마우스를 항목 어디에 올려도 이 링크에 올린 것이에요).
                  focus-visible:outline-none: 링크 자체의 초점 테두리는 없애고, 대신 <li> 전체에 테두리와 반전을 보여 줘요.
                  IntentLink: 목록에 보이기만 해서는 상세 화면을 미리 받지 않고, 마우스를 올리거나 초점이 갈 때만 받아요. */}
              {linked ? (
                <IntentLink href={`/reviews/${slug}`} className="stretched-link no-underline focus-visible:outline-none">
                  {title}
                </IntentLink>
              ) : (
                title
              )}
            </h3>
            <span aria-hidden="true" className="leader hidden sm:block" />
            {/* max-sm:hidden: 640px보다 좁으면 숨겨요(휴대폰은 포스터 아래의 평점이 보여요). ml-auto: 오른쪽 끝에 붙어요. */}
            <Rating value={rating} className="ml-auto max-sm:hidden" />
          </div>

          {/* 둘째 줄: 원제 · 연도 · 감독 이름. 없는 값(원제가 없을 때)은 빼고 " · "로 이어요(lib/format.ts의 joinFacts).
              가운뎃점은 앞 항목에 붙어서, 휴대폰에서 줄이 넘쳐도 가운뎃점으로 시작하는 줄이 생기지 않아요.
              line-clamp-2: 길면 두 줄까지만 보이고 끝을 "…"로 줄여요(화면 낭독기는 다 읽어요). 너무 긴 낱말도 끊어 줄을 바꿔요(globals.css).
              감독 이름은 글자로만 둬요. 이름으로 찾기는 상세 화면에서 해요. */}
          <p className="mt-1 line-clamp-2 text-crt-dim">{joinFacts([originalTitle, year, director])}</p>

          {/* 한 줄 평. 화면 낭독기에는 앞에 "한 줄 평:"을 붙여 무슨 글인지 알려 줘요.
              휴대폰(mt-1): 둘째 줄 바로 아래(4px, 첫째·둘째 줄 사이와 같아요)에 붙어요. 평점이 포스터 아래로 가서 왼쪽 칸이 길어져도 벌어지지 않아요.
              넓은 화면(sm:mt-auto sm:pt-2): 남는 높이를 위에 두어 글자 칸 맨 아래(썸네일 아래 끝)에 붙고, 글이 길어도 둘째 줄과 8px은 띄워요. */}
          <p className="mt-1 sm:mt-auto sm:pt-2">
            <span className="sr-only">한 줄 평: </span>“{oneLiner}”
          </p>
          {/* 상세를 열지 않은 동안(v3 전)은 글쓴이의 [수정]·[삭제]를 여기에 둬요. 방문자에게는 아무것도 그리지 않아요. */}
          {!linked && <ReviewListAdmin slug={slug} title={title} />}
        </div>
      </article>
    </li>
  );
}
