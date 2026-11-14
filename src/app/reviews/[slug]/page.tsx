/**
 * @file 리뷰 상세 화면 (app/reviews/[slug]/page.tsx → 주소 "/reviews/<slug>")
 *
 * 이 파일이 하는 일
 *   리뷰 한 편의 상세 화면을 만들어요. 예: /reviews/winter-stop → winter-stop.md 원고의 화면
 *
 * 폴더 이름의 [slug]는 뭔가요? ("동적 라우트")
 *   대괄호로 감싼 폴더 이름은 "이 자리에 아무 값이나 올 수 있다"는 뜻이에요.
 *   /reviews/winter-stop으로 들어오면 slug = "winter-stop"이 돼요.
 *   리뷰마다 폴더를 만들지 않아도 이 파일 하나로 모든 리뷰 화면을 만들 수 있죠.
 *
 * 맡은 기능
 *   1. generateStaticParams: 빌드할 때 어떤 주소들의 페이지를 미리 만들지 알려 줘요(원고 수만큼).
 *   2. generateMetadata: 리뷰마다 탭 제목, 설명, 메신저 미리보기 글자를 정해요.
 *   3. ReviewPage: 주소의 slug로 원고를 찾아 화면을 그려요. 없으면 404 화면을 보여 줘요.
 */

import type { Metadata } from "next";
// notFound(): 부르면 그 자리에서 멈추고 app/not-found.tsx 화면을 보여 줘요.
import { notFound } from "next/navigation";

import { ReviewArticle } from "@/components/review-article";
import { formatRating } from "@/lib/format";
import { getNeighbors, getReviewBySlug, getReviewSummaries } from "@/lib/review-data";
import { DEFAULT_SHARE_IMAGE } from "@/lib/site";
import { reviewJsonLd, toJsonLd } from "@/lib/structured-data";

/**
 * 빌드할 때 만든 주소 밖의 주소(예: /reviews/없는-글)는 만들지 않고 404로 보내요.
 *
 * 리뷰 화면은 빌드할 때 미리 만들어 두고 그대로 줘요(가볍고 빨라요). 원고 파일은 빌드할 때만 읽기 때문에,
 * 빌드 뒤에 새 주소가 들어와도 만들지 않고 404로 보내요. 새 리뷰는 저장 → 다시 배포(빌드)되면서 페이지가 생겨요.
 * (Next.js의 약속: 이 값은 페이지 파일에 직접 적어야 해요.)
 */
export const dynamicParams = false;

/**
 * 페이지가 받는 값의 모양
 *
 * params: 주소에서 읽은 값({ slug: "winter-stop" })이에요.
 * Next.js 15부터 params는 Promise(나중에 도착하는 값)라서 `await params`로 꺼내 써요.
 */
type Props = { params: Promise<{ slug: string }> };

/**
 * 빌드할 때 만들 페이지 목록을 알려 줘요.
 *
 * 리뷰가 15편이면 [{ slug: "winter-stop" }, { slug: "3am-store" }, ...] 15개를 돌려주고,
 * Next.js는 이 목록대로 /reviews/winter-stop 같은 페이지를 15개 미리 만들어요.
 */
export async function generateStaticParams() {
  // map(({ slug }) => ({ slug })): 리뷰마다 slug만 꺼내 { slug } 묶음으로 바꿔요.
  return (await getReviewSummaries()).map(({ slug }) => ({ slug }));
}

/**
 * 리뷰마다 메타데이터(탭 제목, 설명, 메신저 미리보기 글자)를 정해요.
 *
 * 예: 탭 제목 "겨울 정류장 리뷰 — DMB"
 *     설명    "평점 4.5 · 버스는 오지 않아도, 기다림은 끝내 도착한다."
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const review = await getReviewBySlug(slug);
  // 원고가 없으면 아무것도 정하지 않아요(곧 404 화면이 나와요).
  if (!review) return {};

  const title = `${review.title} 리뷰`;
  const description = `평점 ${formatRating(review.rating)} · ${review.oneLiner}`;

  // 공유 미리 보기 그림: 포스터가 있으면 포스터, 없으면 블로그 기본 그림(public/og.png, layout.tsx와 같아요).
  // 포스터는 세로로 긴 그림이라 X(트위터)에서는 작은 네모 카드(summary)로, 기본 그림은 큰 카드로 보여요.
  // 가로·세로(og:image:width·height)도 알려 줘요. 메신저·SNS가 링크를 처음 받았을 때 그림을 다 받기 전에도 포스터를 그려 줘요.
  // ([공유하기] 단추로 링크를 보내면 받는 쪽 미리 보기에 이 포스터가 보여요. components/share-button.tsx)
  const image = review.poster
    ? { url: review.poster, alt: review.posterAlt ?? `영화 ‘${review.title}’ 포스터`, ...review.posterSize }
    : { ...DEFAULT_SHARE_IMAGE };

  return {
    // layout.tsx의 template 덕분에 뒤에 " — DMB"가 붙어요.
    title,
    description,
    // 대표 주소. layout.tsx의 metadataBase와 합쳐져 전체 주소가 돼요.
    alternates: { canonical: `/reviews/${slug}` },
    // 메신저 미리보기: type "article"은 "글"이라는 뜻이에요. 쓴 날도 알려 줘요.
    // (openGraph를 여기서 정하면 layout.tsx의 openGraph를 통째로 바꿔서, 그림도 여기서 다시 적어요.)
    openGraph: { type: "article", title, description, url: `/reviews/${slug}`, publishedTime: review.publishedAt, images: [image] },
    twitter: { card: review.poster ? "summary" : "summary_large_image", title, description, images: [image] },
  };
}

/**
 * 리뷰 상세 화면
 *
 * 원고 찾기 같은 "데이터 준비"는 여기서 하고, "그리기"는 ReviewArticle 컴포넌트에 맡겨요.
 */
export default async function ReviewPage({ params }: Props) {
  // 주소에서 slug를 꺼내요.
  const { slug } = await params;
  // slug에 맞는 원고를 찾아요.
  const review = await getReviewBySlug(slug);
  // 없으면 404 화면으로. (notFound()는 그 자리에서 멈추므로 아래 코드는 실행되지 않아요.)
  if (!review) notFound();

  // 이전·다음 리뷰를 찾아요(처음 화면 목록 순서: 이전 = 바로 위, 다음 = 바로 아래).
  const { previous, next } = await getNeighbors(slug);

  return (
    <>
      {/* 검색엔진용 리뷰 정보(JSON-LD: 영화·평점·글쓴이). 화면에는 보이지 않아요(lib/structured-data.ts). */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(reviewJsonLd(review)) }} />
      <ReviewArticle review={review} previous={previous} next={next} />
    </>
  );
}
