/**
 * @file 리뷰 수정 화면 (app/write/[slug]/page.tsx → 주소 "/write/<주소>")
 *
 * 이 파일이 하는 일
 *   글쓴이가 이미 쓴 리뷰를 고치는 화면이에요. 예: /write/winter-stop
 *   원고는 블로그에 배포된 파일이 아니라 저장소의 최신 원고를 읽어 와요(lib/review-store.ts).
 *   방금 저장해서 아직 배포되지 않은 내용도 이어서 고칠 수 있어요.
 *
 * 로그인 확인 두 번: proxy.ts가 먼저, 여기서 한 번 더(app/write/page.tsx 설명 참고).
 * 없는 리뷰면 404 화면, 저장 설정이 없거나 GitHub에 닿지 못하면 안내를 보여 줘요.
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { NotConfigured } from "@/components/not-configured";
import { type EditSource, ReviewWriter } from "@/components/review-writer";
import { isAdmin } from "@/lib/admin-auth";
import { GitHubError, isGitHubConfigured } from "@/lib/github";
import { parseReviewFile } from "@/lib/review-file";
import { loadReviewSource } from "@/lib/review-store";

/** 탭 제목, 그리고 검색엔진에 올리지 않기 */
export const metadata: Metadata = {
  title: "리뷰 수정",
  robots: { index: false },
};

/** 리뷰 수정 화면. params: 주소에서 읽은 { slug } (Next.js 15부터 Promise라 await로 꺼내요) */
export default async function EditPage({ params }: PageProps<"/write/[slug]">) {
  const { slug } = await params;
  // 로그인하지 않았으면 로그인 화면으로. 로그인한 뒤 이 화면으로 돌아오게 next를 적어요.
  if (!(await isAdmin())) redirect(`/login?next=${encodeURIComponent(`/write/${slug}`)}`);

  if (!isGitHubConfigured()) {
    return (
      <EditLayout title="리뷰 수정">
        <NotConfigured />
      </EditLayout>
    );
  }

  // 저장소에서 최신 원고를 읽어요. GitHub에 닿지 못하면 이유를 보여 줘요.
  let review: Awaited<ReturnType<typeof loadReviewSource>>;
  try {
    review = await loadReviewSource(slug);
  } catch (error) {
    const message = error instanceof GitHubError ? error.message : "원고를 읽지 못했습니다. 잠시 뒤 다시 시도해 주세요.";
    return (
      <EditLayout title="리뷰 수정">
        <p role="alert" className="alert-text">
          {message}
        </p>
      </EditLayout>
    );
  }
  // 저장소에 없는 리뷰면 404 화면으로
  if (!review) notFound();

  // 원고를 여기(서버)에서 칸 값으로 바꿔 넘겨요. YAML 도구는 커서 브라우저로 보내지 않아요(lib/review-file.ts).
  const result = parseReviewFile(review.source);
  const parsed: EditSource = result.ok ? { ok: true, values: result.values } : { ok: false, message: result.message, source: review.source };

  return (
    <EditLayout title={`리뷰 수정: ${slug}`}>
      <ReviewWriter mode="edit" slug={slug} parsed={parsed} baseSha={review.sha} />
    </EditLayout>
  );
}

/** 수정 화면의 틀: 제목(h1)과 내용 */
function EditLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-labelledby="write-title" className="grid gap-8">
      <h1 id="write-title" className="glow text-big">
        {title}
      </h1>
      {children}
    </section>
  );
}
