/**
 * @file 조회수 API 부르기 (views-api.ts)
 *
 * 이 파일이 하는 일
 *   브라우저에서 조회수 API(app/api/views/**)를 부르는 작은 함수들이에요.
 *   실패하면(오프라인, 서버 문제) 오류를 던지지 않고 null을 돌려줘요. 조회수는 없으면 "–"로 보이면 되는 곁들이 정보라서요.
 *
 *     fetchViewCounts()   GET  /api/views         모든 리뷰의 조회수(목록, 조회순 정렬)
 *     fetchViews(slug)    GET  /api/views/<주소>   이 리뷰의 조회수(세지 않음)
 *     countView(slug)     POST /api/views/<주소>   이 리뷰를 한 번 봤다고 세기(로그인한 글쓴이는 서버가 세지 않아요)
 *
 * 그리고 숫자를 "1,234"처럼 보이게 하는 formatViews도 있어요.
 *
 * 누가 쓰나요?
 *   components/use-view-counts.ts(목록), components/review-views.tsx(상세)
 */

import type { ViewResult, ViewSnapshot } from "./view-rules";

/** 응답을 JSON으로 읽어요. 실패하면 null */
async function readJson<T>(request: Promise<Response>): Promise<T | null> {
  try {
    const response = await request;
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

/** 모든 리뷰의 조회수와 총 조회수. 실패하면 null */
export function fetchViewCounts(): Promise<ViewSnapshot | null> {
  return readJson(fetch("/api/views", { cache: "no-store" }));
}

/** 이 리뷰의 조회수(세지 않아요). 실패하면 null */
export function fetchViews(slug: string): Promise<ViewResult | null> {
  return readJson(fetch(`/api/views/${encodeURIComponent(slug)}`, { cache: "no-store" }));
}

/** 이 리뷰를 한 번 봤다고 세요. 센 뒤의 숫자를 돌려줘요. 실패하면 null */
export function countView(slug: string): Promise<ViewResult | null> {
  return readJson(fetch(`/api/views/${encodeURIComponent(slug)}`, { method: "POST", cache: "no-store" }));
}

/**
 * 조회수를 화면에 보일 글자로 바꿔요. 아직 모르면(null) "–"예요.
 *
 * @example
 * formatViews(1234); // "1,234"
 * formatViews(null); // "–"
 */
export function formatViews(count: number | null | undefined): string {
  return count === null || count === undefined ? "–" : count.toLocaleString("ko-KR");
}
