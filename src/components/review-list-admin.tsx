"use client";

/**
 * @file 목록 한 편의 수정·삭제 (review-list-admin.tsx)
 *
 * 이 파일이 하는 일
 *   v3 전까지는 리뷰 상세 화면을 글쓴이에게도 열지 않아요(lib/site.ts의 REVIEW_DETAIL_PUBLIC).
 *   그래서 상세 화면 맨 윗줄에 있던 [수정]·[삭제]를, 글쓴이로 로그인했을 때만 목록 한 편 아래에 보여 줘요.
 *
 *     ┌────┐ 겨울 정류장 ································ 4.5
 *     │포스│ Winter Stop · 2024 · 한서윤
 *     │ 터 │ “버스는 오지 않아도, 기다림은 끝내 도착한다.”
 *     └────┘ [수정] [삭제]                 ← 로그인했을 때만(방문자에게는 아무것도 없어요)
 *
 *   - 수정: 글쓰기 화면(/write/<주소>)으로 가요.
 *   - 삭제: 확인 창을 띄우고, 확인하면 리뷰를 삭제해요(delete-review.tsx, 상세 화면과 같은 창). 삭제하는 동안 창 안에 로딩 UI가 보여요.
 *     지운 뒤에는 두 단추 대신 안내를 보이고, 초점을 그 안내로 옮겨요(누른 단추가 사라져서 초점이 길을 잃지 않게요).
 *
 * 누가 쓰나요?
 *   components/review-list-item.tsx(상세를 열지 않았을 때 목록 한 편 아래)
 */

import { useEffect, useRef, useState } from "react";

import { AdminReviewActions } from "./admin-review-actions";
import { useIsAdmin } from "./use-is-admin";

/** ReviewListAdmin이 받는 값 */
type Props = {
  /** 리뷰 주소 */
  slug: string;
  /** 리뷰 제목(삭제 확인 문구에 써요) */
  title: string;
};

/** 목록 한 편 아래의 [수정]·[삭제](로그인했을 때만)와 삭제한 뒤의 안내 */
export function ReviewListAdmin({ slug, title }: Props) {
  const isAdmin = useIsAdmin();
  // 삭제를 마친 뒤의 안내 글. 비어 있으면 아직 지우지 않은 상태예요.
  const [deletedMessage, setDeletedMessage] = useState("");
  // 안내 칸의 손잡이. 지운 뒤 누른 [삭제]가 사라지니, 키보드 초점을 여기로 옮겨요.
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (deletedMessage) statusRef.current?.focus();
  }, [deletedMessage]);

  // 방문자에게는 아무것도 그리지 않아요.
  if (!isAdmin) return null;

  return (
    // mt-3: 한 줄 평과 단추 사이 12px.
    <div className="mt-3">
      {deletedMessage === "" && (
        // gap-2: [수정] [삭제] 사이 8px(상세 화면 맨 윗줄과 같아요).
        <div className="flex flex-wrap items-center gap-2">
          <AdminReviewActions slug={slug} title={title} onDeleted={setDeletedMessage} />
        </div>
      )}
      {/* 삭제 안내(role="status": 처음부터 두고 글자만 바꿔요). tabIndex -1: 코드로만 초점을 옮겨요(Tab 순서에는 없어요).
          비어 있으면 상자 모양도 여백도 없어서 자리를 차지하지 않아요. */}
      <p ref={statusRef} tabIndex={-1} role="status" className={deletedMessage ? "border-2 border-crt-fg px-3 py-2 outline-none focus-visible:outline-2 focus-visible:outline-dashed focus-visible:outline-crt-fg" : ""}>
        {deletedMessage}
      </p>
    </div>
  );
}
