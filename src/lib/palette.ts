/**
 * @file 형광 초록 색 값 (palette.ts)
 *
 * 이 파일이 하는 일
 *   블로그의 기본 인광 색(형광 초록)을 자바스크립트 값으로 모아 둬요.
 *
 * 왜 CSS 변수가 있는데 또 적나요?
 *   화면 색은 globals.css의 CSS 변수(--phosphor 등)로 정해요. 그런데 CSS를 읽을 수 없는 곳이 있어요.
 *     - 앱 아이콘 만들기(scripts/make-icons.mjs): 빌드 밖에서 도는 스크립트
 *   그런 곳은 이 값을 써요. globals.css의 :root 기본 색과 같아야 해서 palette.test.ts가 둘을 비교해요.
 */

/** 형광 초록 인광 색(globals.css :root의 기본 색 묶음과 같아요) */
export const GREEN_PHOSPHOR = {
  /** 글자(--phosphor) */
  phosphor: "#39ff14",
  /** 보조 글자(--phosphor-dim) */
  dim: "#2ad40e",
  /** 선(--phosphor-line) */
  line: "#178a0a",
  /** 화면 바탕(--screen) */
  screen: "#020802",
  /** 반전 영역의 글자(--ink) */
  ink: "#021002",
} as const;
