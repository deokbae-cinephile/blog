/**
 * @file 리뷰 상세 내용 (review-article.tsx)
 *
 * 이 파일이 하는 일
 *   리뷰 한 편의 상세 화면 내용을 그립니다. 넓은 화면(1024px~)에서는 두 칸, 좁은 화면에서는 한 칸으로 놓여요.
 *   내용은 화면 너비를 다 써요(풀 페이지). 글줄 길이를 따로 줄이지 않아요.
 *
 *     [◀ 목록으로]                                  [공유하기] [수정] [삭제] ← 수정·삭제는 로그인했을 때만(review-toolbar.tsx)
 *     ┌ 반전 안내판(화면 너비 전체) ───────────────────────────────┐
 *     │ [드라마]                              ← 장르(제목 위)          │
 *     │ 필름이 끊기기 전에                    ← 영화 제목(h1)    5.0  │ ← 평점(크게, 오른쪽)
 *     │ Avant la dernière bobine · 2023 · 104분 · 감독: 카미유 루셀 · 출연: A, B │  ← 감독·배우 이름은 링크
 *     └──────────────────────────────────────────────────────────┘
 *     ┌ 왼쪽 칸(스크롤해도 붙어 있음) ┐  ┌ 오른쪽 칸(남는 너비 전부) ────────┐
 *     │ [포스터 또는 기본 포스터]      │  │ “한 줄 평”                           │
 *     │                              │  │ 사진 → 글 → 사진 → 글 ...          │
 *     │                              │  │ (본문 Markdown)                   │
 *     │                              │  │ [◀ 이전 리뷰] [다음 리뷰 ▶]        │
 *     └──────────────────────────────┘  └────────────────────────────────────┘
 *
 * 맡은 기능
 *   - 반전 안내판에 장르(제목 위), 제목, 한 줄 정보(원제·연도·상영 시간·감독·출연), 큰 평점(오른쪽) 보여 주기
 *   - 감독·배우 이름을 누르면 그 이름으로 찾은 처음 화면 목록으로 가기(/?q=이름, lib/people.ts)
 *   - 포스터(없으면 기본 포스터)를 왼쪽 칸에 보여 주기
 *   - 맨 윗줄 오른쪽 [공유하기]: 휴대폰 공유 창으로 리뷰 링크 보내기. 받는 쪽 미리 보기에 포스터가 보여요(share-button.tsx)
 *     (왼쪽 칸 포스터 아래에 두면, 키가 작은 화면에서 왼쪽 아래에 떠 있는 [키보드 조작] 단추에 가려져서 맨 윗줄에 둬요.)
 *   - 한 줄 평과 본문(사진과 글을 섞은 HTML)을 오른쪽 칸에 보여 주기
 *   - 장르를 누르면 그 장르로 거른 목록으로 가기
 *   - 처음 화면 목록(최신순) 순서로 이전·다음 리뷰로 가기(링크, 그리고 키보드 ◀▶ — review-keys.tsx)
 *     이전 = 목록에서 바로 위 리뷰(더 최근에 쓴 글), 다음 = 바로 아래 리뷰(더 예전에 쓴 글)
 *     새 리뷰를 받는 동안 화면 가운데에 로딩 UI를 보여요. [◀ 목록으로]·Esc로 목록에 갈 때도 같아요(review-navigation.tsx).
 *   - 글쓴이로 로그인했으면 [수정]·[삭제] 단추(admin-review-actions.tsx)
 *
 * 왜 페이지 파일(app/reviews/[slug]/page.tsx)과 나눴을까요?
 *   페이지 파일은 "원고 읽기" 같은 서버 일을 하고, 이 파일은 "받은 리뷰를 그리기"만 해요.
 *   그래서 이 파일은 가짜 리뷰 데이터만 넣어 바로 테스트할 수 있어요.
 *
 * 누가 쓰나요?
 *   app/reviews/[slug]/page.tsx
 */

import { Fragment, type ReactNode } from "react";

import { FACT_SEPARATOR, formatRating, NBSP } from "@/lib/format";
import { personSearchHref, splitNames } from "@/lib/people";
import type { Review, ReviewSummary } from "@/lib/review";
import { siteUrl } from "@/lib/site";

import { GenreTags } from "./genre-tags";
import { IntentLink } from "./intent-link";
import { Poster } from "./poster";
import { Rating } from "./rating";
import { ReviewKeys } from "./review-keys";
import { ReviewNavigation, ReviewNavLink } from "./review-navigation";
import { ReviewToolbar } from "./review-toolbar";

