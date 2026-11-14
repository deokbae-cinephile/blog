/**
 * @file 리뷰 원고 파일 읽기·쓰기 (review-file.ts)
 *
 * 이 파일이 하는 일
 *   리뷰 원고(.md)는 맨 위의 정보 영역(frontmatter)과 그 아래 본문(Markdown)으로 되어 있어요.
 *
 *     ---
 *     title: 겨울 정류장        ← 정보 영역(YAML)
 *     rating: 4.5
 *     ---
 *
 *     본문 첫 문단...           ← 본문(Markdown)
 *
 *   이 파일은 원고 글자 ↔ 글쓰기 화면의 칸(제목, 평점, 본문 ...)을 서로 바꿔 줘요.
 *     - parseReviewFile: 원고 글자 → 칸 값. "리뷰 수정" 화면(서버)이 저장소의 원고를 읽을 때 써요.
 *     - serializeReviewFile: 검사를 통과한 칸 값 → 원고 글자. 저장할 때 서버가 써요.
 *
 * 서버에서만 써요
 *   YAML 도구(yaml)가 커서 브라우저로 보내지 않아요. 글쓰기 화면은 칸 값 모양(lib/review-values.ts)만 가져가고,
 *   수정 화면은 서버가 원고를 읽어 칸 값으로 바꿔 넘겨줘요(app/write/[slug]/page.tsx).
 *   읽기와 쓰기가 같은 파일에 있어서 "읽은 원고"와 "저장한 원고"의 모양이 늘 같아요.
 *
 * 누가 쓰나요?
 *   app/write/[slug]/page.tsx(수정할 원고 읽기), lib/review-store.ts(저장)
 */

import { parse, stringify } from "yaml";

import { GENRES, type Genre } from "./genres";
import { FRONTMATTER_KEYS, type ReviewFrontmatter } from "./review-schema";
import type { ReviewFormValues } from "./review-values";

/** parseReviewFile의 결과 */
export type ParsedReviewFile =
  | {
      ok: true;
      /** 원고에서 읽은 칸 값(원고에 없던 칸은 비어 있어요) */
      values: Omit<ReviewFormValues, "slug">;
      /** 이 블로그에서 쓰지 않아 뺀 항목 이름들(예: 예전 원고의 watchedAt) */
      ignoredKeys: string[];
    }
  | { ok: false; message: string };

/**
 * 원고 맨 위의 정보 영역을 찾는 정규식이에요(vfile-matter와 같은 규칙).
 *   ^---줄바꿈 (내용) 줄바꿈---줄바꿈
 *   [\s\S]*? : 줄바꿈까지 포함한 아무 글자나 "가장 짧게". 첫 번째 닫는 ---에서 멈춰요.
 */
const FRONTMATTER = /^---(?:\r?\n|\r)(?:([\s\S]*?)(?:\r?\n|\r))?---(?:\r?\n|\r|$)/;

/** 글자로 바꿔요. 숫자(연도 2024)도 입력란에 넣을 수 있게 "2024"로 바꿔요. 없거나 이상한 값은 ""예요. */
function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  // YAML이 날짜(2026-10-05)를 Date로 읽어 오는 경우가 있어서 "YYYY-MM-DD"로 되돌려요.
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return "";
}

/** 평점 숫자를 고르기 칸의 값("4.5", "4.0")으로 바꿔요. */
function asRating(value: unknown): string {
  const number = typeof value === "number" ? value : Number(asText(value));
  return asText(value) === "" || !Number.isFinite(number) ? "" : number.toFixed(1);
}

/** 장르 값을 목록으로 바꿔요. 하나만 적었으면 [그 장르], 목록에 없는 장르(예전 장르 포함)는 빼요. */
function asGenres(value: unknown): Genre[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return list.map(asText).filter((name): name is Genre => (GENRES as readonly string[]).includes(name));
}

/**
 * 원고 글자를 읽어 글쓰기 화면의 칸 값으로 바꿔요.
 *
 * - 정보 영역이 없거나 YAML 문법이 틀리면 { ok: false, message }를 돌려줘요(화면이 고치는 방법을 보여 줘요).
 * - 이 블로그에서 쓰지 않는 항목(예: 예전 원고의 watchedAt, sample)은 빼고 ignoredKeys로 알려 줘요.
 * - 본문 앞의 빈 줄은 지워요(정보 영역과 본문 사이의 빈 줄).
 *
 * @param text 원고 파일의 글자 전체
 * @example
 * parseReviewFile("---\ntitle: 겨울 정류장\nrating: 4.5\n---\n\n본문");
 * // { ok: true, values: { title: "겨울 정류장", rating: "4.5", body: "본문", ... }, ignoredKeys: [] }
 */
