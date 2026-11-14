/**
 * @file 본문 사진의 작은 사본 규칙 (photo-variants.ts)
 *
 * 이 파일이 하는 일
 *   본문 사진을 화면 크기에 맞춰 작게 받도록(srcset), 빌드할 때 만드는 작은 사본의 너비·주소 규칙과
 *   브라우저에게 "이 사진이 화면에서 얼마나 크게 보이는지" 알려 주는 sizes 글을 정해요.
 *
 *     원본  /images/shutter-island/scene-1.webp                     (최대 1600px, 저장소에 있는 파일)
 *     사본  /_resized/480/images/shutter-island/scene-1.webp.webp   (빌드할 때 만들어요, 저장소에는 올리지 않아요)
 *           /_resized/800/images/shutter-island/scene-1.webp.webp
 *           /_resized/1200/images/shutter-island/scene-1.webp.webp
 *
 *   사본 이름 끝에 .webp를 덧붙이는 까닭: 사본은 모두 WebP라서, 원본 확장자를 바꾸면 a.jpg와 a.png의 사본이 겹쳐요.
 *
 * 흐름
 *   1. 빌드 직전에 scripts/resize-photos.mjs(lib/resize-photos.ts)가 public/images의 사진으로 사본을 만들어요(public/_resized).
 *   2. 원고를 읽을 때(lib/load-reviews.ts) 사본이 정말 있는지 보고, lib/markdown.ts가 <img srcset sizes>를 달아요.
 *   3. 브라우저는 화면 너비와 화소 밀도(DPR)에 맞는 가장 작은 사본을 골라 받아요.
 *      예: 휴대폰(412px, DPR 2.6)은 1200px, 노트북(1280px, DPR 1)은 800px, 넓은 모니터는 원본.
 *   실행 중인 워커는 아무 일도 하지 않아요. 사본은 다른 정적 파일처럼 Cloudflare가 바로 내줘요(가볍게).
 *
 * 이 파일에는 Node.js·브라우저 코드가 없어서, 빌드 스크립트와 원고 읽기가 함께 써요.
 */

/** 만드는 사본의 너비(px). 휴대폰·태블릿·노트북 화면을 고르게 덮어요. 원본(최대 1600px)은 넓은 화면용으로 그대로 둬요. */
export const PHOTO_WIDTHS = [480, 800, 1200] as const;

/** 사본을 두는 public 아래 폴더 이름(저장소에는 올리지 않아요, .gitignore) */
export const RESIZED_DIR = "_resized";

/** 사본으로 만드는 그림 형식(확장자). GIF는 움직이는 그림일 수 있어 사본을 만들지 않아요. */
export const RESIZABLE = /\.(jpe?g|png|webp|avif)$/i;

/** 사본 하나: 너비와 주소 */
export type PhotoVariant = { width: number; url: string };

/**
 * 원본 너비에 맞는 사본 너비들. 원본의 90%를 넘는 너비는 만들지 않아요(거의 같은 크기라 받는 양이 별로 줄지 않아요).
 * @example variantWidths(1600); // [480, 800, 1200]
 * @example variantWidths(900);  // [480, 800]
 */
export function variantWidths(originalWidth: number): number[] {
  return PHOTO_WIDTHS.filter((width) => width <= originalWidth * 0.9);
}

/**
 * 원고에 적은 사진 주소 → 사본 주소. %로 바꾼 글자(한글 파일 이름 등)는 그대로 둬요(브라우저가 같은 파일을 찾아요).
 * @example variantUrl("/images/a/scene-1.jpg", 480); // "/_resized/480/images/a/scene-1.jpg.webp"
 */
export function variantUrl(src: string, width: number): string {
  // new URL(...).pathname: ?나 # 뒤를 떼어 낸 주소
  const { pathname } = new URL(src, "http://localhost");
  return `/${RESIZED_DIR}/${width}${pathname}.webp`;
}

/**
 * 사본 파일의 public 기준 경로. 원본의 public 기준 경로(%를 풀어 둔 실제 파일 이름)를 받아요.
 * @example variantFile("images/a/scene-1.jpg", 480); // "_resized/480/images/a/scene-1.jpg.webp"
 */
export function variantFile(publicPath: string, width: number): string {
  return `${RESIZED_DIR}/${width}/${publicPath}.webp`;
}

/**
 * 브라우저에게 "이 사진이 화면에서 얼마나 크게 보이는지" 알려 주는 sizes 글. 브라우저는 이 너비와 화소 밀도로 사본을 골라요.
 *
 * 상세 화면 본문 칸의 너비(app/layout.tsx의 main 안쪽 여백, components/review-article.tsx의 두 칸)
 *   - 1024px 이상: 화면 − 양옆 여백 3rem×2 − 왼쪽 칸 18rem − 칸 사이 3rem = 100vw − 27rem
 *   - 640px 이상: 화면 − 양옆 여백 2rem×2 = 100vw − 4rem
 *   - 그보다 좁으면: 화면 − 양옆 여백 1rem×2 = 100vw − 2rem
 * 사진 액자는 그중 가장 작은 값이에요(globals.css의 .photo-frame과 같아요).
 *   - 칸 너비, 원본 너비(작은 사진을 늘리지 않음), 화면 높이 80% × 비율(세로로 긴 사진)
 * 나란히 놓인 사진(photo-row)은 640px 이상에서 칸을 둘로 나눠 써요(사이 1.5rem). 세 장 이상이면 조금 크게 잡혀도 괜찮아요.
 *
 * @param size 원본 크기(가로·세로)
 * @param inRow 나란히 놓인 사진인지
 */
export function photoSizes({ width, height }: { width: number; height: number }, inRow = false): string {
  // 세로로 긴 사진이 화면 높이의 80%를 넘지 않게 줄어드는 너비(80vh × 가로/세로)
  const byHeight = `calc(80vh * ${(width / height).toFixed(4)})`;
  /** 칸 너비(column)와 원본 너비·높이 제한 가운데 가장 작은 값 */
  const fit = (column: string) => `min(${column}, ${width}px, ${byHeight})`;
  const wide = inRow ? "calc((100vw - 28.5rem) / 2)" : "calc(100vw - 27rem)";
  const medium = inRow ? "calc((100vw - 5.5rem) / 2)" : "calc(100vw - 4rem)";
  return `(min-width: 1024px) ${fit(wide)}, (min-width: 640px) ${fit(medium)}, ${fit("calc(100vw - 2rem)")}`;
}
