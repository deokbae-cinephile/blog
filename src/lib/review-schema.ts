/**
 * @file 리뷰 원고 검사 규칙 (review-schema.ts)
 *
 * 이 파일이 하는 일
 *   리뷰 원고 맨 위의 정보 영역(frontmatter, `---`와 `---` 사이)이 올바르게 쓰였는지 검사하는 "규칙"을 정합니다.
 *
 * 맡은 기능
 *   - 꼭 있어야 하는 항목(제목, 감독, 평점 등)이 빠졌는지 확인
 *   - 값의 모양 확인: 평점은 0.5 단위 숫자인지, 날짜는 YYYY-MM-DD인지, 장르는 목록에 있는지,
 *     포스터 파일 이름이 올바른지
 *   - 원고 파일 이름(= 주소)의 모양 규칙(SLUG)
 *   - 문제가 있으면 "무엇이 틀렸고 어떻게 고치는지" 알려 주는 한국어 문구 준비
 *
 * 검사는 어떻게 하나요?
 *   원고는 사람이 손으로 쓸 수도 있어서, 프로그램이 돌 때 들어온 값을 하나하나 확인해요(checkFrontmatter).
 *   TypeScript 타입은 "코드를 쓸 때"만 검사해서, 실행할 때 들어오는 원고 값은 이렇게 직접 확인해야 해요.
 *   예전에는 검사 라이브러리(zod)를 썼지만, 블로그를 가볍게 하려고 같은 규칙을 직접 짰어요(문구와 순서도 같아요).
 *
 * 누가 쓰나요?
 *   - lib/load-reviews.ts가 빌드할 때 원고를 읽으며 이 규칙으로 검사합니다.
 *     검사에 실패하면 빌드가 멈추고, 아래 문구들이 터미널(또는 배포 기록)에 보여요.
 *   - lib/review-form.ts가 글쓰기 화면의 입력값을 같은 규칙으로 검사해요(화면과 서버 둘 다).
 *     규칙이 한 곳에 있어서, 화면에서 통과한 글은 빌드에서도 통과해요.
 */

import { GENRES, type Genre } from "./genres";

/**
 * 원고 맨 위에 쓸 수 있는 항목 이름들.
 * 오타(예: ratting)를 쓰면 "쓸 수 있는 항목"으로 이 목록을 보여 줍니다.
 */
export const FRONTMATTER_KEYS = [
  "title",
  "originalTitle",
  "year",
  "country",
  "director",
  "runtime",
  "genres",
  "rating",
  "oneLiner",
  "publishedAt",
  "poster",
  "posterAlt",
] as const;

/**
 * 검사에 실패했을 때 보여 줄 문구들.
 *
 * 좋은 오류 문구는 "무엇이 틀렸는지"와 "어떻게 고치는지(예시)"를 함께 알려 줘요.
 * 글쓴이가 개발자가 아니어도 오류 문구만 보고 원고를 고칠 수 있게 하려는 거예요.
 */
