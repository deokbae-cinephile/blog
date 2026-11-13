/**
 * @file 아이콘 만들기 (scripts/make-icons.mjs)
 *
 * 이 파일이 하는 일
 *   로고 픽셀 그림(src/lib/logo.ts)으로 블로그에 필요한 아이콘 파일을 모두 만들어요.
 *
 *     src/app/icon.svg                브라우저 탭 아이콘(파비콘). Next.js가 <link rel="icon">을 알아서 달아요.
 *     src/app/apple-icon.png          아이폰·아이패드 홈 화면 아이콘(180×180). <link rel="apple-touch-icon">도 알아서 달려요.
 *     public/icons/icon-192.png       설치 앱 아이콘(192×192)  ┐
 *     public/icons/icon-512.png       설치 앱 아이콘(512×512)  ├ 설치 정보(src/app/manifest.ts)에 적혀 있어요.
 *     public/icons/icon-maskable-512.png 모양 잘림용 아이콘    ┘
 *
 * 언제 실행하나요?
 *   로고 그림(src/lib/logo.ts)을 고쳤을 때만 실행해요. 만든 파일은 저장소에 함께 올려요.
 *     pnpm icons
 *
 * 픽셀이 흐려지지 않게 그리는 방법
 *   로고 한 칸을 아이콘마다 정수 크기(예: 512 아이콘은 한 칸 32px)로 키우고, 가운데 자리도 정수 픽셀에 맞춰요.
 *   그래서 아이콘을 크게 봐도 칸 가장자리가 또렷해요.
 *
 * maskable(모양 잘림용) 아이콘이 뭔가요?
 *   안드로이드는 홈 화면 아이콘을 동그라미·둥근 사각형 등 기기마다 다른 모양으로 잘라요.
 *   잘려도 로고가 남도록, 가운데 원(지름 80%) 안에 들어가게 로고를 더 작게 그린 판이에요.
 *
 * Playwright(E2E 테스트에 쓰는 브라우저 도구)로 SVG를 PNG로 찍어요. 새 라이브러리가 필요 없어요.
 * Node.js 24는 .ts 파일을 바로 불러올 수 있어서(타입만 지우고 실행) src/lib의 로고 데이터를 그대로 써요.
 */

import { mkdirSync, writeFileSync } from "node:fs";

import { chromium } from "@playwright/test";

import { LOGO_ROWS } from "../src/lib/logo.ts";
import { GREEN_PHOSPHOR } from "../src/lib/palette.ts";
import { pixelPath } from "../src/lib/pixel-path.ts";

/** 화면 바탕색과 형광 초록 (src/lib/palette.ts — globals.css의 --screen, --phosphor와 같아요) */
const SCREEN = GREEN_PHOSPHOR.screen;
const GREEN = GREEN_PHOSPHOR.phosphor;

/** 로고 그림의 가로·세로 칸 수 */
const logoWidth = Math.max(...LOGO_ROWS.map((row) => row.length));
const logoHeight = LOGO_ROWS.length;

/**
 * 정사각형 아이콘 SVG를 만들어요: 어두운 바탕 + 가운데 초록 로고
 *
 * @param {number} size 아이콘 한 변의 픽셀 수
 * @param {number} cell 로고 한 칸의 픽셀 수(정수)
 * @returns {string} SVG 글자
 */
function iconSvg(size, cell) {
  // 로고를 가운데에 두는 자리. Math.floor로 정수 픽셀에 맞춰야 칸 가장자리가 흐려지지 않아요.
  const x = Math.floor((size - logoWidth * cell) / 2);
  const y = Math.floor((size - logoHeight * cell) / 2);
  // path는 "한 칸 = 1" 단위로 그려져 있어서, translate로 자리를 옮기고 scale로 한 칸을 cell px로 키워요.
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`,
    `<rect width="${size}" height="${size}" fill="${SCREEN}"/>`,
    `<path fill="${GREEN}" transform="translate(${x} ${y}) scale(${cell})" d="${pixelPath(LOGO_ROWS, "#")}"/>`,
    `</svg>`,
  ].join("");
}

// 1) 파비콘: 16×16 격자에 한 칸 1로 그린 벡터 그림(SVG)이라 파일을 바로 써요.
writeFileSync("src/app/icon.svg", `${iconSvg(16, 1)}\n`);

// 2) PNG 아이콘들: [저장할 파일, 한 변 크기, 로고 한 칸 크기]
const pngs = [
  ["src/app/apple-icon.png", 180, 12],
  ["public/icons/icon-192.png", 192, 12],
  ["public/icons/icon-512.png", 512, 32],
  // 모양 잘림용: 로고가 가운데 원(지름 80%) 안에 들어가도록 한 칸을 24px로 작게
  ["public/icons/icon-maskable-512.png", 512, 24],
];

mkdirSync("public/icons", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

for (const [file, size, cell] of pngs) {
  // 아이콘 크기에 딱 맞는 빈 화면에 SVG를 그리고, 그 SVG 요소만 PNG로 찍어요.
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0">${iconSvg(size, cell)}</body>`);
  await page.locator("svg").screenshot({ path: file });
  console.log(`${file} (${size}×${size})`);
}

await browser.close();
console.log("src/app/icon.svg (16×16)");
