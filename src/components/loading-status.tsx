/**
 * @file 로딩 UI (loading-status.tsx)
 *
 * 이 파일이 하는 일
 *   화면을 불러오는 동안 옛 DOS 프로그램처럼 "일하는 중"을 보여 줘요.
 *
 *     불러오는 중▮  [■■■■■■□□□□□□□□□□]
 *                    └ 16칸 막대가 한 칸씩 차오르고, 다 차면 처음부터 다시 차요.
 *
 *   막대는 얼마나 남았는지가 아니라 "멈추지 않고 일하고 있다"는 표시예요(남은 양을 알 수 없을 때 쓰는 모양).
 *   움직임은 globals.css의 .loading-cursor, .loading-bar가 맡아요. 동작 줄이기를 켜면 멈춰 보여요.
 *
 * 접근성
 *   - role="status": 화면 낭독기가 하던 말을 끊지 않고 차례에 "불러오는 중"을 읽어 줘요.
 *   - 커서와 막대는 꾸밈이라 화면 낭독기에서 숨겨요(aria-hidden). 뜻은 글자가 전해요.
 *
 * 브라우저 코드가 없는 "서버 컴포넌트"예요. 움직임은 모두 CSS라 자바스크립트를 받기 전에도 보여요.
 *
 * 누가 쓰나요?
 *   app/write/loading.tsx(리뷰 추가·수정 화면을 불러오는 동안),
 *   components/markdown-preview.tsx(미리 보기 변환 도구를 처음 받는 동안)
 */

/** LoadingStatus가 받는 값 */
type Props = {
  /** 보일 글자. 무엇을 불러오는지 알려 주면 좋아요. 예: "리뷰를 불러오는 중" */
  label?: string;
  /** 바깥 여백 등 모양 */
  className?: string;
};

/** 불러오는 중 표시(글자 + 깜빡이는 커서 + 16칸 진행 막대) */
export function LoadingStatus({ label = "불러오는 중", className = "" }: Props) {
  return (
    // flex-wrap: 좁은 화면에서는 막대가 글자 아래 줄로 내려가요.
    <div role="status" className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
      <p className="glow">
        {label}
        {/* 깜빡이는 네모 커서(▮). 꾸밈이라 읽지 않아요. */}
        <span aria-hidden="true" className="loading-cursor" />
      </p>
      {/* 16칸 진행 막대. 안쪽 span이 칸을 그리며 한 칸씩 드러나요. 꾸밈이라 읽지 않아요. */}
      <span aria-hidden="true" className="loading-bar">
        <span />
      </span>
    </div>
  );
}
