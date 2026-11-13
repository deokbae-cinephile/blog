/**
 * @file 로그인·로그아웃 API (app/api/session/route.ts → 주소 "/api/session")
 *
 * 이 파일이 하는 일
 *   - POST   /api/session : 아이디·비밀번호를 확인하고, 맞으면 로그인 쿠키 두 개를 구워 줘요(로그인).
 *   - DELETE /api/session : 로그인 쿠키를 지워요(로그아웃).
 *
 * Next.js 약속: route.ts (Route Handler)
 *   app 폴더 안의 route.ts에서 GET, POST, DELETE 같은 이름의 함수를 내보내면, 그 주소의 API가 돼요.
 *   화면(page.tsx) 대신 JSON 같은 데이터를 돌려줘요. 요청이 올 때마다 서버에서 실행돼요.
 *
 * 로그인 화면은 누구나 열 수 있어야 해서 이 주소는 proxy.ts가 지키지 않아요.
 * 대신 "우리 사이트에서 보낸 요청인지(Origin)"는 여기서 확인해요.
 *
 * 누가 쓰나요?
 *   components/login-form.tsx(로그인), components/session-controls.tsx(로그아웃) — lib/admin-api.ts를 거쳐요.
 */

import { NextResponse, type NextRequest } from "next/server";

import { checkCredentials, cookieOptions, isSameOrigin } from "@/lib/admin-auth";
import { readJson } from "@/lib/api-response";
import { ADMIN_HINT_COOKIE, SESSION_COOKIE } from "@/lib/auth-cookies";
import { clearLoginFailures, clientKey, reserveLoginAttempt } from "@/lib/login-limit";
import { createSessionToken, readSessionConfig } from "@/lib/session";

/** 다른 사이트에서 보낸 요청에 돌려줄 답 */
const FORBIDDEN = { message: "이 블로그 화면에서 보낸 요청만 받습니다. 블로그를 새로 고친 뒤 다시 시도하세요." };

/** 잠깐 기다려요. 비밀번호가 틀렸을 때 조금 늦게 답해서, 비밀번호를 빠르게 계속 대입해 보는 공격을 느리게 해요. */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 로그인: { id, password }를 받아 확인하고, 맞으면 쿠키를 구워요. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json(FORBIDDEN, { status: 403 });

  // 보낸 내용에서 아이디와 비밀번호를 꺼내요. 글자가 아니면 빈 글자로 봐요.
  const body = await readJson(request);
  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const password = typeof record.password === "string" ? record.password : "";

  // 같은 곳에서 너무 많이 틀렸으면, 비밀번호를 확인(계산)하기 전에 바로 막아요(lib/login-limit.ts).
  // 허용되면 이 시도를 먼저 실패 한 번으로 세어 둬요. 동시에 보낸 요청도 하나씩 세어지게요.
  const key = clientKey(request.headers);
  const allowed = reserveLoginAttempt(key);
  if (!allowed.ok) {
    const minutes = Math.ceil(allowed.retryAfter / 60);
    return NextResponse.json(
      { message: `로그인에 여러 번 실패해 잠시 막았습니다. ${minutes}분 뒤 다시 시도하세요.` },
      // Retry-After: 몇 초 뒤에 다시 시도하면 되는지 알려 주는 표준 머리글
      { status: 429, headers: { "Retry-After": String(allowed.retryAfter) } },
    );
  }

  const result = await checkCredentials(id, password);
  if (result === "not-configured") {
    return NextResponse.json(
      { message: "서버에 로그인 설정이 없어 로그인할 수 없습니다. ADMIN_ID, ADMIN_PASSWORD_HASH, SESSION_SECRET을 설정해 주세요(.env.example 참고)." },
      { status: 503 },
    );
  }
  if (result === "wrong") {
    // 이 실패는 위에서 이미 세어 뒀어요.
    await wait(400);
    return NextResponse.json({ message: "아이디나 비밀번호가 맞지 않습니다. 다시 확인해 입력하세요." }, { status: 401 });
  }

  // 맞았어요! 이곳의 실패 기록을 지우고, 로그인 표(세션 토큰)를 만들어 쿠키에 담아요.
  // checkCredentials가 "ok"면 설정은 늘 있어요.
  clearLoginFailures(key);
  const config = readSessionConfig()!;
  const token = await createSessionToken(config.adminId, config.secret);
  const response = NextResponse.json({ ok: true });
  // 세션 쿠키: 자바스크립트가 읽지 못하게(httpOnly)
  response.cookies.set(SESSION_COOKIE, token, cookieOptions(true));
  // 로그인 표시 쿠키: 화면이 [새 리뷰]·[고치기] 단추를 보일지 정할 때 읽어요(비밀 없음).
  response.cookies.set(ADMIN_HINT_COOKIE, "1", cookieOptions(false));
  return response;
}

/** 로그아웃: 쿠키 두 개를 지워요. 로그인하지 않았어도 그냥 성공으로 답해요(이미 로그아웃 상태니까요). */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json(FORBIDDEN, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(ADMIN_HINT_COOKIE);
  return response;
}
