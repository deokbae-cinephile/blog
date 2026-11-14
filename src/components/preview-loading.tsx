/**
 * @file 본문 미리 보기의 로딩 화면 (preview-loading.tsx)
 *
 * 이 파일이 하는 일
 *   글쓰기 화면의 본문 미리 보기를 준비하는 동안 보여 주는 로딩 UI와 글줄 모양의 스켈레톤(소제목 한 줄 + 글 세 줄)이에요.
 *
 *     ▮ 미리 보기를 준비하는 중 [■■■■□□□…]
 *     ▬▬▬▬▬▬                 ← 스켈레톤(꾸밈이라 읽지 않아요)
 *     ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 *
 * 왜 따로 두나요?
 *   두 곳이 같은 모양을 써요.
 *     - components/review-writer.tsx: 미리 보기 코드(markdown-preview.tsx)를 브라우저에서 받는 동안(next/dynamic의 loading)
 *     - components/markdown-preview.tsx: 받은 뒤 Markdown 변환 도구를 처음 받는 동안
 *   review-writer가 markdown-preview.tsx를 직접 가져오면 서버 묶음에 변환 도구가 다시 따라 들어가서, 이 작은 파일로 나눴어요.
 */

import { LoadingStatus } from "./loading-status";

/** 본문 미리 보기의 로딩 화면 */
export function PreviewLoading() {
  return (
    <div className="grid gap-4">
      <LoadingStatus label="미리 보기를 준비하는 중" />
      <div aria-hidden="true" className="grid gap-3">
        <span className="skeleton block h-6 w-1/3" />
        <span className="skeleton block h-4 w-full" />
        <span className="skeleton block h-4 w-5/6" />
        <span className="skeleton block h-4 w-2/3" />
      </div>
    </div>
  );
}
