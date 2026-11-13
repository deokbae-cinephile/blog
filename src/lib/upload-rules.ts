/**
 * @file 사진 올리기 규칙 (upload-rules.ts)
 *
 * 이 파일이 하는 일
 *   포스터와 장면 사진을 올릴 때의 규칙(최대 크기, 받는 형식, 저장 경로 모양)을 한곳에 모아 둬요.
 *   글쓰기 화면은 고르자마자 이 규칙으로 먼저 알려 주고, 사진 올리기 API는 같은 규칙으로 다시 확인해요.
 *
 * 누가 쓰나요?
 *   components/review-writer.tsx(화면), app/api/images/route.ts(서버)
 */

/**
 * 사진 한 장의 최대 크기: 4MB. 블로그 사진으로 넉넉하면서, 요청 하나가 하는 일(CPU·메모리)이
 * Cloudflare Workers 한도 안에 머물게 정했어요. 다른 호스팅의 요청 크기 한도(Vercel 4.5MB 등)에도 들어가요.
 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** 포스터로 받는 확장자(움직이는 GIF는 포스터로 받지 않아요) */
export const POSTER_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif"] as const;

/** 장면 사진으로 받는 확장자 */
export const SCENE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "avif"] as const;

/** 파일 고르기 창에 "이 형식만 보여 줘"라고 알려 줄 값(<input accept>) */
export const POSTER_ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
export const SCENE_ACCEPT = "image/jpeg,image/png,image/gif,image/webp,image/avif";

/**
 * 받을 수 있는 저장 경로 모양이에요.
 *   - 포스터: public/posters/<주소>.<jpg|jpeg|png|webp|avif>
 *   - 장면 사진: public/images/<주소>/<이름>.<jpg|jpeg|png|gif|webp|avif>
 * 이 리뷰의 경로가 맞는지는 저장할 때 lib/review-store.ts가 주소와 함께 다시 확인해요.
 */
export const UPLOAD_PATH =
  /^public\/(?:posters\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpe?g|png|webp|avif)|images\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpe?g|png|gif|webp|avif))$/;

/**
 * 파일 이름에서 확장자를 소문자로 꺼내요. 확장자가 없으면 ""예요.
 * @example extensionOf("Poster.JPG"); // "jpg"
 */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/**
 * 고른 파일을 받을 수 있는지 확인하고, 안 되면 이유와 고치는 방법을 돌려줘요. 되면 null이에요.
 *
 * @param file 고른 파일(이름과 크기만 봐요. 진짜 그림인지는 서버가 파일 앞부분을 읽어 확인해요)
 * @param kind "poster"(포스터) 또는 "scene"(장면 사진)
 */
export function uploadProblem(file: { name: string; size: number }, kind: "poster" | "scene"): string | null {
  const allowed: readonly string[] = kind === "poster" ? POSTER_EXTENSIONS : SCENE_EXTENSIONS;
  if (!allowed.includes(extensionOf(file.name))) {
    return kind === "poster"
      ? `${file.name}: 포스터는 JPG·PNG·WebP·AVIF 그림만 넣을 수 있습니다. 아이폰 사진(HEIC)은 JPG로 바꿔 넣어 주세요.`
      : `${file.name}: 장면 사진은 JPG·PNG·GIF·WebP·AVIF 그림만 넣을 수 있습니다. 아이폰 사진(HEIC)은 JPG로 바꿔 넣어 주세요.`;
  }
  if (file.size > MAX_IMAGE_BYTES) return `${file.name}: 사진이 4MB보다 큽니다. 사진 크기를 줄여 다시 넣어 주세요.`;
  return null;
}
