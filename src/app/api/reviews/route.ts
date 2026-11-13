/**
 * @file 새 리뷰 저장 API (app/api/reviews/route.ts → 주소 "/api/reviews")
 *
 * 이 파일이 하는 일
 *   POST /api/reviews : 글쓰기 화면이 보낸 새 리뷰(칸 값 + 올린 사진 목록)를 검사하고 저장소에 커밋해요.
 *   저장소에 올라가면 호스팅이 블로그를 다시 빌드해서, 보통 1~2분 뒤 목록에 새 리뷰가 보여요.
 *
 * 답(JSON)
 *   - 성공(201): { slug, commitSha }
 *   - 실패: { message, errors? } — errors는 칸마다 오류 문구(예: { title: "제목을 입력하세요." })
 *
 * 로그인했는지는 proxy.ts가 먼저, 여기서 한 번 더 확인해요. 실제 저장 일은 lib/review-store.ts가 해요.
 */

import type { NextRequest } from "next/server";

import { guardAdminRequest } from "@/lib/admin-auth";
import { errorResponse, readJson } from "@/lib/api-response";
import { saveReview, savePayloadSchema } from "@/lib/review-store";

/** 새 리뷰 저장 */
export async function POST(request: NextRequest) {
  const denied = await guardAdminRequest(request);
  if (denied) return denied;

  // 보낸 JSON이 약속한 모양인지 검사해요. safeParse는 틀려도 오류를 던지지 않고 결과로 알려 줘요.
  const payload = savePayloadSchema.safeParse(await readJson(request));
  if (!payload.success) {
    return Response.json({ message: "보낸 내용의 모양이 올바르지 않습니다. 화면을 새로 고친 뒤 다시 저장해 주세요." }, { status: 400 });
  }

  try {
    // 새 글의 주소는 칸에 적은 주소(values.slug)예요.
    const result = await saveReview("create", payload.data.values.slug, payload.data);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