const MESSAGE = {
  title: "title(한국어 제목)을 적어 주세요. 예: title: 겨울 정류장",
  originalTitle: "originalTitle(원제)은 글자로 적습니다. 원제가 없으면 그 줄을 지웁니다. 예: originalTitle: Winter Stop",
  year: "year(개봉 연도)는 숫자 네 자리로 적습니다. 예: year: 2024",
  country: "country(제작 국가)는 글자로 적습니다. 예: country: 한국",
  director: "director(감독)를 적어 주세요. 여러 명이면 쉼표로 나눕니다. 예: director: 한서윤",
  runtime: "runtime(상영 시간)은 분 단위 숫자로 적습니다. 예: runtime: 112",
  genres: "genres(장르)를 하나 이상 적어 주세요. 예: genres: [드라마, 로맨스]",
  genresDuplicate: "genres(장르)에 같은 장르를 두 번 적었습니다. 하나만 남겨 주세요.",
  rating: "rating(평점)은 0.5부터 5까지 0.5 단위 숫자로 적습니다(0점은 없습니다). 예: rating: 4.5",
  oneLiner: "oneLiner(한줄평)를 적어 주세요. 예: oneLiner: 눈이 그친 뒤에야 들리는 이야기",
  publishedAt: "publishedAt(글 쓴 날)은 YYYY-MM-DD 형식으로 적습니다. 예: publishedAt: 2026-10-05",
  poster:
    "poster(포스터)에는 public/posters 폴더에 넣은 파일 이름을 적습니다(앞에 /posters/를 붙여도 됩니다). 영어 소문자·숫자·하이픈과 확장자(jpg, jpeg, png, webp, avif)만 씁니다. 예: poster: winter-stop.jpg",
  posterAlt: "posterAlt(포스터 설명)는 글자로 적습니다. 없으면 그 줄을 지웁니다. 예: posterAlt: 눈 내리는 정류장에 앉은 두 사람",
} as const;

/**
 * 포스터 파일 이름의 모양(정규식)이에요.
 *   [a-z0-9]+(?:-[a-z0-9]+)*  : 영어 소문자·숫자를 하이픈으로 이은 이름 (원고 파일 이름과 같은 규칙)
 *   \.(?:jpe?g|png|webp|avif) : 점(.) 뒤에 jpg, jpeg, png, webp, avif 중 하나
 * 폴더 이름(../ 같은)을 못 쓰게 막아서, public/posters 밖의 파일을 가리킬 수 없어요.
 */
export const POSTER_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpe?g|png|webp|avif)$/;

/**
 * 원고 파일 이름(= 주소)이 따라야 하는 모양이에요(정규식).
 *
 * 읽는 법: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
 *   ^          처음부터
 *   [a-z0-9]+  영어 소문자나 숫자가 한 글자 이상
 *   (?:-[a-z0-9]+)*  "하이픈 + 소문자·숫자 묶음"이 0번 이상 반복
 *   $          끝까지
 *   → "winter-stop", "3am-store"는 통과, "Winter Stop", "겨울", "a--b"는 실패
 *
 * 원고 읽기(lib/load-reviews.ts)와 글쓰기 화면·저장 API(lib/review-form.ts)가 함께 써요.
 */
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * 검사를 통과한 원고 정보예요. 선택 항목(?가 붙은 것)은 원고에 적었을 때만 들어 있어요.
 * (감독을 [A, B] 목록으로 적었어도 여기서는 "A, B" 글자 하나예요.)
 */
export type ReviewFrontmatter = {
  title: string;
  originalTitle?: string;
  year: number;
  country?: string;
  director: string;
  runtime?: number;
  genres: Genre[];
  rating: number;
  oneLiner: string;
  publishedAt: string;
  poster?: string;
  posterAlt?: string;
};

/** 검사에서 찾은 문제 하나: 어느 항목인지(path, 예: "year")와 고치는 방법(message) */
export type FrontmatterIssue = { path: string; message: string };

/** 검사 결과: 통과하면 정리된 정보(value), 아니면 문제 목록(issues, 항목 순서대로) */
export type FrontmatterResult = { ok: true; value: ReviewFrontmatter } | { ok: false; issues: FrontmatterIssue[] };

