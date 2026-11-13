/**
 * @file E2E 테스트 설정 (playwright.config.ts)
 *
 * E2E(End-to-End) 테스트가 뭔가요?
 *   진짜 브라우저(Chromium)를 띄워 사용자처럼 클릭하고 입력하면서 사이트 전체가 잘 동작하는지 확인하는 테스트예요.
 *   단위 테스트(Vitest)가 부품 하나하나를 본다면, E2E는 완성된 자동차를 실제로 몰아 보는 셈이에요.
 *   레이아웃 넘침, 실제 글꼴, 접근성(axe), 로그인·저장 흐름 같은 것은 진짜 브라우저에서만 제대로 확인할 수 있어요.
 *
 * 실행: pnpm e2e  (처음 한 번은 pnpm exec playwright install chromium으로 브라우저를 받아야 해요)
 *
 * 무엇을 띄워서 시험하나요?
 *   1. 가짜 GitHub 서버(e2e/mock-github.mjs): 글쓰기·고치기·지우기가 올리는 커밋을 받아요. 진짜 저장소는 건드리지 않아요.
 *   2. 블로그 서버(pnpm start): 실제로 올릴 운영 빌드를 그대로 띄워요.
 *      원고는 실제 원고(content/reviews)가 아니라 시험용 원고(e2e/fixtures/reviews)로 빌드해요(pnpm e2e:build).
 *      글쓴이가 리뷰를 아무리 더하거나 고쳐도 E2E 결과가 늘 같도록 하기 위해서예요.
 *      로그인에 쓰는 아이디·비밀번호·열쇠도 시험용 값을 넣어요(e2e/admin-account.ts).
 */

import { defineConfig, devices } from "@playwright/test";

// 비밀번호 해시는 블로그와 같은 방법(scrypt)으로 시험할 때마다 새로 만들어요(src/lib/password-hash.ts).
import { E2E_ADMIN } from "./e2e/admin-account";
import { hashPassword } from "./src/lib/password-hash";

/** 시험용 블로그 서버 포트. 다른 프로그램과 겹치면 E2E_PORT=3200 pnpm e2e처럼 바꿀 수 있어요. */
const PORT = Number(process.env.E2E_PORT ?? 3100);
/** 가짜 GitHub 서버 포트 */
const GITHUB_PORT = Number(process.env.MOCK_GITHUB_PORT ?? 3101);

// 시험 전에 실행할 명령
//  - CI: 앞 단계에서 이미 pnpm e2e:build를 했으니 서버만 띄워요.
//  - 내 컴퓨터: 시험용 원고로 빌드한 뒤 서버를 띄워요.
const command = process.env.CI ? `pnpm start --port ${PORT}` : `pnpm e2e:build && pnpm start --port ${PORT}`;

export default defineConfig({
  // 테스트 파일이 있는 폴더
  testDir: "./e2e",
  // 테스트를 여러 개 동시에 돌려 빨리 끝내요.
  fullyParallel: true,
  // CI에서는 test.only(하나만 돌리기)가 남아 있으면 실패시켜, 실수로 나머지 테스트를 건너뛰지 않게 해요.
  forbidOnly: !!process.env.CI,
  // CI에서는 가끔 생기는 우연한 실패에 대비해 두 번까지 다시 해 봐요.
  retries: process.env.CI ? 2 : 0,
  // 결과를 한 줄씩 보여 줘요.
  reporter: "list",
  use: {
    // page.goto("/")처럼 짧게 쓰면 이 주소 뒤에 붙어요.
    baseURL: `http://localhost:${PORT}`,
    // 다시 해 볼 때(retry) 무슨 일이 있었는지 기록(trace)을 남겨요. 실패 원인을 찾을 때 좋아요.
    trace: "on-first-retry",
    // 브라우저 언어를 한국어로
    locale: "ko-KR",
  },
  // 같은 테스트를 두 가지 화면에서 돌려요: 데스크톱 크롬, 휴대폰(Pixel 7)
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // 테스트 전에 서버 두 개를 띄우고, 주소가 응답할 때까지 기다려요(빌드까지 최대 5분).
  // reuseExistingServer: 내 컴퓨터에서는 이미 띄워 둔 서버가 있으면 그대로 써요.
  webServer: [
    {
      command: "node e2e/mock-github.mjs",
      url: `http://127.0.0.1:${GITHUB_PORT}/__health`,
      env: { MOCK_GITHUB_PORT: String(GITHUB_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        ADMIN_ID: E2E_ADMIN.id,
        ADMIN_PASSWORD_HASH: await hashPassword(E2E_ADMIN.password),
        SESSION_SECRET: "e2e-session-secret-0123456789-abcdefghijklmnop",
        GITHUB_CONTENT_TOKEN: "e2e-token",
        GITHUB_API_URL: `http://127.0.0.1:${GITHUB_PORT}`,
      },
    },
  ],
});
