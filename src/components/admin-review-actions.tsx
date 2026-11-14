"use client";

/**
 * @file 상세 화면의 수정·삭제 (admin-review-actions.tsx)
 *
 * 이 파일이 하는 일
 *   글쓴이로 로그인했을 때만 리뷰 상세 화면 맨 윗줄 오른쪽에 [수정]과 [삭제]를 보여 줘요([공유하기] 오른쪽).
 *     - 수정: 글쓰기 화면(/write/<주소>)으로 가요.
 *     - 삭제: 확인 창을 띄우고, 확인하면 리뷰를 삭제해요(delete-review.tsx). 삭제하는 동안 창 안에 로딩 UI가 보여요.
 *       삭제한 뒤의 안내와 초점 옮기기는 맨 윗줄 전체를 맡은 review-toolbar.tsx가 해요(onDeleted로 알려 줘요).
 *   로그인 전에는 아무것도 그리지 않아요. 그래서 방문자에게는 보이지 않아요.
 *
 * 상세 화면은 빌드할 때 미리 만든 HTML이라, 로그인 여부는 브라우저에서 쿠키 표시로 알아내요(use-is-admin.ts).
 * 표시를 몰래 만들어 단추를 보이게 해도, 실제 수정·삭제는 서버가 로그인을 다시 확인해서 막혀요.
 *
 * 누가 쓰나요?
 *   components/review-toolbar.tsx(상세 화면 맨 윗줄)
 */

import Link from "next/link";

import { DeleteReview } from "./delete-review";
import { useIsAdmin } from "./use-is-admin";

/** AdminReviewActions가 받는 값 */
type Props = {
  /** 리뷰 주소 */
  slug: string;
  /** 리뷰 제목(삭제 확인 문구에 써요) */
  title: string;
  /** 삭제를 마치면 불러요. 화면에 보일 안내 문구를 넘겨줘요. */
  onDeleted: (message: string) => void;
};

/** 상세 화면의 [수정]·[삭제](로그인했을 때만) */
export function AdminReviewActions({ slug, title, onDeleted }: Props) {
  const isAdmin = useIsAdmin();
  if (!isAdmin) return null;

  return (
    // 묶음 없이(<>…</>) 맨 윗줄 오른쪽 묶음에 바로 놓여요. 그래서 [공유하기] [수정] [삭제] 사이가 모두 같은 간격(8px)이에요.
    // 옆의 [공유하기]와 같은 높이(btn-line, 44px)의 단추들이라, 한 줄에 가운데를 맞춰 놓여요.
    <>
      <Link href={`/write/${slug}`} className="btn-line">
        수정
      </Link>
      <DeleteReview slug={slug} title={title} onDeleted={onDeleted} />
    </>
  );
}
