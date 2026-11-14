/**
 * @file 방문자 API (app/api/visits/route.ts → 주소 "/api/visits")
 *
 * 이 파일이 하는 일
 *   - POST /api/visits : 방문을 하나 세요. 같은 사람은 하루(한국 시간)에 한 번만 세요. 답은 내용 없이 204예요.
 *   - GET  /api/visits : 누적 방문자 수를 돌려줘요. 로그인한 글쓴이만 볼 수 있어요(아니면 401).
 *     답(JSON): { total: 1234 }
 *
 * 세지 않는 때
 *   - 글쓴이로 로그인한 상태(세션 쿠키가 올바름): 글쓴이 자신의 방문은 넣지 않아요.
 *   - 검색엔진 로봇·링크 미리 보기 수집기(브라우저 정보로 알아봐요, lib/visitor-key.ts의 isBot)
 *   - 같은 사람이 같은 날 다시 옴(저장소가 걸러요, worker/visit-counter.ts)
 *   - 다른 사이트에서 보낸 요청(Origin이 우리 주소가 아님, 403)
 *
 * 누가 부르나요?
 *   components/visitor-count.tsx: 방문자 브라우저는 하루에 한 번 POST, 로그인한 글쓴이 화면은 GET으로 숫자를 받아 왼쪽 아래에 보여요.
 *   (proxy.ts가 막는 주소가 아니에요. 로그인하지 않은 방문자도 세기 요청을 보내야 해서, GET만 여기서 로그인을 확인해요.)
 */

import type { NextRequest } from "next/server";

import { isSameOrigin } from "@/lib/admin-auth";
import { SESSION_COOKIE } from "@/lib/auth-cookies";
import { isValidSession } from "@/lib/session";
import { getVisitStore } from "@/lib/visit-store";
import { isBot, seoulDay, visitorKey } from "@/lib/visitor-key";

/** 요청마다 새로 처리해요(미리 만들어 두지 않아요). */
export const dynamic = "force-dynamic";

/** 저장소에 문제가 있을 때의 답 */
const unavailable = () => Response.json({ message: "방문자 수를 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요." }, { status: 503 });

/** 로그인한 글쓴이인지(세션 쿠키가 올바른지) */
const isAuthor = (request: NextRequest) => isValidSession(request.cookies.get(SESSION_COOKIE)?.value);

/** 방문 세기(같은 사람은 하루에 한 번) */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ message: "이 블로그 화면에서 보낸 요청만 받습니다." }, { status: 403 });
  }
  // 글쓴이와 로봇은 세지 않아요. 결과를 알려 줄 필요가 없어서 내용 없이 답해요(204).
  if ((await isAuthor(request)) || isBot(request.headers.get("user-agent"))) return new Response(null, { status: 204 });
  try {
    await getVisitStore().visit(await visitorKey(request), seoulDay());
    return new Response(null, { status: 204 });
  } catch {
    return unavailable();
  }
}

/** 누적 방문자 수 읽기(로그인한 글쓴이만) */
export async function GET(request: NextRequest) {
  if (!(await isAuthor(request))) {
    return Response.json({ message: "로그인한 글쓴이만 볼 수 있습니다." }, { status: 401 });
  }
  try {
    // no-store: 숫자는 늘 바뀌고 글쓴이만 보는 값이라, 브라우저·중간 서버가 저장해 두지 않게 해요.
    return Response.json(await getVisitStore().visits(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return unavailable();
  }
}
