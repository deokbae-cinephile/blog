/**
 * @file 리뷰 하나의 조회수 API (app/api/views/[slug]/route.ts → 주소 "/api/views/<주소>")
 *
 * 이 파일이 하는 일
 *   - GET  /api/views/winter-stop : 이 리뷰의 조회수를 세지 않고 읽어요.
 *   - POST /api/views/winter-stop : 이 리뷰를 한 번 봤다고 세고, 센 뒤의 숫자를 돌려줘요.
 *     답(JSON): { count: 13, counted: true }  (counted: 이번에 셌는지)
 *
 * 세지 않는 때
 *   - 빌드할 때 올라가 있지 않은 주소(404): 아무 주소로나 요청을 보내 저장소를 채우지 못하게 해요(lib/review-slugs.ts).
 *   - 글쓴이로 로그인한 상태(세션 쿠키가 올바름): 글쓴이가 자기 글을 보는 것은 조회수에 넣지 않아요.
 *   - 같은 사람(접속 주소 + 브라우저)이 같은 리뷰를 10분 안에 다시 봤을 때(lib/view-rules.ts)
 *   - 다른 사이트에서 보낸 요청(Origin이 우리 주소가 아님): 남의 사이트가 방문자 브라우저로 조회수를 부풀리지 못하게 해요.
 *
 * 사람을 어떻게 구별하나요?
 *   접속 주소(Cloudflare가 알려 주는 cf-connecting-ip)와 브라우저 정보(user-agent)를 섞어 SHA-256으로 줄인 값을 써요.
 *   원래 주소는 저장하지 않고, 줄인 값도 10분 동안 메모리에만 둬요.
 */

import type { NextRequest } from "next/server";

import { isSameOrigin } from "@/lib/admin-auth";
import { SESSION_COOKIE } from "@/lib/auth-cookies";
import { SLUG } from "@/lib/review-schema";
import { isPublishedSlug } from "@/lib/review-slugs";
import { isValidSession } from "@/lib/session";
import { getViewStore } from "@/lib/view-store";

/** 요청마다 새로 처리해요(미리 만들어 두지 않아요). */
export const dynamic = "force-dynamic";

/** 리뷰 주소가 규칙(영어 소문자·숫자·하이픈, 100자까지)에 맞는지 */
const isSlug = (slug: string) => slug.length <= 100 && SLUG.test(slug);

/** 주소가 틀렸을 때의 답 */
const badSlug = () => Response.json({ message: "리뷰 주소가 올바르지 않습니다." }, { status: 400 });

/** 저장소에 문제가 있을 때의 답 */
const unavailable = () => Response.json({ message: "조회수를 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요." }, { status: 503 });

/**
 * 사람을 구별하는 값: 접속 주소 + 브라우저 정보를 SHA-256으로 줄인 앞 16글자.
 * Cloudflare에서는 cf-connecting-ip가 늘 와요(방문자가 바꿀 수 없어요). 내 컴퓨터·시험에서는 x-forwarded-for를 써요.
 */
async function visitorKey(request: NextRequest): Promise<string> {
  const address = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const agent = request.headers.get("user-agent") ?? "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${address}|${agent}`));
  return Array.from(new Uint8Array(digest).slice(0, 8), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** 이 리뷰의 조회수 읽기(세지 않아요) */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/views/[slug]">) {
  const { slug } = await ctx.params;
  if (!isSlug(slug)) return badSlug();
  try {
    return Response.json(await getViewStore().get(slug), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return unavailable();
  }
}

/** 이 리뷰를 한 번 봤다고 세기(로그인한 글쓴이는 세지 않아요) */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/views/[slug]">) {
  if (!isSameOrigin(request)) {
    return Response.json({ message: "이 블로그 화면에서 보낸 요청만 받습니다." }, { status: 403 });
  }
  const { slug } = await ctx.params;
  if (!isSlug(slug)) return badSlug();
  // 올라가 있는 리뷰만 세요. 없는 주소로 저장소에 새 줄을 만들지 않아요.
  if (!isPublishedSlug(slug)) return Response.json({ message: "없는 리뷰입니다." }, { status: 404 });
  try {
    const store = getViewStore();
    // 글쓴이로 로그인했으면 세지 않고 지금 숫자만 돌려줘요.
    if (await isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) {
      return Response.json(await store.get(slug), { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json(await store.count(slug, await visitorKey(request)), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return unavailable();
  }
}
