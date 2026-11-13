/**
 * @file 글쓴이 API 부르기 (admin-api.ts)
 *
 * 이 파일이 하는 일
 *   브라우저 화면이 서버 API(로그인, 사진 올리기, 리뷰 저장·삭제)를 부르는 함수를 모아 둬요.
 *   모든 함수가 같은 모양의 결과를 돌려줘서 화면 코드가 단순해져요.
 *     성공: { ok: true, data }
 *     실패: { ok: false, status, message, errors? } — message는 알림 문구, errors는 칸마다 오류 문구
 *
 * 인터넷이 끊겨 서버에 닿지도 못하면 status 0과 "연결 확인" 문구를 돌려줘요.
 *
 * 누가 쓰나요?
 *   components/login-form.tsx, components/session-controls.tsx, components/review-writer.tsx, components/delete-review.tsx
 */

import type { ReviewFormValues } from "./review-file";
import type { FieldErrors } from "./review-form";

/** API 결과 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string; errors?: FieldErrors };

/** 서버에 닿지 못했을 때의 결과 */
const OFFLINE = { ok: false, status: 0, message: "서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요." } as const;

/**
 * 요청을 보내고 결과를 ApiResult 모양으로 바꿔요.
 * 실패 응답이면 서버가 보낸 { message, errors }를 꺼내고, 그마저 없으면 기본 문구를 써요.
 */
async function send<T>(url: string, init: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    return OFFLINE;
  }
  // 답이 JSON이 아닐 수도 있어서(호스팅의 오류 화면 등) 읽기에 실패하면 빈 객체로 봐요.
  const body = (await response.json().catch(() => ({}))) as { message?: string; errors?: FieldErrors };
  if (response.ok) return { ok: true, data: body as T };
  return {
    ok: false,
    status: response.status,
    message: body.message ?? `요청을 처리하지 못했습니다(응답 ${response.status}). 잠시 뒤 다시 시도해 주세요.`,
    errors: body.errors,
  };
}

/** JSON을 보내는 요청 설정 */
function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

/** 로그인 */
export function login(id: string, password: string) {
  return send<{ ok: true }>("/api/session", json("POST", { id, password }));
}

/** 로그아웃 */
export function logout() {
  return send<{ ok: true }>("/api/session", json("DELETE"));
}

/**
 * 사진 한 장 올리기. 파일은 JSON이 아니라 FormData(파일을 담는 상자)로 보내요.
 *
 * @param file 고른 그림 파일
 * @param path 저장소 안 경로. 예: public/posters/winter-stop.jpg
 * @returns 성공하면 { path, sha }
 */
export function uploadImage(file: Blob, path: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("path", path);
  return send<{ path: string; sha: string }>("/api/images", { method: "POST", body: form });
}

/** 리뷰 저장에 보내는 내용 */
export type SaveRequest = {
  values: ReviewFormValues;
  uploads: { path: string; sha: string }[];
  baseSha?: string;
};

/** 새 리뷰 저장 */
export function createReview(request: SaveRequest) {
  return send<{ slug: string; commitSha: string }>("/api/reviews", json("POST", request));
}

/** 리뷰 고치기 */
export function updateReview(slug: string, request: SaveRequest) {
  return send<{ slug: string; commitSha: string }>(`/api/reviews/${encodeURIComponent(slug)}`, json("PUT", request));
}

/** 리뷰 지우기 */
export function deleteReview(slug: string) {
  return send<{ title: string; commitSha: string }>(`/api/reviews/${encodeURIComponent(slug)}`, json("DELETE"));
}
