/**
 * @file review-browser.tsx 테스트
 *
 * 나눠서 확인해요.
 *   1. ReviewBrowserView(화면): 조건을 직접 넣어, 검색·자동완성·장르·정렬·빈 결과·조건 지우기가 잘 되는지
 *   2. 방향키로 고르기
 *   3. 무한 스크롤(10편씩 보여 주기)과 [더 보기] 단추
 *   4. ReviewBrowser(주소 연결): 주소의 조건을 읽고, 조건이 바뀌면 주소를 바꾸는지
 *
 * 사용자 동작 흉내 내기(user-event)
 *   - const user = userEvent.setup() : 가상의 사용자를 만들어요.
 *   - await user.type(입력란, "글자")  : 글자를 한 자씩 쳐요.
 *   - await user.keyboard("{Enter}")  : Enter 키를 눌러요.
 *   - await user.click(요소)           : 요소를 눌러요.
 *   진짜 사람처럼 이벤트(키 누름, 포커스 등)를 차례로 일으켜서, fireEvent보다 실제 사용에 가까워요.
 */

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type BrowseParams, DEFAULT_PARAMS } from "@/lib/browse";
import type { ReviewSummary } from "@/lib/review";
import { manyReviews, reviewMocks } from "@/test/review-mocks";

import { ReviewBrowser, ReviewBrowserView } from "./review-browser";

/* ── 가짜 next/navigation: 주소 조건을 우리가 정한 값으로 흉내 내요 ── */
const navigation = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useSearchParams: () => new URLSearchParams(navigation.search),
  // 목록의 리뷰 링크(IntentLink)가 마우스를 올릴 때 미리 받기(prefetch)를 불러요.
  useRouter: () => ({ prefetch: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
}));

/**
 * 주소 대신 useState로 조건을 들고 있는 시험용 부모 컴포넌트예요.
 * 화면(ReviewBrowserView)이 조건을 바꾸면 이 부모가 받아 다시 그려 줘요. 실제 앱에서 주소가 하는 일을 대신해요.
 */
function Harness({
  initial = DEFAULT_PARAMS,
  onChange,
  reviews = reviewMocks,
}: {
  initial?: BrowseParams;
  onChange?: (p: BrowseParams) => void;
  reviews?: ReviewSummary[];
}) {
  const [params, setParams] = useState(initial);
  return (
    <ReviewBrowserView
      reviews={reviews}
      params={params}
      onParamsChange={(next) => {
        onChange?.(next);
        setParams(next);
      }}
    />
  );
}

/** 지금 목록에 보이는 리뷰 제목(h3)들 */
const listTitles = () => screen.queryAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
/** 검색창. role="combobox"(자동완성 검색창)이고 이름은 label의 "검색"이에요. */
const searchBox = () => screen.getByRole("combobox", { name: "검색" });
/** 결과 안내(role="status"). 목록 위의 편수 안내예요. */
const status = () => screen.getByText(/편/, { selector: "[role='status']" });

