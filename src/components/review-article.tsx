/**
 * @file 리뷰 상세 내용 (review-article.tsx)
 *
 * 이 파일이 하는 일
 *   리뷰 한 편의 상세 화면 내용을 그립니다. 넓은 화면(1024px~)에서는 두 칸, 좁은 화면에서는 한 칸으로 놓여요.
 *   내용은 화면 너비를 다 써요(풀 페이지). 글줄 길이를 따로 줄이지 않아요.
 *
 *     ◀ 목록으로                                              [수정] [삭제] ← 로그인했을 때만
 *     ┌ 반전 안내판(화면 너비 전체) ───────────────────────────────┐
 *     │ [드라마]                              ← 장르(제목 위)          │
 *     │ 필름이 끊기기 전에                    ← 영화 제목(h1)    5.0  │ ← 평점(크게, 오른쪽)
 *     │ Avant la dernière bobine · 2023 · 프랑스 · 104분 · 감독 카미유 루셀 │
 *     └──────────────────────────────────────────────────────────┘
 *     ┌ 왼쪽 칸(스크롤해도 붙어 있음) ┐  ┌ 오른쪽 칸(남는 너비 전부) ────────┐
 *     │ [포스터 또는 기본 포스터]      │  │ “한줄평”                           │
 *     │                              │  │ 사진 → 글 → 사진 → 글 ...          │
 *     │                              │  │ (본문 Markdown)                   │
 *     │                              │  │ [◀ 이전 리뷰] [다음 리뷰 ▶]        │
 *     └──────────────────────────────┘  └────────────────────────────────────┘
 *
 * 맡은 기능
 *   - 반전 안내판에 장르(제목 위), 제목, 한 줄 정보(원제·연도·국가·상영 시간·감독), 큰 평점(오른쪽) 보여 주기
 *   - 포스터(없으면 기본 포스터)를 왼쪽 칸에 보여 주기
 *   - 한줄평과 본문(사진과 글을 섞은 HTML)을 오른쪽 칸에 보여 주기
 *   - 장르를 누르면 그 장르로 거른 목록으로 가기
 *   - 쓴 날 순서로 이전·다음 리뷰로 가기(링크, 그리고 키보드 ◀▶ — review-keys.tsx)
 *   - 글쓴이로 로그인했으면 [수정]·[삭제] 단추(admin-review-actions.tsx)
 *
 * 왜 페이지 파일(app/reviews/[slug]/page.tsx)과 나눴을까요?
 *   페이지 파일은 "원고 읽기" 같은 서버 일을 하고, 이 파일은 "받은 리뷰를 그리기"만 해요.
 *   그래서 이 파일은 가짜 리뷰 데이터만 넣어 바로 테스트할 수 있어요.
 *
 * 누가 쓰나요?
 *   app/reviews/[slug]/page.tsx
 */

import Link from "next/link";

import { joinFacts, labeled } from "@/lib/format";
import type { Review, ReviewSummary } from "@/lib/review";

import { AdminReviewActions } from "./admin-review-actions";
import { GenreTags } from "./genre-tags";
import { Poster } from "./poster";
import { Rating } from "./rating";
import { ReviewKeys } from "./review-keys";

/** ReviewArticle이 받는 값 */
type Props = {
  /** 보여 줄 리뷰(본문 포함) */
  review: Review;
  /** 바로 다음에(더 최근에) 쓴 리뷰. 없으면 null */
  newer: ReviewSummary | null;
  /** 바로 전에(더 예전에) 쓴 리뷰. 없으면 null */
  older: ReviewSummary | null;
};

