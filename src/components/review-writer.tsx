/**
 * @file 리뷰 라이터 = 리뷰 추가·수정 화면 (review-writer.tsx)
 *
 * 이 파일이 하는 일
 *   글쓴이가 리뷰를 추가하고 수정하는 폼이에요. 본문은 Markdown으로 써요.
 *
 *     [Markdown 파일 불러오기]  ← .md 원고를 고르면 칸이 바로 채워져요(불러오면 바로 적용)
 *     넓은 화면(1024px~)은 3칸: [포스터 | 영화 정보 2열 × 5행]
 *     ┌ 포스터 ───────┐ ┌ 영화 정보 ─────────────────────────────┐
 *     │ [미리보기]     │ │ 주소(영문)        │ 제목              │
 *     │ [포스터 고르기]│ │ 원제              │ 개봉 연도          │  ← 단추는 포스터와 같은 너비
 *     │ [포스터 빼기]  │ │ 제작 국가         │ 감독              │
 *     │               │ │ 상영 시간         │ 장르(여러 개)      │
 *     │               │ │ 평점(처음 5.0)    │ 한줄평            │
 *     └───────────────┘ └──────────────────────────────────────┘
 *     ┌ 본문 ─────────────────────────────────────────────────┐
 *     │ [장면 사진 넣기] → 커서 자리에 ![](/images/...) 줄이 들어가요 │
 *     │ 본문(Markdown) <textarea> │ 미리 보기(저장한 뒤의 모습)  │  ← 좁은 화면은 탭으로 바꿔 봐요
 *     └──────────────────────────────────────────────────────┘
 *     [저장] [취소]
 *   좁은 화면에서는 한 칸으로, 포스터 → 영화 정보 → 본문 차례로 쌓여요(코드 순서도 같아서 읽는 순서가 같아요).
 *   칸 아래 도움말은 주소(영문)에만 둬요. 나머지 칸은 이름만으로 알 수 있고, 틀리면 오류 문구가 고치는 방법을 알려 줘요.
 *
 * 저장하는 순서
 *   1. 칸 검사(lib/review-form.ts) — 틀린 칸이 있으면 "고칠 곳" 목록을 보여 주고 거기로 초점을 옮겨요.
 *   2. 새로 고른 포스터·장면 사진을 한 장씩 올려요(app/api/images). 본문에서 지운 사진은 올리지 않아요.
 *   3. 칸 값과 올린 사진 목록을 저장 API(app/api/reviews)로 보내요. 서버가 검사한 뒤 저장소에 커밋해요.
 *   4. "저장했습니다" 안내. GitHub Actions가 검사한 뒤 다시 배포하면(몇 분 뒤) 블로그에 보여요.
 *
 * 사진 원본은 고치지 않아요
 *   고른 파일을 그대로 올려요. 화면에서만 형광 초록 4단계 명암과 주사선으로 바꿔 보여 줘요(SVG 필터).
 *
 * 두 번 누름 막기
 *   [저장]을 빠르게 두 번 눌러도 저장은 한 번만 해요. useState는 다음 그리기에야 바뀌어서 useRef 잠금을 함께 써요.
 *   저장에 성공하면 폼을 떠나므로(저장 완료 안내로 바뀌어요) 잠금을 풀지 않고, 실패했을 때만 풀어요.
 *
 * 누가 쓰나요?
 *   app/write/page.tsx(리뷰 추가), app/write/[slug]/page.tsx(리뷰 수정)
 */

"use client";

