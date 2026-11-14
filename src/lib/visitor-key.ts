/**
 * @file 방문자 구별·로봇 거르기·오늘 날짜 (visitor-key.ts)
 *
 * 이 파일이 하는 일
 *   방문자 API가 쓰는 작은 도구들이에요(서버에서만 써요).
 *
 *     visitorKey(request)  사람을 구별하는 값: 접속 주소 + 브라우저 정보를 SHA-256으로 줄인 16글자
 *     isBot(userAgent)     검색엔진 로봇·링크 미리 보기 수집기인지(방문자로 세지 않아요)
 *     seoulDay(now)        한국 시간 기준 오늘 날짜 "YYYY-MM-DD"(하루에 한 번만 세는 기준)
 *
 * 사람을 어떻게 구별하나요?
 *   접속 주소(Cloudflare가 알려 주는 cf-connecting-ip)와 브라우저 정보(user-agent)를 섞어 SHA-256으로 줄인 값을 써요.
 *   원래 주소는 저장하지 않아요. 방문자 저장소는 이 값도 어제·오늘 것만 두고 그보다 오래된 것은 지워요(worker/visit-counter.ts).
 *
 * 누가 쓰나요?
 *   app/api/visits/route.ts(방문자)
 */

import "server-only";

/**
 * 사람을 구별하는 값: 접속 주소 + 브라우저 정보를 SHA-256으로 줄인 앞 16글자.
 * Cloudflare에서는 cf-connecting-ip가 늘 와요(방문자가 바꿀 수 없어요). 내 컴퓨터·시험에서는 x-forwarded-for를 써요.
 */
export async function visitorKey(request: Request): Promise<string> {
  const address = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const agent = request.headers.get("user-agent") ?? "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${address}|${agent}`));
  return Array.from(new Uint8Array(digest).slice(0, 8), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * 검색엔진 로봇·링크 미리 보기 수집기·자동 검사 도구의 브라우저 정보에 흔히 들어 있는 낱말이에요.
 * 이들은 사람이 아니라서 방문자로 세지 않아요. (자바스크립트를 돌리지 않는 로봇은 처음부터 세기 요청을 보내지 않아요.)
 */
const BOT = /bot|crawl|spider|slurp|scrap|preview|facebookexternalhit|headless|lighthouse|pingdom|monitor/i;

/** 사람이 아니라 로봇(검색엔진·미리 보기 수집기 등)인지. 브라우저 정보가 아예 없어도 로봇으로 봐요. */
export function isBot(userAgent: string | null): boolean {
  return !userAgent || BOT.test(userAgent);
}

/**
 * 한국 시간 기준 오늘 날짜 "YYYY-MM-DD". 서버는 다른 나라 시간대에 있을 수 있어서 시간대를 정해 계산해요.
 * ("sv-SE"(스웨덴) 날짜 모양이 마침 YYYY-MM-DD라서 빌려 써요.)
 *
 * @param now 기준 시각. 시험에서 정해 넣으려고 받아요. 기본은 지금
 */
export function seoulDay(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(now);
}
