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
 * zod가 뭔가요?
 *   데이터가 정해진 모양인지 검사해 주는 라이브러리예요. 규칙을 한 번 적어 두면
 *   `schema.safeParse(데이터)`로 검사하고, 통과하면 깔끔하게 정리된 데이터를 돌려줍니다.
 *   TypeScript 타입은 "코드를 쓸 때" 검사하고, zod는 "프로그램이 돌 때 들어온 데이터"를 검사해요.
 *   원고 파일은 사람이 손으로 쓰니 실행할 때 검사하는 zod가 필요합니다.
 *
 * 누가 쓰나요?
 *   - lib/load-reviews.ts가 빌드할 때 원고를 읽으며 이 규칙으로 검사합니다.
 *     검사에 실패하면 빌드가 멈추고, 아래 문구들이 터미널(또는 배포 기록)에 보여요.
 *   - lib/review-form.ts가 글쓰기 화면의 입력값을 같은 규칙으로 검사해요(화면과 서버 둘 다).
 *     규칙이 한 곳에 있어서, 화면에서 통과한 글은 빌드에서도 통과해요.
 */

import { z } from "zod";

import { GENRES } from "./genres";

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
 * "비어 있지 않은 글자" 규칙을 만드는 작은 도우미 함수예요. 같은 규칙을 여러 항목에 쓰려고 만들었어요.
 *
 * - z.string(): 글자여야 해요. 글자가 아니면 { error } 문구를 보여 줍니다.
 * - .trim(): 앞뒤 공백을 지운 뒤 검사해요. "   "(공백만)은 빈 글자가 됩니다.
 * - .min(1): 한 글자 이상이어야 해요.
 */
export const text = (message: string) => z.string({ error: message }).trim().min(1, { error: message });

/**
 * 평점 규칙: 0.5부터 5까지 0.5 단위 숫자예요(0점은 없어요).
 *
 * - z.number(): 숫자여야 해요. 따옴표로 감싼 "4.5"는 글자라서 실패합니다.
 * - .multipleOf(0.5): 0.5의 배수여야 해요. 4.3 같은 값을 막습니다.
 */
export const ratingSchema = (message: string) =>
  z.number({ error: message }).min(0.5, { error: message }).max(5, { error: message }).multipleOf(0.5, { error: message });

/**
 * 원고에 날짜를 쓰는 방식은 사람마다 조금씩 달라요.
 * YAML이 날짜를 Date 객체로 읽어 오는 경우가 있어서, 검사 전에 "YYYY-MM-DD" 글자로 맞춰 줍니다.
 *
 * - `value instanceof Date`: value가 Date 객체인지 확인해요.
 * - toISOString()은 "2026-10-05T00:00:00.000Z" 같은 글자를 돌려주므로 앞 10글자만 잘라 씁니다.
 */
const toIsoDate = (value: unknown) => (value instanceof Date ? value.toISOString().slice(0, 10) : value);

/**
 * 날짜 규칙. z.preprocess(먼저 할 일, 규칙)는 "검사 전에 값을 먼저 손보고 나서 규칙을 적용"해요.
 * z.iso.date()는 "YYYY-MM-DD 모양의 실제 날짜 글자"인지 확인합니다.
 */
const isoDate = (message: string) => z.preprocess(toIsoDate, z.iso.date({ error: message }));

/**
 * 리뷰 원고 맨 위 정보 영역의 검사 규칙입니다.
 *
 * z.strictObject({ ... })는 "이 항목들만 있는 객체"라는 뜻이에요.
 * 목록에 없는 항목(오타 등)이 있으면 실패합니다. 그냥 z.object였다면 오타를 조용히 무시했을 거예요.
 *
 * .optional()이 붙은 항목은 없어도 됩니다.
 */