/** 앞뒤 공백을 지우고 한 글자 이상인 글자면 그 글자, 아니면 null. "   "(공백만)은 빈 글자로 봐요. */
function filledText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** min 이상(max가 있으면 max 이하)의 정수면 true. 따옴표로 감싼 "2024"는 글자라서 false예요. */
function isIntIn(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

/**
 * 평점이 0.5부터 5까지 0.5 단위 숫자인지(0점은 없어요). 4.3처럼 0.5 단위가 아닌 값과 글자 "4.5"는 false예요.
 * 2를 곱해 정수가 되면 0.5 단위예요(4.5 × 2 = 9).
 */
export function isRating(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0.5 && value <= 5 && Number.isInteger(value * 2);
}

/**
 * "YYYY-MM-DD" 모양의 실제 날짜 글자면 그 글자, 아니면 null(2026-02-30처럼 없는 날도 null).
 * YAML이 날짜를 Date 객체로 읽어 오는 경우가 있어서, Date면 "YYYY-MM-DD"로 맞춰 줘요(toISOString의 앞 10글자).
 */
function isoDate(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  // 년·월·일로 날짜를 만들어 다시 읽었을 때 같은 날이면 실제로 있는 날짜예요(2월 30일은 3월 2일로 바뀌어 달라져요).
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : null;
}

/** 글자·숫자가 아닌 객체(배열 아님)인지. 원고 정보 영역은 "항목: 값"이 모인 객체여야 해요. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 리뷰 원고 맨 위 정보 영역을 검사해요.
 *
 * - 꼭 있어야 하는 항목이 빠졌거나 모양이 틀리면, 항목 순서대로 문제를 모두 모아 돌려줘요(한꺼번에 고칠 수 있게).
 * - 목록에 없는 항목(오타 등)이 있으면 맨 끝에 "알 수 없는 항목"으로 알려 줘요(조용히 무시하지 않아요).
 * - 손으로 쓰기 쉽게 몇 가지는 받아 줘요: 장르 하나를 괄호 없이 적기, 감독 여러 명을 목록으로 적기,
 *   포스터를 "/posters/파일"처럼 경로까지 적기(앞의 /posters/는 떼어요), YAML이 Date로 읽은 날짜.
 *
 * @param input 원고 정보 영역을 YAML로 읽은 값
 * @returns 통과하면 { ok: true, value }, 아니면 { ok: false, issues }
 * @example
 * checkFrontmatter({ title: "겨울 정류장" }); // { ok: false, issues: [{ path: "year", message: "year(개봉 연도)는 ..." }, ...] }
 */
export function checkFrontmatter(input: unknown): FrontmatterResult {
  // 객체가 아니면(비어 있는 정보 영역 등) 아무 항목도 없는 것으로 보고 빠진 항목을 알려 줘요.
  const data = isRecord(input) ? input : {};
  const issues: FrontmatterIssue[] = [];
  const fail = (path: string, message: string) => issues.push({ path, message });
  // 선택 항목: 원고에 적었을 때(undefined가 아닐 때)만 검사해요. YAML에서 값을 비워 둔 줄(null)은 틀린 값이에요.
  const has = (key: string) => data[key] !== undefined;

  const title = filledText(data.title);
  if (title === null) fail("title", MESSAGE.title);

  const originalTitle = has("originalTitle") ? filledText(data.originalTitle) : undefined;
  if (originalTitle === null) fail("originalTitle", MESSAGE.originalTitle);

  // 1888년은 최초의 영화가 찍힌 해예요.
  const year = isIntIn(data.year, 1888, 2100) ? data.year : null;
  if (year === null) fail("year", MESSAGE.year);

  const country = has("country") ? filledText(data.country) : undefined;
  if (country === null) fail("country", MESSAGE.country);

  // 감독이 여러 명이라 목록([A, B])으로 적었다면 "A, B" 한 줄로 이어 검사해요.
  const director = filledText(Array.isArray(data.director) ? data.director.join(", ") : data.director);
  if (director === null) fail("director", MESSAGE.director);

  const runtime = has("runtime") ? (isIntIn(data.runtime, 1) ? data.runtime : null) : undefined;
  if (runtime === null) fail("runtime", MESSAGE.runtime);

  // 장르: 하나뿐이라 괄호 없이 `genres: 드라마`로 적어도 받아 줘요. 칸마다 장르 목록(lib/genres.ts) 안의 이름인지 보고,
  // 모두 맞으면 하나 이상인지, 같은 장르를 두 번 적지 않았는지 봐요.
  const genreList = typeof data.genres === "string" ? [data.genres] : data.genres;
  let genres: Genre[] | null = null;
  if (!Array.isArray(genreList)) {
    fail("genres", MESSAGE.genres);
  } else {
    const wrong = genreList.filter((name) => !(GENRES as readonly unknown[]).includes(name));
    for (const name of wrong) {
      fail("genres", `genres(장르)의 "${String(name)}"은(는) 쓸 수 있는 장르가 아닙니다. 쓸 수 있는 장르: ${GENRES.join(", ")}`);
    }
    if (wrong.length === 0) {
      if (genreList.length === 0) fail("genres", MESSAGE.genres);
      // new Set(list)는 중복을 없앤 묶음이라, 크기가 원래 목록과 다르면 같은 장르가 두 번 들어 있다는 뜻이에요.
      else if (new Set(genreList).size !== genreList.length) fail("genres", MESSAGE.genresDuplicate);
      else genres = genreList as Genre[];
    }
  }

  const rating = isRating(data.rating) ? data.rating : null;
  if (rating === null) fail("rating", MESSAGE.rating);

  const oneLiner = filledText(data.oneLiner);
  if (oneLiner === null) fail("oneLiner", MESSAGE.oneLiner);

  const publishedAt = isoDate(data.publishedAt);
  if (publishedAt === null) fail("publishedAt", MESSAGE.publishedAt);

  // 포스터: 파일 이름 모양(POSTER_FILE)만 봐요. 파일이 정말 있는지는 원고를 읽을 때 따로 확인해요(lib/load-reviews.ts).
  // "/posters/winter-stop.jpg"처럼 경로까지 적어도 받아 줘요. 앞의 /posters/를 떼어 파일 이름만 남긴 뒤 검사해요.
  let poster: string | null | undefined;
  if (has("poster")) {
    const file = typeof data.poster === "string" ? data.poster.replace(/^\/posters\//, "") : null;
    poster = file !== null && POSTER_FILE.test(file) ? file : null;
    if (poster === null) fail("poster", MESSAGE.poster);
  }

  const posterAlt = has("posterAlt") ? filledText(data.posterAlt) : undefined;
  if (posterAlt === null) fail("posterAlt", MESSAGE.posterAlt);

  // 목록에 없는 항목(오타, 예전 원고의 watchedAt 등)은 한 줄로 모아 맨 끝에 알려요.
  const unknownKeys = Object.keys(data).filter((key) => !(FRONTMATTER_KEYS as readonly string[]).includes(key));
  if (unknownKeys.length > 0) {
    fail(
      "",
      `알 수 없는 항목입니다: ${unknownKeys.join(", ")}. 이름에 오타가 없는지 확인하세요. 쓸 수 있는 항목: ${FRONTMATTER_KEYS.join(", ")}`,
    );
  }

  if (issues.length > 0) return { ok: false, issues };
  // 여기까지 오면 필수 항목은 모두 채워졌어요(! 표시: null이 아님을 TypeScript에 알려 줘요).
  // 선택 항목은 적었을 때만 넣어요(...(조건 ? { 항목 } : {}) 모양).
  return {
    ok: true,
    value: {
      title: title!,
      ...(originalTitle ? { originalTitle } : {}),
      year: year!,
      ...(country ? { country } : {}),
      director: director!,
      ...(runtime ? { runtime } : {}),
      genres: genres!,
      rating: rating!,
      oneLiner: oneLiner!,
      publishedAt: publishedAt!,
      ...(poster ? { poster } : {}),
      ...(posterAlt ? { posterAlt } : {}),
    },
  };
}

/**
 * 본문 사진으로 받는 그림 형식(image-size가 알려 주는 이름). 모든 브라우저가 보여 줄 수 있는 형식만 골랐어요.
 * image-size는 TIFF, PSD(포토샵), HEIC(아이폰 사진)도 크기를 재 주지만, 브라우저 대부분이 보여 주지 못해 받지 않아요.
 * 원고 읽기(lib/load-reviews.ts)와 사진 올리기 API(app/api/images/route.ts)가 함께 써요.
 */
export const WEB_IMAGE_TYPES: ReadonlySet<string> = new Set(["jpg", "png", "gif", "webp", "avif"]);

/**
 * %EA%B2%A8처럼 바뀐 글자를 사람이 읽을 수 있게 되돌려요. 되돌릴 수 없는 모양이면 그대로 둬요.
 * 오류 문구에 사진 주소를 보여 줄 때 써요(한글 파일 이름이 알아볼 수 있게 나와요).
 */
export function safeDecode(src: string): string {
  try {
    return decodeURI(src);
  } catch {
    return src;
  }
}

/**
 * 본문 사진 하나(![설명](주소))의 설명과 주소 모양을 검사해요. 파일이 정말 있는지는 부르는 쪽이 따로 확인해요.
 *
 * 확인하는 것
 *   1. 설명(대체 텍스트)을 적었는지: ![여기](/images/a.jpg)가 비어 있으면 안 돼요.
 *      사진을 볼 수 없는 사람(화면 낭독기 사용자)에게 읽어 주는 글이라 꼭 필요해요.
 *   2. 사이트 안의 파일인지: /로 시작하는 주소만 받아요(public 폴더 기준).
 *      바깥 주소(https://...)는 그 사이트가 사진을 지우면 깨지고, 오프라인에서도 볼 수 없어서 받지 않아요.
 *   3. 주소에 ./ 이나 ../가 없는지: 있으면 엉뚱한 폴더를 가리킬 수 있어요.
 *
 * 누가 쓰나요?
 *   lib/load-reviews.ts(빌드할 때 원고 검사), lib/review-form.ts(글쓰기 화면과 저장 API)
 *
 * @param src 원고에 적은 사진 주소(한글은 %EA... 모양일 수 있어요)
 * @param alt 사진 설명
 * @returns messages: 고칠 곳 목록, pathOk: 주소 모양이 맞는지(맞아야 파일을 찾아볼 수 있어요)
 */
export function imageRefProblems(src: string, alt: string): { messages: string[]; pathOk: boolean } {
  // 오류 문구에 보여 줄 주소(한글을 읽을 수 있게 되돌린 모양)
  const shown = safeDecode(src);
  const messages: string[] = [];

  if (alt.trim() === "") {
    messages.push(`사진 ${shown}에 설명을 적어 주세요. 사진을 볼 수 없는 사람에게 읽어 주는 글입니다. 예: ![영사실 창으로 새어 나오는 빛](${shown})`);
  }

  // //로 시작하는 주소는 "다른 사이트"라는 뜻이라 함께 막아요(//example.com/a.jpg).
  if (!src.startsWith("/") || src.startsWith("//")) {
    messages.push(
      `사진 ${shown}: 사진은 public 폴더에 넣고 /로 시작하는 주소로 적어 주세요. 예: public/images/winter-stop/scene.jpg → /images/winter-stop/scene.jpg`,
    );
    return { messages, pathOk: false };
  }

  // new URL(...).pathname은 ?나 # 뒤를 떼어 내고, ./ 이나 ../ 구간을 풀어서 정리한 주소를 줘요.
  // 정리한 주소가 적은 주소와 다르면 ./ 이나 ../가 들어 있다는 뜻이에요. 그래서 처음부터 막아요.
  const { pathname } = new URL(src, "http://localhost");
  if (pathname !== src.replace(/[?#].*$/, "")) {
    messages.push(`사진 ${shown}: 주소에 ./ 이나 ../를 쓰지 말고 /images/...처럼 처음부터 적어 주세요.`);
    return { messages, pathOk: false };
  }

  return { messages, pathOk: true };
}
