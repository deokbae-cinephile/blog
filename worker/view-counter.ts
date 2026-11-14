/**
 * @file 조회수 저장소: Durable Object (worker/view-counter.ts)
 *
 * 이 파일이 하는 일
 *   Cloudflare의 Durable Object로 블로그의 조회수를 저장해요.
 *
 *     views 표(SQLite)              visit_days 표                  visitors_today 표
 *     ┌─────────────┬───────┐       ┌────────────┬───────┐        ┌────────────┬──────────────────┐
 *     │ slug        │ count │       │ day        │ count │        │ day        │ visitor          │
 *     ├─────────────┼───────┤       ├────────────┼───────┤        ├────────────┼──────────────────┤
 *     │ winter-stop │ 12    │       │ 2026-11-14 │ 37    │        │ 2026-11-14 │ 3fa1c0…(16글자)   │
 *     └─────────────┴───────┘       └────────────┴───────┘        └────────────┴──────────────────┘
 *      리뷰마다의 조회수               날마다 센 방문 수(더하면 누적)    오늘 이미 센 사람(지난 날 것은 지워요)
 *     (조회수는 2.0.0 핫픽스부터 화면이 부르지 않아요. 방문자 수는 로그인한 글쓴이에게만 보여요.)
 *
 * Durable Object가 뭔가요?
 *   이름이 같으면 전 세계 어디서 불러도 늘 같은 "하나"로 연결되는 작은 서버예요(lib/view-store.ts가 "blog"라는 이름으로 불러요).
 *   요청을 한 번에 하나씩 차례로 처리해서, 여러 사람이 동시에 봐도 숫자가 어긋나지 않아요.
 *   저장소는 Durable Object에 딸린 SQLite예요(무료 요금제에서 쓸 수 있는 방식).
 *
 * 세는 규칙(lib/view-rules.ts)
 *   같은 사람이 같은 리뷰를 10분 안에 다시 보면 세지 않아요. 세는 주소는 올라가 있는 리뷰뿐이에요(API가 먼저 확인해요).
 *   "방금 본 사람" 장부는 메모리에만 둬요(이 Durable Object가 쉬면 사라져요. 그래도 괜찮은 짧은 기록이에요).
 *
 * 누가 부르나요?
 *   lib/view-store.ts가 RPC(함수를 부르듯 다른 서버의 메서드 부르기)로 count·get·read를 불러요.
 *   이 클래스는 worker/index.ts가 내보내고, wrangler.jsonc의 durable_objects·migrations가 연결해요.
 */

import { DurableObject } from "cloudflare:workers";

import { RecentViews, type ViewResult, type ViewSnapshot, type VisitTotal } from "../src/lib/view-rules";

/** 조회수 저장소 */
export class ViewCounter extends DurableObject {
  /** "방금 본 사람" 장부(메모리) */
  private readonly recent = new RecentViews();

  /** 이 Durable Object에 딸린 SQLite */
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    // 표가 없으면 만들어요(처음 한 번). PRIMARY KEY는 겹치지 않는 열쇠예요.
    this.sql.exec("CREATE TABLE IF NOT EXISTS views (slug TEXT PRIMARY KEY, count INTEGER NOT NULL)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS visit_days (day TEXT PRIMARY KEY, count INTEGER NOT NULL)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS visitors_today (day TEXT NOT NULL, visitor TEXT NOT NULL, PRIMARY KEY (day, visitor))");
  }

  /**
   * 방문을 하나 세요. 같은 사람은 하루에 한 번만 세요. 이번에 셌으면 true
   * @param visitor 사람을 구별하는 값(lib/visitor-key.ts)
   * @param day 한국 시간 기준 날짜 "YYYY-MM-DD"
   */
  visit(visitor: string, day: string): boolean {
    // 지난 날의 사람 값은 지워요(오늘 한 번만 세는 데에만 쓰고 오래 두지 않아요).
    this.sql.exec("DELETE FROM visitors_today WHERE day != ?", day);
    // 오늘 처음 온 사람이면 줄이 새로 들어가고, 들어간 줄을 돌려받아요(RETURNING). 이미 있으면 들어가지 않아 빈 목록이에요(OR IGNORE).
    const added = this.sql.exec("INSERT OR IGNORE INTO visitors_today (day, visitor) VALUES (?, ?) RETURNING visitor", day, visitor).toArray().length > 0;
    if (added) this.sql.exec("INSERT INTO visit_days (day, count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET count = count + 1", day);
    return added;
  }

  /** 누적 방문자 수(날마다 센 방문을 모두 더한 수) */
  visits(): VisitTotal {
    return { total: this.sql.exec<{ total: number }>("SELECT COALESCE(SUM(count), 0) AS total FROM visit_days").one().total };
  }

  /** 한 번 세요. 같은 사람이 방금 본 리뷰면 세지 않고 지금 숫자만 돌려줘요. */
  count(slug: string, visitor: string): ViewResult {
    if (this.recent.isRepeat(visitor, slug)) return this.result(slug, false);
    // 줄이 없으면 1로 만들고, 있으면 1 올려요(INSERT … ON CONFLICT … DO UPDATE).
    this.sql.exec("INSERT INTO views (slug, count) VALUES (?, 1) ON CONFLICT(slug) DO UPDATE SET count = count + 1", slug);
    return this.result(slug, true);
  }

  /** 세지 않고 지금 숫자만 읽어요. */
  get(slug: string): ViewResult {
    return this.result(slug, false);
  }

  /** 모든 리뷰의 조회수를 읽어요. */
  read(): ViewSnapshot {
    const counts: Record<string, number> = {};
    for (const row of this.sql.exec<{ slug: string; count: number }>("SELECT slug, count FROM views")) counts[row.slug] = row.count;
    return { counts };
  }

  /** 돌려줄 결과: 이 리뷰의 지금 숫자(줄이 없으면 0)와 이번에 셌는지 */
  private result(slug: string, counted: boolean): ViewResult {
    const count = this.sql.exec<{ count: number }>("SELECT count FROM views WHERE slug = ?", slug).toArray()[0]?.count ?? 0;
    return { count, counted };
  }
}
