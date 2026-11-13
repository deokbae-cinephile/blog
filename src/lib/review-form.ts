/**
 * @file 글쓰기 칸 검사 (review-form.ts)
 *
 * 이 파일이 하는 일
 *   글쓰기 화면의 칸 값(제목, 연도, 평점, 본문 ...)이 올바른지 검사하고,
 *   틀린 칸마다 "무엇이 틀렸고 어떻게 고치는지" 알려 주는 문구를 돌려줘요.
 *
 * 화면과 서버가 같은 검사를 해요
 *   - 화면(components/review-writer.tsx): 저장 단추를 누르면 서버에 보내기 전에 먼저 검사해요. 틀린 칸을 바로 알려 줘요.
 *   - 서버(lib/review-store.ts): 화면을 거치지 않은 요청도 있을 수 있어서, 저장하기 전에 한 번 더 검사해요.
 *   검사 규칙의 바탕은 빌드할 때 원고를 검사하는 규칙(lib/review-schema.ts)과 같아요.
 *   그래서 글쓰기 화면에서 통과한 글은 빌드에서도 통과하고, 잘못된 글 때문에 배포가 멈추는 일이 없어요.
 *
 * 원고 검사 문구와 다른 점
 *   원고 검사 문구는 파일을 직접 쓰는 사람용이라 "title: 겨울 정류장"처럼 YAML 예시를 보여 줘요.
 *   여기서는 칸에 입력하는 사람용으로 "제목을 입력하세요"처럼 칸 이름으로 말해요.
 */

import type { ReviewFormValues } from "./review-file";
import { imageRefProblems, type ReviewFrontmatter, reviewFrontmatterSchema, SLUG } from "./review-schema";

/** 칸 이름 → 그 칸의 오류 문구. 오류가 없는 칸은 들어 있지 않아요. */
export type FieldErrors = Partial<Record<keyof ReviewFormValues, string>>;

/** 칸마다 보여 줄 오류 문구. 원인과 고치는 방법(예시)을 함께 적어요. */
export const FIELD_MESSAGES: Record<keyof ReviewFormValues, string> = {
  slug: "주소는 영어 소문자, 숫자, 하이픈(-)으로만 적어 주세요. 예: winter-stop",
  title: "제목을 입력하세요. 예: 겨울 정류장",
  originalTitle: "원제는 글자로 입력하세요. 원제가 없으면 비워 둡니다.",
  year: "개봉 연도는 1888부터 2100 사이의 숫자 네 자리로 입력하세요. 예: 2024",
  country: "제작 국가는 글자로 입력하세요. 없으면 비워 둡니다.",
  director: "감독을 입력하세요. 여러 명이면 쉼표로 나눕니다. 예: 한서윤, 김도윤",
  runtime: "상영 시간은 1 이상의 분 단위 숫자로 입력하세요. 모르면 비워 둡니다. 예: 112",
  genres: "장르를 하나 이상 고르세요.",
  rating: "평점을 고르세요. 0.5점부터 5점까지 0.5점 단위입니다.",
  oneLiner: "한줄평을 입력하세요. 예: 버스는 오지 않아도, 기다림은 끝내 도착한다.",
  poster: "포스터 파일 이름이 올바르지 않습니다. 포스터를 다시 골라 주세요.",
  posterAlt: "포스터 설명은 글자로 입력하세요. 없으면 비워 둡니다.",
  publishedAt: "글 쓴 날이 날짜 모양(YYYY-MM-DD)이 아닙니다. 불러온 원고의 publishedAt을 고친 뒤 다시 불러오세요.",
  body: "본문을 확인해 주세요.",
};

/** 검사 결과: 통과하면 원고에 넣을 정보(frontmatter), 아니면 칸별 오류 */
export type FormCheck = { ok: true; frontmatter: ReviewFrontmatter } | { ok: false; errors: FieldErrors };

/**
 * 오늘 날짜를 한국 시간 기준 "YYYY-MM-DD"로 돌려줘요. 새 리뷰의 "글 쓴 날"에 넣어요.
 *
 * 서버는 다른 나라 시간대에 있을 수 있어서(timeZone 지정 없이 쓰면 한국의 새벽이 전날이 될 수 있어요),
 * 시간대를 "Asia/Seoul"로 정해 계산해요. "sv-SE"(스웨덴) 날짜 모양이 마침 YYYY-MM-DD라서 빌려 써요.
 *
 * @param now 기준 시각. 테스트에서 시각을 정해 넣으려고 받아요. 기본은 지금
 */
export function todayInSeoul(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(now);
}

