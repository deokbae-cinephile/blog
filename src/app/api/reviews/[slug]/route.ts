/**
 * @file 리뷰 수정·삭제 API (app/api/reviews/[slug]/route.ts → 주소 "/api/reviews/<주소>")
 *
 * 이 파일이 하는 일
 *   - PUT    /api/reviews/winter-stop : 고친 내용(칸 값 + 올린 사진 + 처음 원고 sha)을 검사하고 커밋해요.
 *   - DELETE /api/reviews/winter-stop : 리뷰와 그 리뷰의 포스터·장면 사진을 지우는 커밋을 올려요.
 *
 * 폴더 이름의 [slug]는 "이 자리에 아무 주소나 올 수 있다"는 뜻이에요(동적 라우트).
 * 두 번째 매개변수(ctx)의 params에서 실제 주소를 꺼내요. Next.js 15부터 params는 Promise라서 await로 꺼내요.
 * RouteContext<"/api/reviews/[slug]">: Next.js가 이 주소 모양을 보고 params의 타입을 만들어 주는 도우미 타입이에요.
 *
 * 로그인했는지는 proxy.ts가 먼저, 여기서 한 번 더 확인해요. 실제 일은 lib/review-store.ts가 해요.
 */

import type { NextRequest } from "next/server";

import { guardAdminRequest } from "@/lib/admin-auth";
import { errorResponse, readJson } from "@/lib/api-response";
import { deleteReview, readSavePayload, saveReview } from "@/lib/review-store";

/** 리뷰 수정 */
export async function PUT(request: NextRequest, ctx: RouteContext<"/api/reviews/[slug]">) {
  const denied = await guardAdminRequest(request);
  if (denied) return denied;

  const payload = readSavePayload(await readJson(request));
  if (!payload) {
    return Response.json({ message: "보낸 내용의 모양이 올바르지 않습니다. 화면을 새로 고친 뒤 다시 저장해 주세요." }, { status: 400 });
  }

  try {
    // 수정할 때는 주소를 바꾸지 않아요. 칸 값의 slug 대신 화면 주소의 slug를 써요.
    const { slug } = await ctx.params;
    return Response.json(await saveReview("update", slug, payload));
  } catch (error) {
    return errorResponse(error);
  }
}

/** 리뷰 삭제 */
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/reviews/[slug]">) {
  const denied = await guardAdminRequest(request);
  if (denied) return denied;

  try {
    const { slug } = await ctx.params;
    return Response.json(await deleteReview(slug));
  } catch (error) {
    return errorResponse(error);
  }
}
