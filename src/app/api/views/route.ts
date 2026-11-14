/**
 * @file 조회수 모두 읽기 API (app/api/views/route.ts → 주소 "/api/views")
 *
 * 이 파일이 하는 일
 *   GET /api/views : 모든 리뷰의 조회수와 총 조회수를 돌려줘요. 처음 화면(목록)이 조회수를 보이고 조회순으로 정렬할 때 써요.
 *     답(JSON): { counts: { "winter-stop": 12, ... }, total: 345 }
 *     총 조회수(total)는 아직 화면에 보이지 않고 데이터로만 둬요.
 *
 * 목록은 미리 만든 화면이라 조회수가 들어 있지 않아요. 브라우저가 화면을 연 뒤 이 API로 따로 받아 와요.
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
