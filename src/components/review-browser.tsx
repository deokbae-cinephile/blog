/**
 * @file 처음 화면의 검색·장르·정렬과 영화 목록 (review-browser.tsx)
 *
 * 이 파일이 하는 일
 *   처음 화면에서 리뷰를 찾고 고르는 영역 전체를 맡습니다.
 *   넓은 화면(1024px~)에서는 왼쪽에 검색 칸, 오른쪽에 영화 목록을 나란히 놓고,
 *   스크롤하면 검색 칸은 왼쪽 위에 붙어 있고 오른쪽 목록만 움직여요(globals.css의 .browse-aside).
 *
 *     ┌ 검색 칸(상세 화면 왼쪽 칸 너비) ┐   영화 목록 ·················· 전체 15편
 *     │ 검색  [__________] [찾기]       │   [포스터] 겨울 정류장 ·········· 4.5
 *     │ 장르  [▶전체 15편] [드라마 5편] │   [포스터] ...
 *     │ 정렬  [▶최신순] [평점순] [조회순] │   (처음 10편, 내려가면 10편씩 더)
 *     └─────────────────────────────────┘
 *
 * 맡은 기능
 *   1. 검색: 글자를 치면 추천 층이 뜨고(search-box.tsx), Enter(또는 찾기 단추)를 누르면 적용해요.
 *   2. 장르 필터, 정렬(최신순·평점순·조회순): 고르는 즉시 적용해요.
 *      조회수는 목록이 열린 뒤 따로 받아 와서(use-view-counts.ts) 항목마다 보여 주고, 조회순 정렬에 써요.
 *   3. 결과 편수 안내: "15편 중 3편"을 화면 낭독기도 읽어 줘요(role="status").
 *   4. 조건을 주소(?q=&genre=&sort=)에 남겨요. 링크를 공유하거나 뒤로 가기를 해도 같은 목록이 보입니다.
 *   5. 결과가 없으면 안내하고, "검색 조건 지우기" 단추로 처음 상태로 돌아가요.
 *      리뷰가 아직 한 편도 없으면 "아직 올린 리뷰가 없습니다"만 보여요.
 *   6. 옛 DOS처럼 ▲ ▼로 리뷰를 고르고 Enter로 열어요(use-list-keys.ts).
 *   7. 무한 스크롤: 처음에는 10편만 보여 주고, 목록 끝에 가까워지면 10편씩 더 보여 줘요.
 *      키보드·화면 낭독기 사용자를 위해 목록 끝에 [n편 더 보기] 단추도 둬요(누르면 새로 나온 첫 리뷰로 초점이 가요).
 *
 * 파일 안의 구성(위에서 아래로)
 *   - ReviewBrowser      : 밖에서 쓰는 컴포넌트. 주소와 화면을 이어 줘요.
 *   - UrlBoundBrowser    : 주소의 조건을 읽고, 조건이 바뀌면 주소를 바꿔요.
 *   - ReviewBrowserView  : 실제 화면(검색창·버튼·목록). 주소를 모르고 받은 조건대로만 그려서 테스트하기 쉬워요.
 *   - Count              : 칩에 붙는 편수(칩 모양 라디오 단추는 choice-chips.tsx)
 *
 * 왜 이렇게 나눴을까요? ("관심사 분리")
 *   "주소 다루기"와 "화면 그리기"를 섞으면 테스트할 때마다 주소를 흉내 내야 해요.
 *   둘을 나누면 화면(ReviewBrowserView)은 조건만 넣어 바로 테스트할 수 있습니다.
 *
 * 누가 쓰나요?
 *   app/page.tsx(처음 화면)
 */

// 이 파일의 컴포넌트는 상태(useState)와 클릭 처리처럼 브라우저에서 돌아야 하는 일을 해서 클라이언트 컴포넌트로 만들어요.
"use client";

// useSearchParams: 주소의 ? 뒤 조건(예: q=겨울&genre=드라마)을 읽는 Next.js 훅
import { useSearchParams } from "next/navigation";
// React에서 쓰는 도구들. 각각 아래에서 쓰일 때 설명할게요.
import { type FormEvent, Suspense, useEffect, useId, useMemo, useRef, useState } from "react";

