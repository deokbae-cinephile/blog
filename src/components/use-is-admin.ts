/**
 * @file 로그인 상태 훅 (use-is-admin.ts)
 *
 * 이 파일이 하는 일
 *   화면 조각에서 "지금 글쓴이로 로그인해 있나?"를 true/false로 알려 주는 훅이에요.
 *   로그인·로그아웃하면 저절로 다시 그려져요(lib/admin-hint.ts가 알려 줘요).
 *
 * 서버에서 미리 만든 HTML에는 늘 false(로그인 전 모습)로 그려 두고,
 * 브라우저에서 화면이 준비되면 쿠키를 보고 맞춰요. 그래서 처음 HTML은 누구에게나 같아요.
 *
 * 누가 쓰나요?
 *   components/site-header.tsx([새 리뷰]), components/session-controls.tsx(로그인·로그아웃),
 *   components/admin-review-actions.tsx([고치기]·[지우기])
 */

import { useSyncExternalStore } from "react";

import { adminHintStore } from "@/lib/admin-hint";

/** 서버(미리 만든 HTML)에서는 쿠키를 모르니 로그인 전으로 그려요. */
const loggedOutOnServer = () => false;

/** 지금 글쓴이로 로그인해 있으면 true */
export function useIsAdmin(): boolean {
  return useSyncExternalStore(adminHintStore.subscribe, adminHintStore.get, loggedOutOnServer);
}
