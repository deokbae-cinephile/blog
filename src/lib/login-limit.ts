/**
 * @file 로그인 실패 횟수 제한 (login-limit.ts)
 *
 * 이 파일이 하는 일
 *   같은 곳(IP)에서 로그인에 짧은 시간 여러 번 실패하면, 잠시 비밀번호를 확인하지 않고 바로 막아요(429).
 *     - 10분 동안 10번 틀리면, 가장 오래된 실패가 10분을 넘길 때까지 막아요.
 *     - 로그인에 성공하면 그곳의 실패 기록을 지워요.
 *
 * 왜 비밀번호를 확인하기 "전에" 막나요?
 *   비밀번호 확인(scrypt)은 일부러 CPU를 많이 쓰게 만든 계산이에요. 막힌 곳의 요청은 계산하지 않아야
 *   비밀번호 대입 공격도 느려지고, 서버(Cloudflare Workers의 CPU 한도)도 지킬 수 있어요.
 *
 * 한계
 *   기록은 서버 메모리에 있어서 서버 인스턴스(Workers의 isolate)마다 따로 세고, 인스턴스가 바뀌면 사라져요.
 *   그래서 도메인을 Cloudflare에 연결한 뒤에는 Cloudflare의 속도 제한 규칙(Rate limiting rules, 무료 1개)으로
 *   /api/session을 함께 막으면 더 단단해요(docs/development.md 5장).
 *
 * 누가 쓰나요?
 *   app/api/session/route.ts(로그인 API)
 */

/** 실패를 세는 시간 창: 10분 */
export const WINDOW_MS = 10 * 60 * 1000;
/** 시간 창 안에서 허용하는 실패 횟수 */
export const MAX_FAILURES = 10;
/** 기록을 들고 있는 곳의 수가 이보다 많아지면 오래된 기록을 치워요(메모리가 끝없이 늘지 않게). */
const SWEEP_AT = 1000;

/** 곳(IP) → 실패한 시각들(오래된 것부터) */
const failures = new Map<string, number[]>();

/** 시간 창 안의 실패만 남겨요. */
function recent(key: string, now: number): number[] {
  return (failures.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
}

/**
 * 지금 로그인을 시도해도 되는지 알려 줘요. 막혔으면 몇 초 뒤에 다시 시도할 수 있는지도 알려 줘요.
 *
 * @param key 요청한 곳(IP)
 * @param now 지금 시각(밀리초). 테스트에서 시각을 정해 주려고 받아요.
 */
export function checkLoginAllowed(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
  const times = recent(key, now);
  if (times.length < MAX_FAILURES) return { ok: true };
  // 가장 오래된 실패가 시간 창을 벗어나는 때까지 막아요. 최소 1초.
  return { ok: false, retryAfter: Math.max(1, Math.ceil((times[0]! + WINDOW_MS - now) / 1000)) };
}

/** 로그인 실패를 기록해요. */
export function recordLoginFailure(key: string, now = Date.now()): void {
  const times = recent(key, now);
  times.push(now);
  failures.set(key, times);
  // 기록이 많아지면 시간 창을 벗어난 곳들을 지워요.
  if (failures.size > SWEEP_AT) {
    for (const [other] of failures) if (recent(other, now).length === 0) failures.delete(other);
  }
}

/** 로그인에 성공하면 그곳의 실패 기록을 지워요. */
export function clearLoginFailures(key: string): void {
  failures.delete(key);
}

/**
 * 요청한 곳(IP)을 알아내요.
 * Cloudflare는 진짜 접속 주소를 cf-connecting-ip 머리글에 넣어 줘요(방문자가 바꿀 수 없어요).
 * 다른 환경(내 컴퓨터의 Node.js 서버 등)에서는 x-forwarded-for의 첫 주소를 쓰고, 그마저 없으면 "unknown"으로 함께 세요.
 */
export function clientKey(headers: Headers): string {
  return headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
