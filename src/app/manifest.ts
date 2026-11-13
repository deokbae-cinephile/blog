/**
 * @file 설치 정보 = 웹 앱 매니페스트 (app/manifest.ts → 주소 "/manifest.webmanifest")
 *
 * 이 파일이 하는 일
 *   이 블로그를 "앱으로 설치"할 때 필요한 정보(이름, 아이콘, 색, 여는 방식)를 브라우저에 알려 줘요.
 *   휴대폰 홈 화면이나 PC 바탕화면에 설치하면 주소창 없는 앱 창으로 열려요.
 *
 * Next.js 약속
 *   app/manifest.ts가 대표 내보내기로 정보를 돌려주면, Next.js가 manifest.webmanifest 파일로 만들고
 *   모든 페이지의 <head>에 <link rel="manifest">를 알아서 달아 줘요.
 *
 * 주소를 "./"처럼 상대 주소로 적은 이유
 *   매니페스트 안의 상대 주소는 매니페스트 파일 위치(/manifest.webmanifest)를 기준으로 풀려요.
 *   그래서 "./"는 /, "icons/icon-192.png"는 /icons/icon-192.png가 돼요.
 *   도메인을 바꾸거나 다른 주소 아래에 올려도 매니페스트를 고칠 필요가 없어요.
 *
 * 아이콘 파일은 scripts/make-icons.mjs가 만들어요(pnpm icons).
 */

import type { MetadataRoute } from "next";

import { site } from "@/lib/site";

/** 정적 사이트로 내보낼 때는 빌드하면서 파일로 만들어 두라는 표시예요(app/sitemap.ts와 같아요). */
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // 설치 화면과 앱 목록에 보이는 이름
    name: site.name,
    // 홈 화면 아이콘 아래에 보이는 짧은 이름
    short_name: site.shortName,
    description: site.description,
    // 언어와 글 방향(왼쪽 → 오른쪽)
    lang: "ko",
    dir: "ltr",
    // 앱을 열면 처음 보일 주소, 그리고 앱이 맡는 주소 범위
    start_url: "./",
    scope: "./",
    // standalone: 주소창 없이 앱처럼 열려요.
    display: "standalone",
    // 앱이 뜨는 동안 보이는 바탕색과 상단 막대 색. 화면 바탕색(globals.css의 --screen)과 같게 맞춰요.
    background_color: "#020802",
    theme_color: "#020802",
    categories: ["entertainment"],
    icons: [
      { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
      // purpose "maskable": 기기가 동그라미 등으로 잘라 쓰는 아이콘(로고가 안쪽 안전 영역에 들어 있어요)
      { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