/** 입력란의 숫자 글자를 숫자로 바꿔요. 숫자 모양이 아니면 글자 그대로 두어, 검사가 "숫자가 아니에요"라고 알려 주게 해요. */
function toNumber(text: string): number | string {
  const trimmed = text.trim();
  return /^\d+(?:\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed;
}

/**
 * Markdown 본문에서 사진(![설명](주소 "캡션"))을 찾는 정규식이에요. 화면에서 빠르게 검사하려고 쓰는 간단한 판이에요.
 * (서버는 저장하기 전에 Markdown 변환 도구로 더 정확하게 한 번 더 찾아요. lib/review-store.ts)
 *   !\[([^\]]*)\]        : ![설명] — 설명은 ] 앞까지
 *   \(\s*<?([^\s)>]+)>?  : (주소 — 공백이나 ) 앞까지. <주소>처럼 꺾쇠로 감싸도 돼요.
 *   (?:\s+("..."|'...'|(...)))? : 캡션(없어도 돼요)
 */
const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(\s*<?([^\s)>]+)>?(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;

/**
 * 본문에 넣은 사진의 주소와 설명을 모두 찾아요(간단한 판).
 *
 * @example
 * findBodyImages("![영사실](/images/a/booth.jpg)"); // [{ src: "/images/a/booth.jpg", alt: "영사실" }]
 */
export function findBodyImages(markdown: string): { src: string; alt: string }[] {
  // matchAll: 정규식에 맞는 곳을 모두 찾아요. 각 결과의 [1]은 설명, [2]는 주소예요.
  return [...markdown.matchAll(MARKDOWN_IMAGE)].map((match) => ({ alt: match[1] ?? "", src: match[2] ?? "" }));
}

/** 칸 값을 원고 정보 모양으로 바꿔요(아직 검사 전). 비워 둔 선택 칸은 아예 넣지 않아요. */
function toFrontmatterInput(values: ReviewFormValues, publishedAt: string): Record<string, unknown> {
  const input: Record<string, unknown> = {
    title: values.title,
    year: toNumber(values.year),
    director: values.director,
    genres: values.genres,
    // 평점을 고르지 않았으면("") 숫자가 아니라서 검사가 평점 문구를 보여 줘요.
    rating: values.rating === "" ? undefined : toNumber(values.rating),
    oneLiner: values.oneLiner,
    publishedAt,
  };
  // 선택 칸: 무엇이든 적었을 때만 넣어요. (trim(): 공백만 친 칸은 빈 칸으로 봐요)
  if (values.originalTitle.trim() !== "") input.originalTitle = values.originalTitle;
  if (values.country.trim() !== "") input.country = values.country;
  if (values.runtime.trim() !== "") input.runtime = toNumber(values.runtime);
  if (values.poster.trim() !== "") input.poster = values.poster;
  if (values.posterAlt.trim() !== "") input.posterAlt = values.posterAlt;
  return input;
}

/**
 * 글쓰기 칸을 모두 검사해요.
 *
 * @param values 칸 값
 * @param options.checkSlug 주소(영문)도 검사할지. 새 글이면 true(고치기 화면은 주소를 바꾸지 않아요)
 * @param options.today "글 쓴 날"이 비어 있을 때 넣을 날짜. 기본은 오늘(한국 시간)
 * @returns 통과하면 { ok: true, frontmatter }, 아니면 { ok: false, errors }
 * @example
 * validateReviewForm({ ...EMPTY_VALUES, title: "겨울 정류장" }, { checkSlug: true });
 * // { ok: false, errors: { slug: "...", year: "...", director: "...", ... } }
 */
export function validateReviewForm(
  values: ReviewFormValues,
  { checkSlug, today = todayInSeoul() }: { checkSlug: boolean; today?: string },
): FormCheck {
  const errors: FieldErrors = {};

  // 1) 주소: 파일 이름이 되는 값이라 원고 파일 이름 규칙(SLUG)을 따라요.
  if (checkSlug && !SLUG.test(values.slug)) errors.slug = FIELD_MESSAGES.slug;

  // 2) 정보 칸: 빌드할 때와 같은 규칙(reviewFrontmatterSchema)으로 검사하고, 틀린 칸에는 칸 이름으로 된 문구를 달아요.
  const parsed = reviewFrontmatterSchema.safeParse(toFrontmatterInput(values, values.publishedAt.trim() || today));
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      // issue.path[0]: 어느 항목이 틀렸는지(예: "year"). 칸 이름과 같아요.
      const key = issue.path[0];
      // `??=`: 그 칸에 문구가 아직 없을 때만 넣어요(한 칸에 문제가 여러 개여도 문구는 하나).
      if (typeof key === "string" && key in FIELD_MESSAGES) errors[key as keyof ReviewFormValues] ??= FIELD_MESSAGES[key as keyof ReviewFormValues];
    }
  }

  // 3) 본문 사진: 설명을 적었는지, 주소 모양이 맞는지(빌드할 때와 같은 규칙, lib/review-schema.ts)
  const imageMessages = findBodyImages(values.body).flatMap(({ src, alt }) => imageRefProblems(src, alt).messages);
  if (imageMessages.length > 0) errors.body = imageMessages.join(" ");

  if (Object.keys(errors).length > 0 || !parsed.success) return { ok: false, errors };
  return { ok: true, frontmatter: parsed.data };
}
