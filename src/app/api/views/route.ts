/**
 * @file 조회수 모두 읽기 API (app/api/views/route.ts → 주소 "/api/views")
 *
 * 이 파일이 하는 일
 *   GET /api/views : 모든 리뷰의 조회수를 돌려줘요.
 *     답(JSON): { counts: { "winter-stop": 12, ... } }
 *
 * 2.0.0 핫픽스에서 목록·상세에 조회수를 보이지 않게 해서, 지금은 화면이 이 API를 부르지 않아요.
 * 저장소(Durable Object)의 데이터를 지우지 않으려고 API는 남겨 뒀어요(docs/development.md 3장).
 * 저장소는 lib/view-store.ts가 골라요(Cloudflare: Durable Object, 내 컴퓨터: 메모리).
 */

import { getViewStore } from "@/lib/view-store";

/** 요청마다 새로 읽어요(미리 만들어 두지 않아요). */
export const dynamic = "force-dynamic";

/** 모든 리뷰의 조회수 읽기 */
export async function GET() {
  try {
    const snapshot = await getViewStore().read();
    // no-store: 조회수는 늘 바뀌어서 브라우저·중간 서버가 저장해 두지 않게 해요.
    return Response.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "조회수를 읽지 못했습니다. 잠시 뒤 다시 시도해 주세요." }, { status: 503 });
  }
}
