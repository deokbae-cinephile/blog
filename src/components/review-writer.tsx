/**
 * @file 리뷰 라이터 = 리뷰 추가·수정 화면 (review-writer.tsx)
 *
 * 이 파일이 하는 일
 *   글쓴이가 리뷰를 추가하고 수정하는 폼이에요. 본문은 Markdown으로 써요.
 *
 *     넓은 화면(1024px~)은 3칸: [포스터 | 영화 정보 2열 × 5행]
 *     ┌ 포스터 ───────┐ ┌ 영화 정보 ─────────────────────────────────┐
 *     │ [미리보기]     │ │ [필수] 주소          │ [필수] 한글 제목      │
 *     │ [포스터 고르기]│ │ 영문 제목            │ [필수] 개봉 연도      │  ← 단추는 포스터와 같은 너비
 *     │ [포스터 빼기]  │ │ [필수] 감독          │ 출연                 │  ← 출연은 5명까지(넘으면 저장할 때 알려요)
 *     │               │ │ 상영 시간(분)        │ [필수] 장르(여러 개)  │
 *     │               │ │ [필수] 평점(처음 5.0) │ [필수] 한 줄 평       │
 *     └───────────────┘ └──────────────────────────────────────────┘
 *     ┌ 본문 ─────────────────────────────────────────────────┐
 *     │ [장면 사진 넣기] → 커서 자리에 ![](/images/...) 줄이 들어가요 │
 *     │ 본문(Markdown) <textarea> │ 미리 보기(저장한 뒤의 모습)  │  ← 좁은 화면은 탭으로 바꿔 봐요
 *     └──────────────────────────────────────────────────────┘
 *     [리뷰 저장] [임시 저장] [취소]
 *   좁은 화면에서는 한 칸으로, 포스터 → 영화 정보 → 본문 차례로 쌓여요(코드 순서도 같아서 읽는 순서가 같아요).
 *   칸 아래 도움말은 주소에만 둬요. 나머지 칸은 이름만으로 알 수 있고, 틀리면 오류 문구가 고치는 방법을 알려 줘요.
 *   꼭 적어야 하는 칸은 이름 앞에 "[필수]"를 보여요(예: "[필수] 한글 제목"). 화면 낭독기는 대괄호 없이 "필수 한글 제목"으로 읽고,
 *   입력 칸에는 required도 달려 있어요.
 *
 * 저장하는 순서
 *   1. 칸 검사(lib/review-form.ts) — 틀린 칸이 있으면 "고칠 곳" 목록을 보여 주고 거기로 초점을 옮겨요.
 *   2. 새로 고른 포스터·장면 사진을 한 장씩 올려요(app/api/images). 본문에서 지운 사진은 올리지 않아요.
 *   3. 칸 값과 올린 사진 목록을 저장 API(app/api/reviews)로 보내요. 서버가 검사한 뒤 저장소에 커밋해요.
 *   4. "저장했습니다" 안내. GitHub Actions가 검사한 뒤 다시 배포하면(몇 분 뒤) 블로그에 보여요.
 *
 * 사진은 올리기 전에 줄여요
 *   고르는 순간 브라우저 안에서 긴 변 1600px로 줄여요(포스터는 JPG, 장면 사진은 WebP. lib/shrink-image.ts). 이미 작은 사진과 GIF는 그대로예요.
 *   그래서 4MB가 넘는 휴대폰 사진도 고를 수 있어요. 화면에서는 형광 초록 4단계 명암과 주사선으로 바꿔 보여 줘요(SVG 필터).
 *
 * 임시 저장(lib/drafts.ts)
 *   [임시 저장]은 검사 없이 지금 칸 값과 고른 사진을 이 브라우저(IndexedDB)에 저장해요. 쓰다 만 글도 돼요.
 *   폼 맨 위의 "임시 저장한 글"에서 [불러오기]로 이어 쓰고, [삭제]로 지워요.
 *   새 글 화면에는 새 글의 임시 저장본만, 수정 화면에는 그 리뷰의 임시 저장본만 보여요.
 *   리뷰를 저장하면 불러왔던 임시 저장본은 지워요(다 쓴 글이니까요).
 *
 * 저장 로딩
 *   [리뷰 저장]·[임시 저장]을 누르면 단추 바로 아래에 로딩 UI(깜빡이는 커서 + 16칸 막대, loading-status.tsx)를 보여요.
 *     리뷰 저장: "사진을 올리는 중(1/2)" → "리뷰를 저장하는 중"   임시 저장: "임시 저장하는 중"(최소 0.4초)
 *   안내 영역(role="status")은 처음부터 두고 내용만 바꿔서, 화면 낭독기가 단계마다 읽어 줘요.
 *
 * 두 번 누름 막기
 *   [저장]을 빠르게 두 번 눌러도 저장은 한 번만 해요. useState는 다음 그리기에야 바뀌어서 useRef 잠금을 함께 써요.
 *   저장에 성공하면 폼을 떠나므로(저장 완료 안내로 바뀌어요) 잠금을 풀지 않고, 실패했을 때만 풀어요.
 *
 * 누가 쓰나요?
 *   app/write/page.tsx(리뷰 추가), app/write/[slug]/page.tsx(리뷰 수정)
 */

"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { type ChangeEvent, type FormEvent, type KeyboardEvent, type MouseEvent, type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
// flushSync: 화면 바꾸기를 바로 끝내게 하는 React 기능이에요. 숨어 있던 본문 칸을 보인 "다음"에 초점을 옮길 때 써요.
import { flushSync } from "react-dom";

