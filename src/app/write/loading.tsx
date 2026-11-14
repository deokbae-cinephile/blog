/**
 * @file 글쓰기 화면을 불러오는 동안 보이는 화면 (app/write/loading.tsx)
 *
 * 이 파일이 하는 일
 *   리뷰 추가(/write)·수정(/write/<주소>) 화면을 준비하는 동안, 글쓰기 화면의 모양을 본뜬 스켈레톤을 먼저 보여 줘요.
 *   제목 자리에 "글쓰기 화면을 불러오는 중▮ [■■■□□□]"를 그려요.
 *   수정 화면은 저장소(GitHub)에서 원고를 읽어 오느라 조금 걸려서, 이 화면이 자주 보여요.
 *   (목록·상세는 미리 만든 화면이라 loading.tsx를 두지 않아요. 두면 화면을 열 때마다 스켈레톤이 번쩍여요. components/skeleton.tsx 참고)
 *
 * 누가 쓰나요?
 *   Next.js가 정한 이름(loading.tsx)이라 /write와 그 아래(/write/<주소>)로 갈 때 저절로 쓰여요.
 */

import { LoadingStatus } from "@/components/loading-status";
import { WriterSkeleton } from "@/components/skeleton";

/** 글쓰기 화면을 불러오는 동안의 화면 */
export default function WriteLoading() {
  // min-h-10: 실제 제목(32px 글자, 40px 줄)과 같은 높이라, 내용이 들어와도 아래가 밀리지 않아요.
  return <WriterSkeleton status={<LoadingStatus label="글쓰기 화면을 불러오는 중" className="min-h-10" />} />;
}
