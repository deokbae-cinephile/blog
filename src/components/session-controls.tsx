/**
 * @file 글쓴이 로그인·로그아웃 (session-controls.tsx)
 *
 * 이 파일이 하는 일
 *   바닥글에 글쓴이용 링크를 하나 보여 줘요.
 *     - 로그인 전: [글쓴이 로그인] 링크 → 로그인 화면(/login)
 *     - 로그인 뒤: [로그아웃] 단추 → 로그인 쿠키를 지우고 처음 화면으로
 *   방문자에게는 눈에 덜 띄게 바닥글에 두었어요(블로그는 글쓴이 한 사람만 로그인해요).
 *
 * 로그아웃을 두 번 빠르게 눌러도 요청은 한 번만 가요(useRef 잠금).
 *
 * 누가 쓰나요?
 *   components/site-footer.tsx(바닥글)
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { logout } from "@/lib/admin-api";
import { adminHintStore } from "@/lib/admin-hint";

import { useIsAdmin } from "./use-is-admin";

/** 바닥글의 로그인·로그아웃 */
export function SessionControls() {
  const isAdmin = useIsAdmin();
  const router = useRouter();
  // 로그아웃 실패 문구. 실패했을 때만 보여요.
  const [error, setError] = useState("");
  // 요청을 보내는 중인지. useState는 다음 그리기에야 바뀌어서, 아주 빠른 두 번 클릭을 막으려고 useRef로도 잠가요.
  const lockRef = useRef(false);

  /** [로그아웃]을 누르면 실행돼요. */
  async function handleLogout() {
    if (lockRef.current) return;
    lockRef.current = true;
    const result = await logout();
    if (result.ok) {
      // 쿠키가 지워졌다고 화면에 알리고, 처음 화면으로 가요. refresh(): 서버에서 그린 부분(글쓰기 화면 등)도 새로 받아요.
      adminHintStore.notify();
      router.push("/");
      router.refresh();
    } else {
      setError(result.message);
    }
    // 실패했을 때 다시 누를 수 있게, 성공했을 때도 다음 로그인 뒤를 위해 잠금을 풀어요(이 단추는 화면을 떠나지 않아요).
    lockRef.current = false;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {isAdmin ? (
        <button type="button" onClick={handleLogout} className="term-link cursor-pointer">
          로그아웃
        </button>
      ) : (
        <Link href="/login" className="term-link">
          글쓴이 로그인
        </Link>
      )}
      {/* role="alert": 로그아웃에 실패하면 바로 읽어 줘요. 영역은 늘 두고 글자만 바꿔요. */}
      <p role="alert">{error}</p>
    </div>
  );
}
