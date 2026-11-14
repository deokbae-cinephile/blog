/**
 * @file 방문자 세기 규칙 (visit-rules.ts)
 *
 * 이 파일이 하는 일
 *   누적 방문자 수를 셀 때 Cloudflare의 저장소(worker/visit-counter.ts)와 내 컴퓨터용 저장소(lib/visit-store.ts)가
 *   함께 쓰는 모양(VisitTotal)과 날짜 도구(previousDay)를 둬요.
 *
 * 규칙
 *   - 같은 사람(lib/visitor-key.ts)은 하루(한국 시간)에 한 번만 세요. 그렇게 센 방문을 날마다 더한 것이 누적 방문자 수예요.
 *   - "그날 이미 센 사람" 기록은 어제·오늘 것만 남기고 그보다 오래된 것은 지워요.
 *     자정 직전 요청이 늦게 도착해도 오늘 기록을 지우지 않고, 어제 센 사람을 다시 세지도 않아요.
 *
 * 이 파일에는 Next.js·Cloudflare 코드가 없어요. 그래서 두 곳에서 그대로 가져다 쓸 수 있고, 시험하기도 쉬워요.
 */

/** 누적 방문자 수: 하루에 한 사람을 한 번씩 센 방문을 모두 더한 수 */
export type VisitTotal = {
  total: number;
};

/**
 * "YYYY-MM-DD"의 하루 전 날짜. 날짜 글자끼리 크기를 견주면(<) 날짜 순서와 같아서, 이보다 오래된 기록을 지우는 기준으로 써요.
 *
 * @example previousDay("2026-03-01"); // "2026-02-28"
 */
export function previousDay(day: string): string {
  // 한국 시간 날짜지만 글자만 하루 당기면 되니, 시간대가 없는 UTC 자정으로 계산해요(서머타임 같은 어긋남이 없어요).
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