/** 리뷰 상세 내용 */
export function ReviewArticle({ review, newer, older }: Props) {
  // 필요한 항목을 꺼내 둬요(구조 분해 할당).
  const { slug, title, originalTitle, year, country, director, runtime, genres, rating, oneLiner, poster, posterAlt, html } =
    review;

  // 제목 아래 한 줄 정보: "Winter Stop · 2024 · 한국 · 112분 · 감독 한서윤"
  // 없는 값(undefined)은 빼고 " · "로 이어요. 가운뎃점은 앞 항목에 붙어 줄 첫머리에 오지 않아요(lib/format.ts의 joinFacts).
  const facts = joinFacts([originalTitle, year, country, runtime ? `${runtime}분` : undefined, labeled("감독", director)]);

  return (
    // 화면 너비를 다 써요(풀 페이지). 본문 글줄도 오른쪽 칸 너비를 모두 써요.
    <article aria-labelledby="review-title">
      {/* 첫 줄: 목록으로 돌아가는 링크 + (로그인했을 때만) 수정·삭제 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* ◀는 꾸밈이라 읽지 않아요. (키보드로는 Esc도 같은 일을 해요) */}
        <Link href="/" className="term-link inline-block py-2">
          <span aria-hidden="true">◀ </span>목록으로
        </Link>
        <AdminReviewActions slug={slug} title={title} />
      </div>

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
          {/* 한 줄 정보(원제 · 연도 · 국가 · 상영 시간 · 감독) */}
          <p className="mt-2">{facts}</p>
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

        {/* 오른쪽 칸: 한줄평과 본문. min-w-0은 긴 낱말·넓은 표가 칸을 밀어내지 않게 하는 그리드 요령이에요. */}
        <div className="min-w-0">
          {/* 한줄평. 화면에는 따옴표 안의 문장만 보이고, 화면 낭독기는 앞에 "한줄평:"을 붙여 읽어요. */}
          <p className="glow border-y-2 border-crt-line py-5 text-big">
            <span className="sr-only">한줄평: </span>“{oneLiner}”
          </p>

          {/* 본문 HTML 넣기
              dangerouslySetInnerHTML은 HTML 글자를 그대로 화면에 넣는 React 기능이에요.
              이름에 "위험(dangerously)"이 붙은 건, 남이 보낸 글을 넣으면 나쁜 스크립트가 실행될 수 있어서예요.
              여기서는 우리 원고를 빌드할 때 바꾼 HTML이고, 원고 안의 HTML 태그는 버리도록 해 두어서 안전해요(lib/markdown.ts).
              prose: 본문 글꼴·간격·제목·사진 모양을 정한 클래스예요(globals.css). */}
          <div className="prose mt-10" dangerouslySetInnerHTML={{ __html: html }} />

          <ReviewNav newer={newer} older={older} />
        </div>
      </div>

      {/* 키보드 조작: ◀▶ 이전·다음 리뷰, Esc 목록으로. 화면에는 아무것도 그리지 않아요. */}
      <ReviewKeys newerHref={newer ? `/reviews/${newer.slug}` : null} olderHref={older ? `/reviews/${older.slug}` : null} />
    </article>
  );
}

/**
 * 이전·다음 리뷰로 가는 링크
 *
 * `Pick<Props, "newer" | "older">`: 위의 Props에서 newer와 older만 골라 쓴다는 뜻이에요.
 */
function ReviewNav({ newer, older }: Pick<Props, "newer" | "older">) {
  // 앞뒤 리뷰가 하나도 없으면(리뷰가 한 편뿐일 때) 아무것도 그리지 않아요. null을 돌려주면 React는 아무것도 그리지 않습니다.
  if (!newer && !older) return null;

  return (
    // <nav>: 이동 링크 묶음이라는 뜻이에요. 이름은 아래 h2("다른 리뷰")로 정해요.
    <nav aria-labelledby="review-nav-title" className="mt-16 border-t-2 border-dotted border-crt-line pt-6">
      {/* sr-only: 화면에는 안 보이지만 화면 낭독기 사용자가 제목으로 이 영역을 찾을 수 있게 해요. */}
      <h2 id="review-nav-title" className="sr-only">
        다른 리뷰
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {older && (
          <li>
            {/* rel="prev": "이전 글"이라는 관계를 검색엔진에 알려 줘요. 링크 이름: "이전 리뷰 필름이 끊기기 전에" */}
            <Link href={`/reviews/${older.slug}`} rel="prev" className="btn-line w-full flex-col items-start py-3">
              <span className="text-crt-dim">
                <span aria-hidden="true">◀ </span>이전 리뷰
              </span>
              {/* 두 줄 사이의 공백 한 칸. 화면 모양에는 영향이 없고, 링크 이름이 "이전 리뷰필름이..."처럼 붙지 않게 해요. */}{" "}
              <span>{older.title}</span>
            </Link>
          </li>
        )}
        {newer && (
          // sm:col-start-2: 넓은 화면에서 이전 리뷰가 없어도 "다음 리뷰"는 늘 오른쪽 칸에 놓여요.
          <li className="sm:col-start-2">
            <Link href={`/reviews/${newer.slug}`} rel="next" className="btn-line w-full flex-col items-end py-3 text-right">
              <span className="text-crt-dim">
                다음 리뷰<span aria-hidden="true"> ▶</span>
              </span>{" "}
              <span>{newer.title}</span>
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
