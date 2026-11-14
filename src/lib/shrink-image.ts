/**
 * @file 사진 줄이기 (shrink-image.ts)
 *
 * 이 파일이 하는 일
 *   글쓰기 화면에서 포스터·장면 사진을 고르면, 올리기 전에 브라우저 안에서 사진을 알맞은 크기로 줄여요.
 *
 *     휴대폰 사진(4000 × 3000px, 3~8MB) ──줄이기──> 긴 변 1600px(보통 200~500KB)
 *       - 장면 사진: WebP. 본문에 그대로 보여서, 같은 화질에 가장 가벼운 형식으로 줄여요.
 *       - 포스터: JPG. 링크를 카카오톡·메신저에 붙이면 포스터가 미리 보기 그림이 되는데(공유 미리 보기),
 *         그런 곳은 WebP를 못 보여 주기도 해서 어디서나 보이는 JPG로 줄여요.
 *         (블로그 화면의 포스터는 이미지 최적화를 거쳐 브라우저에 맞는 가벼운 형식으로 바뀌어 보여요.)
 *
 *   - 블로그에서 가장 크게 보이는 사진도 1600px보다 작게 보여서(고해상도 화면 포함), 더 큰 사진은 받는 사람만 무거워요.
 *   - 저장소(GitHub)와 사진 올리기 요청(4MB 한도)이 가벼워지고, 4MB가 넘는 휴대폰 사진도 그대로 고를 수 있어요.
 *
 * 줄이지 않는 때
 *   - GIF: 움직이는 그림일 수 있어요. 그림판(canvas)에 그리면 첫 장면만 남아서 그대로 둬요.
 *   - 이미 작은 사진: 긴 변이 1600px 이하이고 1MB 이하면 화질을 지키려고 그대로 둬요.
 *     (포스터는 JPG·PNG일 때만 그대로 둬요. WebP·AVIF 포스터는 작아도 JPG로 바꿔요.)
 *   - 브라우저가 읽지 못하는 형식이면 그대로 둬요(사진 올리기 API가 다시 확인해요).
 *   - 다시 만든 파일이 더 크면 원래 파일을 써요.
 *
 * 어떻게 줄이나요?
 *   사진을 <img>로 읽고(휴대폰 사진의 회전 정보도 브라우저가 맞춰 줘요), 줄인 크기의 그림판(canvas)에 그린 뒤 저장해요.
 *   장면 사진은 WebP로 저장하고, WebP를 만들 줄 모르는 옛 브라우저면 PNG는 PNG로, 나머지는 JPG로 저장해요.
 *   포스터는 JPG로 저장해요(투명한 곳은 흰색으로 채워요. JPG는 투명을 담지 못해요).
 *
 * 누가 쓰나요?
 *   components/review-writer.tsx(포스터 고르기, 장면 사진 넣기)
 */

/** 줄인 사진의 긴 변 최대 길이(px) */
export const MAX_IMAGE_SIDE = 1600;

/** 이 크기 이하의 파일은(긴 변도 맞으면) 다시 만들지 않아요. 화질을 지키려고요. */
const KEEP_BYTES = 1024 * 1024;

/** 다시 만들 때의 화질(0~1). 사진은 0.85면 눈으로 차이를 거의 느끼지 못해요. */
const QUALITY = 0.85;

/**
 * 긴 변이 max를 넘지 않게 가로·세로를 같은 비율로 줄인 크기(정수 px)예요. 이미 작으면 그대로예요.
 *
 * @example
 * fitWithin(4000, 3000); // { width: 1600, height: 1200 }
 * fitWithin(800, 600);   // { width: 800, height: 600 }
 */