describe("ReviewBrowserView (화면)", () => {
  it("정렬은 최신순·평점순 두 가지이고(조회순은 없다), 조회수는 보이지 않으며 조회수 API도 부르지 않는다", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<Harness />);
    const sorts = screen.getByRole("group", { name: "정렬" });
    expect(within(sorts).getAllByRole("radio").map((radio) => radio.closest("label")?.textContent?.replace("▶", "").trim())).toEqual([
      "최신순",
      "평점순",
    ]);
    // 순서는 최신순 그대로예요(조회수로 늘어놓지 않아요).
    expect(listTitles()).toEqual(["겨울 정류장", "화성 세탁소", "필름이 끊기기 전에", "8비트 영웅전"]);
    // 조회수는 2.0.0 핫픽스에서 화면에서 뺐어요. 목록이 조회수 API를 부르지도 않아요.
    expect(screen.queryByText(/조회/)).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });


  it("처음에는 모든 리뷰를 최근에 쓴 글부터 보이고, 전체 편수를 알린다", () => {
    render(<Harness />);
    expect(listTitles()).toEqual(["겨울 정류장", "화성 세탁소", "필름이 끊기기 전에", "8비트 영웅전"]);
    expect(status()).toHaveTextContent("전체 4편");
  });

  it("검색어는 Enter를 눌러야 적용한다", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(searchBox(), "겨울");
    // 아직 Enter를 누르지 않았으니 목록은 그대로 4편
    expect(listTitles()).toHaveLength(4);

    // 추천 층이 열려 있어도, 고른 추천이 없으면 Enter는 친 글자 그대로 찾아요.
    await user.keyboard("{Enter}");
    // toHaveBeenLastCalledWith: 가짜 함수가 마지막으로 이 값으로 불렸는지 확인해요.
    expect(onChange).toHaveBeenLastCalledWith({ q: "겨울", genre: null, sort: "latest" });
    expect(listTitles()).toEqual(["겨울 정류장"]);
    expect(status()).toHaveTextContent("4편 중 1편");
  });

  it("찾기 단추로도 검색하고, 앞뒤 공백은 지운다", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(searchBox(), "  winter  ");
    await user.click(screen.getByRole("button", { name: "찾기" }));
    expect(listTitles()).toEqual(["겨울 정류장"]);
  });

  it("검색 안내는 입력란 안의 placeholder로 보이고, 찾기 단추에는 아이콘이 없다", () => {
    render(<Harness />);
    expect(searchBox()).toHaveAttribute("placeholder", "검색어를 입력하세요");
    expect(screen.getByRole("button", { name: "찾기" }).querySelector("svg")).not.toBeInTheDocument();
    // 검색 이름 옆의 꺾쇠(>) 꾸밈도 없어요.
    expect(screen.getByText("검색", { selector: "label" })).toHaveTextContent(/^검색$/);
  });

  it("장르는 고르는 즉시 거른다", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // within(묶음): 그 묶음 안에서만 찾아요. fieldset의 역할은 "group", 이름은 legend의 "장르"예요.
    const genre = screen.getByRole("group", { name: "장르" });
    // 라디오 단추 이름은 칩에 보이는 글자 그대로 "드라마 2편"이에요(꾸밈 ▶는 빠져요).
    await user.click(within(genre).getByRole("radio", { name: "드라마 2편" }));
    expect(listTitles()).toEqual(["겨울 정류장", "필름이 끊기기 전에"]);
    expect(within(genre).getByRole("radio", { name: "드라마 2편" })).toBeChecked();
  });

  it("평점순으로 정렬한다", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: "평점순" }));
    expect(listTitles()).toEqual(["필름이 끊기기 전에", "겨울 정류장", "화성 세탁소", "8비트 영웅전"]);
  });

  it("찾는 리뷰가 없으면 알리고, 조건을 지우면 검색란으로 초점을 옮긴다", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ q: "없는 영화", genre: null, sort: "rating" }} />);

    expect(screen.getByText("찾는 리뷰가 없습니다.")).toBeInTheDocument();
    expect(status()).toHaveTextContent("4편 중 0편");

    await user.click(screen.getByRole("button", { name: "검색 조건 지우기" }));

    expect(listTitles()).toHaveLength(4);
    expect(searchBox()).toHaveValue("");
    // toHaveFocus: 지금 키보드 초점이 이 요소에 있는지 확인해요.
    expect(searchBox()).toHaveFocus();
    // 정렬은 보기 취향이라 그대로 남아요.
    expect(screen.getByRole("radio", { name: "평점순" })).toBeChecked();
    // 거르는 조건이 없으니 지우기 단추도 사라져요.
    expect(screen.queryByRole("button", { name: "검색 조건 지우기" })).not.toBeInTheDocument();
  });

  it("주소의 검색어가 바뀌면(뒤로 가기) 입력란도 맞춘다", () => {
    // rerender: 같은 컴포넌트를 새 값으로 다시 그려요. 부모가 새 조건을 넘긴 상황을 흉내 내요.
    const { rerender } = render(<ReviewBrowserView reviews={reviewMocks} params={DEFAULT_PARAMS} onParamsChange={() => {}} />);
    rerender(<ReviewBrowserView reviews={reviewMocks} params={{ ...DEFAULT_PARAMS, q: "화성" }} onParamsChange={() => {}} />);
    expect(searchBox()).toHaveValue("화성");
  });

  it("검색 영역과 '영화 목록' 구역에 이름이 있고, 목록은 번호 없는 목록(ul)이다", () => {
    const { container } = render(<Harness />);
    // <search> 태그는 브라우저에서 "검색" 역할을 갖지만, 테스트 도구(jsdom)는 아직 이 태그의 역할을 몰라요.
    // 그래서 여기서는 태그로 찾아 이름만 확인하고, 역할은 실제 브라우저로 도는 E2E(e2e/blog.spec.ts)에서 확인해요.
    expect(container.querySelector("search")).toHaveAttribute("aria-label", "리뷰 찾기");
    // aria-labelledby로 이름을 붙인 <section>은 "region" 역할이 돼요.
    const region = screen.getByRole("region", { name: "영화 목록" });
    expect(region.querySelector("ul")).toBeInTheDocument();
    expect(region.querySelector("ol")).not.toBeInTheDocument();
  });
});