export function parseReviewFile(text: string): ParsedReviewFile {
  // 윈도에서 쓴 파일의 줄바꿈(\r\n)을 \n으로 맞추고, 맨 앞의 보이지 않는 표시(BOM)를 지워요.
  const source = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const match = FRONTMATTER.exec(source);
  if (!match) {
    return { ok: false, message: "원고 맨 위에 --- 로 감싼 정보 영역이 없습니다. 원고 틀(content/templates/review.md)의 모양을 따라 주세요." };
  }

  let data: unknown;
  try {
    // 정보 영역 글자를 YAML로 읽어요. 비어 있으면 빈 객체로 봐요.
    data = parse(match[1] ?? "") ?? {};
  } catch {
    return { ok: false, message: "맨 위 --- 사이의 항목을 읽지 못했습니다. 콜론(:) 뒤에 한 칸을 띄웠는지, 따옴표 짝이 맞는지 확인하세요." };
  }
  if (typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, message: "맨 위 --- 사이에는 '이름: 값' 줄을 적어 주세요. 예: title: 겨울 정류장" };
  }

  // 객체로 다루기 쉽게 타입을 정해 둬요.
  const record = data as Record<string, unknown>;
  // 쓸 수 있는 항목 이름 목록에 없는 것은 뺀 항목으로 알려 줘요.
  const ignoredKeys = Object.keys(record).filter((key) => !(FRONTMATTER_KEYS as readonly string[]).includes(key));
  // 출연 목록에 이름(글자)이 아닌 칸(숫자·true 등)이 있으면, 빌드 검사(lib/review-schema.ts)처럼 고치는 방법을 알려요.
  // 숫자를 이름으로 바꾸거나 말없이 빼면, 원고와 다른 출연이 칸에 들어가 그대로 저장될 수 있어서예요.
  if (Array.isArray(record.cast) && !record.cast.every((name) => typeof name === "string")) {
    return {
      ok: false,
      message: "cast(출연) 목록에 이름이 아닌 값(숫자 등)이 있습니다. 배우 이름만 쉼표로 나눠 적어 주세요. 예: cast: 레오나르도 디카프리오, 마크 러팔로",
    };
  }

  return {
    ok: true,
    ignoredKeys,
    values: {
      title: asText(record.title),
      originalTitle: asText(record.originalTitle),
      year: asText(record.year),
      // 감독·출연을 [A, B] 목록으로 적었으면 "A, B"로 이어요.
      director: Array.isArray(record.director) ? record.director.map(asText).filter(Boolean).join(", ") : asText(record.director),
      // (출연 목록은 위에서 모두 글자인지 확인했어요.)
      cast: Array.isArray(record.cast) ? record.cast.map(asText).filter(Boolean).join(", ") : asText(record.cast),
      runtime: asText(record.runtime),
      genres: asGenres(record.genres),
      rating: asRating(record.rating),
      oneLiner: asText(record.oneLiner),
      // 포스터를 "/posters/a.jpg"처럼 경로까지 적었으면 파일 이름만 남겨요.
      poster: asText(record.poster).replace(/^\/posters\//, ""),
      posterAlt: asText(record.posterAlt),
      publishedAt: asText(record.publishedAt),
      // 본문: 정보 영역 뒤의 글자. 앞의 빈 줄과 끝의 공백은 지워요.
      body: source.slice(match[0].length).replace(/^\n+/, "").trimEnd(),
    },
  };
}

/**
 * 글자 하나를 YAML 값으로 안전하게 적어요.
 * 대부분은 그대로(따옴표 없이) 적고, 콜론이나 # 같은 특별한 글자가 있거나 숫자·true처럼 보이면 따옴표로 감싸요.
 * lineWidth: 0 — 긴 한줄평을 여러 줄로 접지 않아요.
 * blockQuote: false — 줄바꿈이 든 글자도 "첫 줄\n둘째 줄"처럼 한 줄 따옴표로 적어요.
 *   (기본값으로는 "|-" 아래에 줄을 나눠 적는데, 그 줄들이 들여 쓰이지 않아 "이름: 값" 줄 안에서는 틀린 YAML이 돼요.)
 */
function scalar(value: string | number): string {
  return stringify(value, { lineWidth: 0, blockQuote: false }).trimEnd();
}

/**
 * 검사를 통과한 정보와 본문으로 원고 글자를 만들어요. 원고 틀(content/templates/review.md)과 같은 순서예요.
 *
 * @param frontmatter 검사를 통과한 정보(lib/review-form.ts의 validateReviewForm 결과)
 * @param body 본문(Markdown)
 * @example
 * serializeReviewFile({ title: "겨울 정류장", year: 2024, ... }, "본문");
 * // "---\ntitle: 겨울 정류장\nyear: 2024\n...---\n\n본문\n"
 */
export function serializeReviewFile(frontmatter: ReviewFrontmatter, body: string): string {
  // [이름, 값] 줄을 원고 틀 순서대로 늘어놓아요. 값이 없는(undefined) 줄은 아래에서 빼요.
  const lines: [string, string | number | undefined][] = [
    ["title", frontmatter.title],
    ["originalTitle", frontmatter.originalTitle],
    ["year", frontmatter.year],
    ["director", frontmatter.director],
    ["cast", frontmatter.cast],
    ["runtime", frontmatter.runtime],
    ["genres", undefined],
    ["rating", frontmatter.rating],
    ["oneLiner", frontmatter.oneLiner],
    ["publishedAt", frontmatter.publishedAt],
    ["poster", frontmatter.poster],
    ["posterAlt", frontmatter.posterAlt],
  ];

  const header = lines
    .map(([key, value]) => {
      // 장르는 원고 틀처럼 [드라마, 코미디] 한 줄 모양으로 적어요(장르 이름은 정해진 낱말이라 따옴표가 필요 없어요).
      if (key === "genres") return `genres: [${frontmatter.genres.join(", ")}]`;
      return value === undefined ? null : `${key}: ${scalar(value)}`;
    })
    .filter((line) => line !== null)
    .join("\n");

  // 본문 줄바꿈을 \n으로 맞추고, 파일은 줄바꿈 하나로 끝나게 해요.
  const text = body.replace(/\r\n?/g, "\n").trim();
  return `---\n${header}\n---\n${text === "" ? "" : `\n${text}\n`}`;
}
