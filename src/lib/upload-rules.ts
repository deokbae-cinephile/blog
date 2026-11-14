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

/** 파일 앞부분으로 알아낼 수 있는 그림 형식(모든 브라우저가 보여 줄 수 있는 것만) */
export type ImageType = "jpg" | "png" | "gif" | "webp" | "avif";

/** 글자 몇 개를 바이트(글자 번호)로 바꿔 파일 앞부분과 견줘요. */
const ascii = (bytes: Uint8Array, start: number, text: string) =>
  text.split("").every((char, index) => bytes[start + index] === char.charCodeAt(0));

/**
 * 파일 앞부분(형식마다 정해진 "서명" 바이트)을 보고 실제 그림 형식을 알아내요. 모르는 형식이면 undefined예요.
 * 확장자는 바꿔 붙일 수 있어서, 사진 올리기 API가 진짜 그림인지 확인할 때 써요(큰 라이브러리 없이 몇 바이트만 봐요).
 *
 *   JPG  : FF D8 FF
 *   PNG  : 89 50 4E 47 0D 0A 1A 0A ("\x89PNG\r\n\x1a\n")
 *   GIF  : "GIF87a" 또는 "GIF89a"
 *   WebP : "RIFF" + (크기 4바이트) + "WEBP"
 *   AVIF : (상자 크기 4바이트) + "ftyp" + 상표 목록에 "avif" 또는 "avis"
 *          아이폰 사진(HEIC)도 같은 ftyp 모양이지만 상표가 "heic" 등이라 걸러져요.
 *
 * @param bytes 파일 내용(앞부분만 있어도 돼요)
 * @example sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])); // "jpg"
 */
export function sniffImageType(bytes: Uint8Array): ImageType | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)) return "png";
  if (ascii(bytes, 0, "GIF87a") || ascii(bytes, 0, "GIF89a")) return "gif";
  if (ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP")) return "webp";
  if (ascii(bytes, 4, "ftyp")) {
    // ftyp 상자의 크기(앞 4바이트, 큰 자리부터)만큼 안에서 상표(4글자씩)를 찾아요: 8번째 바이트부터 주 상표, 16번째부터 함께 쓰는 상표들.
    const boxSize = (((bytes[0] ?? 0) << 24) | ((bytes[1] ?? 0) << 16) | ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0)) >>> 0;
    const end = Math.min(boxSize, bytes.length);
    for (let offset = 8; offset + 4 <= end; offset += offset === 8 ? 8 : 4) {
      if (ascii(bytes, offset, "avif") || ascii(bytes, offset, "avis")) return "avif";
    }
  }
  return undefined;
}

/** 큰 자리부터 읽는 2바이트·4바이트 수(PNG·JPEG 머리) */
const u16be = (bytes: Uint8Array, at: number) => ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0);
const u32be = (bytes: Uint8Array, at: number) => ((u16be(bytes, at) << 16) | u16be(bytes, at + 2)) >>> 0;
/** 작은 자리부터 읽는 2바이트 수(GIF 머리) */
const u16le = (bytes: Uint8Array, at: number) => (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);

/**
 * JPEG 안에 그림 틀(SOF: 가로·세로를 적는 덩어리)이 있는지 봐요. 덩어리(마커 FF xx + 길이)를 차례로 건너뛰며 찾아요.
 * 그림 데이터(SOS)나 끝(EOI)이 먼저 나오거나, 모양이 틀어지면 false예요.
 */
function jpegHasFrame(bytes: Uint8Array): boolean {
  let at = 2; // FF D8(시작) 다음부터
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) return false;
    const marker = bytes[at + 1]!;
    // 채움 바이트(FF FF …)와 길이 없는 표시(RSTn D0~D7, TEM 01)는 2바이트만 건너뛰어요.
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      at += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return false;
    // SOF0~SOF15(C0~CF) 가운데 C4(DHT)·C8(JPG)·CC(DAC)는 그림 틀이 아니에요.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return at + 9 <= bytes.length && u16be(bytes, at + 5) > 0 && u16be(bytes, at + 7) > 0;
    }
    const length = u16be(bytes, at + 2);
    if (length < 2) return false;
    at += 2 + length;
  }
  return false;
}

/** 글자(4글자)가 파일 앞부분(처음 limit바이트) 어딘가에 있는지 */
function containsAscii(bytes: Uint8Array, text: string, limit = 64 * 1024): boolean {
  const end = Math.min(bytes.length, limit) - text.length;
  for (let at = 0; at <= end; at += 1) if (ascii(bytes, at, text)) return true;
  return false;
}

/**
 * 진짜 그림인지 확인해요: 서명으로 형식을 알아낸 뒤(sniffImageType), 그 형식의 머리(헤더)가 제대로 있는지도 봐요.
 * 서명만 맞고 내용이 없는 파일(예: PNG 서명 8바이트뿐인 파일)은 화면에 보이지 않으니 받지 않아요.
 *
 *   PNG  : 첫 덩어리가 IHDR이고 가로·세로가 0보다 커요.
 *   GIF  : 서명 뒤 가로·세로가 0보다 커요.
 *   WebP : RIFF 머리 뒤 첫 덩어리가 VP8·VP8L·VP8X예요.
 *   JPEG : 그림 틀(SOF)이 있고 가로·세로가 0보다 커요.
 *   AVIF : 그림 크기 상자(ispe)가 있어요.
 *
 * @param bytes 파일 내용 전체
 * @returns 진짜 그림이면 형식, 아니면 undefined
 */
export function checkImage(bytes: Uint8Array): ImageType | undefined {
  const type = sniffImageType(bytes);
  let ok = false;
  if (type === "png") ok = bytes.length >= 33 && ascii(bytes, 12, "IHDR") && u32be(bytes, 16) > 0 && u32be(bytes, 20) > 0;
  else if (type === "gif") ok = bytes.length >= 13 && u16le(bytes, 6) > 0 && u16le(bytes, 8) > 0;
  else if (type === "webp") ok = bytes.length >= 30 && ["VP8 ", "VP8L", "VP8X"].some((chunk) => ascii(bytes, 12, chunk));
  else if (type === "jpg") ok = jpegHasFrame(bytes);
  else if (type === "avif") ok = containsAscii(bytes, "ispe");
  return ok ? type : undefined;
}
