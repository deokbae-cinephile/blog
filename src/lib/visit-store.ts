/**
 * @file 방문자 저장소 고르기 (visit-store.ts)
 *
 * 이 파일이 하는 일
 *   방문자 API(app/api/visits)가 방문을 세고 누적 방문자 수를 읽을 저장소를 골라 줘요.
 *
 *     Cloudflare(배포된 블로그)  → Durable Object "VisitCounter"(worker/visit-counter.ts)
 *                                   SQLite에 날마다 센 방문 수를 저장해요. 세는 일은 한 곳에서 차례로 해서 숫자가 어긋나지 않아요.
 *     내 컴퓨터(pnpm dev)·E2E    → 메모리 저장소. 서버를 끄면 사라져요. 규칙(lib/visit-rules.ts)은 똑같아요.
 *
 * 어느 쪽인지는 어떻게 아나요?
 *   Cloudflare Workers에서는 navigator.userAgent가 "Cloudflare-Workers"예요. 그때는 반드시 Durable Object를 써요.
 *   (설정이 빠져 있으면 메모리로 몰래 바꾸지 않고 오류를 내요. 방문자 수가 조용히 사라지면 안 되니까요.)
 *
 * 누가 쓰나요?
 *   app/api/visits/route.ts(방문 세기·누적 방문자 수 읽기)
 */

import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { previousDay, type VisitTotal } from "./visit-rules";

/** 방문자 저장소가 하는 일 */
export type VisitStore = {
  /**
   * 방문을 하나 세요. 같은 사람(visitor)은 하루(day)에 한 번만 세요. 이번에 셌으면 true
   * @param visitor 사람을 구별하는 값(lib/visitor-key.ts)
   * @param day 한국 시간 기준 날짜 "YYYY-MM-DD"
   */
  visit(visitor: string, day: string): Promise<boolean>;
  /** 누적 방문자 수(하루 단위로 센 방문을 모두 더한 수)를 읽어요. */
  visits(): Promise<VisitTotal>;
};

/** wrangler.jsonc의 durable_objects 바인딩(VISIT_COUNTER) 모양. Cloudflare 타입을 Next.js 쪽에 들이지 않으려고 모양만 적어요. */
type VisitCounterNamespace = {
  idFromName(name: string): unknown;
  get(id: unknown): VisitStore;
};

/** Cloudflare Workers에서 돌고 있는지 */
const onWorkers = () => typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

/**
 * 지금 쓸 방문자 저장소를 돌려줘요.
 * Cloudflare에서는 Durable Object(블로그 전체에 하나), 그 밖에서는 메모리 저장소예요.
 */
export function getVisitStore(): VisitStore {
  if (!onWorkers()) return memoryStore;
  const namespace = (getCloudflareContext().env as { VISIT_COUNTER?: VisitCounterNamespace }).VISIT_COUNTER;
  if (!namespace) throw new Error("방문자 저장소(VISIT_COUNTER)가 wrangler.jsonc에 연결되어 있지 않습니다.");
  // idFromName("blog"): 이름이 같으면 늘 같은 하나의 Durable Object예요. 블로그 전체의 방문을 한 곳에서 세요.
  return namespace.get(namespace.idFromName("blog"));
}

/* ──────────────────────────────────────────────────────────────
 * 메모리 저장소(내 컴퓨터·E2E용). Durable Object와 같은 규칙으로 세요.
 * ────────────────────────────────────────────────────────────── */

/** 날짜 → 그날 센 방문 수 */
const memoryVisitDays = new Map<string, number>();
/** 그날 이미 센 사람들: "날짜|사람" 모음. 요청 날짜의 어제보다 오래된 것은 지워요(Durable Object와 같은 규칙). */
const memorySeen = new Set<string>();

const memoryStore: VisitStore = {
  async visit(visitor, day) {
    // 어제보다 오래된 사람 값은 지워요(늦게 도착한 어제 요청이 오늘 기록을 지우지 않게, 이틀 치는 남겨요).
    const keepFrom = previousDay(day);
    for (const key of memorySeen) if (key.slice(0, 10) < keepFrom) memorySeen.delete(key);
    const key = `${day}|${visitor}`;
    if (memorySeen.has(key)) return false;
    memorySeen.add(key);
    memoryVisitDays.set(day, (memoryVisitDays.get(day) ?? 0) + 1);
    return true;
  },
  async visits() {
    return { total: [...memoryVisitDays.values()].reduce((sum, count) => sum + count, 0) };
  },
};