describe("ReviewBrowserView (자동완성)", () => {
  it("글자를 치면 추천 층이 열리고, 추천을 누르면 그 글자로 바로 찾는다", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(searchBox(), "필름");
    // 추천 층은 이름 있는 목록 상자(listbox), 추천 하나는 option이에요.
    const listbox = screen.getByRole("listbox", { name: "추천 검색어" });
    expect(searchBox()).toHaveAttribute("aria-expanded", "true");
    await user.click(within(listbox).getByRole("option", { name: "필름이 끊기기 전에 제목" }));

    expect(searchBox()).toHaveValue("필름이 끊기기 전에");
    expect(listTitles()).toEqual(["필름이 끊기기 전에"]);
    // 고르면 층이 닫혀요.
    expect(searchBox()).toHaveAttribute("aria-expanded", "false");
  });

  it("▼로 추천을 고르면 aria-activedescendant가 그 추천을 가리키고, Enter로 찾는다", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(searchBox(), "한서");
    await user.keyboard("{ArrowDown}");
    const option = screen.getByRole("option", { name: "한서윤 감독" });
    expect(option).toHaveAttribute("aria-selected", "true");
    expect(searchBox()).toHaveAttribute("aria-activedescendant", option.id);
    // 초점은 검색창에 그대로 있어요(목록 상자 안으로 옮기지 않아요).
    expect(searchBox()).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(searchBox()).toHaveValue("한서윤");
    expect(listTitles()).toEqual(["겨울 정류장"]);
  });

  it("Esc는 추천 층만 닫고 쳐 둔 글자는 그대로 둔다", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(searchBox(), "겨울");
    expect(screen.getByRole("listbox", { name: "추천 검색어" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(searchBox()).toHaveAttribute("aria-expanded", "false");
    expect(searchBox()).toHaveValue("겨울");
  });

  it("맞는 추천이 없으면 층을 열지 않는다", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(searchBox(), "없는영화");
    expect(searchBox()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("ReviewBrowserView (방향키로 고르기)", () => {
  /** 지금 키보드 초점이 있는 요소의 글자. 초점이 리뷰 링크에 있으면 그 리뷰 제목이에요. */
  const focused = () => document.activeElement?.textContent;

  /**
   * 목록 항목의 화면 위치를 흉내 내요. jsdom은 화면을 그리지 않아 위치가 모두 0이라서,
   * bottom(화면 위쪽 끝에서 항목 아래쪽까지의 거리)을 정해 줘요. 양수면 화면 안(또는 아래), 음수면 화면 위로 지나간 항목이에요.
   */
  const placeItems = (bottom: number) =>
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ bottom } as DOMRect);

  beforeEach(() => {
    placeItems(100); // 기본: 목록이 화면에 보여요.
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("목록 밖에서 ▼를 누르면 첫 리뷰를 고르고, ▲ ▼로 오르내린다", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe("겨울 정류장");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(focused()).toBe("필름이 끊기기 전에");
    await user.keyboard("{ArrowUp}");
    expect(focused()).toBe("화성 세탁소");
  });

  it("◀ ▶도 ▲ ▼처럼 이전·다음 리뷰를 고른다(목록 밖에서 ▶를 누르면 첫 리뷰로 들어간다)", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard("{ArrowRight}");
    expect(focused()).toBe("겨울 정류장");
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(focused()).toBe("필름이 끊기기 전에");
    await user.keyboard("{ArrowLeft}");
    expect(focused()).toBe("화성 세탁소");
  });

  it("목록 안에서 Home·End는 처음·끝 리뷰로 간다", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard("{ArrowDown}{End}");
    expect(focused()).toBe("8비트 영웅전");
    await user.keyboard("{Home}");
    expect(focused()).toBe("겨울 정류장");
  });

  it("목록 끝에서는 키를 가로채지 않아 화면이 평소처럼 스크롤된다", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.keyboard("{ArrowDown}{End}");

    // fireEvent.keyDown은 누군가 preventDefault를 부르면 false, 아니면 true를 돌려줘요.
    // true = 브라우저의 원래 동작(스크롤)이 그대로 일어난다는 뜻이에요.
    expect(fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" })).toBe(true);
    expect(focused()).toBe("8비트 영웅전");
  });

  it("목록이 모두 화면 위로 지나갔으면(바닥글을 보는 중) ▼를 가로채지 않는다", () => {
    placeItems(-10);
    render(<Harness />);

    // true = 처리하지 않음. 맨 위 리뷰로 끌어올리지 않고, 브라우저가 평소처럼 아래로 스크롤해요.
    expect(fireEvent.keyDown(document.body, { key: "ArrowDown" })).toBe(true);
    expect(document.body).toHaveFocus();
  });

  it("검색창에서는 목록이 방향키를 가로채지 않는다(추천이 없으면 아무 일도 없다)", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(searchBox());
    await user.keyboard("{ArrowDown}");
    expect(searchBox()).toHaveFocus();
  });

  it("Shift 등 다른 키와 함께 누르면 가로채지 않는다", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(document.body).toHaveFocus();
  });

  it("미리 만든 HTML(interactive={false})에서는 방향키를 듣지 않는다", async () => {
    const user = userEvent.setup();
    render(<ReviewBrowserView reviews={reviewMocks} params={DEFAULT_PARAMS} onParamsChange={() => {}} interactive={false} />);

    await user.keyboard("{ArrowDown}");
    expect(document.body).toHaveFocus();
  });
});

