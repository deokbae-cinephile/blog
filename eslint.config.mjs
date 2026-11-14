/**
 * @file ESLint 설정 (eslint.config.mjs)
 *
 * ESLint가 뭔가요?
 *   코드를 실행하지 않고 읽기만 해서 "실수하기 쉬운 코드"를 찾아 주는 검사 도구예요.
 *   예: 쓰지 않는 변수, React 훅을 조건문 안에서 부르기, 이미지에 대체 텍스트(alt) 빠뜨리기 등
 *
 * 실행: pnpm lint  (CI에서도 올릴 때마다 돌아가요)
 *
 * 이 파일은 "평평한 설정(flat config)" 방식이에요. 배열 안의 설정을 위에서부터 차례로 겹쳐 적용하고,
 * 같은 규칙이 여러 번 나오면 아래쪽 설정이 이겨요.
 */

import { defineConfig, globalIgnores } from "eslint/config";
// Next.js가 권하는 규칙 묶음. core-web-vitals는 페이지 속도에 영향을 주는 실수까지 오류로 잡아요.
import nextVitals from "eslint-config-next/core-web-vitals";
// TypeScript용 규칙 묶음
import nextTs from "eslint-config-next/typescript";
// 접근성(jsx-a11y) 규칙: 화면 낭독기·키보드 사용자에게 문제가 될 코드를 찾아요.
import jsxA11y from "eslint-plugin-jsx-a11y";

export default defineConfig([
  // `...배열`: 규칙 묶음 배열을 펼쳐 이 배열에 그대로 넣어요.
  ...nextVitals,
  ...nextTs,

  // Pages Router(옛 방식)용 규칙이라 App Router를 쓰는 이 프로젝트에서는 꺼요.
  { rules: { "@next/next/no-html-link-for-pages": "off" } },

  {
    // .jsx, .tsx 파일에만 적용
    files: ["**/*.{jsx,tsx}"],
    rules: {
      // eslint-config-next는 접근성 규칙을 몇 개만 켜 둬요. 권장 규칙 전체를 더 켭니다.
      ...jsxA11y.flatConfigs.recommended.rules,
      // 가로로 스크롤되는 영역(표)은 키보드로도 스크롤할 수 있게 tabIndex={0}을 줘야 해요.
      // 원래 "초점을 받지 않는 요소에 tabIndex 금지" 규칙이 있는데, 이름 있는 region 역할에는 허락해요.
      // 탭 내용(tabpanel)도 허락해요. WAI-ARIA 탭 패턴은 탭 내용에 tabIndex={0}을 줘서 Tab 키로 들어가게 해요.
      // allowExpressionValues: 역할을 조건식으로 정한 요소(예: 좁은 화면에서만 tabpanel)는 검사에서 빼요.
      // 이 규칙은 조건식 역할을 읽지 못해서, 맞게 쓴 코드도 틀렸다고 해요. (tabpanel·allowExpressionValues 모두 jsx-a11y 기본 권장값과 같아요)
      "jsx-a11y/no-noninteractive-tabindex": ["error", { tags: [], roles: ["region", "tabpanel"], allowExpressionValues: true }],
    },
  },

  // 검사하지 않을 폴더: 빌드 결과물(Next.js, Cloudflare Workers용)과 테스트 기록, Next.js가 만드는 타입 파일
  globalIgnores([
    ".next/**",
    ".open-next/**",
    ".wrangler/**",
    "test-results/**",
    "playwright-report/**",
    "next-env.d.ts",
  ]),
]);
