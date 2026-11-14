/**
 * @file 글쓴이 로그아웃 (session-controls.tsx)
 *
 * 이 파일이 하는 일
 *   글쓴이로 로그인했을 때만 화면 왼쪽 아래에 떠 있는 [로그아웃] 단추를 보여 줘요([키보드 조작] 오른쪽, 옆 단추와 같은 모양).
 *   어느 화면에서든 같은 자리에 있어서, 길게 내려 읽다가도 바로 로그아웃할 수 있어요.
 *     - 로그인 전: 아무것도 보이지 않아요. 방문자에게 로그인 링크를 보이지 않으려고요.
 *       글쓴이는 로그인 화면 주소(/login)로 직접 가거나, 글쓰기 화면(/write)에 가면 로그인 화면으로 보내져요(proxy.ts).
 *     - 로그인 뒤: [로그아웃] 단추 → 로그인 쿠키를 지우고 처음 화면으로
 *
 * 로그아웃을 두 번 빠르게 눌러도 요청은 한 번만 가요(useRef 잠금).
 *
 * 누가 쓰나요?
 *   components/site-footer.tsx(바닥글의 왼쪽 아래 고정 줄)
 */

"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { logout } from "@/lib/admin-api";
import { adminHintStore } from "@/lib/admin-hint";

import { useIsAdmin } from "./use-is-admin";

/** 바닥글의 로그아웃(로그인했을 때만) */
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

  // 로그인 전에는 아무것도 그리지 않아요(로그인 링크도 없어요).
  if (!isAdmin) return null;

  return (
    // 실패 안내(absolute)는 이 단추가 아니라 바깥의 왼쪽 아래 고정 줄(site-footer.tsx, position: fixed, 화면 왼쪽 16px)을 기준으로 떠요.
    // 그래야 [키보드 조작] 오른쪽에 있어도 안내 상자가 화면 왼쪽 16px부터 시작해, 최대 너비(100vw − 2rem) 안에서 오른쪽 밖으로 넘치지 않아요.
    // (그래서 이 묶음에는 relative를 주지 않아요.) 안내가 떠도 단추 줄은 움직이지 않아요.
    <div>
      {/* btn-float: 옆의 [키보드 조작]과 같은 떠 있는 단추 모양(누르는 높이 44px) */}
      <button type="button" onClick={handleLogout} className="btn-float">
        로그아웃
      </button>
      {/* role="alert": 로그아웃에 실패하면 바로 읽어 줘요. 영역은 단추와 함께 늘 두고 글자만 바꿔요.
          글이 있을 때만 단추 위에 상자로 보여요(비어 있으면 상자 모양도 없어서 보이지 않아요). */}
      <p
        role="alert"
        className={
          error
            ? "absolute bottom-full left-0 mb-2 w-max max-w-[calc(100vw-2rem)] border-2 border-crt-fg bg-crt-bg px-3 py-2 shadow-[0_0_1rem_rgb(var(--glow-rgb)/0.3)]"
            : "absolute bottom-full left-0"
        }
      >
        {error}
      </p>
    </div>
  );
}
