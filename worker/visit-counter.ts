/**
 * @file 방문자 저장소: Durable Object (worker/visit-counter.ts)
 *
 * 이 파일이 하는 일
 *   Cloudflare의 Durable Object로 블로그의 누적 방문자 수를 저장해요(로그인한 글쓴이에게만 보여요).
 *
 *     visit_days 표                     visitors_recent 표
 *     ┌────────────┬───────┐           ┌────────────┬──────────────────┐
 *     │ day        │ count │           │ day        │ visitor          │
 *     ├────────────┼───────┤           ├────────────┼──────────────────┤
 *     │ 2026-11-14 │ 37    │           │ 2026-11-14 │ 3fa1c0…(16글자)   │
 *     └────────────┴───────┘           └────────────┴──────────────────┘
 *      날마다 센 방문 수(더하면 누적)       그날 이미 센 사람(어제·오늘 것만 남겨요, lib/visit-rules.ts)
 *
 * Durable Object가 뭔가요?
 *   이름이 같으면 전 세계 어디서 불러도 늘 같은 "하나"로 연결되는 작은 서버예요(lib/visit-store.ts가 "blog"라는 이름으로 불러요).
 *   요청을 한 번에 하나씩 차례로 처리해서, 여러 사람이 동시에 와도 숫자가 어긋나지 않아요.
 *   저장소는 Durable Object에 딸린 SQLite예요(무료 요금제에서 쓸 수 있는 방식).
 *
 * 예전 조회수 저장소(ViewCounter)는요?
 *   2.0.0 핫픽스에서 조회수 기능을 모두 지우면서, 조회수와 방문자 수를 함께 담던 그 Durable Object도 지웠어요
 *   (wrangler.jsonc의 migrations v3: 저장된 숫자까지 지워져요). 방문자 수는 이 새 저장소(v2)에서 0부터 다시 세요.
 *
 * 누가 부르나요?
 *   lib/visit-store.ts가 RPC(함수를 부르듯 다른 서버의 메서드 부르기)로 visit·visits를 불러요.
 *   이 클래스는 worker/index.ts가 내보내고, wrangler.jsonc의 durable_objects·migrations가 연결해요.
 */

import { DurableObject } from "cloudflare:workers";

import { previousDay, type VisitTotal } from "../src/lib/visit-rules";

/** 방문자 저장소 */
export class VisitCounter extends DurableObject {
  /** 이 Durable Object에 딸린 SQLite */
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    // 표가 없으면 만들어요(처음 한 번). PRIMARY KEY는 겹치지 않는 열쇠예요.
    this.sql.exec("CREATE TABLE IF NOT EXISTS visit_days (day TEXT PRIMARY KEY, count INTEGER NOT NULL)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS visitors_recent (day TEXT NOT NULL, visitor TEXT NOT NULL, PRIMARY KEY (day, visitor))");
  }

  /**
   * 방문을 하나 세요. 같은 사람은 하루에 한 번만 세요. 이번에 셌으면 true
   * @param visitor 사람을 구별하는 값(lib/visitor-key.ts)
   * @param day 한국 시간 기준 날짜 "YYYY-MM-DD"
   */
  visit(visitor: string, day: string): boolean {
    // 사람 값은 하루 한 번만 세는 데에만 써서 오래 두지 않아요. 다만 요청 날짜의 "어제"보다 오래된 것만 지워요.
    // (자정 직전 요청이 늦게 도착해도 오늘 기록을 지우지 않고, 어제 기록도 남아 있어 같은 사람을 다시 세지 않아요.)
    this.sql.exec("DELETE FROM visitors_recent WHERE day < ?", previousDay(day));
    // 그날 처음 온 사람이면 줄이 새로 들어가고, 들어간 줄을 돌려받아요(RETURNING). 이미 있으면 들어가지 않아 빈 목록이에요(OR IGNORE).
    const added = this.sql.exec("INSERT OR IGNORE INTO visitors_recent (day, visitor) VALUES (?, ?) RETURNING visitor", day, visitor).toArray().length > 0;
    if (added) this.sql.exec("INSERT INTO visit_days (day, count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET count = count + 1", day);
    return added;
  }

  /** 누적 방문자 수(날마다 센 방문을 모두 더한 수) */
  visits(): VisitTotal {
    return { total: this.sql.exec<{ total: number }>("SELECT COALESCE(SUM(count), 0) AS total FROM visit_days").one().total };
  }
}
