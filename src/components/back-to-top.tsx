/**
 * @file 맨 위로 단추 (back-to-top.tsx)
 *
 * 이 파일이 하는 일
 *   화면 오른쪽 아래에 떠 있는 "맨 위로" 단추예요. 누르면 화면 맨 위로 올라가요.
 *   떠 있는 자리(오른쪽 아래)는 함께 떠 있는 "+" 단추와 묶어서 floating-buttons.tsx가 정해요.
 *
 * 맡은 기능
 *   - 조금(400px 넘게) 내려 읽었을 때만 보여요. 맨 위에서는 필요 없으니까요.
 *   - 누르면 부드럽게 올라가요. 단, "동작 줄이기"를 켠 사용자에게는 움직임 없이 바로 올라가요.
 *   - 키보드 초점도 맨 위(머리글)로 옮겨요. 화면만 올라가고 초점이 아래에 남으면,
 *     Tab을 누르는 순간 다시 아래로 끌려 내려가거든요.
 *
 * 숨길 때 hidden 속성을 쓰는 이유
 *   hidden은 화면에서도, 화면 낭독기에서도, Tab 순서에서도 함께 빼 줘요.
 *   (투명하게만 만들면 보이지 않는 단추에 Tab 초점이 들어가 사용자가 길을 잃어요.)
 *
 * 누가 쓰나요?
 *   components/floating-buttons.tsx가 "+"(리뷰 추가) 단추 위에 놓아요.
 */

"use client";

import { useSyncExternalStore } from "react";

/** 이만큼(px) 넘게 내려가면 단추를 보여요. */
const SHOW_AFTER = 400;

/**
 * 스크롤할 때마다 알려 달라고 등록해요(useSyncExternalStore가 불러요).
 * passive: true — "스크롤을 막지 않겠다"는 약속이라 브라우저가 스크롤을 더 부드럽게 처리해요.
 */
function subscribe(onScroll: () => void) {
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}

/** 지금 단추를 보여야 하는지. window.scrollY는 문서가 위로 얼마나 스크롤됐는지(px)예요. */
const isScrolledDown = () => window.scrollY > SHOW_AFTER;

/** 서버에서 HTML을 미리 만들 때는 스크롤이 없으니 숨긴 채로 그려요. */
const hiddenOnServer = () => false;

/** 화면 오른쪽 아래의 "맨 위로" 단추 */
export function BackToTop() {
  // useSyncExternalStore: 스크롤 위치처럼 React 바깥에서 바뀌는 값을 읽어요.
  // 돌려주는 값이 true/false라서, 스크롤할 때마다가 아니라 "보임 ↔ 숨김"이 바뀔 때만 다시 그려요.
  const visible = useSyncExternalStore(subscribe, isScrolledDown, hiddenOnServer);

  function handleClick() {
    // 사용자가 운영체제에서 "동작 줄이기"를 켰는지 확인해요. 어지럼증이 있는 사람에게 큰 움직임은 힘들 수 있어요.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // behavior: "smooth"는 부드럽게, "auto"는 바로 이동해요.
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    // 머리글(id="top", site-header.tsx)로 초점을 옮겨요. preventScroll: 스크롤은 위의 scrollTo에 맡겨요.
    document.getElementById("top")?.focus({ preventScroll: true });
  }

  return (
    // w-24 justify-center: 너비를 6rem으로 정해 아래 "+" 단추와 같게 맞추고, 글자는 가운데에 놓아요.
    <button type="button" hidden={!visible} onClick={handleClick} className="btn-float w-24 justify-center">
      맨 위로
    </button>
  );
}
