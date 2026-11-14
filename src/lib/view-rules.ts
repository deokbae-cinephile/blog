/**
 * @file 조회수 세는 규칙 (view-rules.ts)
 *
 * 이 파일이 하는 일
 *   조회수를 셀 때 함께 지키는 규칙과, "방금 본 사람"을 기억하는 작은 장부(RecentViews)를 둬요.
 *   Cloudflare의 조회수 저장소(worker/view-counter.ts)와 내 컴퓨터용 저장소(lib/view-store.ts)가 똑같이 써요.
 *
 * 규칙
 *   - 같은 사람(접속 주소 + 브라우저)이 같은 리뷰를 10분 안에 다시 보면 한 번만 세요(새로 고침·여러 번 누르기로 부풀지 않게).
 *     휴대폰 통신사처럼 여러 사람이 같은 접속 주소를 쓰기도 해서, 브라우저 정보까지 묶어 덜 겹치게 해요.
 *   - 리뷰마다의 조회수와 함께 총 조회수(TOTAL_KEY 줄)도 하나씩 올려요. 총 조회수는 아직 화면에 보이지 않고 데이터로만 둬요.
 *   - 처음 보는 주소(리뷰)는 MAX_SLUGS개까지만 받아요. 아무 주소로나 요청을 보내 저장소를 채우는 일을 막아요.
 *
 * 이 파일에는 Next.js·Cloudflare 코드가 없어요. 그래서 두 곳에서 그대로 가져다 쓸 수 있고, 시험하기도 쉬워요.
 */

/** 총 조회수를 담는 줄의 이름. 리뷰 주소는 영어 소문자·숫자·하이픈만 써서(lib/review-schema.ts의 SLUG) 겹치지 않아요. */
export const TOTAL_KEY = "__total__";

/** 같은 사람이 같은 리뷰를 다시 봐도 세지 않는 시간(10분) */
export const REPEAT_WINDOW_MS = 10 * 60 * 1000;

/** 조회수를 받을 리뷰 주소의 최대 개수 */
export const MAX_SLUGS = 5000;

/** 조회수 묶음: 리뷰 주소 → 조회수, 그리고 총 조회수 */
export type ViewSnapshot = {
  counts: Record<string, number>;
  total: number;
};

/** 한 번 세기의 결과: 이 리뷰의 조회수, 총 조회수, 이번에 셌는지(같은 사람이 다시 봤거나 로그인한 글쓴이면 false) */
export type ViewResult = {
  count: number;
  total: number;
  counted: boolean;
};

/**
 * "방금 본 사람" 장부. 사람 + 리뷰마다 마지막으로 센 때를 기억해요.
 * 메모리에만 두는 짧은 기록이라 저장하지 않고, 오래된 것은 저절로 지워요.
 */
export class RecentViews {
  /** "사람|리뷰" → 마지막으로 센 때(ms) */
  private readonly seen = new Map<string, number>();
  /** 마지막으로 오래된 기록을 지운 때(ms). 지우기는 1분에 한 번만 해요. */
  private prunedAt = 0;

  /**
   * 이 사람이 이 리뷰를 방금(10분 안에) 봤는지 알려 주고, 아니면 지금 본 것으로 적어 둬요.
   *
   * @param visitor 사람을 가리키는 값(접속 주소 + 브라우저를 줄인 값)
   * @param slug 리뷰 주소
   * @param now 지금 시각(ms). 시험에서 바꿔 넣을 수 있어요.
   * @returns 방금 봤으면 true(이번에는 세지 않아요)
   */
  isRepeat(visitor: string, slug: string, now = Date.now()): boolean {
    this.prune(now);
    const key = `${visitor}|${slug}`;
    const last = this.seen.get(key);
    if (last !== undefined && now - last < REPEAT_WINDOW_MS) return true;
    this.seen.set(key, now);
    return false;
  }

  /** 10분이 지난 기록을 지워 장부가 끝없이 커지지 않게 해요(1분에 한 번만). */
  private prune(now: number) {
    if (now - this.prunedAt < 60_000) return;
    this.prunedAt = now;
    for (const [key, time] of this.seen) {
      if (now - time >= REPEAT_WINDOW_MS) this.seen.delete(key);
    }
  }
}
