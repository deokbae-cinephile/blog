/**
 * @file Next.js 설정 (next.config.ts)
 *
 * 이 파일이 하는 일
 *   Next.js가 블로그를 어떻게 빌드하고 띄울지 정합니다.
 *
 * 이 블로그는 "서버가 있는" Next.js 앱이에요
 *   - 목록·상세 화면은 빌드할 때 미리 HTML로 만들어 둬요(정적 생성). 방문자에게는 만들어 둔 파일을 그대로 주니 가볍고 빨라요.
 *   - 로그인, 글쓰기 화면, 저장 API(src/app/api), 접근 검사(src/proxy.ts)만 요청이 올 때 서버에서 돌아요.
 *   내 컴퓨터에서는 `pnpm build` 뒤 `pnpm start`(Node.js 서버)로 띄우고,
 *   배포는 Cloudflare Workers에 해요(OpenNext 어댑터가 Workers용으로 바꿔 줘요. open-next.config.ts, wrangler.jsonc).
 *   (예전처럼 정적 파일만 내보내는 output: "export"를 쓰면 proxy.ts와 API를 쓸 수 없어서 쓰지 않아요.)
 *
 * Cloudflare에서는 정적 파일(public/, _next/static)이 이 설정의 headers()를 거치지 않아요.
 *   그래서 같은 보안 헤더를 public/_headers에도 적어 두었어요. 헤더를 바꾸면 두 곳을 함께 고쳐요.
 */

import type { NextConfig } from "next";

/**
 * 모든 응답에 붙일 보안 헤더예요. 브라우저에게 "이렇게 조심해 줘"라고 알려 줘요.
 *
 * - X-Content-Type-Options: nosniff
 *     파일 종류(Content-Type)를 브라우저가 멋대로 짐작하지 않게 해요. 그림인 척하는 스크립트를 막아요.
 * - Referrer-Policy: strict-origin-when-cross-origin
 *     다른 사이트로 갈 때 우리 주소 전체가 아니라 도메인만 알려 줘요.
 * - X-Frame-Options: DENY
 *     다른 사이트가 우리 화면을 <iframe>에 몰래 넣지 못하게 해요(로그인·글쓰기 화면을 속여 누르게 하는 공격을 막아요).
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  // 응답 헤더에 "X-Powered-By: Next.js"를 붙이지 않아요(굳이 알릴 필요가 없는 정보예요).
  poweredByHeader: false,
  // 포스터는 Next.js 이미지 최적화를 거쳐요. 목록의 작은 썸네일은 작게 줄인 파일을 받아서 화면이 가벼워져요.
  // 원본 파일은 그대로 두고, 줄인 파일은 서버가 따로 만들어 보관해요.
  // 쓸 수 있는 품질 값을 75 하나로 정해 둬요(Next.js 16 기본값과 같아요. 엉뚱한 값으로 서버를 괴롭히는 요청을 막아요).
  images: { qualities: [75] },
  // 모든 주소("/:path*")에 위의 보안 헤더를 붙여요.
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Turbopack(Next.js의 빌드 도구)이 CSS 파일을 Tailwind로 처리하게 해요.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