import { type ApiResult, createReview, updateReview, uploadImage } from "@/lib/admin-api";
import { deleteDraft, type Draft, type DraftSummary, listDrafts, loadDraft, saveDraft } from "@/lib/drafts";
import { GENRES, type Genre } from "@/lib/genres";
import { indentText } from "@/lib/indent";
import { formatBytes, shrinkImage } from "@/lib/shrink-image";
import { type FieldErrors, validateReviewForm } from "@/lib/review-form";
import { SLUG } from "@/lib/review-schema";
import { REVIEW_DETAIL_PUBLIC } from "@/lib/site";
import { EMPTY_VALUES, type ReviewFormValues, withFormDefaults } from "@/lib/review-values";
import { extensionOf, POSTER_ACCEPT, SCENE_ACCEPT, uploadProblem } from "@/lib/upload-rules";

import { Choice, ChoiceGroup } from "./choice-chips";
import { LoadingStatus } from "./loading-status";
import { PixelArt } from "./pixel-art";
import { DefaultPoster } from "./poster";
import { PreviewLoading } from "./preview-loading";
import { type PaneView, WritePreviewPanes } from "./write-preview-panes";

/**
 * 본문 미리 보기(components/markdown-preview.tsx)는 브라우저에서만 불러와요(ssr: false).
 * 미리 보기는 Markdown 변환 도구(lib/markdown.ts)를 쓰는데, 서버에서 이 화면을 그릴 때 함께 묶이면 워커가 그만큼(압축 약 64KB) 무거워져요.
 * 미리 보기는 원래 브라우저에서만 변환하니 서버에서 그릴 일이 없어요. 받는 동안은 같은 로딩 화면을 보여요.
 */
const MarkdownPreview = dynamic(() => import("./markdown-preview").then((module) => module.MarkdownPreview), {
  ssr: false,
  loading: () => <PreviewLoading />,
});

/* ──────────────────────────────────────────────────────────────
 * 1. 화면이 받는 값과 정해 둔 값
 * ────────────────────────────────────────────────────────────── */

/** 수정 화면이 서버에서 원고를 읽은 결과(app/write/[slug]/page.tsx가 lib/review-file.ts로 읽어 넘겨줘요) */
export type EditSource =
  | {
      ok: true;
      /** 원고에서 읽은 칸 값(주소 빼고) */
      values: Omit<ReviewFormValues, "slug">;
    }
  | {
      ok: false;
      /** 읽지 못한 까닭과 고치는 방법 */
      message: string;
      /** 원고 글자 전체(본문 칸에 그대로 넣어 손으로 고칠 수 있게 해요) */
      source: string;
    };

/** ReviewWriter가 받는 값. 리뷰 추가면 mode만, 수정이면 서버가 읽은 원고와 그 내용 번호까지 받아요. */
type Props =
  | { mode: "create" }
  | {
      mode: "edit";
      /** 수정할 리뷰 주소 */
      slug: string;
      /** 저장소에서 읽은 원고(서버가 칸 값으로 바꿔 둔 것) */
      parsed: EditSource;
      /** 원고의 내용 번호(sha). 저장할 때 그사이 다른 곳에서 고쳤는지 비교해요. */
      baseSha: string;
    };

/** 평점 고르기 칸의 값: 0.5, 1.0, ... 5.0 (0점은 없어요) */
const RATINGS = Array.from({ length: 10 }, (_, index) => ((index + 1) / 2).toFixed(1));

/** 저장 로딩 UI를 보이는 가장 짧은 시간(ms). 순식간에 끝나는 임시 저장도 로딩이 번쩍이지 않고 보이게 해요. */
const MIN_BUSY_MS = 400;

/** 평점 칸의 처음 값. "고르세요" 대신 가장 높은 점수를 골라 둬요. */
const DEFAULT_RATING = "5.0";

/** 글쓰기 화면의 빈 칸 값: 원고의 빈 값에 평점만 처음 값(5.0)을 넣어요. */
const WRITER_EMPTY_VALUES: ReviewFormValues = { ...EMPTY_VALUES, rating: DEFAULT_RATING };

/** 평점 고르기 칸 오른쪽의 ▼ 그림(7×4칸, 한 칸 2px → 14×8px). 사이트의 픽셀 그림과 같은 모양이에요. */
const SELECT_ARROW_ROWS = ["#######", ".#####.", "..###..", "...#..."] as const;

/** 칸 이름(화면에 보이는 이름). 고칠 곳 목록에서 "한글 제목: 한글 제목을 입력하세요."처럼 써요. */
const FIELD_LABELS: Record<keyof ReviewFormValues, string> = {
  poster: "포스터",
  posterAlt: "포스터 설명",
  slug: "주소",
  title: "한글 제목",
  originalTitle: "영문 제목",
  year: "개봉 연도",
  director: "감독",
  cast: "출연",
  runtime: "상영 시간",
  genres: "장르",
  rating: "평점",
  oneLiner: "한 줄 평",
  body: "본문",
  publishedAt: "글 쓴 날",
};

/**
 * 고칠 곳 목록을 보여 줄 순서(화면에 놓인 순서와 같아요).
 * 포스터 설명(posterAlt)은 화면에 칸이 없어요. 원고에 적혀 있으면 그대로 두고, 없으면 상세 화면이 "영화 ‘제목’ 포스터"로 읽어요.
 */
