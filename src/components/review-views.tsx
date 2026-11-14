/**
 * @file 상세 화면의 조회수 (review-views.tsx)
 *
 * 이 파일이 하는 일
 *   리뷰 상세 화면의 정보 줄 끝에 " · 조회 12"처럼 조회수를 보여 주고, 이 리뷰를 본 것을 한 번 세요.
 *
 *     Alpha Station · 2020 · 한국 · 101분 · 감독 김시험 · 조회 12
 *
 * 언제 세나요?
 *   - 화면을 연 뒤 한 번 POST /api/views/<주소>로 세요. 서버가 센 뒤의 숫자를 돌려줘요.
 *   - 같은 탭에서 이미 센 리뷰(새로 고침, 뒤로 가기)는 다시 세지 않고 숫자만 읽어요(sessionStorage에 기억).
 *   - 글쓴이로 로그인했으면 세지 않고 숫자만 읽어요. 서버도 로그인을 확인해서 세지 않아요(이중 확인).
 *   (같은 사람이 10분 안에 다시 보면 서버가 한 번 더 걸러요. lib/view-rules.ts)
 *
 * 미리 만든 HTML에는 숫자가 없어 "조회 –"로 보이고, 화면이 준비되면 숫자로 바뀌어요.
 *
 * 누가 쓰나요?
 *   components/review-article.tsx(상세 화면 머리 안내판의 정보 줄)
 */

"use client";

import { useEffect, useState } from "react";

import { adminHintStore } from "@/lib/admin-hint";
import { FACT_SEPARATOR, labeled } from "@/lib/format";
import { countView, fetchViews, formatViews } from "@/lib/views-api";

/** 같은 탭에서 이미 센 리뷰를 기억하는 이름 */
const viewedKey = (slug: string) => `dmb:viewed:${slug}`;

/** 상세 화면의 조회수(" · 조회 12") */
export function ReviewViews({ slug }: { slug: string }) {
  // 조회수. 받기 전·실패하면 null("–")
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    // 이미 센 리뷰인지(같은 탭). 저장소를 쓸 수 없는 브라우저면 세는 쪽으로 해요.
    let viewed = false;
    try {
      viewed = sessionStorage.getItem(viewedKey(slug)) === "1";
    } catch {
      viewed = false;
    }
    // 글쓴이(로그인 표시 쿠키)이거나 이미 센 리뷰면 읽기만, 아니면 세기
    const request = adminHintStore.get() || viewed ? fetchViews(slug) : countView(slug);
    void request.then((result) => {
      if (!result) return;
      if (result.counted) {
        try {
          sessionStorage.setItem(viewedKey(slug), "1");
        } catch {
          // 저장소를 쓸 수 없으면 기억하지 못할 뿐이에요(서버가 10분 안의 다시 보기를 걸러요).
        }
      }
      if (!cancelled) setCount(result.count);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // " · 조회 12": 정보 줄의 다른 항목과 같은 " · "로 이어요. 가운뎃점은 앞 항목(감독)에 붙어 줄 첫머리에 오지 않아요(lib/format.ts).
  return (
    <span>
      {FACT_SEPARATOR}
      {labeled("조회", formatViews(count))}
    </span>
  );
}
