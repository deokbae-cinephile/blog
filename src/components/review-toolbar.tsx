"use client";

/**
 * @file 리뷰 상세의 맨 윗줄 (review-toolbar.tsx)
 *
 * 이 파일이 하는 일
 *   상세 화면 맨 위 한 줄을 그려요. 모든 단추가 같은 모양(btn-line, 높이 44px)이라 한 줄에 가지런히 놓여요.
 *
 *     [◀ 목록으로]                                [공유하기] [수정] [삭제]   ← 수정·삭제는 로그인했을 때만
 *
 *   리뷰를 삭제하면 [공유하기]·[수정]·[삭제]를 치우고, 윗줄 아래에 안내를 화면 너비로 보여 줘요.
 *
 *     [◀ 목록으로]                                                         ← 초점이 여기로 와요
 *     ┌──────────────────────────────────────────────────────────┐
 *     │ ‘폰 부스’ 리뷰를 삭제했습니다. 블로그를 다시 배포하면(몇 분 뒤) … │  ← role="status"(화면 낭독기가 읽어요)
 *     └──────────────────────────────────────────────────────────┘
 *
 *   (예전에는 안내 글과 링크를 오른쪽 좁은 칸에 넣어 줄이 깨졌어요. 안내 칸이 비어 있어도 한 줄을 차지해 [공유하기]만
 *    조금 내려가 보였는데, 이제 안내 칸은 처음부터 있되 비어 있으면 자리를 차지하지 않아요.)
 *
 * [◀ 목록으로]의 ◀는 아래쪽 [◀ 이전 리뷰]와 같은 표시예요. 꾸밈이라 읽지 않아요(키보드로는 Esc도 같은 일을 해요).
 *
 * 누가 쓰나요?
 *   components/review-article.tsx(상세 화면)
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AdminReviewActions } from "./admin-review-actions";
import { ShareButton } from "./share-button";

/** ReviewToolbar가 받는 값 */
type Props = {
  /** 리뷰 주소 */
  slug: string;
  /** 리뷰 제목(삭제 확인 문구) */
  title: string;
  /** 공유할 대표 주소. 예: "https://deokbae.blog/reviews/winter-stop" */
  shareUrl: string;
  /** 공유 창 제목. 예: "겨울 정류장 리뷰" */
  shareTitle: string;
  /** 공유할 때 함께 보낼 글. 예: "평점 4.5 · 기다림은 끝내 도착한다" */
  shareText: string;
};

/** 리뷰 상세의 맨 윗줄: [◀ 목록으로] … [공유하기] [수정] [삭제] + 삭제 안내 */
export function ReviewToolbar({ slug, title, shareUrl, shareTitle, shareText }: Props) {
  // 삭제를 마친 뒤의 안내 글. 비어 있으면 아직 지우지 않은 상태예요.
  const [deletedMessage, setDeletedMessage] = useState("");
  // [◀ 목록으로]의 손잡이. 지운 뒤 누른 단추가 사라지니, 키보드 초점을 여기로 옮겨요.
  const backRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (deletedMessage) backRef.current?.focus();
  }, [deletedMessage]);

  return (
    <div>
      {/* flex-wrap: 좁은 화면에서 자리가 모자라면 오른쪽 묶음이 다음 줄로 내려가요. items-center: 모든 단추의 세로 가운데를 맞춰요. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link ref={backRef} href="/" className="btn-line">
          <span aria-hidden="true">◀</span>목록으로
        </Link>
        {deletedMessage === "" && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ShareButton url={shareUrl} title={shareTitle} text={shareText} />
            <AdminReviewActions slug={slug} title={title} onDeleted={setDeletedMessage} />
          </div>
        )}
      </div>
      {/* 삭제 안내(role="status": 처음부터 두고 글자만 바꿔요). 비어 있으면 상자 모양도 여백도 없어서 자리를 차지하지 않아요. */}
      <p role="status" className={deletedMessage ? "mt-4 border-2 border-crt-fg px-4 py-3" : ""}>
        {deletedMessage}
      </p>
    </div>
  );
}
