/**
 * @file 조회수 저장소 (view-store.ts)
 *
 * 이 파일이 하는 일
 *   조회수 API(app/api/views/**)가 조회수를 세고 읽을 저장소를 골라 줘요.
 *
 *     Cloudflare(배포된 블로그)  → Durable Object "ViewCounter"(worker/view-counter.ts)
 *                                   SQLite에 리뷰마다의 조회수를 저장해요. 세는 일은 한 곳에서 차례로 해서 숫자가 어긋나지 않아요.
 *     내 컴퓨터(pnpm dev)·E2E    → 메모리 저장소. 서버를 끄면 사라져요. 규칙(lib/view-rules.ts)은 똑같아요.
 *
 * 어느 쪽인지는 어떻게 아나요?
 *   Cloudflare Workers에서는 navigator.userAgent가 "Cloudflare-Workers"예요. 그때는 반드시 Durable Object를 써요.
 *   (설정이 빠져 있으면 메모리로 몰래 바꾸지 않고 오류를 내요. 조회수가 조용히 사라지면 안 되니까요.)
 *
 * 누가 쓰나요?
 *   app/api/views/route.ts(모두 읽기), app/api/views/[slug]/route.ts(하나 읽기·세기)
 */

import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { RecentViews, type ViewResult, type ViewSnapshot } from "./view-rules";

/** 조회수 저장소가 하는 일 */
export type ViewStore = {
  /** 한 번 세요(같은 사람이 방금 본 리뷰면 세지 않고 지금 숫자만 알려 줘요). */
  count(slug: string, visitor: string): Promise<ViewResult>;
  /** 세지 않고 지금 숫자만 읽어요. */
  get(slug: string): Promise<ViewResult>;
  /** 모든 리뷰의 조회수를 읽어요. */
  read(): Promise<ViewSnapshot>;
};

/** Durable Object(worker/view-counter.ts)의 RPC 메서드. 여기서는 모양만 적어요(Cloudflare 타입을 Next.js 쪽에 들이지 않으려고요). */
type ViewCounterStub = ViewStore;

/** wrangler.jsonc의 durable_objects 바인딩(VIEW_COUNTER) 모양 */
type ViewCounterNamespace = {
  idFromName(name: string): unknown;
  get(id: unknown): ViewCounterStub;
};

/** Cloudflare Workers에서 돌고 있는지 */
const onWorkers = () => typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

/**
 * 지금 쓸 조회수 저장소를 돌려줘요.
 * Cloudflare에서는 Durable Object(블로그 전체에 하나), 그 밖에서는 메모리 저장소예요.
 */
export function getViewStore(): ViewStore {
  if (!onWorkers()) return memoryStore;
  const namespace = (getCloudflareContext().env as { VIEW_COUNTER?: ViewCounterNamespace }).VIEW_COUNTER;
  if (!namespace) throw new Error("조회수 저장소(VIEW_COUNTER)가 wrangler.jsonc에 연결되어 있지 않습니다.");
  // idFromName("blog"): 이름이 같으면 늘 같은 하나의 Durable Object예요. 블로그 전체의 조회수를 한 곳에서 세요.
  return namespace.get(namespace.idFromName("blog"));
}

/* ──────────────────────────────────────────────────────────────
 * 메모리 저장소(내 컴퓨터·E2E용). Durable Object와 같은 규칙으로 세요.
 * ────────────────────────────────────────────────────────────── */

/** 리뷰 주소 → 조회수 */
const memoryCounts = new Map<string, number>();
const memoryRecent = new RecentViews();

/** 지금 숫자 읽기 */
const memoryResult = (slug: string, counted: boolean): ViewResult => ({ count: memoryCounts.get(slug) ?? 0, counted });

const memoryStore: ViewStore = {
  async count(slug, visitor) {
    if (memoryRecent.isRepeat(visitor, slug)) return memoryResult(slug, false);
    memoryCounts.set(slug, (memoryCounts.get(slug) ?? 0) + 1);
    return memoryResult(slug, true);
  },
  async get(slug) {
    return memoryResult(slug, false);
  },
  async read() {
    return { counts: Object.fromEntries(memoryCounts) };
  },
};
