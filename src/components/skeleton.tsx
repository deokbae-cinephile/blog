/**
 * @file 스켈레톤 UI (skeleton.tsx)
 *
 * 이 파일이 하는 일
 *   글쓰기 화면을 불러오는 동안, 곧 나올 화면과 같은 자리에 옅은 초록 막대·상자를 미리 그려 둬요.
 *   내용이 도착하면 그 자리에 그대로 들어와서 화면이 덜 흔들리고, 무엇이 나올지 미리 알 수 있어요.
 *
 *     WriterSkeleton  글쓰기: [(로딩 UI)] [포스터 | 영화 정보 2열 × 5행] [본문 | 미리 보기]
 *
 *   로딩 UI(status 자리)는 실제 화면의 첫 줄(글쓰기 제목) 자리에 놓아요. 그래서 내용이 들어올 때 화면이 밀리지 않아요.
 *
 * 왜 글쓰기 화면에만 있나요?
 *   목록·상세는 빌드할 때 미리 만든 화면이라 기다릴 일이 거의 없어요. 그런데 loading.tsx를 두면 Next.js가 미리 만든
 *   HTML 맨 앞에도 로딩 화면을 넣고 내용을 잠시 뒤 바꿔 넣어서, 화면을 열 때마다 스켈레톤이 번쩍여요.
 *   그래서 저장소(GitHub)에서 원고를 읽느라 실제로 기다리는 글쓰기 화면에만 둬요.
 *   막대·상자는 움직이지 않는 옅은 초록 칸이에요(globals.css의 .skeleton). 눈이 편하도록 테두리도, 지나가는 빛도 두지 않았어요.
 *   화면에서 움직이는 것은 로딩 UI(깜빡이는 커서와 차오르는 막대) 하나뿐이에요.
 *   칸 나누기(grid)는 실제 화면과 같은 값을 써서, 내용이 들어와도 자리가 바뀌지 않아요.
 *
 * 접근성
 *   막대·상자는 모양뿐이라 화면 낭독기에서 숨겨요(aria-hidden). "불러오는 중"은 status 자리의
 *   로딩 UI(components/loading-status.tsx, role="status")가 글자로 알려 줘요. 그래서 status는 숨긴 영역 밖에 둬요.
 *
 * 누가 쓰나요?
 *   app/write/loading.tsx(리뷰 추가·수정 화면을 불러오는 동안)
 */

import type { ReactNode } from "react";

/** 스켈레톤이 받는 값 */
type Props = {
  /** 첫 줄 자리에 놓을 로딩 UI(<LoadingStatus />) */
  status: ReactNode;
};

/** 막대 하나. 기본은 글자 한 줄 높이(16px)예요. className으로 너비·높이를 정해요. */
function Bar({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block h-4 ${className}`} />;
}

/** 상자 하나(입력 칸·단추·포스터 자리). 막대처럼 옅게 칠하고, 테두리는 두지 않아요. */
function Box({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block ${className}`} />;
}

/** 글쓰기 화면의 스켈레톤: components/review-writer.tsx와 같은 칸 나누기예요. */
export function WriterSkeleton({ status }: Props) {
  return (
    <div className="grid gap-10">
      {/* 제목(리뷰 추가·리뷰 수정) 자리에 로딩 UI, 그 아래 [Markdown 파일 불러오기] */}
      {status}
      <Box className="h-11 w-56" />

      {/* [포스터 | 영화 정보 2열 × 5행] */}
      <div aria-hidden="true" className="grid gap-10 lg:grid-cols-3 lg:gap-8">
        <div className="grid content-start gap-4">
          <Bar className="mb-4 h-8 w-24" />
          <div className="grid w-40 gap-4 lg:w-full lg:max-w-[18rem]">
            <Box className="aspect-[2/3] w-full" />
            <Box className="h-11 w-full" />
          </div>
        </div>
        <div className="grid content-start items-start gap-6 lg:col-span-2 lg:grid-cols-2 lg:gap-x-6">
          <Bar className="mb-4 h-8 w-32 lg:col-span-2" />
          {Array.from({ length: 10 }, (_, index) => (
            <div key={index} className="grid gap-2">
              <Bar className="w-24" />
              <Box className="h-11 w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* 본문: [장면 사진 넣기] 아래 [본문 | 미리 보기]. 좁은 화면은 탭 두 개와 한 칸만 보여요. */}
      <div aria-hidden="true" className="grid gap-4">
        <Bar className="mb-4 h-8 w-20" />
        <Box className="h-11 w-36" />
        <div className="flex gap-2 lg:hidden">
          <Box className="h-11 w-36" />
          <Box className="h-11 w-24" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Box className="h-[30rem] w-full" />
          <Box className="h-[30rem] w-full max-lg:hidden" />
        </div>
      </div>
    </div>
  );
}