const FIELD_ORDER = Object.keys(FIELD_LABELS) as (keyof ReviewFormValues)[];

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
  // 결과 안내(포스터 고름, 올리는 중) — role="status"
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

  // 임시 저장: 지금 쓰는 글의 임시 저장 번호(불러왔거나 한 번 저장했으면 있어요)와, 이 화면에 보일 임시 저장한 글 목록
  const [draftId, setDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  // [임시 저장] 단추 아래의 결과 안내(role="status")
  const [draftNotice, setDraftNotice] = useState("");
  // 단추 아래 로딩 UI의 글자(저장·임시 저장하는 동안만, 예: "리뷰를 저장하는 중"). 비어 있으면 로딩 UI를 보이지 않아요.
  const [busyLabel, setBusyLabel] = useState("");
  // [임시 저장] 두 번 누름 막기: 잠금(useRef)과 단추 막기(useState)를 함께 써요(저장과 같은 까닭).
  const draftLockRef = useRef(false);
  const [draftBusy, setDraftBusy] = useState(false);
  // 사진을 줄이는 중인 작업 수. 그동안은 [리뷰 저장]·[임시 저장]을 막아요(줄인 사진이 빠진 채 저장되지 않게).
  // 잠금은 useRef(바로 바뀜), 단추 막기는 useState(다시 그리기)로 함께 둬요.
  const photoJobsRef = useRef(0);
  const [photoBusy, setPhotoBusy] = useState(false);
  // 포스터 고르기 작업 번호. 줄이는 사이 다른 포스터를 고르거나 [포스터 빼기]를 누르면 번호가 바뀌어, 늦게 끝난 예전 결과를 버려요.
  const posterJobRef = useRef(0);
  // 마지막으로 임시 저장했거나 불러온 상태. 떠날 때 "저장하지 않은 내용"이 있는지 이것과 견줘요.
  const [savedState, setSavedState] = useState<SavedState>(() => ({ values: initial.values, poster: null, scenes: new Map() }));
  // 수정 화면이면 그 리뷰 주소(그 리뷰의 임시 저장본만 보여요), 새 글이면 null
  const editSlug = props.mode === "edit" ? props.slug : null;

  // 초점을 옮길 곳들의 손잡이
  const summaryRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const savedRef = useRef<HTMLHeadingElement>(null);
  const draftsHeadingRef = useRef<HTMLHeadingElement>(null);
  const draftButtonRef = useRef<HTMLButtonElement>(null);
  // 본문을 바꾼 뒤 커서(고른 범위)를 둘 자리 [시작, 끝]. 다음 그리기에서 맞춰요(사진 줄 넣기, Tab 들여쓰기).
  const selectionRef = useRef<[number, number] | null>(null);
  // 본문 칸에서 Esc를 누른 바로 다음 Tab은 들여쓰지 않고 원래대로 다음 칸으로 넘어가요(글상자에서 빠져나갈 길).
  const tabLeavesRef = useRef(false);
  // 늘 최신 칸 값·장면 사진·포스터를 담아 두는 손잡이. 기다리는 사이(사진 줄이기, 임시 저장 읽기) 바뀐 값을 알아채려고 써요.
  const latestRef = useRef({ values, scenes, poster });
  useLayoutEffect(() => {
    latestRef.current = { values, scenes, poster };
  });

  /**
   * 사진을 줄이는 일을 하는 동안 "사진 처리 중"으로 표시해요(저장 단추를 막아요). 끝나면(실패해도) 풀어요.
   * @param work 사진을 줄이는 일
   */
  async function processPhotos<T>(work: () => Promise<T>): Promise<T> {
    photoJobsRef.current += 1;
    setPhotoBusy(true);
    setNotice("사진을 준비하는 중입니다.");
    try {
      return await work();
    } finally {
      photoJobsRef.current -= 1;
      if (photoJobsRef.current === 0) setPhotoBusy(false);
    }
  }

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

  /* ── 포스터 ── */

  /**
   * [포스터 고르기]로 그림을 고르면 큰 사진은 줄이고(lib/shrink-image.ts) 미리보기를 보여 주고, 저장할 때 올려요.
   * 주소보다 먼저 골라도 돼요. 파일 이름(<주소>.jpg 등)은 주소를 적는 대로 맞춰져요(changeSlug).
   */
  async function handlePosterChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    // 형식(확장자)은 줄이기 전에 먼저 봐요. 크기(4MB)는 줄인 뒤에 봐요(큰 휴대폰 사진도 줄이면 들어가요).
    const typeProblem = uploadProblem({ name: picked.name, size: 0 }, "poster");
    if (typeProblem) {
      setErrors((current) => ({ ...current, poster: typeProblem }));
      return;
    }
    // 포스터는 공유 미리 보기(카카오톡 등)에서도 보이게 JPG로 줄여요.
    const job = ++posterJobRef.current;
    const { file, shrunk } = await processPhotos(() => shrinkImage(picked, "poster"));
    // 줄이는 사이 다른 포스터를 골랐거나 [포스터 빼기]·[불러오기]를 했으면, 이 결과는 버려요(나중 선택이 이겨요).
    if (job !== posterJobRef.current) return;
    const problem = uploadProblem(file, "poster");
    if (problem) {
      setErrors((current) => ({ ...current, poster: problem }));
      setNotice("");
      return;
    }
    // 확장자는 jpeg도 jpg로 맞춰 파일 이름을 <주소>.jpg처럼 정해요.
    const extension = extensionOf(file.name).replace("jpeg", "jpg");
    // URL.createObjectURL: 고른 파일을 서버에 올리지 않고도 화면에 보여 줄 수 있는 임시 주소(blob:)를 만들어요.
    setPoster({ file, url: URL.createObjectURL(file), extension });
    // 주소가 이미 있으면 파일 이름을 바로 정하고, 아직이면 비워 둬요(주소를 적으면 채워져요). 줄이는 사이 바뀐 주소도 반영해요.
    const slug = latestRef.current.values.slug;
    setField("poster", SLUG.test(slug) ? `${slug}.${extension}` : "");
    const resized = shrunk ? ` 큰 사진이라 ${formatBytes(picked.size)}에서 ${formatBytes(file.size)}로 줄였습니다.` : "";
    setNotice(`포스터로 ${picked.name}을(를) 골랐습니다.${resized} 저장하면 함께 올라갑니다.`);
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

  /** [포스터 빼기]: 포스터 없이 저장해요(화면에는 기본 포스터가 보여요). 줄이던 포스터가 있으면 그 결과도 버려요. */
  function handlePosterRemove() {
    posterJobRef.current += 1;
    setPoster(null);
    setField("poster", "");
    setNotice("포스터를 뺐습니다. 저장하면 기본 포스터가 보입니다.");
  }

  /* ── 장면 사진 ── */

  /** [장면 사진 넣기]로 그림을 고르면 큰 사진은 줄이고(lib/shrink-image.ts), 본문의 커서 자리에 사진 줄을 넣어요. */
  async function handleScenesChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (picked.length === 0) return;
    // 좁은 화면에서 미리 보기를 보고 있었어도, 사진 줄은 쓰기 칸에 들어가니 쓰기 칸을 보여 줘요.
    setBodyView("input");
    if (!slugReady) {
      setErrors((current) => ({ ...current, slug: "사진을 넣기 전에 주소를 먼저 적어 주세요. 사진은 그 주소의 폴더에 저장됩니다." }));
      document.getElementById(fieldId("slug"))?.focus();
      return;
    }

    // 형식이 맞는 사진만 줄여요(한 장씩 차례로: 큰 사진 여러 장을 한꺼번에 읽으면 휴대폰 메모리가 모자랄 수 있어요).
    const typeOk = picked.filter((file) => uploadProblem({ name: file.name, size: 0 }, "scene") === null);
    const files: File[] = [];
    let shrunkCount = 0;
    await processPhotos(async () => {
      for (const file of typeOk) {
        const result = await shrinkImage(file, "scene");
        files.push(result.file);
        if (result.shrunk) shrunkCount += 1;
      }
    });
    setNotice("");
    // 줄이는 동안 바뀐 본문·사진도 반영하려고 최신 값으로 이어 가요.
    const { values, scenes } = latestRef.current;
    // 줄이는 사이 주소 칸을 비우거나 틀리게 고쳤으면, 사진 경로(/images/<주소>/…)를 만들 수 없어서 멈추고 알려요.
    if (!SLUG.test(values.slug)) {
      setErrors((current) => ({ ...current, slug: "사진을 넣기 전에 주소를 먼저 적어 주세요. 사진은 그 주소의 폴더에 저장됩니다." }));
      document.getElementById(fieldId("slug"))?.focus();
      return;
    }

    // 받을 수 없는 파일은 이유를 모아 알려 주고(형식이 틀렸거나, 줄여도 4MB가 넘는 사진), 받을 수 있는 것만 넣어요.
    const problems = [
      ...picked.filter((file) => !typeOk.includes(file)).map((file) => uploadProblem({ name: file.name, size: 0 }, "scene")),
      ...files.map((file) => uploadProblem(file, "scene")),
    ].filter((problem): problem is string => problem !== null);
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
      announceQuietly(`사진 ${lines.length}장을 본문에 넣었습니다.${shrunkCount > 0 ? ` 큰 사진 ${shrunkCount}장은 줄였습니다.` : ""}`);
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
    setBusyLabel("");
    if (result.errors && Object.keys(result.errors).length > 0) {
      showErrors(result.errors);
    } else {
      setFailure(result.message);
    }
  }

  /** [저장]을 누르면 실행돼요. */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // 저장 중이거나, 사진을 줄이는 중이거나, 임시 저장하는 중이면 누르지 못해요(단추도 막혀 있어요).
    if (lockRef.current || photoJobsRef.current > 0 || draftLockRef.current) return;

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
    setDraftNotice("");
    setBusyLabel("리뷰를 저장하는 중");

    // 2) 새로 고른 사진 올리기. 본문에 남아 있는 장면 사진과 새 포스터만 올려요.
    const files: [string, File][] = [];
    if (posterFile && values.poster) files.push([`public/posters/${values.poster}`, posterFile]);
    for (const [path, file] of scenes) if (values.body.includes(path)) files.push([`public${path}`, file]);

    const uploads: { path: string; sha: string }[] = [];
    for (const [index, [path, file]] of files.entries()) {
      setBusyLabel(`사진을 올리는 중(${index + 1}/${files.length})`);
      const result = await uploadImage(file, path);
      if (!result.ok) return fail(result);
      uploads.push(result.data);
    }

    // 3) 리뷰 저장
    setBusyLabel("리뷰를 저장하는 중");
    const request = { values, uploads, baseSha: props.mode === "edit" ? props.baseSha : undefined };
    const result = props.mode === "edit" ? await updateReview(props.slug, request) : await createReview(request);
    if (!result.ok) return fail(result);

    // 4) 성공: 저장 완료 안내로 바꿔요. 폼을 떠나니 잠금은 풀지 않아요.
    //    불러왔던 임시 저장본은 다 쓴 글이라 지워요(지우지 못해도 저장은 끝났으니 알리지 않아요).
    if (draftId) void deleteDraft(draftId).catch(() => undefined);
    setNotice("");
    setBusyLabel("");
    setSavedSlug(result.data.slug);
    setPhase("saved");
  }

  /* ── 임시 저장 ── */

  // 이 화면에 보일 임시 저장한 글을 처음 한 번 읽어요(브라우저에만 있어서 화면이 열린 뒤에 읽어요).
  useEffect(() => {
    let cancelled = false;
    listDrafts().then(
      (all) => {
        if (!cancelled) setDrafts(draftsFor(all, editSlug));
      },
      // 이 브라우저에서 임시 저장을 쓸 수 없으면(사생활 보호 창 등) 목록을 보이지 않아요.
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [editSlug]);

  /** 임시 저장한 글 목록을 다시 읽어요(저장·삭제한 뒤). */
  async function refreshDrafts() {
    try {
      setDrafts(draftsFor(await listDrafts(), editSlug));
    } catch {
      // 읽지 못하면 목록을 그대로 둬요.
    }
  }

  /** [임시 저장]: 지금 칸 값과 고른 사진을 이 브라우저에 저장해요. 검사하지 않아요(쓰다 만 글도 저장돼요). */
  async function handleDraftSave() {
    if (draftLockRef.current || lockRef.current || photoJobsRef.current > 0) return;
    draftLockRef.current = true;
    setDraftBusy(true);
    setFailure("");
    setDraftNotice("");
    setBusyLabel("임시 저장하는 중");
    // 브라우저 저장은 순식간이라 로딩 UI가 번쩍이고 사라지지 않게, 적어도 0.4초는 보여요(첫 화면 로딩 레이어와 같은 길이).
    const shownAt = Date.now();
    // 처음 저장하면 새 번호를, 불러왔거나 저장한 적이 있으면 같은 번호를 써서 그 글을 새 내용으로 바꿔요.
    const draft: Draft = {
      id: draftId ?? crypto.randomUUID(),
      mode,
      reviewSlug: editSlug ?? "",
      savedAt: Date.now(),
      // 수정: 이 화면을 연 때의 원고 번호. 나중에 불러올 때 그사이 리뷰가 바뀌었는지 알아보려고 적어 둬요.
      ...(props.mode === "edit" ? { baseSha: props.baseSha } : {}),
      values,
      poster: poster ? { file: poster.file, extension: poster.extension } : null,
      // 본문에 남아 있는 장면 사진만 담아요. 본문에서 지운 사진 파일은 저장 공간만 차지해요([리뷰 저장]도 이렇게 올려요).
      scenes: [...scenes].filter(([path]) => values.body.includes(path)),
      imagesSlug,
    };
    try {
      await saveDraft(draft);
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, MIN_BUSY_MS - (Date.now() - shownAt))));
      setDraftId(draft.id);
      setSavedState({ values, poster: posterFile, scenes });
      setDraftNotice(`${formatDraftTime(draft.savedAt)}에 임시 저장했습니다. 이 브라우저에 저장했고, 위의 ‘임시 저장한 글’에서 다시 불러올 수 있습니다.`);
      await refreshDrafts();
    } catch {
      setFailure("임시 저장하지 못했습니다. 이 브라우저가 저장 공간을 쓸 수 없는 상태일 수 있습니다(사생활 보호 창 등). 일반 창에서 다시 시도해 주세요.");
    } finally {
      draftLockRef.current = false;
      setDraftBusy(false);
      setBusyLabel("");
    }
  }

  /**
   * [불러오기]: 임시 저장한 글로 칸과 사진을 채워요. 지금 쓰던 내용이 있으면 먼저 물어요.
   * 수정 화면에서는, 임시 저장본을 쓴 뒤에 리뷰가 다른 곳에서 바뀌었으면(원고 번호가 다름) 덮어쓴다는 것을 알리고 물어요.
   * 불러오기로 고르면 지금 원고 번호로 저장해요(알고 고른 덮어쓰기). 예전 번호로 저장하면 늘 "그사이 바뀜"으로 막혀서요.
   */
  async function handleDraftLoad(id: string) {
    // 사진을 줄이는 중이면 불러오지 않아요(줄이던 사진이 불러온 글에 섞이지 않게). 단추도 막혀 있어요.
    if (photoJobsRef.current > 0) return;
    if (dirty && !window.confirm("지금 쓰던 내용을 지우고 임시 저장한 글을 불러올까요?")) return;
    // 읽는 동안 입력이 바뀌었는지 알아보려고, 읽기 전의 값을 기억해요.
    const before = latestRef.current;
    setDraftBusy(true);
    let draft: Draft | undefined;
    try {
      draft = await loadDraft(id);
    } catch {
      draft = undefined;
    } finally {
      setDraftBusy(false);
    }
    if (!draft) {
      setFailure("임시 저장한 글을 찾지 못했습니다. 목록을 다시 읽었습니다.");
      await refreshDrafts();
      return;
    }
    // 읽는 사이 칸이나 사진을 고쳤으면, 그 내용을 지우지 않게 멈춰요.
    const now = latestRef.current;
    if (now.values !== before.values || now.scenes !== before.scenes || now.poster !== before.poster) {
      setNotice("임시 저장한 글을 읽는 동안 글이 바뀌어서 불러오지 않았습니다. 다시 눌러 주세요.");
      return;
    }
    if (
      props.mode === "edit" &&
      draft.baseSha &&
      draft.baseSha !== props.baseSha &&
      !window.confirm("이 임시 저장본을 쓴 뒤에 리뷰가 다른 곳에서 바뀌었습니다. 불러와서 저장하면 그사이 바뀐 내용은 사라집니다. 그래도 불러올까요?")
    ) {
      return;
    }
    // 줄이던 포스터가 있으면 그 결과는 버려요(불러온 포스터가 이겨요).
    posterJobRef.current += 1;
    // 예전 칸 모양으로 저장한 글도 지금 칸에 맞춰요(없는 칸은 빈 값, 사라진 칸은 버림 — lib/review-values.ts).
    // 수정 화면은 주소를 바꾸지 않아요(그 리뷰를 고치는 화면이니까요).
    const loadedValues = withFormDefaults(draft.values);
    const nextValues = editSlug === null ? loadedValues : { ...loadedValues, slug: editSlug };
    const nextScenes = new Map(draft.scenes);
    setValues(nextValues);
    // 포스터 미리보기용 임시 주소(blob:)는 새로 만들어요. 예전 주소는 정리 함수가 지워요(위의 useEffect).
    setPoster(draft.poster ? { ...draft.poster, url: URL.createObjectURL(draft.poster.file) } : null);
    setScenes(nextScenes);
    setImagesSlug(draft.imagesSlug);
    setDraftId(draft.id);
    setErrors({});
    setFailure("");
    setDraftNotice("");
    setSavedState({ values: nextValues, poster: draft.poster?.file ?? null, scenes: nextScenes });
    setNotice(`${formatDraftTime(draft.savedAt)}에 임시 저장한 글을 불러왔습니다.`);
  }

  /** [삭제]: 확인한 뒤 임시 저장한 글을 지워요. */
  async function handleDraftDelete(draft: DraftSummary) {
    const name = draft.title || "제목 없음";
    if (!window.confirm(`임시 저장한 글 ‘${name}’을(를) 지울까요? 지우면 되돌릴 수 없습니다.`)) return;
    try {
      await deleteDraft(draft.id);
    } catch {
      setFailure("임시 저장한 글을 지우지 못했습니다. 다시 시도해 주세요.");
      return;
    }
    // 지금 쓰는 글의 임시 저장본을 지웠으면: 다음 [임시 저장]은 새 글로 저장하고,
    // 화면의 내용은 이제 어디에도 저장되지 않았으니 떠날 때 다시 묻도록 처음 상태와 견줘요.
    if (draft.id === draftId) {
      setDraftId(null);
      setSavedState({ values: initial.values, poster: null, scenes: new Map() });
    }
    await refreshDrafts();
    setNotice(`임시 저장한 글 ‘${name}’을(를) 지웠습니다.`);
    // 누른 [삭제] 단추가 사라져 초점을 잃지 않게, 목록 제목(남아 있으면)이나 [임시 저장] 단추로 옮겨요.
    requestAnimationFrame(() => (draftsHeadingRef.current ?? draftButtonRef.current)?.focus());
  }

  // 저장 완료 안내가 나오면 그 제목으로 초점을 옮겨요(누른 [저장] 단추가 사라지니까요).
  useEffect(() => {
    if (phase === "saved") savedRef.current?.focus();
  }, [phase]);

  /* ── 저장하지 않고 떠나려 할 때 묻기 ── */

  // 처음 값(또는 마지막으로 임시 저장·불러온 상태)과 칸 값이나 고른 사진이 다르면 "저장하지 않은 내용이 있음"으로 봐요.
  // (그릴 때마다 견줘도 가벼워요. React Compiler가 알아서 다시 쓰기를 줄여 줘요.)
  const dirty =
    JSON.stringify(values) !== JSON.stringify(savedState.values) || posterFile !== savedState.poster || !sameScenes(scenes, savedState.scenes);
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
          {/* 리뷰 상세는 v3에서 열어요(lib/site.ts). 그전에는 [이 리뷰 보기]를 두지 않아요(눌러도 목록으로 가요). */}
          {REVIEW_DETAIL_PUBLIC && (
            <li>
              <Link href={`/reviews/${savedSlug}`} className="btn-line">
                이 리뷰 보기
              </Link>
            </li>
          )}
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
    // 폼과 저장 진행 안내를 한 묶음으로 둬요. 진행 안내는 폼 밖에 있어야 해요:
    // 저장하는 동안 폼은 aria-busy라서, 화면 낭독기가 그 안의 바뀜을 끝날 때까지 미뤄 읽을 수 있거든요(WAI-ARIA 1.2).
    // gap-3: 진행 안내가 맨 아래 단추 줄 바로 밑(12px)에 붙어 보여요.
    <div className="grid gap-3">
    {/* noValidate: 브라우저 기본 오류 말풍선 대신 우리 문구를 보여 줘요. aria-busy: 저장하는 동안 폼이 바뀌는 중이라고 알려요. */}
    <form onSubmit={handleSubmit} noValidate className="grid gap-10" aria-busy={saving}>
      {/* 결과 안내(포스터 고름·올리는 중). role="status": 끼어들지 않고 차례대로 읽어 줘요.
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

      {/* 임시 저장한 글(이 브라우저에 저장해 둔 글). 있을 때만 보여요. 최근에 저장한 것부터예요.
          [불러오기]·[삭제]의 이름은 보이는 글자 그대로이고, 어느 글인지는 설명(aria-describedby)으로 덧붙여요. */}
      {drafts.length > 0 && (
        <section aria-labelledby={`${baseId}-drafts`} className="grid gap-3">
          {/* tabIndex -1: 글을 지운 뒤 초점을 여기로 옮겨요(Tab 순서에는 들어가지 않아요). */}
          <h2 id={`${baseId}-drafts`} ref={draftsHeadingRef} tabIndex={-1} className="glow outline-none">
            임시 저장한 글 <span className="text-crt-dim">({drafts.length})</span>
          </h2>
          {/* 넓은 화면(sm~): 목록을 [글 이름 | 단추] 두 칸 표처럼 놓아 단추가 한 세로줄에 맞아요.
              줄(li)은 두 칸을 다 쓰고 grid-cols-subgrid로 목록의 칸 너비를 그대로 따라요. 좁은 화면은 이름 아래에 단추가 와요. */}
          <ul className="grid gap-3 sm:grid-cols-[auto_auto] sm:items-center sm:justify-start sm:gap-x-6">
            {drafts.map((draft) => {
              const labelId = `${baseId}-draft-${draft.id}`;
              return (
                <li key={draft.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:col-span-2 sm:grid sm:grid-cols-subgrid">
                  <span id={labelId}>
                    {draft.title || "제목 없음"}
                    <span className="text-crt-dim">
                      {" · "}
                      <time dateTime={new Date(draft.savedAt).toISOString()}>{formatDraftTime(draft.savedAt)}</time>
                      {draft.id === draftId ? " · 지금 쓰는 글" : ""}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      aria-describedby={labelId}
                      onClick={() => void handleDraftLoad(draft.id)}
                      disabled={saving || draftBusy || photoBusy}
                      className="btn-line"
                    >
                      불러오기
                    </button>
                    <button
                      type="button"
                      aria-describedby={labelId}
                      onClick={() => void handleDraftDelete(draft)}
                      disabled={saving || draftBusy}
                      className="btn-line"
                    >
                      삭제
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
            {/* 미리보기: 화면에서처럼 형광 초록으로 보여요(올라가는 파일은 색을 바꾸지 않은 사진이에요). 꾸밈이라 alt를 비워요. */}
            <span className="poster-frame relative block aspect-[2/3] w-full">
              {posterSrc ? (
                // unoptimized: 브라우저 안의 blob: 주소는 이미지 최적화를 거칠 수 없어서 원본 그대로 보여 줘요.
                <Image src={posterSrc} alt="" fill unoptimized sizes="(min-width: 1024px) 288px, 160px" className="poster-image object-cover" />
              ) : (
                // 포스터를 아직 고르지 않았으면 상세 화면과 같은 기본 포스터(빈 필름 그림 + NO POSTER)를 보여 줘요.
                // 그림은 꾸밈이라 읽지 않고, 화면 낭독기에는 "고른 포스터 없음"이라고 알려 줘요.
                <>
                  <DefaultPoster alt="" size="large" />
                  <span className="sr-only">고른 포스터 없음</span>
                </>
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

        {/* 영화 정보: 넓은 화면에서는 오른쪽 두 칸(lg:col-span-2)을 쓰고, 칸들을 2열로 놓아요(주소~한 줄 평 10칸 = 2열 × 5행).
            content-start: 칸들이 위에서부터 놓이게 해요.
            items-start: 같은 행의 옆 칸에 도움말이 길어도 이 칸(입력 상자)이 따라 늘어나지 않고 제 높이를 지켜요. */}
        <fieldset className="grid content-start items-start gap-6 lg:col-span-2 lg:grid-cols-2 lg:gap-x-6" disabled={saving}>
          <legend className="glow mb-4 text-big">영화 정보</legend>

          {mode === "create" ? (
            <TextField
              id={fieldId("slug")}
              label={FIELD_LABELS.slug}
              required
              hint="리뷰 주소와 파일 이름이 됩니다. 영어 소문자, 숫자, 하이픈(-)만 씁니다. (예: shutter-island → /reviews/shutter-island)"
              error={errors.slug}
              value={values.slug}
              onChange={changeSlug}
              spellCheck={false}
              autoCapitalize="none"
            />
          ) : (
            // 주소는 수정할 때 바꿀 수 없어요. 괄호 안내는 다음 줄에 보여요(<br>, 화면 낭독기는 이어서 읽어요).
            <p>
              <span className="text-crt-dim">주소: </span>/reviews/{values.slug}
              <br />
              <span className="text-crt-dim">(수정할 때는 바꿀 수 없습니다.)</span>
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
          <TextField
            id={fieldId("director")}
            label={FIELD_LABELS.director}
            required
            error={errors.director}
            value={values.director}
            onChange={(value) => setField("director", value)}
          />
          {/* 출연: 배우 이름을 쉼표로 나눠 적어요(예: 레오나르도 디카프리오, 마크 러팔로). 한 작품에 5명까지예요(넘으면 저장할 때 알려요).
              저장하면 이름마다 나눠, 상세 화면에서 이름을 누르면 그 배우로 찾은 목록으로 가요. */}
          <TextField
            id={fieldId("cast")}
            label={FIELD_LABELS.cast}
            error={errors.cast}
            value={values.cast}
            onChange={(value) => setField("cast", value)}
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
                // 장르는 체크박스 묶음이라 required를 달 곳이 없어요. "[필수]" 글자가 묶음 이름("필수 장르")에 들어가 필수라고 알려요.
                <>
                  <RequiredMark /> {FIELD_LABELS.genres}
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
                  {/* 목록에 없는 값(저장소 원고를 손으로 고친 4.3 같은 값)이면 그 값을 그대로 보여 주고, 저장할 때 오류로 알려요. */}
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

      {/* 저장·임시 저장·취소. 임시 저장 결과는 단추 바로 아래에 알려요(role="status": 끼어들지 않고 읽어 줘요). */}
      <div className="flex flex-wrap items-center gap-3">
          {/* 사진을 줄이는 중이거나 임시 저장하는 중이면 막아요(한 번에 하나만 저장해요). */}
          <button type="submit" disabled={saving || photoBusy || draftBusy} className="btn-inverse">
            {saving ? "저장하는 중…" : mode === "edit" ? "수정한 내용 저장" : "리뷰 저장"}
          </button>
          <button
            type="button"
            ref={draftButtonRef}
            onClick={() => void handleDraftSave()}
            disabled={saving || draftBusy || photoBusy}
            className="btn-line"
          >
            임시 저장
          </button>
          <Link href={mode === "edit" ? `/reviews/${values.slug}` : "/"} className="btn-line">
            취소
          </Link>
      </div>
    </form>
    {/* 저장 로딩·임시 저장 결과(단추 줄 바로 아래, 폼 밖). 이 안내 영역은 늘 두고 안의 내용만 바꿔요(화면 낭독기가 바뀔 때마다 읽어 줘요).
        저장하는 동안은 로딩 UI(커서 + 막대, live={false}: 안내 영역은 바깥이 맡아요), 끝나면 결과 글자예요. */}
    <div role="status" className="empty:sr-only">
      {busyLabel ? <LoadingStatus label={busyLabel} live={false} /> : draftNotice ? <p className="text-crt-dim">{draftNotice}</p> : null}
    </div>
    </div>
  );
}

/** 마지막으로 임시 저장했거나 불러온 상태(떠날 때 저장하지 않은 내용이 있는지 견줘 봐요) */
type SavedState = { values: ReviewFormValues; poster: File | null; scenes: Map<string, File> };

/** 장면 사진 두 묶음이 같은지(같은 주소에 같은 파일) */
function sameScenes(a: Map<string, File>, b: Map<string, File>): boolean {
  return a.size === b.size && [...a].every(([path, file]) => b.get(path) === file);
}

/** 이 화면에 보일 임시 저장한 글: 새 글 화면(editSlug null)은 새 글 것만, 수정 화면은 그 리뷰 것만 */
function draftsFor(all: DraftSummary[], editSlug: string | null): DraftSummary[] {
  return all.filter((draft) => (editSlug === null ? draft.mode === "create" : draft.mode === "edit" && draft.reviewSlug === editSlug));
}

/** 임시 저장한 때를 "11월 14일 오후 3:12"처럼 보여요. */
function formatDraftTime(time: number): string {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(time);
}

/** 처음 상태(칸 값과 안내)를 만들어요. 수정이면 서버가 읽어 둔 원고로 채워요. */
function initialState(props: Props): { values: ReviewFormValues; notice: string; failure: string } {
  if (props.mode === "create") return { values: WRITER_EMPTY_VALUES, notice: "", failure: "" };
  const { parsed } = props;
  if (!parsed.ok) {
    // 저장소의 원고를 읽지 못했어요(직접 고친 원고가 망가진 경우). 본문 칸에 원고 전체를 넣어 손으로 고칠 수 있게 해요.
    return { values: { ...WRITER_EMPTY_VALUES, slug: props.slug, body: parsed.source }, notice: "", failure: `원고를 읽지 못했습니다: ${parsed.message}` };
  }
  return { values: { ...parsed.values, slug: props.slug }, notice: "", failure: "" };
}

/* ──────────────────────────────────────────────────────────────
 * 3. 칸 조각들
 * ────────────────────────────────────────────────────────────── */

/**
 * 꼭 적어야 하는 칸의 표시 "[필수]". 칸 이름 앞에 빈칸 한 칸을 두고 붙여요(예: "[필수] 한글 제목").
 * 보조 글자색(text-crt-dim)으로 칸 이름보다 덜 눈에 띄게 해요. 대괄호는 꾸밈이라 화면 낭독기가 읽지 않고("필수"만 읽어요),
 * 칸 이름에도 "필수"가 들어가 필수라고 알려 줘요(글자 칸에는 required도 함께 달아요).
 */
function RequiredMark() {
  return (
    <span className="text-crt-dim">
      <span aria-hidden="true">[</span>필수<span aria-hidden="true">]</span>
    </span>
  );
}

/** Field가 받는 값 */
type FieldProps = {
  /** 입력 요소의 id(label이 가리켜요) */
  id: string;
  /** 칸 이름 */
  label: string;
  /**
   * 꼭 채워야 하는 칸이면 이름 앞에 "[필수]"를 글자로 보여 줘요(색만으로 알리지 않아요).
   * 입력 요소에도 required를 달아 필수 상태를 알려요.
   */
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
        {/* "[필수]"와 이름 사이 빈칸 한 칸. */}
        {required && (
          <>
            <RequiredMark />{" "}
          </>
        )}
        {label}
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
