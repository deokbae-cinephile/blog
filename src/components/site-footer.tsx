/**
 * @file 바닥글 (site-footer.tsx)
 *
 * 이 파일이 하는 일
 *   모든 화면 맨 아래에 앱 설치 안내와, 글쓴이로 로그인했을 때의 [로그아웃]을 보여 줍니다.
 *   (로그인 링크는 두지 않아요. 글쓴이는 /login 주소로 직접 가요. session-controls.tsx 참고)
 *   화면 아래쪽에 떠 있는 단추들도 여기에 둬요.
 *     - 왼쪽 아래: 키보드 조작 안내(keyboard-help.tsx)
 *     - 오른쪽 아래: 맨 위로(back-to-top.tsx)와, 로그인했을 때 그 오른쪽의 리뷰 추가(+) 단추(floating-buttons.tsx)
 *   떠 있는 단추는 화면 어디에 보이든 코드에서는 바닥글의 마지막이라, Tab으로 옮겨 다닐 때도 맨 끝에 와요.
 *
 * <footer> 태그
 *   "바닥글" 영역이라는 뜻을 가진 태그예요. 화면 낭독기는 이를 "콘텐츠 정보(contentinfo)" 랜드마크로 알려 줘서,
 *   사용자가 바닥글로 바로 건너뛸 수 있습니다.
 *
 * 누가 쓰나요?
 *   app/layout.tsx가 모든 화면 아래에 놓습니다.
 */

import { FloatingButtons } from "./floating-buttons";
import { InstallPrompt } from "./install-prompt";
import { KeyboardHelp } from "./keyboard-help";
import { SessionControls } from "./session-controls";

/** 모든 화면 맨 아래의 바닥글 */
export function SiteFooter() {
  return (
    // text-crt-dim: 조금 어두운 초록(보조 글자색). globals.css의 --crt-dim을 씁니다.
    // 화면 너비를 다 써요(풀화면). pb-24: 아래쪽에 떠 있는 단추(키보드 조작, 리뷰 추가, 맨 위로)가 바닥글 글자를 가리지 않게 여백을 둬요.
    <footer className="grid w-full gap-6 px-4 pt-16 pb-24 text-crt-dim sm:px-8 lg:px-12">
      {/* 앱 설치 안내. 브라우저에 따라 단추·안내 글이 보이거나, 아무것도 보이지 않아요(install-prompt.tsx). */}
      <InstallPrompt />
      {/* 로그인했을 때만: 점선 아래 [로그아웃] */}
      <SessionControls />
      {/* 화면 아래쪽에 떠 있는 단추들(position: fixed). 바닥글 안에 있어도 화면 위치는 아래쪽에 고정돼요.
          왼쪽 아래: 키보드 조작 안내, 오른쪽 아래: 맨 위로와 그 오른쪽의 리뷰 추가(+) */}
      <KeyboardHelp />
      <FloatingButtons />
    </footer>
  );
}
