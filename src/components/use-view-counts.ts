/**
 * @file 목록의 조회수 받기 훅 (use-view-counts.ts)
 *
 * 이 파일이 하는 일
 *   처음 화면(목록)이 열리면 모든 리뷰의 조회수를 API(GET /api/views)로 한 번 받아 와요.
 *   목록은 미리 만든 화면이라 조회수가 들어 있지 않거든요. 받기 전·실패했을 때는 null이고, 목록에는 "조회 –"로 보여요.
 *
 * 누가 쓰나요?
 *   components/review-browser.tsx(목록의 조회수 표시)
 */

import { useEffect, useState } from "react";

import type { ViewSnapshot } from "@/lib/view-rules";
import { fetchViewCounts } from "@/lib/views-api";

/** 모든 리뷰의 조회수(받기 전·실패하면 null) */
export function useViewCounts(): ViewSnapshot | null {
  const [snapshot, setSnapshot] = useState<ViewSnapshot | null>(null);

  useEffect(() => {
    // 화면을 떠난 뒤에 도착한 답은 버려요.
    let cancelled = false;
    void fetchViewCounts().then((result) => {
      if (!cancelled && result) setSnapshot(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return snapshot;
}
