/**
 * @file 로그인 세션 표 만들기·확인하기 (session.ts)
 *
 * 이 파일이 하는 일
 *   글쓴이가 로그인하면 "이 사람은 글쓴이예요, 언제까지 유효해요"라는 표(토큰)를 만들어 쿠키에 담아 줘요.
 *   다음 요청부터는 서버가 그 표를 보고 진짜인지(위조되지 않았는지), 기한이 남았는지 확인해요.
 *
 * 표의 모양
 *   "내용.서명" 두 부분을 점(.)으로 이은 글자예요.
 *     내용: { sub: 글쓴이 아이디, exp: 만료 시각(초) }를 JSON으로 적고 base64url로 바꾼 글자
 *     서명: 내용을 비밀 열쇠(SESSION_SECRET)로 HMAC-SHA256 계산한 값
 *   비밀 열쇠를 모르는 사람은 올바른 서명을 만들 수 없어서, 내용을 고치면(예: 기한 늘리기) 확인에서 걸려요.
 *
 * 왜 라이브러리 없이 직접 만들었나요?
 *   브라우저·Node.js·엣지 런타임 어디에나 있는 웹 표준 Web Crypto(crypto.subtle)만 쓰면 20줄 남짓이라
 *   의존성을 더하지 않았어요(가벼움이 우선). 같은 이유로 node:crypto도 쓰지 않아,
 *   proxy.ts가 어느 런타임(Cloudflare Workers, Node.js 서버 등)에서 돌아도 그대로 동작해요.
 *
 * 누가 쓰나요?
 *   src/proxy.ts(쓰기 화면·API 앞에서 확인), lib/admin-auth.ts(API와 글쓰기 화면에서 다시 확인),
 *   app/api/session/route.ts(로그인할 때 표 만들기)
 */

import { SESSION_MAX_AGE } from "./auth-cookies";

/** 표의 내용: 누구(sub)의 표인지와 언제(exp, 1970년부터 센 초)까지 유효한지 */
type SessionPayload = { sub: string; exp: number };

/** 글자 ↔ 바이트 변환 도구. 암호 계산은 바이트(Uint8Array)로 해요. */
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * 바이트를 base64url 글자로 바꿔요.
 * base64url은 base64에서 주소·쿠키에 곤란한 글자(+, /, =)를 -, _로 바꾸고 끝의 =를 지운 모양이에요.
 */
function toBase64Url(bytes: Uint8Array): string {
  // btoa는 "한 글자 = 한 바이트" 글자를 base64로 바꿔요. 그래서 바이트를 먼저 그런 글자로 이어 붙여요.
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url 글자를 바이트로 되돌려요. 모양이 틀렸으면 null이에요. */
function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  // base64url에 쓰는 글자만 들어 있는지 먼저 확인해요.
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    // -, _를 원래의 +, /로 돌려놓고 atob로 풀어요(atob는 끝의 = 없이도 풀어 줘요).
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** 비밀 열쇠 글자로 HMAC-SHA256 열쇠를 만들어요. extractable: false — 만든 열쇠를 다시 꺼낼 수 없게 해요. */
function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/**
 * 로그인 표를 만들어요.
 *
 * @param sub 글쓴이 아이디(ADMIN_ID)
 * @param secret 비밀 열쇠(SESSION_SECRET)
 * @param now 지금 시각(밀리초). 테스트에서 시각을 정해 넣으려고 받아요. 기본은 지금
 * @returns "내용.서명" 모양의 글자
 */
export async function createSessionToken(sub: string, secret: string, now = Date.now()): Promise<string> {
  // 만료 시각 = 지금(초) + 유지 시간(7일)
  const payload: SessionPayload = { sub, exp: Math.floor(now / 1000) + SESSION_MAX_AGE };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  // 내용 글자(body)에 서명해요. 확인할 때도 똑같이 body 글자로 확인해요.
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await importKey(secret), encoder.encode(body)));
  return `${body}.${toBase64Url(signature)}`;
}

/**
 * 로그인 표가 진짜이고, 기한이 남았고, 지금 글쓴이의 표인지 확인해요.
 *
 * crypto.subtle.verify는 서명을 비교할 때 걸리는 시간이 늘 같아서(상수 시간),
 * "어디까지 맞았는지"를 시간 차이로 알아내는 공격(타이밍 공격)을 막아 줘요.
 *
 * @param token 쿠키에서 꺼낸 표
 * @param secret 비밀 열쇠(SESSION_SECRET)
 * @param expectedSub 지금 글쓴이 아이디(ADMIN_ID). 아이디를 바꾸면 예전 표는 모두 무효가 돼요.
 * @param now 지금 시각(밀리초). 기본은 지금
 */
export async function verifySessionToken(token: string, secret: string, expectedSub: string, now = Date.now()): Promise<boolean> {
  // "내용.서명" 두 부분으로 나눠요. 점이 더 있거나 비어 있으면 가짜예요.
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return false;

  const signatureBytes = fromBase64Url(signature);
  const bodyBytes = fromBase64Url(body);
  if (!signatureBytes || !bodyBytes) return false;

  // 1) 서명 확인: 내용 글자로 다시 계산한 서명과 같은지
  const valid = await crypto.subtle.verify("HMAC", await importKey(secret), signatureBytes, encoder.encode(body));
  if (!valid) return false;

  // 2) 내용 확인: 같은 글쓴이인지, 기한이 남았는지
  try {
    const payload = JSON.parse(decoder.decode(bodyBytes)) as Partial<SessionPayload>;
    return payload.sub === expectedSub && typeof payload.exp === "number" && payload.exp * 1000 > now;
  } catch {
    return false;
  }
}

/**
 * 세션 확인에 필요한 서버 설정(환경 변수)을 읽어요. 설정이 없거나 모자라면 null이에요.
 *
 * - SESSION_SECRET: 서명용 비밀 열쇠. 짧으면 알아맞히기 쉬워서 32글자 이상만 받아요(`pnpm admin-secrets`가 만들어 줘요).
 * - ADMIN_ID: 글쓴이 아이디. 이 블로그는 이 아이디 한 사람만 로그인할 수 있어요.
 */
export function readSessionConfig(): { secret: string; adminId: string } | null {
  const secret = process.env.SESSION_SECRET ?? "";
  const adminId = process.env.ADMIN_ID ?? "";
  if (secret.length < 32 || adminId === "") return null;
  return { secret, adminId };
}

/**
 * 쿠키의 표가 지금 유효한 글쓴이 로그인인지 알려 줘요. 서버 설정이 없으면 늘 false(아무도 로그인할 수 없음)예요.
 *
 * @param token 세션 쿠키 값. 쿠키가 없으면 undefined
 */
export async function isValidSession(token: string | undefined): Promise<boolean> {
  const config = readSessionConfig();
  if (!config || !token) return false;
  return verifySessionToken(token, config.secret, config.adminId);
}