/** ReviewArticle이 받는 값 */
type Props = {
  /** 보여 줄 리뷰(본문 포함) */
  review: Review;
  /** 이전 리뷰: 처음 화면 목록(최신순)에서 바로 위 리뷰(더 최근에 쓴 글). 맨 위면 null */
  previous: ReviewSummary | null;
  /** 다음 리뷰: 목록에서 바로 아래 리뷰(더 예전에 쓴 글). 맨 아래면 null */
  next: ReviewSummary | null;
};

/** 리뷰 상세 내용 */
export function ReviewArticle({ review, previous, next }: Props) {
  // 필요한 항목을 꺼내 둬요(구조 분해 할당).
  const { slug, title, originalTitle, year, director, cast, runtime, genres, rating, oneLiner, poster, posterAlt, html } = review;

  return (
    // 화면 너비를 다 써요(풀 페이지). 본문 글줄도 오른쪽 칸 너비를 모두 써요.
    <article aria-labelledby="review-title">
      {/* ReviewNavigation: 이전·다음 리뷰나 목록으로 옮겨 가는 동안 로딩 UI를 보여 줘요(링크와 키보드 ◀ ▶ Esc가 함께 써요). */}
      <ReviewNavigation>
        {/* 첫 줄: [◀ 목록으로] … [공유하기] [수정] [삭제](수정·삭제는 로그인했을 때만), 삭제한 뒤의 안내(review-toolbar.tsx)
            공유하는 것은 리뷰의 대표 주소예요. 받는 쪽 메신저가 이 주소의 공유 미리 보기(포스터)를 카드로 보여 줘요. */}
        <ReviewToolbar
          slug={slug}
          title={title}
          shareUrl={`${siteUrl}/reviews/${slug}`}
          shareTitle={`${title} 리뷰`}
          shareText={`평점 ${formatRating(rating)} · ${oneLiner}`}
        />

        {/* 반전 안내판: 장르, 영화 제목, 한 줄 정보, 그리고 오른쪽에 큰 평점. <header>는 이 글(article)의 머리라는 뜻이에요.
            flex justify-between: 왼쪽 글 묶음과 오른쪽 평점을 양 끝에 놓아요. items-center: 평점을 글 묶음의 세로 가운데에 맞춰요. */}
        <header className="inverse mt-4 flex items-center justify-between gap-6 px-5 py-5">
          {/* min-w-0: 긴 제목이 평점 자리를 밀어내지 않고 줄바꿈되게 해요. */}
          <div className="min-w-0">
            {/* 장르(제목 위). 장르마다 그 장르로 거른 목록으로 가는 링크예요. */}
            <GenreTags genres={genres} linked label="장르" />
            <h1 id="review-title" className="mt-2 text-big">
              {title}
            </h1>
            {/* 한 줄 정보(원제 · 연도 · 상영 시간 · 감독 · 출연). 감독·배우 이름은 그 이름으로 찾은 목록으로 가는 링크예요. */}
            <ReviewFacts originalTitle={originalTitle} year={year} runtime={runtime} director={director} cast={cast} />
          </div>
          {/* 평점: 크게, 오른쪽에 따로. 화면 낭독기는 "평점 5점 만점에 4.5점"으로 읽어요(components/rating.tsx).
              shrink-0: 좁은 화면에서도 숫자가 찌그러지지 않게 해요. */}
          <p className="shrink-0 text-big">
            <Rating value={rating} />
          </p>
        </header>

        {/* 넓은 화면(lg, 1024px~)에서는 [왼쪽 칸 | 오른쪽 칸] 두 칸, 좁은 화면에서는 위아래 한 칸이에요.
            minmax(16rem,18rem): 왼쪽 칸은 16~18rem, minmax(0,1fr): 오른쪽 칸은 남는 너비를 모두 써요. */}
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(16rem,18rem)_minmax(0,1fr)] lg:gap-12">
          {/* 왼쪽 칸: 포스터
              lg:sticky lg:top-8 lg:self-start — 넓은 화면에서 본문을 내려 읽어도 화면 위쪽에 붙어 있어요. */}
          <div className="grid content-start gap-8 lg:sticky lg:top-8 lg:self-start">
            {/* 상세 화면에서는 포스터가 내용이라 대체 텍스트를 읽어 줘요. posterAlt가 없으면 제목으로 만들어요.
                포스터가 없으면 기본 포스터가 같은 자리에 보여요(components/poster.tsx).
                preload: 첫 화면에서 가장 큰 그림이라 먼저 받아 화면이 빨리 완성되게 해요. */}
            <Poster
              src={poster}
              alt={posterAlt ?? `영화 ‘${title}’ 포스터`}
              size="large"
              preload
              className="mx-auto lg:mx-0"
            />

          </div>

          {/* 오른쪽 칸: 한 줄 평과 본문. min-w-0은 긴 낱말·넓은 표가 칸을 밀어내지 않게 하는 그리드 요령이에요. */}
          <div className="min-w-0">
            {/* 한 줄 평. 화면에는 따옴표 안의 문장만 보이고, 화면 낭독기는 앞에 "한 줄 평:"을 붙여 읽어요. */}
            <p className="glow border-y-2 border-crt-line py-5 text-big">
              <span className="sr-only">한 줄 평: </span>“{oneLiner}”
            </p>

            {/* 본문 HTML 넣기
                dangerouslySetInnerHTML은 HTML 글자를 그대로 화면에 넣는 React 기능이에요.
                이름에 "위험(dangerously)"이 붙은 건, 남이 보낸 글을 넣으면 나쁜 스크립트가 실행될 수 있어서예요.
                여기서는 우리 원고를 빌드할 때 바꾼 HTML이고, 원고 안의 HTML 태그는 버리도록 해 두어서 안전해요(lib/markdown.ts).
                prose: 본문 글꼴·간격·제목·사진 모양을 정한 클래스예요(globals.css). */}
            <div className="prose mt-10" dangerouslySetInnerHTML={{ __html: html }} />

            <ReviewNav previous={previous} next={next} />
          </div>
        </div>

        {/* 키보드 조작: ◀▶ 이전·다음 리뷰, Esc 목록으로. 화면에는 아무것도 그리지 않아요. */}
        <ReviewKeys previousHref={previous ? `/reviews/${previous.slug}` : null} nextHref={next ? `/reviews/${next.slug}` : null} />
      </ReviewNavigation>
    </article>
  );
}