import {
  browse,
  type BrowseParams,
  countGenres,
  DEFAULT_PARAMS,
  isFiltered,
  parseParams,
  resultStatus,
  type SortKey,
  toSearch,
} from "@/lib/browse";
import type { ReviewSummary } from "@/lib/review";

import { Choice, ChoiceGroup } from "./choice-chips";
import { ReviewListItem } from "./review-list-item";
import { useViewCounts } from "./use-view-counts";
import { SearchBox } from "./search-box";
import { useListKeys } from "./use-list-keys";

/** 한 번에 보여 줄 리뷰 수. 처음에 10편, 목록 끝에 가까워지면 10편씩 더 보여 줘요. */
export const PAGE_SIZE = 10;

/* ──────────────────────────────────────────────────────────────
 * 1. 밖에서 쓰는 컴포넌트: 주소와 화면을 이어 준다
 * ────────────────────────────────────────────────────────────── */

/** ReviewBrowser가 받는 값 */
type Props = {
  /** 전체 리뷰(목록 정보). app/page.tsx가 빌드할 때 원고를 읽어 넘겨줘요. */
  reviews: ReviewSummary[];
};

/**
 * 처음 화면의 검색·장르·정렬과 영화 목록
 *
 * Suspense를 쓰는 이유 (조금 어려운 이야기예요)
 *   처음 화면은 빌드할 때 미리 HTML로 만들어 둬요(정적 생성).
 *   그런데 빌드할 때는 방문자가 어떤 주소(?q=...)로 들어올지 알 수 없죠.
 *   그래서 주소를 읽는 useSearchParams()를 쓰는 부분은 미리 만들 수 없고, 브라우저에서 그려야 해요.
 *
 *   <Suspense fallback={A}>B</Suspense>는 "B를 그릴 수 없을 때는 A를 대신 보여 줘"라는 뜻이에요.
 *   - 빌드할 때: B(주소 읽기)를 못 그리니 A(조건 없는 목록)가 HTML에 들어가요.
 *     → 검색엔진과 자바스크립트가 꺼진 브라우저도 목록을 볼 수 있어요.
 *   - 브라우저에서: 주소의 조건을 읽은 B로 바뀌어 거른 목록을 보여 줘요.
 */
export function ReviewBrowser({ reviews }: Props) {
  return (
    // fallback의 interactive={false}: 미리 만든 HTML에서는 검색창·버튼을 "사용할 수 없음(disabled)"으로 둬요.
    // 화면이 준비되기 전에 누른 것은 진짜 화면으로 바뀌면서 사라져 버리기 때문에, 아예 누를 수 없게 하는 편이 정직해요.
    // 준비가 끝나면(UrlBoundBrowser가 그려지면) 모두 켜져요. 보통 눈 깜짝할 사이예요.
    <Suspense
      fallback={<ReviewBrowserView reviews={reviews} params={DEFAULT_PARAMS} onParamsChange={ignore} interactive={false} />}
    >
      <UrlBoundBrowser reviews={reviews} />
    </Suspense>
  );
}

/** 아무것도 하지 않는 함수. 미리 만든 HTML(fallback)에서는 조건을 바꿀 일이 없어서 빈 함수를 넘겨요. */
function ignore() {}

/**
 * 주소의 조건을 읽어 화면에 넘기고, 화면에서 조건이 바뀌면 주소도 바꿔요.
 *
 * 왜 조건을 상태(useState)로 따로 들고 있을까요?
 *   주소만 바꾸고 그 주소를 다시 읽어 그리면, 주소가 바뀌어 화면에 닿기까지 아주 잠깐의 틈이 생겨요.
 *   그 틈에 방금 누른 라디오 단추가 예전 값으로 돌아가 보일 수 있어요.
 *   그래서 화면은 상태로 "바로" 바꾸고, 주소는 그 뒤에 맞춰 바꿔요.
 */
