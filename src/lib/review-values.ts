/**
 * @file 글쓰기 칸 값 (review-values.ts)
 *
 * 이 파일이 하는 일
 *   글쓰기 화면의 칸 값 모양(ReviewFormValues)과 아무것도 적지 않은 처음 값(EMPTY_VALUES)을 정해요.
 *
 * 왜 따로 둘까요?
 *   글쓰기 화면(브라우저)과 서버(검사·저장)가 함께 쓰는 값이에요.
 *   원고 읽기·쓰기(lib/review-file.ts)는 YAML 도구가 커서 서버에서만 쓰는데, 이 값을 거기 두면
 *   글쓰기 화면이 이것만 가져가려 해도 YAML 도구까지 따라와요. 그래서 가벼운 이 파일로 나눴어요.
 *
 * 누가 쓰나요?
 *   components/review-writer.tsx(글쓰기 화면), lib/review-form.ts(칸 검사), lib/review-file.ts(원고 ↔ 칸 값),
 *   lib/review-store.ts(저장), lib/admin-api.ts(저장 API 부르기)
 */

import type { Genre } from "./genres";

/**
 * 글쓰기 화면의 칸 값이에요. 입력란은 글자를 다루니 숫자(연도·평점)도 글자로 들고 있어요.
 * 검사(lib/review-form.ts)를 통과하면 숫자로 바뀌어 원고에 들어가요.
 */
export type ReviewFormValues = {
  /** 주소(영문). 원고 파일 이름이 돼요. 예: winter-stop */
  slug: string;
  title: string;
  originalTitle: string;
  year: string;
  country: string;
  director: string;
  runtime: string;
  genres: Genre[];
  /** "0.5" ~ "5.0". 아직 고르지 않았으면 "" */
  rating: string;
  oneLiner: string;
  /** 포스터 파일 이름(public/posters 안). 없으면 "" */
  poster: string;
  posterAlt: string;
  /** 글 쓴 날(YYYY-MM-DD). 새 글이면 ""이고, 저장할 때 서버가 오늘 날짜를 넣어요. */
  publishedAt: string;
  /** 본문(Markdown) */
  body: string;
};

/** 아무것도 적지 않은 처음 칸 값 */
export const EMPTY_VALUES: ReviewFormValues = {
  slug: "",
  title: "",
  originalTitle: "",
  year: "",
  country: "",
  director: "",
  runtime: "",
  genres: [],
  rating: "",
  oneLiner: "",
  poster: "",
  posterAlt: "",
  publishedAt: "",
  body: "",
};