/**
 * 제목 아래 한 줄 정보: "Avant la dernière bobine · 2023 · 104분 · 감독: 카미유 루셀 · 출연: 김태리, 류준열"
 *
 * - 없는 값(원제·상영 시간·출연)은 빼고 " · "로 이어요. 가운뎃점 앞 빈칸은 줄바꿈되지 않는 빈칸(NBSP)이라
 *   줄이 넘쳐도 가운뎃점은 앞 항목 끝에 남아요(lib/format.ts의 FACT_SEPARATOR, 목록의 joinFacts와 같은 모양).
 * - 감독·배우 이름은 한 사람씩 링크예요. 누르면 그 이름으로 찾은 처음 화면 목록으로 가요(/?q=이름).
 *   링크 이름은 보이는 이름 그대로("마크 러팔로")이고, 화면 낭독기에는 어디로 가는지 설명("이 배우의 리뷰 찾기")을 덧붙여 읽어 줘요.
 */
function ReviewFacts({ originalTitle, year, runtime, director, cast }: Pick<Review, "originalTitle" | "year" | "runtime" | "director" | "cast">) {
  const items: ReactNode[] = [];
  if (originalTitle) items.push(originalTitle);
  items.push(String(year));
  if (runtime) items.push(`${runtime}분`);
  items.push(<People label="감독" names={splitNames(director)} />);
  const actors = splitNames(cast);
  if (actors.length > 0) items.push(<People label="출연" names={actors} />);

  return (
    <p className="mt-2">
      {items.map((item, index) => (
        // 항목 사이에만 " · "를 넣어요(첫 항목 앞에는 없어요).
        <Fragment key={index}>
          {index > 0 && FACT_SEPARATOR}
          {item}
        </Fragment>
      ))}
    </p>
  );
}

/**
 * 감독·배우 이름 링크의 설명(aria-describedby). 링크 이름은 보이는 이름 그대로 두고(KWCAG 6.5.3 레이블과 네임),
 * 어디로 가는지는 설명으로 덧붙여요. 상세 화면은 한 화면에 하나뿐이라 id가 겹치지 않아요.
 */
const PEOPLE_HINTS = {
  감독: { id: "director-search-hint", text: "이 감독의 리뷰 찾기" },
  출연: { id: "cast-search-hint", text: "이 배우의 리뷰 찾기" },
} as const;

