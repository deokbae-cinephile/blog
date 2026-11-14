/**
 * @file 본문 사진의 작은 사본 만들기 (resize-photos.ts)
 *
 * 이 파일이 하는 일
 *   빌드 직전에 public/images의 본문 사진마다 작은 WebP 사본(480·800·1200px, lib/photo-variants.ts)을 만들어
 *   public/_resized에 둬요. 상세 화면은 이 사본들로 <img srcset>을 달아, 화면 크기에 맞는 작은 사진을 받게 해요.
 *
 *     public/images/shutter-island/scene-1.webp (1600px)
 *       → public/_resized/480/images/shutter-island/scene-1.webp.webp
 *       → public/_resized/800/images/shutter-island/scene-1.webp.webp
 *       → public/_resized/1200/images/shutter-island/scene-1.webp.webp
 *
 * 언제 돌아가나요?
 *   package.json의 build·e2e:build가 next build보다 먼저 scripts/resize-photos.mjs로 불러요.
 *   배포(OpenNext)도 pnpm build를 불러서 같은 순서예요. 사본은 저장소에 올리지 않고 빌드할 때마다 새로 만들어요.
 *
 * 왜 빌드할 때 만드나요?
 *   방문할 때마다 워커가 사진을 줄이면(이미지 변환) 요청마다 일이 생겨요. 미리 만들어 두면 다른 정적 파일처럼
 *   Cloudflare가 바로 내줘서 워커는 아무 일도 하지 않아요(이 블로그는 가벼움이 가장 중요해요).
 *
 * sharp가 뭔가요?
 *   그림을 빠르게 줄이고 다른 형식으로 바꿔 주는 도구예요(Next.js도 이미지 최적화에 써요).
 *   이 파일은 빌드 스크립트만 불러서, 방문자 화면이나 워커 코드에는 들어가지 않아요.
 */

import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

// .ts까지 적어요: 빌드 스크립트는 Node.js가 이 파일을 바로 실행해서(type stripping), 확장자를 생략하면 파일을 찾지 못해요.
import { RESIZABLE, RESIZED_DIR, variantFile, variantWidths } from "./photo-variants.ts";

/** 사본의 WebP 품질(0~100). 78이면 눈으로는 원본과 거의 같고 크기는 크게 줄어요. */
const QUALITY = 78;

/** 만든 결과: 살펴본 사진 수, 만든 사본 수, 움직이는 그림이라 건너뛴 수, 사본을 만들지 못한 사진(public 기준 경로) */
export type ResizeResult = { photos: number; variants: number; animated: number; failed: string[] };

/**
 * public/images의 사진마다 작은 사본을 만들어요. 예전 사본(public/_resized)은 먼저 모두 지우고 새로 만들어요
 * (지운 사진의 사본이 남거나, 같은 이름으로 바꾼 사진의 예전 사본이 쓰이지 않게).
 *
 * 사진 하나를 읽지 못해도(깨진 파일 등) 빌드를 멈추지 않고 그 사진만 건너뛰어요(failed에 적어요).
 * 사본은 화면을 가볍게 하는 덤이라, 없으면 그 사진은 원본만 보여 줘요(원고 검사가 따로 사진을 확인해요).
 *
 * @param publicDir public 폴더 경로
 * @returns 살펴본 사진 수, 만든 사본 수, 사본을 만들지 못한 사진
 */
export async function resizePhotos(publicDir: string): Promise<ResizeResult> {
  const out = path.join(publicDir, RESIZED_DIR);
  await rm(out, { recursive: true, force: true });

  const result: ResizeResult = { photos: 0, variants: 0, animated: 0, failed: [] };
  for (const file of await listFiles(path.join(publicDir, "images"))) {
    if (!RESIZABLE.test(file)) continue;
    result.photos += 1;
    // public 기준 경로(예: "images/a/scene-1.jpg"). 사본 이름은 이 경로로 정해요(주소의 / 모양을 따르게 \를 /로).
    const publicPath = path.relative(publicDir, file).split(path.sep).join("/");

    try {
      const { width = 0, height = 0, orientation, pages = 1, format } = await sharp(file).metadata();
      // 움직이는 그림(여러 장으로 된 WebP·AVIF, 움직이는 PNG)은 사본을 만들지 않아요(GIF와 같아요).
      // sharp는 기본으로 첫 장만 읽어서 사본이 멈춘 그림이 되고, 브라우저가 그 사본을 고르면 움직임이 사라지거든요.
      // 사본이 없으면 원고 읽기가 srcset을 달지 않아서 원본(움직이는 그림)만 보여요.
      if (pages > 1 || (format === "png" && isAnimatedPng(await readFile(file)))) {
        result.animated += 1;
        continue;
      }
      // 휴대폰 사진에는 "돌려서 보여 줘"(orientation)가 들어 있기도 해요. 5~8은 90도로 돌리라는 뜻이라 가로·세로를 바꿔 봐요.
      const shownWidth = orientation !== undefined && orientation >= 5 ? height : width;

      for (const target of variantWidths(shownWidth)) {
        const dest = path.join(publicDir, ...variantFile(publicPath, target).split("/"));
        await mkdir(path.dirname(dest), { recursive: true });
        // rotate(): 돌림 표시대로 돌려 저장해요(사본에는 표시가 없어도 바르게 보여요). resize: 가로를 맞추고 세로는 비율대로.
        await sharp(file).rotate().resize({ width: target }).webp({ quality: QUALITY }).toFile(dest);
        result.variants += 1;
      }
    } catch {
      // 읽지 못한 사진은 건너뛰어요. 이미 만든 사본이 있으면 그것만 쓰이고, 없으면 원본만 보여요.
      result.failed.push(publicPath);
    }
  }
  return result;
}

/**
 * 움직이는 PNG(APNG)인지. APNG는 그림 자료(IDAT) 앞에 "움직임 정보"(acTL) 칸이 있어요.
 * sharp(libvips)는 APNG의 첫 장만 읽고 여러 장이라고 알려 주지 않아서, 파일 안의 칸 이름을 직접 찾아봐요.
 */
export function isAnimatedPng(bytes: Uint8Array): boolean {
  const text = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const animation = text.indexOf("acTL");
  const data = text.indexOf("IDAT");
  return animation !== -1 && (data === -1 || animation < data);
}

/** 폴더 안의 모든 파일 경로(하위 폴더까지). 폴더가 없으면 빈 목록이에요(아직 본문 사진이 없는 블로그). */
async function listFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => path.join(entry.parentPath, entry.name)).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
