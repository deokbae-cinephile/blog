/**
 * @file 로그인 표시 읽기 (admin-hint.ts)
 *
 * 이 파일이 하는 일
 *   브라우저에서 "지금 글쓴이로 로그인해 있나?"를 알려 주는 작은 저장소예요.
 *   로그인할 때 서버가 구워 준 표시 쿠키(blog_admin=1, lib/auth-cookies.ts)가 있는지 봐요.
 *
 * 왜 서버에 묻지 않고 쿠키를 보나요?
 *   목록·상세 화면은 빌드할 때 미리 만든 파일이라, 방문자마다 서버가 다르게 그려 줄 수 없어요.
 *   방문자 모두에게 "로그인했어요?"를 서버에 물으면 요청이 늘어 무거워지고요.
 *   그래서 화면은 쿠키만 보고 [+](리뷰 추가)·[수정]·[삭제] 단추를 보일지 정해요.
 *   이 표시는 단추를 보일지만 정할 뿐이에요. 실제 저장·삭제는 서버가 세션 쿠키로 다시 확인해요.
 *
 * React의 useSyncExternalStore와 함께 써요(components/use-is-admin.ts).
 *   subscribe(알려 줄 곳 등록) / get(지금 값) / notify(바뀌었다고 알리기)
 */

import { ADMIN_HINT_COOKIE } from "./auth-cookies";

/** 값이 바뀌면 알려 줄 화면들 */
const listeners = new Set<() => void>();

/** 바뀐 것을 화면들에 알려요. */
function emit() {
  listeners.forEach((listener) => listener());
}

export const adminHintStore = {
  /**
   * 지금 로그인 표시가 있는지 읽어요.
   * document.cookie는 "이름=값; 이름=값" 모양의 글자예요. "; "로 나눠 "blog_admin=1" 조각이 있는지 찾아요.
   */
  get(): boolean {
    return document.cookie.split("; ").includes(`${ADMIN_HINT_COOKIE}=1`);
  },

  /**
   * 값이 바뀌면 알려 달라고 등록해요. 돌려준 함수를 부르면 등록을 풀어요.
   * 다른 탭에서 로그인·로그아웃했을 수도 있어서, 이 탭으로 돌아올 때(focus)도 다시 읽게 해요.
   */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    window.addEventListener("focus", listener);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("focus", listener);
    };
  },

  /** 로그인·로그아웃 직후에 불러서, 쿠키가 바뀐 것을 화면에 바로 알려요. */
  notify: emit,
};