/**
 * 이름표 + 사람 이름 링크들: "감독: 한서윤, 김도윤"
 * 이름표 뒤에 쌍점(:)을 붙여요(목록의 "감독: …"과 같은 모양, lib/format.ts의 labeled).
 * 쌍점과 첫 이름 사이는 NBSP라 줄바꿈으로 떨어지지 않아요. 이름 사이(", ")에서는 줄이 바뀔 수 있어요.
 * 화면 낭독기는 "마크 러팔로, 링크, 이 배우의 리뷰 찾기"처럼 읽어요.
 */
function People({ label, names }: { label: keyof typeof PEOPLE_HINTS; names: string[] }) {
  const hint = PEOPLE_HINTS[label];
  return (
    <span>
      {label}:{NBSP}
      {names.map((name, index) => (
        <Fragment key={name}>
          {index > 0 && ", "}
          {/* term-link: 장르 링크와 같은 점선 밑줄. IntentLink: 가리키거나 초점이 갈 때만 목록 화면을 미리 받아요. */}
          <IntentLink href={personSearchHref(name)} aria-describedby={hint.id} className="term-link">
            {name}
          </IntentLink>
        </Fragment>
      ))}
      {/* 링크 설명. hidden이라 화면에는 보이지 않지만, aria-describedby로 가리키면 화면 낭독기가 읽어 줘요. */}
      <span id={hint.id} hidden>
        {hint.text}
      </span>
    </span>
  );
}

/**
 * 이전·다음 리뷰로 가는 링크
 *
 * 처음 화면 목록(최신순) 순서를 따라요: [◀ 이전 리뷰] = 목록에서 바로 위, [다음 리뷰 ▶] = 바로 아래.
 * `Pick<Props, "previous" | "next">`: 위의 Props에서 previous와 next만 골라 쓴다는 뜻이에요.
 */
function ReviewNav({ previous, next }: Pick<Props, "previous" | "next">) {
  // 앞뒤 리뷰가 하나도 없으면(리뷰가 한 편뿐일 때) 아무것도 그리지 않아요. null을 돌려주면 React는 아무것도 그리지 않습니다.
  if (!previous && !next) return null;

  return (
    // <nav>: 이동 링크 묶음이라는 뜻이에요. 이름은 아래 h2("다른 리뷰")로 정해요.
    <nav aria-labelledby="review-nav-title" className="mt-16 border-t-2 border-dotted border-crt-line pt-6">
      {/* sr-only: 화면에는 안 보이지만 화면 낭독기 사용자가 제목으로 이 영역을 찾을 수 있게 해요. */}
      <h2 id="review-nav-title" className="sr-only">
        다른 리뷰
      </h2>
      {/* 마우스를 올리면 단추 전체가 [◀ 목록으로]처럼 반전돼요. 보조 글자색(text-crt-dim)인 "◀ 이전 리뷰"도
          group-hover:text-inherit로 단추 글자색(반전된 어두운 색)을 따라가서, 밝은 바탕 위에 흐린 초록이 남지 않아요.
          ReviewNavLink: 누르면 새 리뷰를 받는 동안 로딩 UI를 보여요(review-navigation.tsx). */}
      <ul className="grid gap-4 sm:grid-cols-2">
        {previous && (
          <li>
            {/* rel="prev": "이전 글"이라는 관계를 검색엔진에 알려 줘요. 링크 이름: "이전 리뷰 리틀 포레스트" */}
            <ReviewNavLink
              href={`/reviews/${previous.slug}`}
              target="previous"
              rel="prev"
              className="group btn-line w-full flex-col items-start py-3"
            >
              <span className="text-crt-dim group-hover:text-inherit">
                <span aria-hidden="true">◀ </span>이전 리뷰
              </span>
              {/* 두 줄 사이의 공백 한 칸. 화면 모양에는 영향이 없고, 링크 이름이 "이전 리뷰리틀..."처럼 붙지 않게 해요. */}{" "}
              <span>{previous.title}</span>
            </ReviewNavLink>
          </li>
        )}
        {next && (
          // sm:col-start-2: 넓은 화면에서 이전 리뷰가 없어도 "다음 리뷰"는 늘 오른쪽 칸에 놓여요.
          <li className="sm:col-start-2">
            <ReviewNavLink
              href={`/reviews/${next.slug}`}
              target="next"
              rel="next"
              className="group btn-line w-full flex-col items-end py-3 text-right"
            >
              <span className="text-crt-dim group-hover:text-inherit">
                다음 리뷰<span aria-hidden="true"> ▶</span>
              </span>{" "}
              <span>{next.title}</span>
            </ReviewNavLink>
          </li>
        )}
      </ul>
    </nav>
  );
}