import Image from "next/image";
import Link from "next/link";
import { type ChangeEvent, type FormEvent, type KeyboardEvent, type MouseEvent, type ReactNode, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
// flushSync: 화면 바꾸기를 바로 끝내게 하는 React 기능이에요. 숨어 있던 본문 칸을 보인 "다음"에 초점을 옮길 때 써요.
import { flushSync } from "react-dom";

import { type ApiResult, createReview, updateReview, uploadImage } from "@/lib/admin-api";
import { GENRES, type Genre } from "@/lib/genres";
import { indentText } from "@/lib/indent";
import { EMPTY_VALUES, parseReviewFile, type ReviewFormValues } from "@/lib/review-file";
import { type FieldErrors, validateReviewForm } from "@/lib/review-form";
import { SLUG } from "@/lib/review-schema";
import { extensionOf, POSTER_ACCEPT, SCENE_ACCEPT, uploadProblem } from "@/lib/upload-rules";

import { Choice, ChoiceGroup } from "./choice-chips";
import { MarkdownPreview } from "./markdown-preview";
import { PixelArt } from "./pixel-art";
import { type PaneView, WritePreviewPanes } from "./write-preview-panes";

/* ──────────────────────────────────────────────────────────────
 * 1. 화면이 받는 값과 정해 둔 값
 * ────────────────────────────────────────────────────────────── */

/** ReviewWriter가 받는 값. 리뷰 추가면 mode만, 수정이면 원고와 그 내용 번호까지 받아요. */
type Props =
  | { mode: "create" }
  | {
      mode: "edit";
      /** 수정할 리뷰 주소 */
      slug: string;
      /** 저장소에서 읽은 원고 글자 */
      source: string;
      /** 원고의 내용 번호(sha). 저장할 때 그사이 다른 곳에서 고쳤는지 비교해요. */
      baseSha: string;
    };

/** 평점 고르기 칸의 값: 0.5, 1.0, ... 5.0 (0점은 없어요) */
const RATINGS = Array.from({ length: 10 }, (_, index) => ((index + 1) / 2).toFixed(1));

/** 평점 칸의 처음 값. "고르세요" 대신 가장 높은 점수를 골라 둬요. */
const DEFAULT_RATING = "5.0";

/** 글쓰기 화면의 빈 칸 값: 원고의 빈 값에 평점만 처음 값(5.0)을 넣어요. */
const WRITER_EMPTY_VALUES: ReviewFormValues = { ...EMPTY_VALUES, rating: DEFAULT_RATING };

/** 평점 고르기 칸 오른쪽의 ▼ 그림(7×4칸, 한 칸 2px → 14×8px). 사이트의 픽셀 그림과 같은 모양이에요. */
const SELECT_ARROW_ROWS = ["#######", ".#####.", "..###..", "...#..."] as const;

/** 칸 이름(화면에 보이는 이름). 고칠 곳 목록에서 "제목: 제목을 입력하세요."처럼 써요. */
const FIELD_LABELS: Record<keyof ReviewFormValues, string> = {
  poster: "포스터",
  posterAlt: "포스터 설명",
  slug: "주소(영문)",
  title: "제목",
  originalTitle: "원제",
  year: "개봉 연도",
  country: "제작 국가",
  director: "감독",
  runtime: "상영 시간",
  genres: "장르",
  rating: "평점",
  oneLiner: "한줄평",
  body: "본문",
  publishedAt: "글 쓴 날",
};

/**
 * 고칠 곳 목록을 보여 줄 순서(화면에 놓인 순서와 같아요).
 * 포스터 설명(posterAlt)은 화면에 칸이 없어요. 원고에 적혀 있으면 그대로 두고, 없으면 상세 화면이 "영화 ‘제목’ 포스터"로 읽어요.
 */
const FIELD_ORDER = Object.keys(FIELD_LABELS) as (keyof ReviewFormValues)[];

/** 원고 파일 이름에서 주소를 만들어요. "winter-stop.md" → "winter-stop". 규칙에 맞지 않으면 "" */
function slugFromFileName(name: string): string {
  const base = name.replace(/\.(md|markdown|txt)$/i, "").toLowerCase();
  return SLUG.test(base) ? base : "";
}

/* ──────────────────────────────────────────────────────────────
 * 2. 글쓰기 폼
 * ────────────────────────────────────────────────────────────── */

/** 리뷰 추가·수정 폼 */
export function ReviewWriter(props: Props) {
  const { mode } = props;
  // 수정 화면이면 원고를 읽어 처음 칸 값을 만들어요(처음 한 번만 계산: useState(() => ...)).
  const [initial] = useState(() => initialState(props));
  const [values, setValues] = useState<ReviewFormValues>(initial.values);
  // 칸별 오류 문구
  const [errors, setErrors] = useState<FieldErrors>({});
  // 본문: 좁은 화면에서 지금 보이는 쪽(Markdown 입력 또는 미리 보기). 넓은 화면은 둘 다 보여요.
  const [bodyView, setBodyView] = useState<PaneView>("input");
  // 결과 안내(불러옴, 포스터 고름, 올리는 중) — role="status"
  const [notice, setNotice] = useState(initial.notice);
  // 화면에는 보이지 않고 화면 낭독기만 읽는 안내(장면 사진을 넣었을 때) — role="status"
  const [quietNotice, setQuietNotice] = useState("");
  // quietNotice를 잠시 뒤 다시 채우는 타이머 번호(announceQuietly 참고)
  const quietTimerRef = useRef<number | undefined>(undefined);
  // 칸과 상관없는 실패(연결 끊김, 그사이 바뀜 등) — role="alert"
  const [failure, setFailure] = useState(initial.failure);
  // 새로 고른 포스터: 파일, 미리보기 주소(브라우저 안에서만 쓰는 blob: 주소), 확장자. 고르지 않았으면 null
  // 확장자를 따로 기억하는 까닭: 포스터 파일 이름은 <주소>.<확장자>인데, 주소를 포스터보다 나중에 적어도 이름을 만들 수 있게요.
  const [poster, setPoster] = useState<{ file: File; url: string; extension: string } | null>(null);
  // 새로 고른 포스터 파일(없으면 null). 아래 코드에서 자주 써서 이름을 붙여 둬요.
  const posterFile = poster?.file ?? null;
  // 본문에 넣은 장면 사진: 사이트 주소("/images/<주소>/scene-1.jpg") → 파일
  const [scenes, setScenes] = useState<Map<string, File>>(() => new Map());
  // 넣은 사진 주소에 지금 들어 있는 주소(slug). 주소 칸을 고치면 사진 주소를 이 값에서 새 값으로 바꿔요.
  // (주소를 한 글자씩 치는 동안 "winter-"처럼 잠깐 규칙에 맞지 않는 값이 되어도 따라가려고 따로 기억해요.)
  const [imagesSlug, setImagesSlug] = useState("");
  // 지금 단계: 쓰는 중 / 저장 중 / 저장함
  const [phase, setPhase] = useState<"editing" | "saving" | "saved">("editing");
  const [savedSlug, setSavedSlug] = useState("");
  // 두 번 누름 막기 잠금
  const lockRef = useRef(false);

  // 초점을 옮길 곳들의 손잡이
  const summaryRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const savedRef = useRef<HTMLHeadingElement>(null);
  // 본문을 바꾼 뒤 커서(고른 범위)를 둘 자리 [시작, 끝]. 다음 그리기에서 맞춰요(사진 줄 넣기, Tab 들여쓰기).
  const selectionRef = useRef<[number, number] | null>(null);
  // 본문 칸에서 Esc를 누른 바로 다음 Tab은 들여쓰지 않고 원래대로 다음 칸으로 넘어가요(글상자에서 빠져나갈 길).
  const tabLeavesRef = useRef(false);

  // 칸 id들의 앞부분. useId로 겹치지 않게 만들어요.
  const baseId = useId();
  const fieldId = (field: keyof ReviewFormValues) => `${baseId}-${field}`;

  // 주소가 규칙에 맞는지(장면 사진은 주소 폴더에 저장해서, 사진을 넣기 전에 필요해요)
  const slugReady = SLUG.test(values.slug);

  /* ── 칸 값 바꾸기 ── */

  /** 칸 하나의 값을 바꾸고, 그 칸의 오류 문구는 지워요(고치기 시작했으니까요). */
  function setField<K extends keyof ReviewFormValues>(field: K, value: ReviewFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  /**
   * 주소를 바꿔요(리뷰 추가만). 이미 넣은 사진의 주소도 함께 바꿔요.
   * 사진은 public/images/<주소>/에 저장되고 포스터는 <주소>.jpg가 되어서, 주소가 바뀌면 경로도 따라 바뀌어야 해요.
   * 주소 칸을 비우는 동안에는 사진 주소를 그대로 두었다가, 다시 적으면 그 주소로 바꿔요.
   */
  function changeSlug(next: string) {
    // 바꿔야 하는지: 넣은 사진이 있고, 새 주소가 비어 있지 않고, 지금 사진 주소와 다를 때
    const moveImages = imagesSlug !== "" && next !== "" && next !== imagesSlug;
    setValues((current) => ({
      ...current,
      slug: next,
      // 본문의 "/images/예전주소/"를 "/images/새주소/"로 바꿔요.
      body: moveImages ? current.body.replaceAll(`/images/${imagesSlug}/`, `/images/${next}/`) : current.body,
      // 새로 고른 포스터가 있으면 파일 이름도 새 주소로. 주소가 아직 규칙에 맞지 않으면 이름을 비워 두고 맞춰지면 채워요.
      poster: poster ? (SLUG.test(next) ? `${next}.${poster.extension}` : "") : current.poster,
    }));
    if (moveImages) {
      setScenes(new Map([...scenes].map(([path, file]) => [path.replace(`/images/${imagesSlug}/`, `/images/${next}/`), file])));
      setImagesSlug(next);
    }
    setErrors((current) => ({ ...current, slug: undefined }));
  }

  /** 장르 칩을 누르면 넣거나 빼요. 순서는 장르 목록(lib/genres.ts) 순서로 맞춰요. */
  function toggleGenre(genre: Genre) {
    const next = values.genres.includes(genre) ? values.genres.filter((item) => item !== genre) : [...values.genres, genre];
    setField(
      "genres",
      GENRES.filter((item) => next.includes(item)),
    );
  }

  /* ── 불러오기(import) ── */

  /** [Markdown 파일 불러오기]로 .md 파일을 고르면 칸을 바로 채워요. */
  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // 같은 파일을 다시 골라도 onChange가 오게 고르기 칸을 비워 둬요.
    event.target.value = "";
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setFailure(`${file.name}: 원고 파일이 1MB보다 큽니다. 원고 틀 모양의 .md 파일인지 확인해 주세요.`);
      return;
    }

    const parsed = parseReviewFile(await file.text());
    if (!parsed.ok) {
      setFailure(`${file.name}: ${parsed.message}`);
      return;
    }

    setValues((current) => ({
      ...parsed.values,
      // 주소: 수정 화면은 바꾸지 않아요. 새 리뷰는 적어 둔 주소가 없으면 파일 이름으로 채워요.
      slug: mode === "edit" ? current.slug : current.slug || slugFromFileName(file.name),
      // 글 쓴 날: 원고에 없으면 지금 값을 그대로 둬요(수정할 때 날짜가 사라지지 않게).
      publishedAt: parsed.values.publishedAt || current.publishedAt,
      // 평점: 원고에 없으면 지금 값(처음에는 5.0)을 그대로 둬요. 평점 칸에 "고르세요"가 없거든요.
      rating: parsed.values.rating || current.rating,
    }));
    // 새로 골라 둔 포스터는 불러온 원고의 포스터로 바뀌니 버려요.
    setPoster(null);
    setErrors({});
    setFailure("");
    const ignored = parsed.ignoredKeys.length > 0 ? ` 이 블로그에서 쓰지 않는 항목(${parsed.ignoredKeys.join(", ")})은 뺐습니다.` : "";
    setNotice(`${file.name}을(를) 불러와 칸을 채웠습니다. 내용을 확인한 뒤 저장하세요.${ignored}`);
  }

  /* ── 포스터 ── */

  /**
   * [포스터 고르기]로 그림을 고르면 미리보기를 보여 주고, 저장할 때 올려요.
   * 주소(영문)보다 먼저 골라도 돼요. 파일 이름(<주소>.jpg)은 주소를 적는 대로 맞춰져요(changeSlug).
   */
  function handlePosterChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = uploadProblem(file, "poster");
    if (problem) {
      setErrors((current) => ({ ...current, poster: problem }));
      return;
    }
    // 확장자는 jpeg도 jpg로 맞춰 파일 이름을 <주소>.jpg처럼 정해요.
    const extension = extensionOf(file.name).replace("jpeg", "jpg");
    // URL.createObjectURL: 고른 파일을 서버에 올리지 않고도 화면에 보여 줄 수 있는 임시 주소(blob:)를 만들어요.
    setPoster({ file, url: URL.createObjectURL(file), extension });
    // 주소가 이미 있으면 파일 이름을 바로 정하고, 아직이면 비워 둬요(주소를 적으면 채워져요).
    setField("poster", slugReady ? `${values.slug}.${extension}` : "");
    setNotice(`포스터로 ${file.name}을(를) 골랐습니다. 저장하면 함께 올라갑니다.`);
  }

  // 미리보기 임시 주소는 포스터를 바꾸거나 화면을 떠날 때 지워요(브라우저 메모리를 돌려줘요).
  // 정리 함수(return 뒤 함수)는 poster가 바뀌기 직전과 화면이 사라질 때 불려요.
  useEffect(() => {
    if (!poster) return;
    const { url } = poster;
    return () => URL.revokeObjectURL(url);
  }, [poster]);

  /**
   * 화면 낭독기에만 짧게 알려요(quietNotice).
   * 같은 글(예: "사진 1장을 본문에 넣었습니다.")을 연달아 넣으면 글자가 바뀌지 않아 화면 낭독기가 다시 읽지 않아요.
   * 그래서 먼저 비우고, 잠시 뒤(0.1초) 다시 채워서 매번 새 안내로 읽히게 해요.
   */
  function announceQuietly(message: string) {
    window.clearTimeout(quietTimerRef.current);
    setQuietNotice("");
    quietTimerRef.current = window.setTimeout(() => setQuietNotice(message), 100);
  }

  // 화면을 떠나면 아직 기다리는 안내 타이머를 치워요.
  useEffect(() => () => window.clearTimeout(quietTimerRef.current), []);

  /** [포스터 빼기]: 포스터 없이 저장해요(화면에는 기본 포스터가 보여요). */
  function handlePosterRemove() {
    setPoster(null);
    setField("poster", "");
    setNotice("포스터를 뺐습니다. 저장하면 기본 포스터가 보입니다.");
  }

  /* ── 장면 사진 ── */

  /** [장면 사진 넣기]로 그림을 고르면 본문의 커서 자리에 사진 줄을 넣어요. */
  function handleScenesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    // 좁은 화면에서 미리 보기를 보고 있었어도, 사진 줄은 쓰기 칸에 들어가니 쓰기 칸을 보여 줘요.
    setBodyView("input");
    if (!slugReady) {
      setErrors((current) => ({ ...current, slug: "사진을 넣기 전에 주소(영문)를 먼저 적어 주세요. 사진은 그 주소의 폴더에 저장됩니다." }));
      document.getElementById(fieldId("slug"))?.focus();
      return;
    }

    // 받을 수 없는 파일은 이유를 모아 알려 주고, 받을 수 있는 것만 넣어요.
    const problems = files.map((file) => uploadProblem(file, "scene")).filter((problem): problem is string => problem !== null);
    const accepted = files.filter((file) => uploadProblem(file, "scene") === null);

    // 사진 이름은 scene-1.jpg, scene-2.png ...처럼 번호를 이어 붙여요. 본문과 넣어 둔 사진에 이미 쓴 번호는 건너뛰어요.
    const used = new Set([...values.body.matchAll(/scene-(\d+)\./g)].map((match) => Number(match[1])));
    for (const path of scenes.keys()) used.add(Number(/scene-(\d+)\./.exec(path)?.[1] ?? 0));
    let number = 1;
    const nextScenes = new Map(scenes);
    const lines = accepted.map((file) => {
      while (used.has(number)) number += 1;
      used.add(number);
      const path = `/images/${values.slug}/scene-${number}.${extensionOf(file.name).replace("jpeg", "jpg")}`;
      nextScenes.set(path, file);
      // 설명(대체 텍스트) 칸은 비워 둬요. 글쓴이가 직접 적어야 저장할 수 있어요(검사가 알려 줘요).
      return `![](${path})`;
    });

    if (lines.length > 0) {
      // 사진 주소에 들어간 주소(slug)를 기억해 둬요(주소를 고치면 따라 바꾸려고요).
      setImagesSlug(values.slug);
      // 커서 자리(고른 글자가 있으면 그 자리)에 사진 줄을 넣어요. 앞뒤에 빈 줄을 둬서 사진만 있는 문단이 되게 해요.
      const textarea = bodyRef.current;
      const start = textarea?.selectionStart ?? values.body.length;
      const end = textarea?.selectionEnd ?? values.body.length;
      const before = values.body.slice(0, start).replace(/\s*$/, "");
      const insert = `${before ? "\n\n" : ""}${lines.join("\n\n")}\n\n`;
      setScenes(nextScenes);
      setField("body", `${before}${insert}${values.body.slice(end).replace(/^\s*/, "")}`);
      // 커서는 첫 사진의 ![ 바로 뒤(설명을 적을 자리)에 둬요.
      const caret = before.length + (before ? 2 : 0) + 2;
      selectionRef.current = [caret, caret];
      // 화면에는 안내 글을 띄우지 않아요. 본문에 넣은 줄이 바로 보이니까요. 화면 낭독기에만 짧게 알려요.
      announceQuietly(`사진 ${lines.length}장을 본문에 넣었습니다.`);
    }
    if (problems.length > 0) setErrors((current) => ({ ...current, body: problems.join(" ") }));
  }

  // 본문을 바꾼 뒤(사진 줄 넣기, Tab 들여쓰기), 화면이 바뀐 바로 그 순간에 본문 칸으로 초점과 커서를 옮겨요.
  useLayoutEffect(() => {
    const selection = selectionRef.current;
    if (selection === null || !bodyRef.current) return;
    selectionRef.current = null;
    bodyRef.current.focus();
    bodyRef.current.setSelectionRange(selection[0], selection[1]);
  }, [values.body]);

  /**
   * 본문 칸의 Tab·Shift+Tab: 다음 칸으로 넘어가지 않고 들여쓰기·내어쓰기를 해요(목록 안의 목록 만들기, lib/indent.ts).
   * Esc를 누른 바로 다음 Tab은 원래대로 다음 칸으로 넘어가요.
   */
  function handleBodyKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      tabLeavesRef.current = true;
      return;
    }
    // Tab이 아니거나, 다른 키와 함께 누르거나, 한글을 조합하는 중이면 건드리지 않아요.
    const isTab = event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.nativeEvent.isComposing;
    const leave = tabLeavesRef.current;
    tabLeavesRef.current = false;
    if (!isTab || leave) return;

    event.preventDefault();
    const textarea = event.currentTarget;
    const result = indentText(textarea.value, textarea.selectionStart, textarea.selectionEnd, event.shiftKey);
    if (result.value === textarea.value) return;

    // 되돌리기(Ctrl·Cmd+Z)가 되게, 브라우저가 글상자에 직접 글을 끼워 넣게 해요(execCommand "insertText").
    // 끼워 넣으면 input 이벤트가 나서 칸 값(onChange)도 따라 바뀌어요. 지원하지 않는 곳에서는 칸 값을 직접 바꿔요.
    textarea.setSelectionRange(result.from, result.to);
    let inserted = false;
    try {
      inserted = document.execCommand("insertText", false, result.replacement);
    } catch {
      inserted = false;
    }
    if (inserted) {
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    } else {
      selectionRef.current = [result.selectionStart, result.selectionEnd];
      setField("body", result.value);
    }
  }

  /* ── 저장 ── */

  /**
   * 고칠 곳 목록의 "본문" 링크를 누르면: 좁은 화면에서 [미리 보기]를 보고 있었어도 쓰기 칸을 보이고 본문 칸으로 초점을 옮겨요.
   * (그냥 #주소로 가면 숨은 칸으로는 갈 수 없어요.) 다른 칸 링크는 #주소로 가는 기본 동작 그대로예요.
   */
  function goToBody(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    flushSync(() => setBodyView("input"));
    bodyRef.current?.focus();
  }

  /** 틀린 칸을 보여 주고, 고칠 곳 목록으로 초점을 옮겨요. */
  function showErrors(next: FieldErrors) {
    setErrors(next);
    // 본문이 틀렸으면 좁은 화면에서도 본문 칸이 보이게 쓰기 칸으로 바꿔요(고칠 곳 목록의 링크가 그리로 가요).
    if (next.body) setBodyView("input");
    // 목록이 그려진 다음에 초점을 옮겨야 해서 다음 그림 차례로 미뤄요.
    requestAnimationFrame(() => summaryRef.current?.focus());
  }

  /** 저장에 실패했을 때: 칸 오류면 칸에, 아니면 알림으로 보여 주고 잠금을 풀어요. */
  function fail(result: Extract<ApiResult<unknown>, { ok: false }>) {
    lockRef.current = false;
    setPhase("editing");
    setNotice("");
    if (result.errors && Object.keys(result.errors).length > 0) {
      showErrors(result.errors);
    } else {
      setFailure(result.message);
    }
  }

  /** [저장]을 누르면 실행돼요. */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lockRef.current) return;

    // 1) 칸 검사(화면에서 먼저)
    const check = validateReviewForm(values, { checkSlug: mode === "create" });
    if (!check.ok) {
      showErrors(check.errors);
      return;
    }

    lockRef.current = true;
    setPhase("saving");
    setFailure("");
    setErrors({});

    // 2) 새로 고른 사진 올리기. 본문에 남아 있는 장면 사진과 새 포스터만 올려요.
    const files: [string, File][] = [];
    if (posterFile && values.poster) files.push([`public/posters/${values.poster}`, posterFile]);
    for (const [path, file] of scenes) if (values.body.includes(path)) files.push([`public${path}`, file]);

    const uploads: { path: string; sha: string }[] = [];
    for (const [index, [path, file]] of files.entries()) {
      setNotice(`사진을 올리는 중입니다(${index + 1}/${files.length}).`);
      const result = await uploadImage(file, path);
      if (!result.ok) return fail(result);
      uploads.push(result.data);
    }

    // 3) 리뷰 저장
    setNotice("리뷰를 저장하는 중입니다.");
    const request = { values, uploads, baseSha: props.mode === "edit" ? props.baseSha : undefined };
    const result = props.mode === "edit" ? await updateReview(props.slug, request) : await createReview(request);
    if (!result.ok) return fail(result);

    // 4) 성공: 저장 완료 안내로 바꿔요. 폼을 떠나니 잠금은 풀지 않아요.
    setNotice("");
    setSavedSlug(result.data.slug);
    setPhase("saved");
  }

  // 저장 완료 안내가 나오면 그 제목으로 초점을 옮겨요(누른 [저장] 단추가 사라지니까요).
  useEffect(() => {
    if (phase === "saved") savedRef.current?.focus();
  }, [phase]);

  /* ── 저장하지 않고 떠나려 할 때 묻기 ── */

  // 처음 값과 달라졌거나 고른 사진이 있으면 "고친 내용이 있음"으로 봐요.
  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initial.values) || posterFile !== null || scenes.size > 0,
    [values, initial.values, posterFile, scenes],
  );
  useEffect(() => {
    if (!dirty || phase === "saved") return;
    // beforeunload: 탭을 닫거나 새로 고칠 때 브라우저가 "떠날까요?"라고 물어 줘요.
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, phase]);

  /* ── 화면 ── */

  // 저장 완료 안내
  if (phase === "saved") {
    return (
      <section aria-labelledby={`${baseId}-saved`} className="grid gap-4">
        <h2 id={`${baseId}-saved`} ref={savedRef} tabIndex={-1} className="glow text-big outline-none">
          저장했습니다
        </h2>
        <p>저장소에 올렸습니다. 블로그를 다시 배포하는 동안(몇 분) 기다린 뒤 새로 고치면 보입니다.</p>
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link href={`/reviews/${savedSlug}`} className="btn-line">
              이 리뷰 보기
            </Link>
          </li>
          <li>
            <Link href="/" className="btn-line">
              목록으로
            </Link>
          </li>
          <li>
            {/* 리뷰 추가 화면을 처음 상태로 다시 열어요(같은 화면이라 페이지를 새로 받아요). */}
            <a href="/write" className="btn-line">
              리뷰 추가
            </a>
          </li>
        </ul>
      </section>
    );
  }

  // 고칠 곳 목록(화면 순서대로)
  const errorList = FIELD_ORDER.filter((field) => errors[field]).map((field) => [field, errors[field]!] as const);
  const saving = phase === "saving";
  // 포스터 미리보기: 새로 고른 그림 > 저장소에 있던 포스터 > 없음(기본 포스터)
  const posterSrc = poster?.url ?? (values.poster ? `/posters/${values.poster}` : null);

  return (
    // noValidate: 브라우저 기본 오류 말풍선 대신 우리 문구를 보여 줘요.
    <form onSubmit={handleSubmit} noValidate className="grid gap-10" aria-busy={saving}>
      {/* 불러오기: 원고 틀(content/templates/review.md) 모양의 .md 파일을 고르면 칸이 바로 채워져요. */}
      <FileButton label="Markdown 파일 불러오기" accept=".md,.markdown,text/markdown,text/plain" onChange={handleImport} disabled={saving} />

      {/* 결과 안내(불러옴·포스터 고름·올리는 중). role="status": 끼어들지 않고 차례대로 읽어 줘요.
          영역은 처음부터 두고 글자만 바꿔야 읽어 줘요. 비어 있을 때는 empty:sr-only로 화면에서만 숨겨 빈 간격이 생기지 않게 해요. */}
      <p role="status" className="empty:sr-only">
        {notice}
      </p>
      {/* 화면 낭독기만 읽는 안내(장면 사진을 넣었을 때). 화면에는 보이지 않아요. */}
      <p role="status" className="sr-only">
        {quietNotice}
      </p>
      {/* 칸과 상관없는 실패. role="alert": 바로 읽어 줘요. */}
      <p role="alert" className="alert-text empty:sr-only">
        {failure}
      </p>

      {/* 고칠 곳 목록. 저장을 눌렀는데 틀린 칸이 있으면 나타나고, 초점이 여기로 와요(tabIndex -1).
          항목을 누르면 그 칸으로 가요. */}
      {errorList.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} aria-labelledby={`${baseId}-summary`} role="group" className="error-summary">
          <h2 id={`${baseId}-summary`} className="inverse px-3">
            고칠 곳 {errorList.length}개
          </h2>
          <ul className="grid gap-1 px-3 py-3">
            {errorList.map(([field, message]) => (
              <li key={field}>
                {/* 글 쓴 날은 칸이 없어서 링크 없이 글자로만 보여요. */}
                {field === "publishedAt" ? (
                  `${FIELD_LABELS[field]}: ${message}`
                ) : (
                  <a
                    href={`#${field === "genres" ? `${fieldId("genres")}-0` : fieldId(field)}`}
                    onClick={field === "body" ? goToBody : undefined}
                    className="term-link"
                  >
                    {FIELD_LABELS[field]}: {message}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 포스터와 영화 정보. 넓은 화면(lg, 1024px~)에서는 3칸으로 나눠 [포스터 | 영화 정보(2칸)]로 놓아요. */}
      <div className="grid gap-10 lg:grid-cols-3 lg:gap-8">
        {/* 포스터: 넓은 화면에서는 왼쪽 한 칸. 주소보다 먼저 골라도 돼요. */}
        <fieldset className="grid content-start gap-4" disabled={saving}>
          <legend className="glow mb-4 text-big">포스터</legend>
          {/* 미리보기와 단추를 같은 너비의 칸에 넣어, 단추가 포스터 너비만큼 넓어요.
              w-40: 좁은 화면 10rem, lg:w-full: 넓은 화면에서는 왼쪽 칸 너비를 채워요(최대 18rem). */}
          <div className="grid w-40 gap-4 lg:w-full lg:max-w-[18rem]">
            {/* 미리보기: 화면에서처럼 형광 초록으로 보여요(원본 파일은 그대로 올라가요). 꾸밈이라 alt를 비워요. */}
            <span className="poster-frame relative block aspect-[2/3] w-full">
              {posterSrc ? (
                // unoptimized: 브라우저 안의 blob: 주소는 이미지 최적화를 거칠 수 없어서 원본 그대로 보여 줘요.
                <Image src={posterSrc} alt="" fill unoptimized sizes="(min-width: 1024px) 288px, 160px" className="poster-image object-cover" />
              ) : (
                <span className="grid h-full place-items-center text-crt-dim">없음</span>
              )}
            </span>
            {/* 단추는 포스터와 같은 너비(w-full)로 위아래로 놓아요. 글자는 가운데(justify-center). */}
            <div className="grid gap-2">
              <FileButton
                id={fieldId("poster")}
                label="포스터 고르기"
                accept={POSTER_ACCEPT}
                onChange={handlePosterChange}
                disabled={saving}
                describedBy={errors.poster ? `${fieldId("poster")}-error` : undefined}
                className="w-full justify-center"
              />
              {(values.poster || posterFile) && (
                <button type="button" onClick={handlePosterRemove} className="btn-line w-full justify-center">
                  포스터 빼기
                </button>
              )}
            </div>
          </div>
          <p id={`${fieldId("poster")}-error`} className="field-error">
            {errors.poster}
          </p>
        </fieldset>

        {/* 영화 정보: 넓은 화면에서는 오른쪽 두 칸(lg:col-span-2)을 쓰고, 칸들을 2열로 놓아요(주소~한줄평 10칸 = 2열 × 5행).
            content-start: 칸들이 위에서부터 놓이게 해요.
            items-start: 같은 행의 옆 칸에 도움말이 길어도 이 칸(입력 상자)이 따라 늘어나지 않고 제 높이를 지켜요. */}
        <fieldset className="grid content-start items-start gap-6 lg:col-span-2 lg:grid-cols-2 lg:gap-x-6" disabled={saving}>
          <legend className="glow mb-4 text-big">영화 정보</legend>

          {mode === "create" ? (
            <TextField
              id={fieldId("slug")}
              label={FIELD_LABELS.slug}
              required
              hint="리뷰 주소와 파일 이름이 됩니다. 영어 소문자, 숫자, 하이픈(-)만 씁니다. 예: shutter-island → /reviews/shutter-island"
              error={errors.slug}
              value={values.slug}
              onChange={changeSlug}
              spellCheck={false}
              autoCapitalize="none"
            />
          ) : (
            <p>
              <span className="text-crt-dim">주소(영문): </span>/reviews/{values.slug} <span className="text-crt-dim">(수정할 때는 바꿀 수 없습니다)</span>
            </p>
          )}

          <TextField id={fieldId("title")} label={FIELD_LABELS.title} required error={errors.title} value={values.title} onChange={(value) => setField("title", value)} />
          <TextField
            id={fieldId("originalTitle")}
            label={FIELD_LABELS.originalTitle}
            error={errors.originalTitle}
            value={values.originalTitle}
            onChange={(value) => setField("originalTitle", value)}
          />
          {/* 숫자 칸: inputMode="numeric"이면 휴대폰에서 숫자 자판이 떠요(type="number"의 화살표·스크롤 문제는 피해요). */}
          <TextField
            id={fieldId("year")}
            label={FIELD_LABELS.year}
            required
            error={errors.year}
            value={values.year}
            onChange={(value) => setField("year", value)}
            inputMode="numeric"
          />
          <TextField id={fieldId("country")} label={FIELD_LABELS.country} error={errors.country} value={values.country} onChange={(value) => setField("country", value)} />
          <TextField
            id={fieldId("director")}
            label={FIELD_LABELS.director}
            required
            error={errors.director}
            value={values.director}
            onChange={(value) => setField("director", value)}
          />
          <TextField
            id={fieldId("runtime")}
            label={`${FIELD_LABELS.runtime}(분)`}
            error={errors.runtime}
            value={values.runtime}
            onChange={(value) => setField("runtime", value)}
            inputMode="numeric"
          />

          {/* 장르: 여러 개 고르는 체크박스 칩(가나다순). 오류 문구는 묶음 설명(aria-describedby)으로 이어요. */}
          <div className="grid gap-2">
            <ChoiceGroup
              layout="aside"
              legend={
                <>
                  {FIELD_LABELS.genres} <span className="text-crt-dim">(필수)</span>
                </>
              }
              describedBy={errors.genres ? `${fieldId("genres")}-error` : undefined}
            >
              {GENRES.map((genre, index) => (
                <Choice
                  key={genre}
                  id={`${fieldId("genres")}-${index}`}
                  type="checkbox"
                  name="genres"
                  checked={values.genres.includes(genre)}
                  onChange={() => toggleGenre(genre)}
                >
                  {genre}
                </Choice>
              ))}
            </ChoiceGroup>
            <p id={`${fieldId("genres")}-error`} className="field-error">
              {errors.genres}
            </p>
          </div>

          {/* 평점: 0.5 ~ 5.0 중에서 고르기(0점은 없어요). 처음에는 5.0이 골라져 있어요.
              네이티브 <select>라 키보드·화면 낭독기가 그대로 써요. */}
          <Field id={fieldId("rating")} label={FIELD_LABELS.rating} required error={errors.rating}>
            {(describedBy) => (
              // relative: ▼ 그림을 칸 오른쪽에 겹쳐 놓는 기준이에요.
              <span className="relative block w-40">
                {/* appearance-none: 브라우저 기본 ▼를 지우고 아래 픽셀 ▼를 그려요.
                    pr-9: 오른쪽에 ▼ 자리(여백 12px + 그림 14px + 사이 10px)를 비워 글자가 겹치지 않게 해요.
                    peer: 칸이 잠기면(disabled) 옆의 ▼도 같이 흐려지게 해요(peer-disabled). */}
                <select
                  id={fieldId("rating")}
                  required
                  value={values.rating}
                  onChange={(event) => setField("rating", event.target.value)}
                  aria-invalid={errors.rating ? true : undefined}
                  aria-describedby={describedBy}
                  aria-errormessage={errors.rating ? `${fieldId("rating")}-error` : undefined}
                  className="peer field w-full cursor-pointer appearance-none pr-9"
                >
                  {/* 목록에 없는 값(불러온 원고의 4.3 같은 값)이면 그 값을 그대로 보여 주고, 저장할 때 오류로 알려요. */}
                  {!RATINGS.includes(values.rating) && (
                    <option value={values.rating} disabled>
                      {values.rating || "고르세요"}
                    </option>
                  )}
                  {RATINGS.map((rating) => (
                    <option key={rating} value={rating}>
                      {rating}
                    </option>
                  ))}
                </select>
                {/* ▼: 오른쪽 끝에서 12px(right-3) 안쪽에 놓아요. 왼쪽 글자도 칸 끝에서 12px(테두리 2px + 여백 10px)
                    안쪽에서 시작해서, 좌우 간격이 같아요. 꾸밈 그림이라 읽지 않고, 누르면 아래 칸이 눌려요(pointer-events-none). */}
                <PixelArt
                  rows={SELECT_ARROW_ROWS}
                  cell={2}
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 peer-disabled:opacity-60"
                />
              </span>
            )}
          </Field>

          <TextField
            id={fieldId("oneLiner")}
            label={FIELD_LABELS.oneLiner}
            required
            error={errors.oneLiner}
            value={values.oneLiner}
            onChange={(value) => setField("oneLiner", value)}
          />
        </fieldset>
      </div>

      {/* 본문: [장면 사진 넣기] 아래에 쓰기 칸과 미리 보기를 둬요.
          넓은 화면은 나란히, 좁은 화면은 [Markdown 입력] [미리 보기] 탭으로 바꿔 봐요(write-preview-panes.tsx). */}
      <fieldset className="grid gap-4" disabled={saving}>
        <legend className="glow mb-4 text-big">본문</legend>
        <FileButton label="장면 사진 넣기" accept={SCENE_ACCEPT} multiple onChange={handleScenesChange} disabled={saving} />
        <WritePreviewPanes
          view={bodyView}
          onViewChange={setBodyView}
          input={
            <Field id={fieldId("body")} label="본문(Markdown)" error={errors.body}>
              {(describedBy) => (
                <textarea
                  ref={bodyRef}
                  id={fieldId("body")}
                  rows={18}
                  value={values.body}
                  onChange={(event) => setField("body", event.target.value)}
                  // Tab·Shift+Tab: 들여쓰기·내어쓰기(Esc 다음 Tab은 다음 칸으로)
                  onKeyDown={handleBodyKeyDown}
                  aria-invalid={errors.body ? true : undefined}
                  aria-describedby={describedBy}
                  aria-errormessage={errors.body ? `${fieldId("body")}-error` : undefined}
                  spellCheck={false}
                  // [tab-size:2]: Tab 문자를 2칸 너비로 보여요(Markdown은 4칸으로 읽어 중첩 목록이 돼요).
                  className="field w-full resize-y leading-7 [tab-size:2]"
                />
              )}
            </Field>
          }
          // 아직 올리지 않은 장면 사진(scenes)은 미리 보기가 브라우저 안의 임시 주소로 바꿔 보여 줘요.
          preview={<MarkdownPreview markdown={values.body} images={scenes} />}
        />
      </fieldset>

      {/* 저장·취소 */}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className="btn-inverse">
          {saving ? "저장하는 중…" : mode === "edit" ? "수정한 내용 저장" : "리뷰 저장"}
        </button>
        <Link href={mode === "edit" ? `/reviews/${values.slug}` : "/"} className="btn-line">
          취소
        </Link>
      </div>
    </form>
  );
}

/** 처음 상태(칸 값과 안내)를 만들어요. 수정이면 원고를 읽어 채워요. */
function initialState(props: Props): { values: ReviewFormValues; notice: string; failure: string } {
  if (props.mode === "create") return { values: WRITER_EMPTY_VALUES, notice: "", failure: "" };
  const parsed = parseReviewFile(props.source);
  if (!parsed.ok) {
    // 저장소의 원고를 읽지 못했어요(직접 고친 원고가 망가진 경우). 본문 칸에 원고 전체를 넣어 손으로 고칠 수 있게 해요.
    return { values: { ...WRITER_EMPTY_VALUES, slug: props.slug, body: props.source }, notice: "", failure: `원고를 읽지 못했습니다: ${parsed.message}` };
  }
  return { values: { ...parsed.values, slug: props.slug }, notice: "", failure: "" };
}

/* ──────────────────────────────────────────────────────────────
 * 3. 칸 조각들
 * ────────────────────────────────────────────────────────────── */

/** Field가 받는 값 */
type FieldProps = {
  /** 입력 요소의 id(label이 가리켜요) */
  id: string;
  /** 칸 이름 */
  label: string;
  /** 꼭 채워야 하는 칸이면 이름 옆에 "(필수)"를 글자로 보여 줘요(색만으로 알리지 않아요). */
  required?: boolean;
  /** 칸 아래 도움말 */
  hint?: string;
  /** 오류 문구(있을 때만 보여요) */
  error?: string;
  /** 입력 요소를 그리는 함수. 도움말·오류 문구의 id(aria-describedby에 넣을 값)를 넘겨줘요. */
  children: (describedBy: string | undefined) => ReactNode;
};

/**
 * 칸 하나의 틀: 이름(label) + 입력 요소 + 도움말 + 오류 문구
 * 도움말과 오류 문구는 aria-describedby로 입력 요소에 이어져, 화면 낭독기가 칸 이름 다음에 읽어 줘요.
 */
function Field({ id, label, required = false, hint, error, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = `${id}-error`;
  // 오류가 있을 때만 오류 문구 id를 이어요. 없는 오류를 읽지 않게요.
  const describedBy = [hintId, error ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="glow">
        {label} {required && <span className="text-crt-dim">(필수)</span>}
      </label>
      {children(describedBy)}
      {hint && (
        <p id={hintId} className="text-crt-dim">
          {hint}
        </p>
      )}
      {/* 오류 문구 자리. 비어 있어도 요소는 둬서 aria-errormessage가 늘 가리킬 수 있어요. */}
      <p id={errorId} className="field-error">
        {error}
      </p>
    </div>
  );
}

/** TextField가 받는 값: Field의 값 + 글자 칸에 필요한 값 */
type TextFieldProps = Omit<FieldProps, "children"> & {
  value: string;
  onChange: (value: string) => void;
  inputMode?: "numeric" | "text";
  spellCheck?: boolean;
  autoCapitalize?: "none" | "sentences";
};

/** 한 줄 글자 칸 */
function TextField({ value, onChange, inputMode, spellCheck, autoCapitalize, ...field }: TextFieldProps) {
  return (
    <Field {...field}>
      {(describedBy) => (
        <input
          id={field.id}
          type="text"
          required={field.required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode={inputMode}
          spellCheck={spellCheck}
          autoCapitalize={autoCapitalize}
          aria-invalid={field.error ? true : undefined}
          aria-describedby={describedBy}
          aria-errormessage={field.error ? `${field.id}-error` : undefined}
          className="field w-full"
        />
      )}
    </Field>
  );
}

/** FileButton이 받는 값 */
type FileButtonProps = {
  /** 단추 글자(= 파일 고르기 칸의 이름) */
  label: string;
  /** 고를 수 있는 파일 종류 */
  accept: string;
  /** 여러 개를 한 번에 고를 수 있는지 */
  multiple?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  /** 파일 고르기 칸의 id(오류가 나면 이리로 초점을 옮겨요) */
  id?: string;
  /** 오류 문구 id */
  describedBy?: string;
  /** 단추 너비 등 모양(기본: 글자만큼 w-fit). 예: 포스터와 같은 너비로 "w-full justify-center" */
  className?: string;
};

/**
 * 단추 모양의 파일 고르기 칸
 *
 * 진짜 <input type="file">을 화면에서만 숨기고(sr-only, 키보드·화면 낭독기는 그대로 써요) <label>을 단추처럼 꾸며요.
 * 단추 글자가 곧 파일 칸의 이름이라, 화면 낭독기는 "포스터 고르기, 파일 선택"처럼 읽어요.
 * 초점이 오면 단추 둘레에 점선 테두리가 그려져요(globals.css의 .file-button).
 */
function FileButton({ label, accept, multiple = false, onChange, disabled = false, id, describedBy, className = "w-fit" }: FileButtonProps) {
  return (
    <label className={`btn-line file-button ${className}`}>
      {label}
      <input id={id} type="file" accept={accept} multiple={multiple} onChange={onChange} disabled={disabled} aria-describedby={describedBy} className="sr-only" />
    </label>
  );
}
