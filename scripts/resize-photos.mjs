// 본문 사진의 작은 사본 만들기 (scripts/resize-photos.mjs)
//
// 이 파일이 하는 일
//   빌드 직전에 public/images의 본문 사진마다 작은 WebP 사본(480·800·1200px)을 public/_resized에 만들어요.
//   실제 일은 src/lib/resize-photos.ts가 하고, 여기서는 불러서 결과만 알려요.
//   package.json의 build·e2e:build가 next build보다 먼저 이 파일을 실행해요(배포의 OpenNext도 pnpm build를 불러요).
//
// .ts 파일을 바로 불러오나요?
//   Node.js 24부터는 TypeScript의 타입 글자만 지우고 그대로 실행할 수 있어요(type stripping). 그래서 빌드 도구 없이 불러요.

import path from "node:path";

import { resizePhotos } from "../src/lib/resize-photos.ts";

const publicDir = path.resolve(process.cwd(), "public");
const { photos, variants, animated, failed } = await resizePhotos(publicDir);
console.log(photos === 0 ? "본문 사진이 없어 작은 사본을 만들지 않았어요." : `본문 사진 ${photos}장 → 작은 사본 ${variants}개(public/_resized)`);
// 움직이는 그림은 사본을 만들지 않고 원본만 써요(사본은 첫 장만 남아 움직임이 사라져서).
if (animated > 0) console.log(`움직이는 그림 ${animated}장은 사본 없이 원본만 써요.`);
// 읽지 못한 사진은 빌드를 멈추지 않고 알리기만 해요(그 사진은 원본만 보여요).
for (const file of failed) console.warn(`경고: public/${file}의 작은 사본을 만들지 못했어요. 그림 파일이 깨지지 않았는지 확인하세요.`);
