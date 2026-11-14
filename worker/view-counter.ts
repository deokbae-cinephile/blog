/**
 * @file 조회수 저장소: Durable Object (worker/view-counter.ts)
 *
 * 이 파일이 하는 일
 *   Cloudflare의 Durable Object로 블로그의 조회수를 저장해요.
 *
 *     views 표(SQLite)
 *     ┌───────────────┬───────┐
 *     │ slug          │ count │
 *     ├───────────────┼───────┤
 *     │ winter-stop   │ 12    │   ← 리뷰마다의 조회수
 *     │ __total__     │ 345   │   ← 총 조회수(아직 화면에 보이지 않고 데이터로만)
 *     └───────────────┴───────┘
 *
 * Durable Object가 뭔가요?
 *   이름이 같으면 전 세계 어디서 불러도 늘 같은 "하나"로 연결되는 작은 서버예요(lib/view-store.ts가 "blog"라는 이름으로 불러요).
 *   요청을 한 번에 하나씩 차례로 처리해서, 여러 사람이 동시에 봐도 숫자가 어긋나지 않아요.
 *   저장소는 Durable Object에 딸린 SQLite예요(무료 요금제에서 쓸 수 있는 방식).
 *
 * 세는 규칙(lib/view-rules.ts)
 *   같은 사람이 같은 리뷰를 10분 안에 다시 보면 세지 않아요. 처음 보는 주소는 5000개까지만 받아요.
 *   "방금 본 사람" 장부는 메모리에만 둬요(이 Durable Object가 쉬면 사라져요. 그래도 괜찮은 짧은 기록이에요).
 *
 * 누가 부르나요?
 *   lib/view-store.ts가 RPC(함수를 부르듯 다른 서버의 메서드 부르기)로 count·get·read를 불러요.
 *   이 클래스는 worker/index.ts가 내보내고, wrangler.jsonc의 durable_objects·migrations가 연결해요.
 */

import { DurableObject } from "cloudflare:workers";

import { MAX_SLUGS, RecentViews, TOTAL_KEY, type ViewResult, type ViewSnapshot } from "../src/lib/view-rules";

/** 조회수 저장소 */
export class ViewCounter extends DurableObject {
  /** "방금 본 사람" 장부(메모리) */
  private readonly recent = new RecentViews();

  /** 이 Durable Object에 딸린 SQLite */
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    // 표가 없으면 만들어요(처음 한 번). slug가 겹치지 않는 열쇠(PRIMARY KEY)예요.
    this.sql.exec("CREATE TABLE IF NOT EXISTS views (slug TEXT PRIMARY KEY, count INTEGER NOT NULL)");
  }

  /** 한 번 세요. 같은 사람이 방금 본 리뷰면 세지 않고 지금 숫자만 돌려줘요. */
  count(slug: string, visitor: string): ViewResult {
    // 처음 보는 주소인데 이미 가득 찼으면 세지 않아요.
    const full = this.value(slug) === null && this.slugCount() >= MAX_SLUGS;
    if (full || this.recent.isRepeat(visitor, slug)) return this.result(slug, false);
    // 리뷰 조회수와 총 조회수를 한 번에(트랜잭션) 올려요. 둘 중 하나만 오르는 일이 없어요.
    this.ctx.storage.transactionSync(() => {
      this.bump(slug);
      this.bump(TOTAL_KEY);
    });
    return this.result(slug, true);
  }

  /** 세지 않고 지금 숫자만 읽어요. */
  get(slug: string): ViewResult {
    return this.result(slug, false);
  }

  /** 모든 리뷰의 조회수와 총 조회수를 읽어요. */
  read(): ViewSnapshot {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const row of this.sql.exec<{ slug: string; count: number }>("SELECT slug, count FROM views")) {
      if (row.slug === TOTAL_KEY) total = row.count;
      else counts[row.slug] = row.count;
    }
    return { counts, total };
  }

  /** 한 줄의 숫자를 1 올려요. 줄이 없으면 1로 만들어요(INSERT … ON CONFLICT … DO UPDATE). */
  private bump(key: string) {
    this.sql.exec("INSERT INTO views (slug, count) VALUES (?, 1) ON CONFLICT(slug) DO UPDATE SET count = count + 1", key);
  }

  /** 한 줄의 숫자. 줄이 없으면 null */
  private value(key: string): number | null {
    return this.sql.exec<{ count: number }>("SELECT count FROM views WHERE slug = ?", key).toArray()[0]?.count ?? null;
  }

  /** 조회수를 받은 리뷰 주소의 개수(총 조회수 줄은 빼요) */
  private slugCount(): number {
    return this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM views WHERE slug != ?", TOTAL_KEY).one().n;
  }

  /** 돌려줄 결과 */
  private result(slug: string, counted: boolean): ViewResult {
    return { count: this.value(slug) ?? 0, total: this.value(TOTAL_KEY) ?? 0, counted };
  }
}
