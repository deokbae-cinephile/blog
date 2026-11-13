/**
 * @file 새 리뷰 쓰기 화면 (app/write/page.tsx → 주소 "/write")
 *
 * 이 파일이 하는 일
 *   글쓴이가 새 리뷰를 쓰는 화면이에요. 폼은 components/review-writer.tsx가 그려요.
 *
 * 로그인 확인 두 번
 *   1. proxy.ts: 로그인하지 않았으면 이 화면에 오기 전에 로그인 화면으로 보내요.
 *   2. 여기(isAdmin): 혹시 proxy가 빠져도 화면을 그리기 전에 한 번 더 확인해요.
 *   cookies()를 쓰는 화면이라 미리 만들어 두지 않고, 요청이 올 때마다 서버에서 그려요.
 *
 * 저장 기능이 설정되지 않은 서버(GitHub 토큰 없음)라면, 폼 대신 무엇을 설정할지 알려 줘요.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NotConfigured } from "@/components/not-configured";
import { ReviewWriter } from "@/components/review-writer";
import { isAdmin } from "@/lib/admin-auth";
import { isGitHubConfigured } from "@/lib/github";

/** 탭 제목, 그리고 검색엔진에 올리지 않기(글쓴이만 쓰는 화면이에요) */
export const metadata: Metadata = {
  title: "새 리뷰 쓰기",
  robots: { index: false },
};

/** 새 리뷰 쓰기 화면 */
export default async function WritePage() {
  // 로그인하지 않았으면 로그인 화면으로. 로그인한 뒤 이 화면으로 돌아오게 next를 적어요.
  if (!(await isAdmin())) redirect("/login?next=/write");

  return (
    <section aria-labelledby="write-title" className="grid gap-8">
      <h1 id="write-title" className="glow text-big">
        새 리뷰 쓰기
      </h1>
      {isGitHubConfigured() ? <ReviewWriter mode="create" /> : <NotConfigured />}
    </section>
  );
}
