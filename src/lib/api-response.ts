/**
 * @file API 오류 응답 만들기 (api-response.ts)
 *
 * 이 파일이 하는 일
 *   저장 API에서 생긴 오류를 화면이 알아듣는 JSON 응답 { message, errors? }으로 바꿔요.
 *   화면(lib/admin-api.ts)은 message를 알림으로, errors를 칸마다 오류 문구로 보여 줘요.
 *
 * 누가 쓰나요?
 *   app/api/images/route.ts, app/api/reviews/route.ts, app/api/reviews/[slug]/route.ts
 */

import "server-only";

import { GitHubError } from "./github";
import { ReviewStoreError } from "./review-store";

/**
 * 오류를 HTTP 응답으로 바꿔요.
 *
 * - ReviewStoreError: 우리가 일부러 멈춘 경우(칸 오류, 주소 겹침 등). 상태 번호와 문구를 그대로 돌려줘요.
 * - GitHubError: GitHub와 이야기하다 생긴 문제. 4xx는 서버 설정 문제라 502(중간 서버 문제)로 바꿔 알려요.
 * - 그 밖의 오류: 예상하지 못한 문제. 자세한 내용은 서버 기록(console.error)에만 남기고, 화면에는 다시 시도하라고 알려요.
 */
export function errorResponse(error: unknown): Response {
  if (error instanceof ReviewStoreError) {
    return Response.json({ message: error.message, errors: error.errors }, { status: error.status });
  }
  if (error instanceof GitHubError) {
    // 503(설정 없음)은 그대로, 그 밖에는 502로 바꿔요. 브라우저 입장에서는 "서버 뒤쪽(GitHub)에서 생긴 문제"예요.
    return Response.json({ message: error.message }, { status: error.status === 503 ? 503 : 502 });
  }
  console.error(error);
  return Response.json({ message: "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요." }, { status: 500 });
}

/**
 * 요청 본문(JSON)을 읽어요. JSON이 아니면 null이에요.
 * request.json()은 모양이 틀리면 오류를 던져서, catch로 받아 null로 바꿔요.
 */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