describe("ReviewBrowserView (무한 스크롤)", () => {
  /** 23편: 처음 10편 → 20편 → 23편으로 늘어나요. */
  const reviews = manyReviews(23);

  it("처음에는 10편만 보이고, 몇 편이 보이는지 알린다", () => {
    render(<Harness reviews={reviews} />);
    expect(listTitles()).toHaveLength(10);
    expect(status()).toHaveTextContent("전체 23편 · 10편 표시");
  });

  it("[더 보기]를 누르면 10편씩 더 보이고, 새로 나온 첫 리뷰로 초점을 옮긴다", async () => {
    const user = userEvent.setup();
    render(<Harness reviews={reviews} />);

    await user.click(screen.getByRole("button", { name: "10편 더 보기" }));
    expect(listTitles()).toHaveLength(20);
    // 11번째 리뷰(새로 나온 첫 리뷰)의 제목 링크에 초점이 가요. 키보드 사용자가 이어서 읽을 수 있어요.
    expect(document.activeElement).toHaveTextContent("시험 영화 11");

    // 남은 것은 3편이라 단추 글자도 3편이에요.
    await user.click(screen.getByRole("button", { name: "3편 더 보기" }));
    expect(listTitles()).toHaveLength(23);
    // 다 보였으면 단추가 사라지고, 안내도 "전체 23편"만 남아요.
    expect(screen.queryByRole("button", { name: /더 보기/ })).not.toBeInTheDocument();
    expect(status()).toHaveTextContent(/^전체 23편$/);
  });

  it("목록 끝의 '더 보기' 자리가 화면에 가까워지면 저절로 10편을 더 보인다", () => {
    // jsdom에는 IntersectionObserver가 없어서, 우리가 부를 때 "보여요"라고 알려 주는 가짜를 넣어요.
    let notify: (entries: { isIntersecting: boolean }[]) => void = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: typeof notify) {
          notify = callback;
        }
        observe() {}
        disconnect() {}
      },
    );

    render(<Harness reviews={reviews} />);
    expect(listTitles()).toHaveLength(10);
    // act: 화면을 바꾸는 일을 감싸서, React가 다 그린 뒤에 확인하게 해요.
    act(() => notify([{ isIntersecting: true }]));
    expect(listTitles()).toHaveLength(20);

    vi.unstubAllGlobals();
  });

  it("[더 보기]에 키보드 초점이 있는 채로 저절로 불러오면, 초점을 잃지 않고 새로 나온 첫 리뷰로 옮긴다", () => {
    let notify: (entries: { isIntersecting: boolean }[]) => void = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: typeof notify) {
          notify = callback;
        }
        observe() {}
        disconnect() {}
      },
    );

    render(<Harness reviews={reviews} />);
    // Tab으로 단추에 온 상황: 단추에 초점이 있고, 화면이 단추까지 스크롤되어 "보여요" 알림이 와요.
    screen.getByRole("button", { name: "10편 더 보기" }).focus();
    act(() => notify([{ isIntersecting: true }]));
    expect(listTitles()).toHaveLength(20);
    expect(document.activeElement).toHaveTextContent("시험 영화 11");

    vi.unstubAllGlobals();
  });

  it("조건(정렬 등)을 바꾸면 다시 처음 10편부터 보인다", async () => {
    const user = userEvent.setup();
    render(<Harness reviews={reviews} />);
    await user.click(screen.getByRole("button", { name: "10편 더 보기" }));
    expect(listTitles()).toHaveLength(20);

    await user.click(screen.getByRole("radio", { name: "평점순" }));
    expect(listTitles()).toHaveLength(10);
  });
});