export const reviewFrontmatterSchema = z.strictObject(
  {
    title: text(MESSAGE.title),
    originalTitle: text(MESSAGE.originalTitle).optional(),

    // z.int(): 정수여야 해요. .min/.max로 범위를 정합니다(1888년은 최초의 영화가 찍힌 해예요).
    year: z.int({ error: MESSAGE.year }).min(1888, { error: MESSAGE.year }).max(2100, { error: MESSAGE.year }),

    country: text(MESSAGE.country).optional(),

    // 감독이 여러 명이라 목록([A, B])으로 적었다면, 검사 전에 "A, B" 한 줄로 이어 줍니다.
    // Array.isArray(value)는 value가 배열인지 확인하고, join(", ")은 배열을 쉼표로 이어 글자로 만들어요.
    director: z.preprocess((value) => (Array.isArray(value) ? value.join(", ") : value), text(MESSAGE.director)),

    runtime: z.int({ error: MESSAGE.runtime }).min(1, { error: MESSAGE.runtime }).optional(),

    // 장르가 하나뿐이라 괄호 없이 `genres: 드라마`로 적어도 받아 줍니다. 검사 전에 ["드라마"]로 감싸요.
    genres: z.preprocess(
      (value) => (typeof value === "string" ? [value] : value),
      z
        // 배열(z.array)의 칸마다 장르 목록(z.enum(GENRES)) 안의 이름인지 검사해요.
        .array(
          z.enum(GENRES, {
            // error에 함수를 주면, 틀린 값(issue.input)을 문구에 넣어 보여 줄 수 있어요.
            error: (issue) =>
              `genres(장르)의 "${String(issue.input)}"은(는) 쓸 수 있는 장르가 아닙니다. 쓸 수 있는 장르: ${GENRES.join(", ")}`,
          }),
          { error: MESSAGE.genres },
        )
        // 적어도 하나는 있어야 해요.
        .min(1, { error: MESSAGE.genres })
        // .refine(조건)은 직접 만든 조건으로 검사해요.
        // new Set(list)는 중복을 없앤 묶음이라, 크기가 원래 배열과 다르면 같은 장르가 두 번 들어 있다는 뜻입니다.
        .refine((list) => new Set(list).size === list.length, { error: MESSAGE.genresDuplicate }),
    ),

    // 평점 규칙은 위의 ratingSchema(0.5~5, 0.5 단위)를 써요.
    rating: ratingSchema(MESSAGE.rating),

    oneLiner: text(MESSAGE.oneLiner),
    publishedAt: isoDate(MESSAGE.publishedAt),

    // .regex(정규식): 글자가 정규식 모양과 맞아야 해요. 파일이 정말 있는지는 원고를 읽을 때 따로 확인해요(lib/load-reviews.ts).
    // 포스터를 "/posters/winter-stop.jpg"처럼 경로까지 적어도 받아 줘요. 앞의 /posters/를 떼어 파일 이름만 남긴 뒤 검사해요.
    poster: z
      .preprocess(
        (value) => (typeof value === "string" ? value.replace(/^\/posters\//, "") : value),
        z.string({ error: MESSAGE.poster }).regex(POSTER_FILE, { error: MESSAGE.poster }),
      )
      .optional(),
    posterAlt: text(MESSAGE.posterAlt).optional(),
  },
  {
    // 객체 전체에 대한 오류 문구예요. 목록에 없는 항목(unrecognized_keys)이 있을 때만 우리 문구를 쓰고,
    // 그 밖의 경우에는 undefined를 돌려 위에서 항목마다 정한 문구를 그대로 쓰게 합니다.
    error: (issue) =>
      issue.code === "unrecognized_keys"
        ? `알 수 없는 항목입니다: ${issue.keys.join(", ")}. 이름에 오타가 없는지 확인하세요. 쓸 수 있는 항목: ${FRONTMATTER_KEYS.join(", ")}`
        : undefined,
  },
);

/**
 * 검사를 통과한 뒤의 데이터 타입이에요.
 * z.output<typeof 규칙>은 "이 규칙을 통과한 결과의 타입"을 zod가 알아서 만들어 줍니다.
 * (예: 감독을 [A, B] 목록으로 적었어도 결과에서는 "A, B" 글자 하나예요.)
 */
export type ReviewFrontmatter = z.output<typeof reviewFrontmatterSchema>;

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