function UrlBoundBrowser({ reviews }: Props) {
  // 주소의 ? 뒤 조건(예: q=겨울&genre=드라마)
  const searchParams = useSearchParams();
  // 비교하기 쉽게 글자로 바꿔 둬요. 예: "genre=공포&sort=rating"
  const urlKey = searchParams.toString();

  // 화면에 보일 조건. 처음에는 주소에서 읽어요. (useState(() => ...)는 처음 한 번만 계산해요.)
  const [params, setParams] = useState(() => parseParams(searchParams));
  // 지난번에 본 주소 조건. 주소가 "바뀌었는지" 알아내려고 기억해 둬요.
  const [prevUrlKey, setPrevUrlKey] = useState(urlKey);

  // 주소가 지난번과 달라졌으면, 그리고 그 주소가 지금 화면 조건과 다르면 화면을 주소에 맞춰요.
  //  - 바깥에서 주소가 바뀐 경우(예: 머리글의 블로그 이름을 눌러 "/"로 이동) → 화면을 맞춰요.
  //  - 우리가 방금 바꾼 주소가 뒤늦게 도착한 경우 → 이미 화면과 같으니 그대로 둬요.
  // 그리는 도중에 바로 맞추는 방법이에요(ReviewBrowserView의 검색창 맞추기와 같은 방법).
  if (urlKey !== prevUrlKey) {
    setPrevUrlKey(urlKey);
    // toSearch(params)는 "?q=..." 모양이라 앞의 "?"를 떼고 주소 조건 글자와 비교해요.
    if (urlKey !== toSearch(params).slice(1)) setParams(parseParams(searchParams));
  }

  /**
   * 화면에서 조건이 바뀌면 실행돼요.
   *
   * window.history.replaceState(상태, "", 새 주소)
   *   브라우저의 주소만 바꾸고 페이지는 다시 받지 않아요. 방문 기록도 새로 쌓지 않아요(replace).
   *   (기록을 쌓으면 장르를 바꿀 때마다 뒤로 가기를 한 번씩 더 눌러야 이전 페이지로 돌아가요.)
   *   Next.js는 이렇게 바꾼 주소도 useSearchParams에 알려 줘요(공식 문서가 권하는 방법이에요).
   */
  function handleChange(next: BrowseParams) {
    // 1) 화면부터 바로 바꿔요.
    setParams(next);
    // 2) 주소를 바꿔요. 주소가 화면에 닿는 것은 조금 뒤지만, 화면과 같은 조건이라 위의 "주소에 맞추기"는 일어나지 않아요.
    window.history.replaceState(null, "", `${window.location.pathname}${toSearch(next)}`);
  }

  // 조회수: 화면이 열린 뒤 API로 받아 와요. 받기 전에는 null이라 "조회 –"로 보여요.
  const views = useViewCounts();

  return <ReviewBrowserView reviews={reviews} params={params} onParamsChange={handleChange} views={views?.counts ?? null} />;
}

/* ──────────────────────────────────────────────────────────────
 * 2. 실제 화면: 받은 조건대로 검색창·버튼·목록을 그린다
 * ────────────────────────────────────────────────────────────── */

/** ReviewBrowserView가 받는 값 */
type ViewProps = {
  /** 전체 리뷰 */
  reviews: ReviewSummary[];
  /** 지금 조건 */
  params: BrowseParams;
  /** 조건이 바뀌면 부르는 함수. 주소를 바꾸는 일은 부르는 쪽이 해요. */
  onParamsChange: (next: BrowseParams) => void;
  /** false면 검색창·버튼을 사용할 수 없게(disabled) 그려요. 미리 만든 HTML(fallback)에서 써요. 기본 true */
  interactive?: boolean;
  /** 리뷰 주소 → 조회수. 아직 받지 못했으면 null(목록에는 "조회 –", 조회순은 최신순처럼) */
  views?: Readonly<Record<string, number>> | null;
};

