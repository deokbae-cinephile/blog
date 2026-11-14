/**
 * @file 사진 올리기 API (app/api/images/route.ts → 주소 "/api/images")
 *
 * 이 파일이 하는 일
 *   POST /api/images : 포스터나 장면 사진 파일 하나를 받아 GitHub 저장소에 blob(파일 덩어리)으로 올리고,
 *                      그 내용 번호(sha)를 돌려줘요. 아직 커밋 전이라 블로그에는 보이지 않아요.
 *   리뷰를 저장할 때(app/api/reviews) 이 번호들을 함께 보내면, 원고와 사진이 커밋 하나로 올라가요.
 *
 * 왜 사진을 하나씩 따로 올리나요?
 *   Cloudflare Workers는 요청 하나가 쓸 수 있는 CPU 시간과 메모리(128MB)에 한도가 있어요.
 *   원고와 사진 여러 장을 한 요청에 담으면 일이 커져 한도를 넘기 쉬워서, 사진은 한 장씩(최대 4MB) 나눠 보내요.
 *   (다른 호스팅도 요청 크기에 한도가 있어서(예: Vercel 4.5MB) 나눠 보내는 쪽이 어디서나 안전해요.)
 *
 * 받는 것(multipart/form-data)
 *   - file: 그림 파일
 *   - path: 저장소 안 경로. 예: public/posters/winter-stop.jpg, public/images/winter-stop/scene-1.jpg
 *
 * 원본 파일은 고치지 않아요. 화면에서만 형광 초록으로 바꿔 보여 줘요(SVG 필터, app/layout.tsx).
 * 로그인했는지는 proxy.ts가 먼저, 여기서 한 번 더 확인해요.
 */

import type { NextRequest } from "next/server";

import { guardAdminRequest } from "@/lib/admin-auth";
import { errorResponse } from "@/lib/api-response";
import { createBlob } from "@/lib/github";
// 최대 크기와 저장 경로 모양은 글쓰기 화면과 함께 쓰는 규칙이에요(lib/upload-rules.ts).
// (route.ts에서는 GET·POST 같은 정해진 이름만 내보낼 수 있어서, 함께 쓰는 값은 lib에 둬요.)
import { extensionOf, MAX_IMAGE_BYTES, sniffImageType, UPLOAD_PATH } from "@/lib/upload-rules";

/** 경로의 확장자가 실제 그림 형식(sniffImageType이 알려 준 이름)과 맞는지. jpeg는 jpg로 봐요. */
function extensionMatches(path: string, type: string): boolean {
  return extensionOf(path).replace("jpeg", "jpg") === type;
}

/** 사진 올리기 */
export async function POST(request: NextRequest) {
  // 1) 로그인했고 우리 화면에서 보낸 요청인지
  const denied = await guardAdminRequest(request);
  if (denied) return denied;

  // 2) 보낸 내용 꺼내기. formData()는 파일이 든 요청(multipart)을 읽어요. 모양이 틀리면 null로 봐요.
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const path = form?.get("path");
  if (!(file instanceof File) || typeof path !== "string") {
    return Response.json({ message: "사진 파일과 저장할 경로를 함께 보내 주세요." }, { status: 400 });
  }
  if (!UPLOAD_PATH.test(path)) {
    return Response.json({ message: "사진을 저장할 경로가 올바르지 않습니다. 화면을 새로 고친 뒤 다시 넣어 주세요." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return Response.json({ message: "사진이 4MB보다 큽니다. 사진 크기를 줄여 다시 넣어 주세요." }, { status: 413 });
  }

  // 3) 진짜 그림인지 확인해요. 확장자는 바꿔 붙일 수 있어서, 파일 앞부분을 읽어 실제 형식을 알아내요.
  //    sniffImageType은 JPG·PNG·GIF·WebP·AVIF만 알아봐요(모르는 형식이면 undefined). lib/upload-rules.ts
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type || !extensionMatches(path, type)) {
    return Response.json(
      { message: "JPG·PNG·WebP·AVIF 그림만 넣을 수 있습니다(장면 사진은 GIF도 됩니다). 아이폰 사진(HEIC)은 JPG로 바꿔 넣어 주세요." },
      { status: 415 },
    );
  }

  // 4) 저장소에 blob으로 올리고 번호를 돌려줘요.
  try {
    const sha = await createBlob(bytes);
    return Response.json({ path, sha });
  } catch (error) {
    return errorResponse(error);
  }
}
