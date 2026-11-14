/**
 * @file 수정 화면용 원고 읽기 (review-source.ts)
 *
 * 이 파일이 하는 일
 *   리뷰 수정 화면(app/write/[slug]/page.tsx)이 보여 줄 원고를 GitHub 저장소에서 읽어요.
 *   그리고 원고 파일 경로 규칙(content/reviews/<주소>.md)을 둬요(저장·삭제를 하는 lib/review-store.ts도 함께 써요).
 *
 * 왜 lib/review-store.ts와 나눴나요?
 *   저장 쪽은 본문 사진을 찾으려고 Markdown 변환 도구(lib/markdown.ts, unified)를 불러요. 같은 파일에 있으면
 *   원고를 읽기만 하는 수정 화면의 서버 묶음에도 변환 도구가 한 벌 더 들어가서, 워커가 압축 기준 약 100KB 커졌어요.
 *   읽기만 따로 두면 수정 화면은 변환 도구 없이 가벼워요(이 블로그는 가벼움이 가장 중요해요).
 */

import "server-only";

import { getSnapshot, readTextBlob } from "./github";
import { SLUG } from "./review-schema";

/** 원고 파일 경로. 예: reviewPath("winter-stop") → "content/reviews/winter-stop.md" */
export const reviewPath = (slug: string) => `content/reviews/${slug}.md`;

/**
 * 수정 화면에 보여 줄 원고를 저장소에서 읽어요.
 *
 * @param slug 리뷰 주소
 * @returns 원고 글자(source), 그 내용 번호(sha, 저장할 때 바뀌었는지 비교해요). 없는 리뷰면 null
 */
export async function loadReviewSource(slug: string): Promise<{ source: string; sha: string } | null> {
  if (!SLUG.test(slug)) return null;
  const snapshot = await getSnapshot();
  const sha = snapshot.files.get(reviewPath(slug));
  if (!sha) return null;
  return { source: await readTextBlob(sha), sha };
}
