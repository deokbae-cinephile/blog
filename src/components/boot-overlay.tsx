/**
 * @file 첫 화면 로딩 레이어 (boot-overlay.tsx)
 *
 * 이 파일이 하는 일
 *   블로그를 처음 열 때 화면 전체를 어두운 레이어로 덮고, 가운데에 로딩 UI("불러오는 중▮ [■■■□□□]")를 보여 줘요.
 *   그동안 픽셀 웹 폰트(neodgm)를 받아서, 레이어가 걷히면 처음부터 픽셀 글꼴로 보여요(기본 글꼴이 잠깐 보였다 바뀌지 않게).
 *
 *     ┌──────────────────────────────┐
 *     │                              │
 *     │  불러오는 중▮ [■■■■■■□□□□]    │   ← 화면 가운데
 *     │                              │
 *     └──────────────────────────────┘
 *
 * 언제 걷히나요? (아래 BOOT_SCRIPT)
 *   - 페이지를 다 받고(load) 웹 폰트까지 준비되면 걷혀요. 너무 짧게 번쩍이지 않게 최소 0.4초는 보여요.
 *   - 늦어도 4초 뒤에는 걷어요(느린 인터넷에서 오래 막지 않게).
 *   - 같은 탭에서 다시 열거나 다른 화면으로 옮겨 갈 때는 다시 덮지 않아요(sessionStorage에 기억).
 *   - 자바스크립트가 꺼져 있으면 처음부터 보이지 않고(noscript), 스크립트가 어떤 이유로 돌지 않아도
 *     6초 뒤에는 CSS가 저절로 걷어요(globals.css의 .boot-overlay).
 *
 * 어떻게 걷나요?
 *   스크립트가 <html>에 data-booted 표시를 붙이면 CSS가 레이어를 흐리게 걷어요(0.3초, 동작 줄이기면 바로).
 *   레이어 요소를 지우지 않고 숨기기만 해서, React가 그린 화면과 어긋나지 않아요.
 *
 * 누가 쓰나요?
 *   app/layout.tsx: <head>에 BOOT_SCRIPT와 BOOT_NOSCRIPT_STYLE, <body> 맨 앞에 <BootOverlay />
 */

import { LoadingStatus } from "./loading-status";

/** 한 번 걷은 뒤 같은 탭에서 다시 덮지 않으려고 기억하는 이름 */
export const BOOT_STORAGE_KEY = "dmb:booted";

/**
 * 레이어를 걷는 스크립트. <head>에 그대로 넣어, 화면을 그리기 전에 바로 돌아요.
 * (React가 다시 돌리지 않는 첫 HTML 전용 스크립트라 문자열로 둬요.)
 */
export const BOOT_SCRIPT = `(function () {
  var root = document.documentElement;
  var key = ${JSON.stringify(BOOT_STORAGE_KEY)};
  try {
    if (sessionStorage.getItem(key)) {
      root.setAttribute("data-booted", "");
      return;
    }
  } catch (error) {}
  var start = Date.now();
  var finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    var rest = Math.max(0, 400 - (Date.now() - start));
    setTimeout(function () {
      root.setAttribute("data-booted", "");
      try {
        sessionStorage.setItem(key, "1");
      } catch (error) {}
    }, rest);
  }
  setTimeout(finish, 4000);
  window.addEventListener("load", function () {
    if (document.fonts && document.fonts.load) document.fonts.load("16px neodgm").then(finish, finish);
    else finish();
  });
})();`;

/** 자바스크립트가 꺼져 있으면 레이어를 처음부터 숨기는 스타일(<noscript> 안에 넣어요) */
export const BOOT_NOSCRIPT_STYLE = "<style>.boot-overlay{display:none}</style>";

/** 첫 화면 로딩 레이어 */
export function BootOverlay() {
  return (
    // boot-overlay: 화면 전체를 덮고 가운데에 놓아요(globals.css). 다 걷히면 보이지 않게(visibility: hidden) 돼요.
    <div className="boot-overlay">
      {/* justify-center: 좁은 화면에서 막대가 글자 아래 줄로 내려가도 가운데에 놓여요. */}
      <LoadingStatus className="justify-center px-4" />
    </div>
  );
}
