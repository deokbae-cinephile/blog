/**
 * @file 저장 설정 없음 안내 (not-configured.tsx)
 *
 * 이 파일이 하는 일
 *   서버에 저장 설정(GitHub 토큰)이 없을 때, 글쓰기 폼 대신 "무엇을 설정하면 되는지" 알려 줘요.
 *   설정 없이 폼을 보여 주면 다 쓰고 나서야 저장이 안 된다는 것을 알게 되니, 먼저 알려 주는 편이 친절해요.
 *
 * 누가 쓰나요?
 *   app/write/page.tsx(리뷰 추가), app/write/[slug]/page.tsx(리뷰 수정)
 *   (page.tsx에서는 정해진 이름만 내보낼 수 있어서, 두 화면이 함께 쓰는 조각은 components에 둬요.)
 */

/** 저장 설정이 없을 때의 안내 */
export function NotConfigured() {
  return (
    <div className="grid gap-2 border-2 border-dashed border-crt-line px-4 py-6">
      <p className="glow">저장 기능이 설정되지 않았습니다.</p>
      <p className="text-crt-dim">
        서버 환경 변수에 GITHUB_CONTENT_TOKEN(이 저장소의 Contents: Read and write 권한을 준 GitHub 토큰)을 넣은 뒤 다시 배포해 주세요.
        자세한 방법은 .env.example에 있습니다.
      </p>
    </div>
  );
}
