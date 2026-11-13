/**
 * @file 단위 테스트 설정 (vitest.config.mts)
 *
 * Vitest가 뭔가요?
 *   함수와 컴포넌트를 하나씩 떼어 시험하는 "단위 테스트" 도구예요.
 *   src 안의 *.test.ts, *.test.tsx 파일을 찾아 실행합니다.
 *
 * 실행: pnpm test (한 번) / pnpm test:watch (파일을 고칠 때마다 다시)
 */

// fileURLToPath: "file:///..." 모양의 주소를 이 컴퓨터의 파일 경로로 바꿔요.
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // React 컴포넌트(JSX)를 테스트에서 읽을 수 있게 하는 플러그인
  plugins: [react()],
  resolve: {
    // tsconfig.json의 "@/" 줄임 경로를 테스트에서도 쓸 수 있게 해요.
    tsconfigPaths: true,
    // 'server-only'는 "브라우저 코드에서 가져오면 오류"를 내는 표시 모듈이에요.
    // 테스트는 서버도 브라우저도 아니라서 의미가 없으니, 빈 모듈(scripts/empty-module.ts)로 바꿔 끼워요.
    // new URL(...).pathname을 쓰면 폴더 이름의 한글·공백이 %EA%B2... 같은 글자로 남아 경로가 틀어져요.
    // fileURLToPath로 바꾸면 한글·공백 폴더와 Windows에서도 올바른 파일 경로가 돼요.
    alias: { "server-only": fileURLToPath(new URL("./scripts/empty-module.ts", import.meta.url)) },
  },
  test: {
    // jsdom: 브라우저를 흉내 낸 가상 화면. 컴포넌트를 그려 볼 수 있어요.
    // (서버 코드 테스트는 파일 맨 위에 `// @vitest-environment node`를 적어 Node.js 환경으로 바꿔요.)
    environment: "jsdom",
    // 테스트를 시작하기 전에 한 번 실행할 준비 파일
    setupFiles: ["./vitest.setup.ts"],
    // 테스트 파일 위치와 이름 규칙
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