/** 정렬 버튼 목록. value는 주소에 쓰는 값, label은 화면에 보이는 이름이에요. */
const SORTS: { value: SortKey; label: string }[] = [
  { value: "latest", label: "최신순" },
  { value: "rating", label: "평점순" },
  { value: "views", label: "조회순" },
];

/**
 * 검색·장르·정렬과 영화 목록의 실제 화면
 *
 * 검색어는 Enter를 눌러야 적용하고, 장르와 정렬은 고르는 즉시 적용해요.
 * 검색어까지 글자를 칠 때마다 적용하면, 화면 낭독기가 결과 편수를 계속 읽어 시끄러워지거든요.
 * (글자를 칠 때는 목록 대신 추천 층만 바뀌어요.)
 */
export function ReviewBrowserView({ reviews, params, onParamsChange, interactive = true, views = null }: ViewProps) {
  // 조건을 하나씩 꺼내 둬요.
  const { q, genre, sort } = params;
  // 사용할 수 없게 둘지(disabled). 입력란·단추·라디오 단추에 똑같이 넘겨요.
  const disabled = !interactive;

  // useState: 컴포넌트가 기억하는 값(상태)을 만들어요. [지금 값, 바꾸는 함수]를 돌려줍니다.
  // draft는 "검색창에 지금 쳐 둔 글자"예요. Enter를 누르기 전까지는 조건(q)과 다를 수 있어요.
  const [draft, setDraft] = useState(q);

  // 뒤로 가기 등으로 주소의 검색어(q)가 바뀌면 검색창 글자(draft)도 맞춰야 해요.
  // React 공식 문서가 권하는 방법: "지난번 q"를 기억해 두고, 그리는 도중에 달라졌으면 바로 맞춥니다.
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    setDraft(q);
  }

  // useRef: 화면의 실제 요소(여기서는 검색창 <input>)를 가리키는 손잡이예요. 나중에 초점을 옮길 때 씁니다.
  const inputRef = useRef<HTMLInputElement>(null);

  // 영화 목록(<ul>)의 손잡이. ▲ ▼로 리뷰를 고르는 기능(useListKeys)이 이 목록 안의 링크를 찾아요.
  // 미리 만든 HTML(interactive가 false)에서는 아직 조작할 수 없으니 꺼 둬요.
  const listRef = useRef<HTMLUListElement>(null);
  useListKeys(listRef, interactive);

  // useId: 이 컴포넌트만의 겹치지 않는 id를 만들어요. label과 input, 제목과 구역을 서로 연결할 때 씁니다.
  const id = useId();

  // useMemo: 계산 결과를 기억해 두고, [ ] 안의 값이 바뀔 때만 다시 계산해요.
  // 리뷰가 많아져도 상관없는 일(예: 검색창에 글자 치기)로 다시 그릴 때 목록 계산을 건너뛸 수 있어요.
  const results = useMemo(() => browse(reviews, { q, genre, sort }, views), [reviews, q, genre, sort, views]);
  const genres = useMemo(() => countGenres(reviews, genre), [reviews, genre]);

  // 검색어나 장르로 거르고 있는지(= "검색 조건 지우기" 단추를 보일지)
  const filtered = isFiltered(params);

  /* ── 무한 스크롤: 지금 몇 편까지 보여 줄지 ── */

  // 보여 줄 편수. 처음에는 10편(PAGE_SIZE)이에요.
  const [shown, setShown] = useState(PAGE_SIZE);
  // 조건(검색어·장르·정렬)이 바뀌면 다시 처음 10편부터 보여 줘요. 위의 검색창 맞추기와 같은 방법이에요.
  const resultKey = `${q}\u0000${genre ?? ""}\u0000${sort}`;
  const [shownKey, setShownKey] = useState(resultKey);
  if (resultKey !== shownKey) {
    setShownKey(resultKey);
    setShown(PAGE_SIZE);
  }
  // 지금 보여 줄 리뷰와, 아직 남은 리뷰가 있는지
  // 미리 만든 HTML(interactive가 false)에는 모든 리뷰를 담아요. 자바스크립트가 꺼져 있으면
  // [더 보기]도 저절로 불러오기도 동작하지 않아서, 처음 10편 뒤의 리뷰에 닿을 길이 없어지거든요.
  // (자바스크립트가 켜지면 처음 10편 + [더 보기]로 바뀌어요. 바뀌는 곳은 첫 화면 아래라 눈에 띄지 않아요.)
  const visible = interactive ? results.slice(0, shown) : results;
  const hasMore = interactive && shown < results.length;

  // [더 보기]로 불러왔을 때(단추를 누르거나, 단추에 초점이 있는 채로 저절로 불러왔을 때),
  // 새로 나온 첫 리뷰로 초점을 옮기려고 그 번호를 기억해 둬요.
  const focusIndexRef = useRef<number | null>(null);
  useEffect(() => {
    const index = focusIndexRef.current;
    if (index === null) return;
    focusIndexRef.current = null;
    // 목록의 index번째 링크(새로 나온 첫 리뷰)로 초점을 옮겨요.
    listRef.current?.querySelectorAll<HTMLAnchorElement>("li a[href]")[index]?.focus();
  }, [shown]);

  // 목록 끝의 "더 보기" 자리. 이 자리가 화면에 가까워지면 10편을 더 보여 줘요.
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = moreRef.current;
    // 미리 만든 HTML이거나, 남은 리뷰가 없거나, 브라우저가 IntersectionObserver를 모르면(아주 옛 브라우저) 단추만 써요.
    if (!interactive || !hasMore || !target || !("IntersectionObserver" in window)) return;
    // IntersectionObserver: 요소가 화면(뷰포트)에 들어오는지 지켜보는 브라우저 도구예요.
    // rootMargin "300px": 화면 아래 300px 앞에서 미리 알려 줘서, 끝에 닿기 전에 다음 리뷰가 준비돼요.
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        // 키보드 사용자가 Tab으로 [더 보기]에 오면 화면이 단추까지 스크롤되면서 여기서 저절로 불러와요.
        // 그러면 초점이 있던 단추가 사라져 초점을 잃으니, 단추를 누른 것처럼 새로 나온 첫 리뷰로 초점을 옮겨요.
        if (target.contains(document.activeElement)) focusIndexRef.current = shown;
        setShown((count) => count + PAGE_SIZE);
      },
      { rootMargin: "0px 0px 300px 0px" },
    );
    observer.observe(target);
    // 정리 함수: 편수가 바뀌면 지켜보기를 새로 시작해요. 새로 시작할 때 그 자리가 아직 화면 안이면 바로 한 번 더 알려 줘서,
    // 화면이 아주 길어도 빈자리 없이 채워져요.
    return () => observer.disconnect();
  }, [interactive, hasMore, shown]);

  /** [더 보기] 단추를 누르면 실행돼요. */
  function handleMore() {
    focusIndexRef.current = shown;
    setShown(shown + PAGE_SIZE);
  }

  /**
   * 조건 일부만 바꿔 알리는 도우미예요.
   * `{ q, genre, sort, ...patch }`: 지금 조건에 바꿀 부분(patch)을 덮어써서 새 조건을 만들어요.
   * Partial<BrowseParams>는 "BrowseParams의 항목 중 일부만 있어도 된다"는 타입이에요.
   */
  const update = (patch: Partial<BrowseParams>) => onParamsChange({ q, genre, sort, ...patch });

  /** 검색창에서 Enter를 누르거나 "찾기" 단추를 누르면 실행돼요. */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // 폼의 기본 동작(페이지 새로 고침)을 막아요. 우리는 주소만 바꿀 거예요.
    event.preventDefault();
    // 앞뒤 공백을 지운 검색어로 조건을 바꿔요.
    update({ q: draft.trim() });
  }

  /** "검색 조건 지우기" 단추를 누르면 실행돼요. */
  function handleReset() {
    setDraft(""); // 검색창을 비우고
    onParamsChange({ ...DEFAULT_PARAMS, sort }); // 검색어·장르를 처음으로. 정렬은 보기 취향이라 그대로 둬요.
    // 누른 단추가 사라지므로, 키보드 사용자가 길을 잃지 않게 초점을 검색창으로 옮겨요.
    // `?.`는 inputRef.current가 비어 있으면 focus()를 부르지 않는다는 뜻이에요.
    inputRef.current?.focus();
  }

  // 목록 위 안내 문구. 아직 다 보여 주지 않았으면 "· 10편 표시"를 붙여 지금 몇 편이 보이는지 알려 줘요.
  const status = `${resultStatus(reviews.length, results.length, params)}${hasMore ? ` · ${visible.length}편 표시` : ""}`;

  return (
    // 넓은 화면(lg, 1024px~)에서는 [검색 칸 | 영화 목록] 두 칸이에요. 검색 칸 너비는 상세 화면의 왼쪽 칸과 같아요(16~18rem).
    // 좁은 화면에서는 검색 칸 아래에 목록이 와요.
    <div className="grid gap-10 lg:grid-cols-[minmax(16rem,18rem)_minmax(0,1fr)] lg:gap-12">
      {/* <search>: "검색 영역"이라는 뜻의 HTML 태그예요. 화면 낭독기가 검색 랜드마크로 알려 줘요.
          browse-aside: 넓고 키가 충분한 화면에서 스크롤해도 왼쪽 위에 붙어 있게 해요(globals.css). */}
      <search aria-label="리뷰 찾기" className="browse-aside border-2 border-crt-line px-4 py-5 sm:px-6 lg:px-4">
        {/* onSubmit: 폼 안에서 Enter를 누르거나 submit 단추를 누르면 handleSubmit이 실행돼요. */}
        <form onSubmit={handleSubmit} className="grid gap-5">
          {/* 검색 줄: 아래 장르·정렬 줄과 똑같이 "이름 칸(4rem) + 간격(gap-x-4) + 내용" 모양이라 세 줄이 가지런해요.
              넓은 화면의 좁은 검색 칸에서는 이름을 위로 올려요(lg:grid-cols-1). */}
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-[4rem_minmax(0,1fr)] lg:grid-cols-1">
            {/* <label htmlFor="...">: 이 글자가 어느 입력란의 이름인지 연결해요. 글자를 눌러도 입력란에 초점이 가요. */}
            <label htmlFor={`${id}-q`} className="glow sm:mt-2 lg:mt-0">
              검색
            </label>
            <div className="flex flex-wrap items-start gap-2">
              <SearchBox
                id={`${id}-q`}
                inputRef={inputRef}
                value={draft}
                onValueChange={setDraft}
                // 추천을 고르면 그 글자로 바로 찾아요.
                onSearch={(value) => update({ q: value.trim() })}
                reviews={reviews}
                disabled={disabled}
              />
              {/* type="submit": 폼을 제출하는 단추. 단추 이름은 "찾기"예요. */}
              <button type="submit" disabled={disabled} className="btn-inverse shrink-0">
                찾기
              </button>
            </div>
          </div>

          {/* 장르 고르기: 라디오 단추 묶음. "전체" + 리뷰가 있는 장르들 */}
          {/* disabled를 <fieldset>에 주면 그 안의 라디오 단추가 모두 사용할 수 없게 돼요(HTML 기본 기능). */}
          <ChoiceGroup legend="장르" layout="aside" disabled={disabled}>
            <Choice name="genre" checked={genre === null} onChange={() => update({ genre: null })}>
              전체 <Count n={reviews.length} />
            </Choice>
            {genres.map(({ genre: value, count }) => (
              <Choice key={value} name="genre" checked={genre === value} onChange={() => update({ genre: value })}>
                {value} <Count n={count} />
              </Choice>
            ))}
          </ChoiceGroup>

          {/* 정렬 고르기 */}
          <ChoiceGroup legend="정렬" layout="aside" disabled={disabled}>
            {SORTS.map(({ value, label }) => (
              <Choice key={value} name="sort" checked={sort === value} onChange={() => update({ sort: value })}>
                {label}
              </Choice>
            ))}
          </ChoiceGroup>
        </form>
      </search>

      {/* 목록 구역. 이름은 아래 h2("영화 목록")로 정해요. min-w-0: 긴 제목이 칸을 밀어내지 않게 해요. */}
      <section aria-labelledby={`${id}-list`} className="min-w-0">
        <div className="flex items-center gap-3">
          <h2 id={`${id}-list`} className="glow shrink-0">
            영화 목록
          </h2>
          <span aria-hidden="true" className="leader" />
          {/* role="status": 안의 글자가 바뀌면 화면 낭독기가 하던 말을 끊지 않고 이어서 읽어 줘요.
              이 영역은 처음부터 화면에 두고 글자만 바꿔야 제대로 읽어 줘요.
              min-w-0 text-right: 안내가 길어지면 좁은 화면에서 넘치지 않고 줄을 바꿔요. */}
          <p role="status" className="min-w-0 text-right">
            {status}
          </p>
        </div>

        {/* 결과가 있으면 목록(<ul>), 없으면 안내 상자를 보여 줘요. ref={listRef}: 위의 손잡이를 이 목록에 연결해요.
            순서가 뜻을 갖는 번호 목록이 아니라서 <ol> 대신 <ul>을 써요. 항목은 썸네일부터 시작해요. */}
        {results.length > 0 ? (
          <ul ref={listRef} className="mt-4 grid gap-2">
            {visible.map((review) => (
              <ReviewListItem key={review.slug} review={review} views={views ? (views[review.slug] ?? 0) : null} />
            ))}
          </ul>
        ) : reviews.length === 0 ? (
          // 리뷰가 아직 한 편도 없을 때: 거른 결과가 아니라서 검색을 바꾸라는 안내는 하지 않아요.
          <div className="mt-4 border-2 border-dashed border-crt-line px-4 py-8 text-center">
            <p className="glow">아직 올린 리뷰가 없습니다.</p>
          </div>
        ) : (
          <div className="mt-4 border-2 border-dashed border-crt-line px-4 py-8 text-center">
            <p className="glow">찾는 리뷰가 없습니다.</p>
            {/* 오류 안내에는 "어떻게 하면 되는지"를 함께 적어요. */}
            <p className="mt-2 text-crt-dim">낱말을 줄이거나 장르를 ‘전체’로 바꿔 보세요.</p>
          </div>
        )}

        {/* 남은 리뷰가 있으면 "더 보기" 자리. 화면에 가까워지면 저절로 10편을 더 보여 주고(위의 IntersectionObserver),
            키보드·화면 낭독기 사용자는 단추로 직접 불러올 수 있어요. */}
        {hasMore && (
          <div ref={moreRef} className="mt-6">
            <button type="button" onClick={handleMore} disabled={disabled} className="btn-line">
              {Math.min(PAGE_SIZE, results.length - shown)}편 더 보기
            </button>
          </div>
        )}

        {/* 거르고 있을 때만 "검색 조건 지우기" 단추를 보여요. type="button": 폼 제출 단추가 아니라는 뜻이에요. */}
        {filtered && (
          <button type="button" onClick={handleReset} className="btn-line mt-6">
            검색 조건 지우기
          </button>
        )}
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * 3. 작은 조각
 * ────────────────────────────────────────────────────────────── */

/**
 * 칩에 붙는 편수(예: "드라마 3편"의 "3편"). 보조 글자색으로 조금 흐리게 보여요.
 *
 * 처음에는 화면에 숫자만 보이고 "편"은 화면 낭독기 전용 글자(sr-only)로 숨겼었어요.
 * 그런데 브라우저마다 숨긴 글자 앞뒤에 띄어쓰기를 넣어 "3 편"처럼 읽기도 해서,
 * "편"까지 화면에 보이게 했어요. 보이는 글자와 읽는 글자가 같으면 누구에게나 분명해요.
 */
function Count({ n }: { n: number }) {
  return <span className="text-crt-dim">{n}편</span>;
}