export function fitWithin(width: number, height: number, max = MAX_IMAGE_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  // 줄여도 1px보다 작아지지 않게 해요.
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * 파일 이름의 확장자를 바꿔요. 확장자가 없으면 붙여요.
 * @example withExtension("Poster.PNG", "webp"); // "Poster.webp"
 */
export function withExtension(name: string, extension: string): string {
  const dot = name.lastIndexOf(".");
  return `${dot === -1 ? name : name.slice(0, dot)}.${extension}`;
}

/**
 * 파일 크기를 읽기 쉬운 글자로 바꿔요. 1MB 이상은 소수 한 자리 MB, 그 아래는 KB예요.
 * @example formatBytes(3_355_443); // "3.2MB"
 * @example formatBytes(421_888);   // "412KB"
 */
export function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

/** 줄이기 결과: 쓸 파일과, 줄였는지(다시 만들었는지) */
export type ShrinkResult = { file: File; shrunk: boolean };

/** 사진 종류: 포스터(JPG로 줄여요)와 장면 사진(WebP로 줄여요) */
export type ImageKind = "poster" | "scene";

/** 포스터를 그대로 두어도 되는 형식(어디서나 보이는 형식) */
const SHAREABLE_TYPES = new Set(["image/jpeg", "image/png"]);

/** 그림판(canvas)의 그림을 파일 덩어리(Blob)로 만들어요. 만들지 못하면 null */
function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/**
 * 사진을 알맞은 크기로 줄여요(위의 "줄이지 않는 때"에는 원래 파일 그대로).
 *
 * @param file 고른 사진 파일
 * @param kind "poster"(JPG로) 또는 "scene"(WebP로). 기본은 장면 사진이에요.
 * @returns 쓸 파일과 줄였는지. 줄였으면 이름의 확장자도 새 형식(jpg·webp·png)으로 바뀌어요.
 */
export async function shrinkImage(file: File, kind: ImageKind = "scene"): Promise<ShrinkResult> {
  const original = { file, shrunk: false };
  if (file.type === "image/gif" || /\.gif$/i.test(file.name)) return original;

  // 사진을 <img>로 읽어요. 임시 주소(blob:)는 다 쓰면 지워요(finally).
  let url = "";
  try {
    url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    // decode(): 사진을 다 읽을 때까지 기다려요. 읽지 못하는 형식이면 오류가 나서 원래 파일을 써요(catch).
    await image.decode();

    // naturalWidth·naturalHeight: 사진의 실제 크기(휴대폰 사진의 회전도 맞춘 크기)
    const { naturalWidth: width, naturalHeight: height } = image;
    // 크기를 알 수 없으면(읽기에 실패한 것과 같아요) 원래 파일을 써요.
    if (width === 0 || height === 0) return original;
    const target = fitWithin(width, height);
    const sameSize = target.width === width && target.height === height;
    // 포스터는 어디서나 보이는 형식(JPG·PNG)이어야 그대로 둬요.
    const keepableType = kind === "scene" || SHAREABLE_TYPES.has(file.type);
    if (sameSize && file.size <= KEEP_BYTES && keepableType) return original;

    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d");
    if (!context) return original;
    if (kind === "poster") {
      // JPG는 투명을 담지 못해서, 투명한 곳이 검게 되지 않게 먼저 흰색으로 칠해요.
      context.fillStyle = "#fff";
      context.fillRect(0, 0, target.width, target.height);
    }
    // 줄일 때 계단 현상이 덜하게 가장 고운 방식으로 그려요.
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, target.width, target.height);

    let blob: Blob | null;
    if (kind === "poster") {
      blob = await toBlob(canvas, "image/jpeg");
    } else {
      // WebP로 만들어 봐요. 만들 줄 모르는 브라우저는 PNG를 돌려줘서(형식이 다름), 그때는 PNG는 PNG로, 나머지는 JPG로 만들어요.
      blob = await toBlob(canvas, "image/webp");
      if (blob?.type !== "image/webp") blob = await toBlob(canvas, file.type === "image/png" ? "image/png" : "image/jpeg");
    }
    if (!blob) return original;
    // 크기도 형식도 그대로 둬도 되는데 다시 만든 파일이 더 크면, 원래 파일이 나아요.
    if (sameSize && keepableType && blob.size >= file.size) return original;

    const extension = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
    return { file: new File([blob], withExtension(file.name, extension), { type: blob.type, lastModified: file.lastModified }), shrunk: true };
  } catch {
    return original;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}
