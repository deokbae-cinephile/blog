/**
 * @file 상세 화면의 고치기·지우기 (admin-review-actions.tsx)
 *
 * 이 파일이 하는 일
 *   글쓴이로 로그인했을 때만 리뷰 상세 화면 위쪽에 [고치기]와 [지우기]를 보여 줘요.
 *     - 고치기: 글쓰기 화면(/write/<주소>)으로 가요.
 *     - 지우기: 확인 창을 띄우고, 확인하면 리뷰를 지워요(delete-review.tsx).
 *       지운 뒤에는 두 단추 대신 "지웠습니다" 안내와 [목록으로] 링크를 보여 주고, 초점도 그 링크로 옮겨요
 *       (누른 단추가 사라져서 키보드 초점이 길을 잃지 않게요).
 *   로그인 전에는 아무것도 그리지 않아요. 그래서 방문자에게는 보이지 않아요.
 *
 * 상세 화면은 빌드할 때 미리 만든 HTML이라, 로그인 여부는 브라우저에서 쿠키 표시로 알아내요(use-is-admin.ts).
 * 표시를 몰래 만들어 단추를 보이게 해도, 실제 고치기·지우기는 서버가 로그인을 다시 확인해서 막혀요.
 *
 * 누가 쓰나요?
 *   components/review-article.tsx
 */

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { DeleteReview } from "./delete-review";
import { useIsAdmin } from "./use-is-admin";

/** AdminReviewActions가 받는 값 */
type Props = {
  /** 리뷰 주소 */
  slug: string;
  /** 리뷰 제목(지우기 확인 문구에 써요) */
  title: string;
};

/** 로그인했을 때만 보이는 고치기·지우기 */
export function AdminReviewActions({ slug, title }: Props) {
  const isAdmin = useIsAdmin();
  // 지운 뒤의 안내 문구. 비어 있으면 아직 지우지 않았어요.
  const [deletedMessage, setDeletedMessage] = useState("");
  // 지운 뒤 초점을 옮길 [목록으로] 링크
  const backRef = useRef<HTMLAnchorElement>(null);

  // 지웠으면 [목록으로]로 초점을 옮겨요.
  useEffect(() => {
    if (deletedMessage) backRef.current?.focus();
  }, [deletedMessage]);

  if (!isAdmin) return null;

  return (
    <div className="grid justify-items-end gap-1">
      {deletedMessage === "" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/write/${slug}`} className="btn-line">
            고치기
          </Link>
          <DeleteReview slug={slug} title={title} onDeleted={setDeletedMessage} />
        </div>
      ) : (
        <Link ref={backRef} href="/" className="term-link">
          목록으로
        </Link>
      )}
      {/* role="status": 지운 결과를 화면 낭독기가 차례대로 읽어 줘요. 영역은 처음부터 두고 글자만 바꿔요. */}
      <p role="status" className="text-right">
        {deletedMessage}
      </p>
    </div>
  );
}