describe("ReviewBrowserView (미리 만든 HTML)", () => {
  it("interactive={false}면 검색창·단추·라디오 단추를 누를 수 없게 그린다", () => {
    render(<ReviewBrowserView reviews={reviewMocks} params={DEFAULT_PARAMS} onParamsChange={() => {}} interactive={false} />);
    expect(searchBox()).toBeDisabled();
    expect(screen.getByRole("button", { name: "찾기" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "최신순" })).toBeDisabled();
    // 목록은 그대로 보여요(검색엔진과 스크립트 없는 환경을 위해).
    expect(listTitles()).toHaveLength(4);
  });

  it("10편이 넘어도 모두 담고 [더 보기]는 두지 않는다(스크립트가 없으면 더 불러올 수 없어서)", () => {
    const reviews = manyReviews(15);
    render(<ReviewBrowserView reviews={reviews} params={DEFAULT_PARAMS} onParamsChange={() => {}} interactive={false} />);
    expect(listTitles()).toHaveLength(15);
    expect(screen.queryByRole("button", { name: /더 보기/ })).toBeNull();
  });
});

describe("ReviewBrowser (주소 연결)", () => {
  beforeEach(() => {
    navigation.search = "";
    // vi.spyOn(객체, "함수 이름"): 진짜 함수를 그대로 쓰면서, 불렸는지·무엇으로 불렸는지 기록해요.
    vi.spyOn(window.history, "replaceState");
  });

  // 테스트마다 spyOn을 원래대로 되돌려요.
  afterEach(() => vi.restoreAllMocks());

  it("주소의 조건으로 목록을 거른다", () => {
    navigation.search = `genre=${encodeURIComponent("코미디")}`;
    render(<ReviewBrowser reviews={reviewMocks} />);
    expect(listTitles()).toEqual(["화성 세탁소"]);
    expect(screen.getByRole("radio", { name: "코미디 1편" })).toBeChecked();
  });

  it("조건을 바꾸면 화면을 바로 바꾸고, 방문 기록을 쌓지 않고(replaceState) 주소를 바꾼다", async () => {
    const user = userEvent.setup();
    render(<ReviewBrowser reviews={reviewMocks} />);
    await user.click(screen.getByRole("radio", { name: "평점순" }));
    // 화면은 기다리지 않고 바로 바뀌어요.
    expect(screen.getByRole("radio", { name: "평점순" })).toBeChecked();
    // 주소: 지금 경로(/) 뒤에 조건을 붙여요.
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, "", "/?sort=rating");
  });

  it("조건을 모두 지우면 조건 없는 주소로 돌아간다", async () => {
    const user = userEvent.setup();
    navigation.search = "q=%ED%99%94%EC%84%B1"; // q=화성
    render(<ReviewBrowser reviews={reviewMocks} />);
    await user.click(screen.getByRole("button", { name: "검색 조건 지우기" }));
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, "", "/");
    expect(listTitles()).toHaveLength(4);
  });

  it("주소가 바깥에서 바뀌면(링크로 이동) 화면 조건도 주소에 맞춘다", () => {
    navigation.search = `genre=${encodeURIComponent("코미디")}`;
    const { rerender } = render(<ReviewBrowser reviews={reviewMocks} />);
    // 머리글의 블로그 이름을 눌러 "/"로 간 상황: 주소 조건이 비었어요.
    navigation.search = "";
    rerender(<ReviewBrowser reviews={reviewMocks} />);
    expect(listTitles()).toHaveLength(4);
    expect(screen.getByRole("radio", { name: "전체 4편" })).toBeChecked();
  });
});
