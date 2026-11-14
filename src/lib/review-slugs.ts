/**
 * @file 올라가 있는 리뷰 주소 목록 (review-slugs.ts)
 *
 * 이 파일이 하는 일
 *   주소(slug)가 빌드할 때 올라가 있던 리뷰인지 알려 줘요.
 *   조회수 API(app/api/views/[slug]/route.ts)가 목록에 있는 리뷰만 세려고 써요.
 *
 * 왜 필요할까요?
 *   주소 모양만 검사하면, 아무 주소로나 세기 요청을 보내 조회수 저장소를 채울 수 있어요(처음 보는 주소는 5,000개까지만 받아서,
 *   다 차면 새 리뷰의 조회수가 오르지 않아요). 브라우저가 아닌 요청은 Origin 헤더를 꾸밀 수 있어서 Origin 검사만으로는 못 막아요.
 *
 * 목록은 어디서 오나요?
 *   next.config.ts가 빌드할 때 원고 폴더(content/reviews, 시험에서는 REVIEWS_DIR)의 파일 이름을 읽어
 *   환경 변수 DMB_REVIEW_SLUGS("a,b,c")로 넣어 줘요. Next.js가 빌드할 때 이 값을 코드에 글자 그대로 박아 넣어서,
 *   파일을 읽을 수 없는 Cloudflare Workers에서도 쓸 수 있어요.
 *   새 리뷰는 저장한 뒤 GitHub Actions가 다시 빌드·배포하면 목록에 들어가요(그 전에는 화면에도 없어요).
 *
 * 누가 쓰나요?
 *   app/api/views/[slug]/route.ts(세기 전에 확인)
 */

import "server-only";

/**
 * 이 주소가 빌드할 때 올라가 있던 리뷰인지 알려 줘요.
 *
 * @param slug 리뷰 주소(원고 파일 이름에서 .md를 뺀 것)
 * @returns 올라가 있던 리뷰면 true
 */
export function isPublishedSlug(slug: string): boolean {
  // process.env.DMB_REVIEW_SLUGS: 빌드할 때 next.config.ts의 env가 "a,b,c" 글자로 바꿔 넣어요. 시험에서는 vi.stubEnv로 정해요.
  // 빈 주소("")는 앞의 주소 모양 검사(SLUG)에서 이미 걸러져요.
  return (process.env.DMB_REVIEW_SLUGS ?? "").split(",").includes(slug);
}
