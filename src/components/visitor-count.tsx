/**
 * @file 방문자 수 (visitor-count.tsx)
 *
 * 이 파일이 하는 일
 *   두 가지 일을 해요. 화면에 그리는 것은 로그인한 글쓴이에게만 보여요.
 *
 *     방문자(로그인하지 않음) : 그날 처음 열면 방문을 한 번 세요(POST /api/visits). 화면에는 아무것도 그리지 않아요.
 *     글쓴이(로그인함)        : 누적 방문자 수를 받아(GET /api/visits) 왼쪽 아래 "키보드 조작" 오른쪽에 보여요.
 *
 *       [키보드 조작] [방문자 1,234명]
 *
 * 누적 방문자 수는 어떻게 세나요?
 *   같은 사람은 하루(한국 시간)에 한 번만 세고, 그렇게 센 방문을 모두 더해요. 오늘 다시 와도 1명, 내일 다시 오면 또 1명이에요.
 *   로그인한 글쓴이와 검색엔진 로봇은 세지 않아요(서버가 확인해요, app/api/visits/route.ts).
 *
 * 가볍게 하려고
 *   방문자 브라우저는 하루에 한 번만 요청을 보내요. 그날 센 것은 이 브라우저(localStorage)에 날짜로 기억해요.
 *   (같은 날 다시 보내도 서버가 걸러 주지만, 요청 자체를 줄여요.)
 *
 * 누가 쓰나요?
 *   components/site-footer.tsx(왼쪽 아래 고정 줄: [키보드 조작] [방문자 n명])
 */

"use client";

import { useEffect, useState } from "react";

import { useIsAdmin } from "./use-is-admin";

/** 이 브라우저가 마지막으로 방문을 센 날짜를 기억하는 이름(localStorage) */
const VISIT_DAY_KEY = "dmb:visit-day";

/** 한국 시간 기준 오늘 날짜 "YYYY-MM-DD"("sv-SE" 날짜 모양이 마침 YYYY-MM-DD예요) */
const seoulToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());

/** 방문 세기(방문자) + 누적 방문자 수 보이기(글쓴이) */
export function VisitorCount() {
  // 글쓴이로 로그인했는지(쿠키 표시). 미리 만든 HTML에서는 늘 false예요.
  const author = useIsAdmin();
  // 누적 방문자 수. 받기 전·실패하면 null("–")
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    // 화면을 떠난 뒤에 도착한 답은 버려요.
    let cancelled = false;
    if (author) {
      // 글쓴이: 누적 방문자 수를 받아 와요(로그인을 서버가 다시 확인해요).
      fetch("/api/visits", { cache: "no-store" })
        .then((response) => (response.ok ? (response.json() as Promise<{ total: number }>) : null))
        .then((data) => {
          if (!cancelled && data) setTotal(data.total);
        })
        .catch(() => undefined);
    } else {
      // 방문자: 오늘 아직 세지 않았으면 한 번 세요. 저장소를 쓸 수 없는 브라우저면 세는 쪽으로 해요(서버가 하루 한 번으로 걸러요).
      const day = seoulToday();
      let countedToday = false;
      try {
        countedToday = localStorage.getItem(VISIT_DAY_KEY) === day;
      } catch {
        countedToday = false;
      }
      if (!countedToday) {
        fetch("/api/visits", { method: "POST", cache: "no-store" })
          .then((response) => {
            if (!response.ok) return;
            try {
              localStorage.setItem(VISIT_DAY_KEY, day);
            } catch {
              // 기억하지 못해도 괜찮아요(다음에 보내면 서버가 걸러요).
            }
          })
          .catch(() => undefined);
      }
    }
    return () => {
      cancelled = true;
    };
  }, [author]);

  if (!author) return null;
  return (
    // 누를 수 없는 안내라 단추(btn-float)가 아니라 같은 높이·테두리의 글자 상자예요(badge-float, globals.css).
    // 숫자는 천 단위 쉼표(1,234). 받기 전·실패하면 "–"
    <p className="badge-float">방문자 {total === null ? "–" : total.toLocaleString("ko-KR")}명</p>
  );
}
