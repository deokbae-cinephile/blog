/**
 * @file 블로그 화면 E2E 테스트 (e2e/blog.spec.ts)
 *
 * 진짜 브라우저로 사이트를 열어 방문자처럼 써 보며 확인해요(글쓴이 기능은 admin.spec.ts).
 *   - 목록: 검색과 자동완성, 장르, 정렬, 결과 없음, 조건 지우기, 주소에 조건 남기기, 10편씩 무한 스크롤
 *   - 넓은 화면: 왼쪽 검색 칸(스크롤해도 붙어 있음) + 오른쪽 영화 목록
 *   - 상세: 포스터(초록 필터)·기본 포스터, 머리 안내판(장르·제목·정보 줄·큰 평점), 본문 Markdown·사진, 이전·다음 리뷰
 *   - 404 화면, 맨 위로 단추, 머리글의 GitHub 링크
 *   - 키보드: 본문 바로가기, DOS식 방향키 조작(▲ ▼ Home End Enter ◀ ▶ Esc), 키보드 조작 안내
 *   - 접근성: axe 자동 검사(WCAG 2.2 AA 규칙), 레이아웃: 좁은 화면에서 가로로 넘치지 않는지
 *
 * 시험용 원고(e2e/fixtures/reviews) 11편
 *   최신순: 알파 정거장 → 베타 로맨스 → 긴 제목(감마) → 델타 기록 → 엡실론의 밤 → 제타의 노래 → 에타 전선
 *           → 세타 궁정 → 이오타 목장 → 카파 사건 → 람다 질주(11번째라 처음에는 보이지 않아요)
 *   평점순: 감마(5) → 알파(4.5) → 카파(4) → 람다(4) → 엡실론(3.5) → 베타(3) → ...
 *   드라마: 알파, 감마 / 포스터: 알파만 있어요(나머지는 기본 포스터)
 *
 * Playwright 기본 문법
 *   - test("이름", async ({ page }) => { ... }) : 테스트 하나. page는 브라우저 탭이에요.
 *   - page.goto("/") : 주소로 이동
 *   - page.getByRole("link", { name: "..." }) : 역할과 이름으로 요소 찾기(Testing Library와 같은 방식)
 *   - await expect(요소).toBeVisible() : 보일 때까지 잠깐 기다렸다가 확인(자동 재시도)
 */

import { readFileSync } from "node:fs";

import { expect, type Page, test } from "@playwright/test";

// 접근성 검사(axe)와 가로 넘침 검사는 다른 테스트 파일과 함께 쓰려고 helpers.ts에 두었어요.
import { expectNoA11yViolations, expectNoHorizontalScroll } from "./helpers";

/** 지금 버전(package.json). E2E는 저장소 맨 위 폴더에서 돌아서 그 자리의 package.json을 읽어요. */
const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

/** 긴 제목 원고의 제목(gamma-long.md) */
const LONG_TITLE = "끝없이이어지는아주아주긴제목이화면을넘치지않는지살펴보는감마영화";
/** 처음 10편(최신순) */
const FIRST_TEN = ["알파 정거장", "베타 로맨스", LONG_TITLE, "델타 기록", "엡실론의 밤", "제타의 노래", "에타 전선", "세타 궁정", "이오타 목장", "카파 사건"];

/** 목록 영역 */
const listRegion = (page: Page) => page.getByRole("region", { name: "영화 목록" });
/** 목록 영역의 편수 안내(role="status") */
const listStatus = (page: Page) => listRegion(page).getByRole("status");
/** 목록에 보이는 리뷰 제목(h3)들을 순서대로 가져와요. */
const listTitles = (page: Page) => listRegion(page).getByRole("heading", { level: 3 }).allTextContents();
/** 검색창(자동완성 콤보박스) */
const searchBox = (page: Page) => page.getByRole("combobox", { name: "검색" });

/**
 * 처음 화면을 열고, 화면이 준비될 때까지(검색창이 켜질 때까지) 기다려요.
 * 미리 만든 HTML이 보인 뒤 자바스크립트가 화면을 맡기 전까지는 검색·방향키 기능이 아직 없어서, 그 전에 누른 키는 쓰이지 않아요.
 */
async function openHome(page: Page, path = "/") {
  await page.goto(path);
  await expect(searchBox(page)).toBeEnabled();
}

test.describe("처음 화면(목록)", () => {
  test("블로그 이름(h1)과 처음 10편을 최신순으로 보이고, 몇 편이 보이는지 알린다", async ({ page }) => {
    await openHome(page);
    await expect(page).toHaveTitle("DMB");
    // h1은 화면에서 숨겼지만(sr-only) 화면 낭독기가 찾을 수 있어요.
    await expect(page.getByRole("heading", { level: 1, name: "DMB" })).toBeAttached();
    await expect(listStatus(page)).toHaveText("전체 11편 · 10편 표시");
    expect(await listTitles(page)).toEqual(FIRST_TEN);
  });

  test("머리글 오른쪽에 소스 코드 저장소로 가는 GitHub 링크가 있고, 예전 소개 문구는 없다", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("banner");
    const github = banner.getByRole("link", { name: "GitHub", exact: true });
    await expect(github).toHaveAttribute("href", "https://github.com/deokbae-cinephile/blog");
    await expect(github).toHaveAccessibleDescription("이 블로그의 소스 코드 저장소(새 창)");
    await expect(github).toHaveAttribute("target", "_blank");
    // 누르기 전에 새 창이라는 것을 눈으로도 알 수 있어요: 가리키거나 초점이 가면 말풍선이 뜨고, Esc로 닫혀요(KWCAG 7.2.1).
    const tip = page.getByRole("tooltip");
    await expect(tip).toBeHidden();
    await github.focus();
    await expect(tip).toHaveText("이 블로그의 소스 코드 저장소(새 창)");
    // 말풍선이 화면 오른쪽 밖으로 잘리지 않아요(좁은 휴대폰 포함).
    const box = await tip.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await expectNoA11yViolations(page);
    await page.keyboard.press("Escape");
    await expect(tip).toBeHidden();
    await expect(github).toBeFocused();
    await expect(banner).not.toContainText("평론가를 꿈꾸는");
    // 처음 화면 머리(촬영기 그림과 안내판)도 없어요.
    await expect(page.locator("#intro-title")).toHaveCount(0);
  });

  test("머리글 오른쪽에는 GitHub 아이콘만 보이고, 왼쪽 로고와 같은 크기로 본문 양 끝·같은 줄에 붙는다(좁은 휴대폰 포함)", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("banner");
    await expect(banner.getByRole("link", { name: "DMB: 덕배의 영화 블로그" })).toHaveAttribute("href", "/");
    // 글자 "GitHub"는 화면 낭독기용으로만 남아요(화면에는 아이콘만).
    await expect(banner.getByRole("link", { name: "GitHub", exact: true }).locator(".sr-only")).toHaveText("GitHub");
    // 머리글의 본문 칸(안쪽 여백을 뺀 자리) 양 끝과 두 아이콘의 위치·크기, GitHub 링크의 누르는 영역을 재요.
    const measure = () =>
      banner.evaluate((header) => {
        const box = header.getBoundingClientRect();
        const style = getComputedStyle(header);
        const [logo, mark] = [...header.querySelectorAll("a svg")].map((svg) => svg.getBoundingClientRect());
        const github = header.querySelector('a[href^="https://github.com/"]')!.getBoundingClientRect();
        const home = header.querySelector('a[href="/"]')!.getBoundingClientRect();
        const version = [...header.querySelectorAll("span")].find((span) => /^\(v\d/.test(span.textContent!))!.getBoundingClientRect();
        const middle = (rect: DOMRect) => Math.round(rect.top + rect.height / 2);
        return {
          icons: [
            [logo.width, logo.height],
            [mark.width, mark.height],
          ],
          // 로고 왼쪽 끝 = 본문 왼쪽 끝, 아이콘 오른쪽 끝 = 본문 오른쪽 끝(둘 다 0이면 딱 맞아요)
          leftGap: Math.round(logo.left - (box.left + parseFloat(style.paddingLeft))),
          rightGap: Math.round(box.right - parseFloat(style.paddingRight) - mark.right),
          // 같은 줄(첫 줄)에 있는지: 두 아이콘의 위쪽 끝이 같고, 버전도 이름과 같은 줄이에요.
          sameRow: Math.round(logo.top) === Math.round(mark.top) && middle(version) === middle(home),
          hit: [Math.round(github.width), Math.round(github.height)],
          // 가로 스크롤이 생기지 않아요.
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
    const expected = { icons: [[24, 24], [24, 24]], leftGap: 0, rightGap: 0, sameRow: true, hit: [44, 44], overflow: false };
    expect(await measure()).toEqual(expected);
    // 좁은 휴대폰(360px)에서도 버전까지 한 줄에 들어가고, 아이콘은 첫 줄 오른쪽 끝에 있어요.
    await page.setViewportSize({ width: 360, height: 780 });
    expect(await measure()).toEqual(expected);
  });

  test("목록의 리뷰 링크는 화면에 보이기만 해서는 미리 받지 않고, 마우스를 올리면 그때 미리 받는다", async ({ page, isMobile }) => {
    test.skip(isMobile, "마우스 올리기는 데스크톱에서 시험해요(휴대폰은 손가락이 닿을 때 받아요)");
    // 리뷰 상세의 화면 데이터(RSC: 주소에 _rsc가 붙어요) 요청을 모아요.
    const prefetched: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/reviews/") && url.searchParams.has("_rsc")) prefetched.push(url.pathname);
    });
    await openHome(page);
    await page.waitForLoadState("networkidle");
    // 목록에 10편이 보여도 하나도 미리 받지 않아요.
    expect(prefetched).toEqual([]);
    const link = page.getByRole("region", { name: "영화 목록" }).getByRole("listitem").first().getByRole("link");
    const href = await link.getAttribute("href");
    await link.hover();
    await expect.poll(() => prefetched).toContain(href);
  });

  test("머리글 이름 옆에 지금 버전(package.json)을 보인다", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("banner").getByText(/^\(v\d+\.\d+\.\d+\)$/)).toHaveText(`(v${version})`);
  });

  test("검색창은 글쓰기 화면의 입력 칸과 같은 모양(2px 실선 테두리, 높이 44px)이다", async ({ page }) => {
    await openHome(page);
    const style = await searchBox(page).evaluate((input) => {
      const css = getComputedStyle(input);
      return [css.borderTopStyle, css.borderTopWidth, css.borderBottomStyle, css.borderLeftWidth, css.minHeight];
    });
    expect(style).toEqual(["solid", "2px", "solid", "2px", "44px"]);
  });

  test("픽셀 글꼴(Neo둥근모)을 받아서 쓴다", async ({ page }) => {
    await page.goto("/");
    // document.fonts.ready: 글꼴을 다 받을 때까지 기다려요. 그다음 받은 글꼴 목록에서 neodgm을 찾아요.
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some((font) => /neodgm/i.test(font.family) && font.status === "loaded");
    });
    expect(loaded).toBe(true);
  });

  test("검색어를 쓰고 Enter를 누르면 거르고, 조건을 주소에 남긴다", async ({ page }) => {
    await openHome(page);
    // 실제 브라우저에서는 <search> 태그가 "검색" 역할(랜드마크)로 잡혀요.
    const search = page.getByRole("search", { name: "리뷰 찾기" });
    await expect(search.getByRole("combobox", { name: "검색" })).toHaveAttribute("placeholder", "검색어를 입력하세요");
    await searchBox(page).fill("station");
    await searchBox(page).press("Enter");

    await expect(page).toHaveURL(/\?q=station$/);
    await expect(listStatus(page)).toHaveText("11편 중 1편");
    expect(await listTitles(page)).toEqual(["알파 정거장"]);

    // 새로 고침해도 주소의 조건으로 같은 결과가 보여요.
    await page.reload();
    await expect(listStatus(page)).toHaveText("11편 중 1편");
    await expect(searchBox(page)).toHaveValue("station");
  });

  test("자동완성: 글자를 치면 추천 층이 뜨고, 추천을 고르면 그 글자로 바로 찾는다", async ({ page }) => {
    await openHome(page);
    await searchBox(page).pressSequentially("시험");
    const listbox = page.getByRole("listbox", { name: "추천 검색어" });
    await expect(listbox).toBeVisible();
    // "시험"이 들어간 감독(김시험, 이시험 ...)과 감독 이름들을 추천해요.
    await expect(listbox.getByRole("option", { name: "김시험 감독" })).toBeVisible();

    // ▼로 고르면 고른 추천이 반전되고, Enter로 찾아요. 초점은 검색창에 그대로 있어요.
    await searchBox(page).press("ArrowDown");
    await expect(listbox.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
    await expect(searchBox(page)).toBeFocused();
    await searchBox(page).press("Enter");
    await expect(listbox).toBeHidden();
    await expect(page).toHaveURL(/\?q=/);
    await expect(listStatus(page)).toHaveText(/^11편 중 \d+편$/);
  });

  test("자동완성 추천을 마우스로 눌러도 바로 찾는다", async ({ page }) => {
    await openHome(page);
    await searchBox(page).pressSequentially("베타");
    await page.getByRole("option", { name: "베타 로맨스 제목" }).click();
    await expect(searchBox(page)).toHaveValue("베타 로맨스");
    await expect.poll(() => listTitles(page)).toEqual(["베타 로맨스"]);
  });

  test("장르를 고르면 바로 거르고, 평점순으로 정렬할 수 있다", async ({ page }) => {
    await openHome(page);
    await page.getByRole("group", { name: "장르" }).getByRole("radio", { name: "드라마 2편" }).check();
    await expect(listStatus(page)).toHaveText("11편 중 2편");
    expect(await listTitles(page)).toEqual(["알파 정거장", LONG_TITLE]);

    await page.getByRole("radio", { name: "평점순" }).check();
    // 주소에는 장르를 영어 이름으로 적어요(드라마 → drama).
    await expect(page).toHaveURL(/\?genre=drama&sort=rating$/);
    await expect.poll(() => listTitles(page)).toEqual([LONG_TITLE, "알파 정거장"]);
  });

  test("장르 칩은 정한 10가지가 가나다순으로 보이고, 목록에 없는 장르는 없다", async ({ page }) => {
    await openHome(page);
    const genres = page.getByRole("group", { name: "장르" });
    // 라디오 단추의 접근 이름("드라마 2편"처럼 장르 + 편수)으로 순서를 확인해요. 레이블 연결이 끊기면 이름이 비어 실패해요.
    const radios = genres.getByRole("radio");
    const names = ["전체", "공포", "다큐멘터리", "드라마", "로맨스", "범죄", "스릴러", "스포츠", "액션", "재난", "코미디"];
    await expect(radios).toHaveCount(names.length);
    for (const [index, name] of names.entries()) {
      await expect(radios.nth(index)).toHaveAccessibleName(new RegExp(`^${name} \\d+편$`));
    }
    for (const removed of ["SF", "판타지", "미스터리", "음악", "전쟁", "역사", "모험", "서부"]) {
      await expect(genres.getByRole("radio", { name: new RegExp(`^${removed} `) })).toHaveCount(0);
    }
  });

  test("고르지 않은 칩은 ▶ 자리를 비워 두지 않는다", async ({ page }) => {
    await openHome(page);
    // 고른 칩(전체)의 ▶는 보이고, 고르지 않은 칩(드라마)의 ▶는 자리도 차지하지 않아요(display: none).
    const checked = page.locator(".chip", { has: page.getByRole("radio", { name: "전체 11편" }) }).locator(".chip-mark");
    const unchecked = page.locator(".chip", { has: page.getByRole("radio", { name: "드라마 2편" }) }).locator(".chip-mark");
    await expect(checked).toBeVisible();
    expect(await unchecked.evaluate((mark) => getComputedStyle(mark).display)).toBe("none");
  });

  test("주소로 들어온 조건(장르·정렬)을 그대로 보인다", async ({ page }) => {
    await openHome(page, `/?genre=${encodeURIComponent("드라마")}&sort=rating`);
    await expect(page.getByRole("radio", { name: "드라마 2편" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "평점순" })).toBeChecked();
    await expect.poll(() => listTitles(page)).toEqual([LONG_TITLE, "알파 정거장"]);
  });

  test("찾는 리뷰가 없으면 알리고, 조건을 지우면 전체로 돌아가 검색란에 초점을 둔다", async ({ page }) => {
    await openHome(page, "/?q=없는영화");
    await expect(page.getByText("찾는 리뷰가 없습니다.")).toBeVisible();
    await expect(listStatus(page)).toHaveText("11편 중 0편");

    await page.getByRole("button", { name: "검색 조건 지우기" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(listStatus(page)).toHaveText("전체 11편 · 10편 표시");
    await expect(searchBox(page)).toBeFocused();
  });

  test("무한 스크롤: 목록 끝으로 내려가면 나머지 리뷰가 저절로 보인다", async ({ page }) => {
    await openHome(page);
    await expect(page.getByRole("link", { name: "람다 질주" })).toHaveCount(0);
    // 목록 끝의 [더 보기] 자리까지 내려가요.
    await page.getByRole("button", { name: "1편 더 보기" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("link", { name: "람다 질주" })).toBeVisible();
    await expect(listStatus(page)).toHaveText("전체 11편");
    await expect(page.getByRole("button", { name: /더 보기/ })).toHaveCount(0);
  });

  test("접근성 규칙 위반이 없다(처음 상태, 추천 층, 거른 상태, 결과 없음)", async ({ page }) => {
    await openHome(page);
    await expectNoA11yViolations(page);
    await searchBox(page).pressSequentially("알파");
    await expect(page.getByRole("listbox", { name: "추천 검색어" })).toBeVisible();
    await expectNoA11yViolations(page);
    await page.goto(`/?genre=${encodeURIComponent("드라마")}`);
    await expectNoA11yViolations(page);
    await page.goto("/?q=없는영화");
    await expectNoA11yViolations(page);
  });

  test("휴대폰 화면에서는 키보드 조작 단추를 숨긴다", async ({ page, isMobile }) => {
    test.skip(!isMobile, "휴대폰 화면 전용");
    await page.goto("/");
    await expect(page.getByRole("button", { name: "키보드 조작" })).toBeHidden();
  });

  test("좁은 화면(320px)에서도 가로로 넘치지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/");
    await expectNoHorizontalScroll(page);
  });
});

test.describe("넓은 화면의 목록 배치", () => {
  test.skip(({ isMobile }) => isMobile, "넓은 화면 전용");

  test("검색 칸은 상세 화면 왼쪽 칸 너비로 목록 왼쪽에 놓이고, 스크롤해도 왼쪽 위에 붙어 있다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openHome(page);
    const aside = page.getByRole("search", { name: "리뷰 찾기" });
    const list = listRegion(page);
    const asideBox = (await aside.boundingBox())!;
    const listBox = (await list.boundingBox())!;

    // 같은 줄(위쪽 높이가 같음)에, 검색 칸이 왼쪽이고 너비는 16~18rem(256~288px)이에요.
    expect(Math.abs(asideBox.y - listBox.y)).toBeLessThan(2);
    expect(asideBox.x + asideBox.width).toBeLessThan(listBox.x);
    expect(asideBox.width).toBeGreaterThanOrEqual(256);
    expect(asideBox.width).toBeLessThanOrEqual(288);

    // 많이 내려도 검색 칸은 화면 위쪽에 붙어 보이고, 목록만 움직여요.
    await page.evaluate(() => window.scrollTo(0, 900));
    await expect(aside).toBeInViewport();
    expect((await aside.boundingBox())!.y).toBeLessThan(80);
  });

  test("포스터 썸네일은 가로 2 : 세로 3으로 맨 앞에 있고, 한줄평은 썸네일 아래 끝에 맞춰진다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openHome(page);
    const item = listRegion(page).locator("li").first();
    const box = (await item.locator(".poster-frame").boundingBox())!;
    // 크기는 디자인에 따라 바뀔 수 있어 비율만 봐요(반올림 오차 0.02까지).
    expect(Math.abs(box.width / box.height - 2 / 3)).toBeLessThanOrEqual(0.02);
    // 앞에 "-"나 번호가 없고, 썸네일이 제목보다 앞(왼쪽)에 있어요.
    await expect(item.locator("article > span[aria-hidden='true']")).toHaveCount(0);
    expect(box.x).toBeLessThan((await item.getByRole("heading", { level: 3 }).boundingBox())!.x);
    // 한줄평의 아래 끝이 썸네일의 아래 끝과 같은 높이예요(반올림 오차 2px까지).
    const oneLiner = (await item.locator("p.mt-auto").boundingBox())!;
    expect(Math.abs(oneLiner.y + oneLiner.height - (box.y + box.height))).toBeLessThanOrEqual(2);
  });
});

test.describe("리뷰 상세", () => {
  test("공유 미리 보기 그림(포스터, 없으면 기본 그림)과 검색엔진용 리뷰 정보(JSON-LD)를 담는다", async ({ page, request }) => {
    // 포스터가 있는 리뷰: 공유 그림은 포스터, X(트위터)는 작은 카드
    await page.goto("/reviews/alpha-station");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/posters\/test-pattern\.png$/);
    // 포스터의 가로·세로도 알려 줘요(메신저가 링크를 처음 받았을 때도 포스터를 바로 그리게). 시험 포스터는 200×300이에요.
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "200");
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "300");
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary");
    const data = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Review",
      datePublished: "2026-03-01",
      reviewRating: { "@type": "Rating", ratingValue: 4.5, bestRating: 5, worstRating: 0.5 },
      itemReviewed: { "@type": "Movie", name: "알파 정거장", alternateName: "Alpha Station", dateCreated: "2020", duration: "PT101M" },
    });

    // 포스터가 없는 리뷰: 블로그 기본 그림(1200×630)
    await page.goto("/reviews/beta-romance");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/og\.png$/);
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    const og = await request.get("/og.png");
    expect(og.status()).toBe(200);
    expect(og.headers()["content-type"]).toBe("image/png");

    // 처음 화면: 사이트 이름 정보(WebSite)와 기본 공유 그림
    await page.goto("/");
    expect(JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!)).toMatchObject({
      "@type": "WebSite",
      name: "DMB",
      alternateName: "덕배의 영화 블로그",
    });
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/og\.png$/);
  });

  test("[공유하기]는 휴대폰 공유 창에 리뷰 제목·평점·대표 주소를 넘기고, 공유 창이 없으면 주소를 복사해 알린다", async ({ page, context, browserName }) => {
    // 공유 창(navigator.share)을 가짜로 심어, 넘긴 값을 모아 둬요(시험 브라우저에는 진짜 공유 창이 없어요).
    await page.addInitScript(() => {
      const shared: ShareData[] = [];
      Object.assign(window, { __shared: shared });
      Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => void shared.push(data) });
    });
    await page.goto("/reviews/alpha-station");
    const share = page.getByRole("button", { name: "공유하기" });
    // 맨 윗줄 오른쪽([◀ 목록으로]와 같은 줄)에 있고, 떠 있는 단추들에 가려지지 않아요(가운데를 누르면 이 단추가 받아요).
    // 첫 화면 로딩 레이어가 다 걷힌 뒤에 재요(레이어는 data-booted가 붙은 뒤에도 0.3초 동안 흐려지며 화면을 덮어요).
    await expect(page.locator(".boot-overlay")).toBeHidden();
    const back = await page.getByRole("link", { name: "목록으로" }).boundingBox();
    const button = await share.boundingBox();
    expect(Math.abs(button!.y + button!.height / 2 - (back!.y + back!.height / 2))).toBeLessThan(4);
    expect(button!.x).toBeGreaterThan(back!.x + back!.width);
    await expect
      .poll(() =>
        share.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
        }),
      )
      .toBe(true);
    await share.click();
    // 공유하는 것은 대표 주소(링크)예요. 받는 쪽 미리 보기 카드에는 이 주소의 공유 그림(포스터)이 보여요.
    expect(await page.evaluate(() => (window as unknown as { __shared: ShareData[] }).__shared)).toEqual([
      { title: "알파 정거장 리뷰", text: expect.stringMatching(/^평점 4\.5 · /), url: "https://deokbae.blog/reviews/alpha-station" },
    ]);
    await expectNoA11yViolations(page);

    // 공유 창이 없는 브라우저(예: 컴퓨터의 Firefox)는 주소를 복사하고 안내해요.
    test.skip(browserName !== "chromium", "클립보드 권한은 Chromium에서만 줄 수 있어요");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    // 공유 창을 없는 것으로 만들어요(브라우저에 원래 있던 것도 가리도록 undefined로 덮어요).
    await page.evaluate(() => Object.defineProperty(navigator, "share", { configurable: true, value: undefined }));
    await share.click();
    await expect(page.getByRole("status").filter({ hasText: "링크를 복사했어요" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("https://deokbae.blog/reviews/alpha-station");
  });

  test("목록에서 제목을 누르면 상세로 가고, 포스터·머리 안내판·본문을 보인다(본 날·쓴 날은 없다)", async ({ page }) => {
    await openHome(page);
    await page.getByRole("link", { name: "알파 정거장" }).click();

    await expect(page).toHaveURL(/\/reviews\/alpha-station$/);
    await expect(page).toHaveTitle("알파 정거장 리뷰 — DMB");
    await expect(page.getByRole("heading", { level: 1, name: "알파 정거장" })).toBeVisible();

    // 포스터: 원고에 적은 설명(posterAlt)이 대체 텍스트가 되고, 형광 초록 SVG 필터가 씌워져 있어요.
    const poster = page.getByRole("img", { name: "일곱 빛깔 세로 띠가 있는 화면 조정 무늬" });
    await expect(poster).toBeVisible();
    // evaluate: 브라우저 안에서 함수를 실행해요. getComputedStyle로 실제 적용된 CSS 값을 읽어요.
    expect(await poster.evaluate((img) => getComputedStyle(img).filter)).toContain("url(");

    // 머리 안내판: 장르(제목 위), 감독까지 이어 쓴 정보 줄, 큰 평점. 예전 정보표(dl)와 본 날·쓴 날은 없어요.
    const header = page.locator("article > header");
    await expect(header.getByRole("list", { name: "장르" })).toHaveText("[드라마][재난]");
    // 정보 줄의 빈칸 일부는 줄바꿈되지 않는 빈칸(NBSP)이라 정규식은 \s(NBSP 포함)로 찾아요.
    await expect(header.getByText(/·\s감독\s/)).toBeVisible();
    await expect(header.getByText("평점 5점 만점에 4.5점")).toBeAttached();
    await expect(page.getByRole("term")).toHaveCount(0);
    // 본문 제목과 사이트 안 링크
    await expect(page.getByRole("heading", { level: 2, name: "좋았던 점" })).toBeVisible();
    await expect(page.getByRole("link", { name: "델타 기록 리뷰" })).toHaveAttribute("href", "/reviews/delta-record");
  });

  test("포스터를 올리지 않은 리뷰는 기본 포스터를 보인다", async ({ page }) => {
    await page.goto("/reviews/beta-romance");
    const fallback = page.getByRole("img", { name: "영화 ‘베타 로맨스’ 포스터(포스터 없음)" });
    await expect(fallback).toBeVisible();
    await expect(fallback).toContainText("NO POSTER");
    // 기본 포스터도 가로 2 : 세로 3이에요.
    const box = (await page.locator(".poster-frame").first().boundingBox())!;
    expect(box.height / box.width).toBeCloseTo(1.5, 1);
  });

  test("가장 최근 리뷰에는 '이전 리뷰'만 있고, 누르면 그 리뷰로 간다", async ({ page }) => {
    await page.goto("/reviews/alpha-station");
    const nav = page.getByRole("navigation", { name: "다른 리뷰" });
    await expect(nav.getByRole("link")).toHaveCount(1);
    await nav.getByRole("link", { name: "이전 리뷰 베타 로맨스" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "베타 로맨스" })).toBeVisible();
  });

  test("장르를 누르면 그 장르로 거른 목록으로 간다", async ({ page }) => {
    await page.goto("/reviews/alpha-station");
    await page.getByRole("link", { name: "재난", exact: true }).click();
    await expect(page.getByRole("radio", { name: "재난 1편" })).toBeChecked();
    await expect.poll(() => listTitles(page)).toEqual(["알파 정거장"]);
  });

  test("본문 Markdown(제목 높이 맞추기, 표, 각주)을 보인다", async ({ page }) => {
    await page.goto("/reviews/delta-record");
    // 원고의 "# 큰 제목"이 h2로 바뀌었는지
    await expect(page.getByRole("heading", { level: 2, name: "큰 제목으로 쓴 소제목" })).toBeVisible();
    // 표를 감싼 영역은 키보드로 초점을 받을 수 있어요(tabindex=0).
    const table = page.getByRole("region", { name: "표 1" });
    await table.focus();
    await expect(table).toBeFocused();
    await expect(page.getByRole("heading", { level: 2, name: "각주" })).toBeAttached();
  });

  test("사진만 있는 문단은 설명을 단 액자로, 붙여 쓴 사진들은 나란히(좁은 화면에서는 위아래로) 놓인다", async ({ page, isMobile }) => {
    await page.goto("/reviews/delta-record");

    // <figure>의 이름은 <figcaption>(사진 설명)이에요.
    const single = page.getByRole("figure", { name: "사진 한 장과 설명" });
    const photo = single.getByRole("img", { name: "화면 조정 무늬 한 장" });
    await expect(photo).toBeVisible();
    // 빌드할 때 잰 크기(200×300)가 달려 있어서, 사진이 오기 전에도 자리가 잡혀요.
    await expect(photo).toHaveAttribute("width", "200");
    await expect(photo).toHaveAttribute("height", "300");
    expect(await photo.evaluate((img) => getComputedStyle(img).filter)).toContain("url(");

    // 한 문단에 붙여 쓴 사진 두 장: 넓은 화면에서는 같은 높이에 나란히, 휴대폰에서는 위아래로
    const left = await page.getByRole("img", { name: "나란히 놓인 왼쪽 무늬" }).boundingBox();
    const right = await page.getByRole("img", { name: "나란히 놓인 오른쪽 무늬" }).boundingBox();
    if (isMobile) expect(right!.y).toBeGreaterThan(left!.y + left!.height);
    else expect(right!.y).toBe(left!.y);
    await expectNoHorizontalScroll(page);
  });

  test("넓은 화면에서는 포스터 칸이 본문 옆에 놓이고, 본문은 오른쪽 칸을 끝까지 쓴다", async ({ page, isMobile }) => {
    test.skip(isMobile, "넓은 화면 전용");
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/reviews/delta-record");

    const poster = page.locator("article .poster-frame").first();
    const body = page.getByRole("heading", { level: 2, name: "큰 제목으로 쓴 소제목" });
    // 두 칸: 포스터가 본문보다 왼쪽에 있어요.
    expect((await poster.boundingBox())!.x).toBeLessThan((await body.boundingBox())!.x);

    // 풀 페이지: 본문 문단이 46rem(736px)에 갇히지 않고 오른쪽 칸 너비를 다 써요.
    const paragraph = page.locator(".prose > p").first();
    expect((await paragraph.boundingBox())!.width).toBeGreaterThan(736);

    // 아래로 많이 내려도 포스터 칸은 화면 위쪽에 붙어 보여요(sticky).
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect(poster).toBeInViewport();
  });

  test("접근성 규칙 위반이 없다", async ({ page }) => {
    await page.goto("/reviews/alpha-station");
    await expectNoA11yViolations(page);
    await page.goto("/reviews/delta-record");
    await expectNoA11yViolations(page);
    await page.goto("/reviews/beta-romance");
    await expectNoA11yViolations(page);
  });

  test("띄어쓰기 없는 긴 제목도 좁은 화면에서 넘치지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/reviews/gamma-long");
    await expect(page.getByRole("heading", { level: 1, name: LONG_TITLE })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe("첫 화면 로딩 레이어", () => {
  test("처음 열면 웹 폰트를 받는 동안 화면을 덮고, 받으면 걷히며, 같은 탭에서 다시 열면 덮지 않는다", async ({ page }) => {
    // 웹 폰트(.woff2) 요청을 잠깐 붙잡아, 글꼴을 받는 동안의 모습을 봐요.
    let releaseFont: () => void = () => {};
    const fontHeld = new Promise<void>((resolve) => (releaseFont = resolve));
    await page.route("**/*.woff2", async (route) => {
      await fontHeld;
      await route.continue();
    });

    await page.goto("/", { waitUntil: "commit" });
    const overlay = page.locator(".boot-overlay");
    await expect(overlay).toBeVisible();
    await expect(overlay.getByRole("status")).toHaveText("불러오는 중");
    // 레이어는 화면 전체를 덮어요.
    const box = (await overlay.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect([Math.round(box.width), Math.round(box.height)]).toEqual([viewport.width, viewport.height]);

    // 글꼴을 받으면 걷혀요.
    releaseFont();
    await expect(overlay).toBeHidden();
    await expectNoA11yViolations(page);

    // 같은 탭에서 다시 열면 처음부터 걷혀 있어요(sessionStorage).
    await page.reload({ waitUntil: "commit" });
    await expect(page.locator("html")).toHaveAttribute("data-booted", "");
    await expect(overlay).toBeHidden();
  });
});

test.describe("포스터를 받지 못할 때", () => {
  // 서비스 워커가 그림 요청을 대신 받으면 아래 page.route로 막을 수 없어서, 이 시험에서는 꺼요.
  test.use({ serviceWorkers: "block" });

  test("포스터 그림을 받지 못하면 스켈레톤을 치우고 기본 포스터를 보인다", async ({ page }) => {
    // 포스터 그림 요청을 실패시켜요(파일이 없거나 연결이 끊긴 것처럼).
    await page.route((url) => url.pathname.startsWith("/_next/image") || url.pathname.startsWith("/posters/"), (route) => route.abort());
    await page.goto("/reviews/alpha-station");
    await expect(page.getByRole("img", { name: "일곱 빛깔 세로 띠가 있는 화면 조정 무늬(포스터 없음)" })).toBeVisible();
    await expect(page.locator("article .poster-frame .skeleton")).toHaveCount(0);
  });
});

test.describe("맨 위로 단추", () => {
  test("내려가면 나타나고(아이콘 없이 글자만), 누르면 맨 위로 올라가 머리글에 초점을 둔다", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto("/reviews/delta-record");
    const toTop = page.getByRole("button", { name: "맨 위로" });
    await expect(toTop).toBeHidden();

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(toTop).toBeVisible();
    await expect(toTop).toHaveText("맨 위로");
    // 화면 오른쪽 아래 구석(오른쪽·아래 끝에서 16px)에 떠 있어요.
    const box = (await toTop.boundingBox())!;
    expect([Math.round(800 - (box.x + box.width)), Math.round(600 - (box.y + box.height))]).toEqual([16, 16]);
    await toTop.click();

    // 부드럽게 올라가는 데 시간이 조금 걸려서, 0이 될 때까지 다시 확인해요(expect.poll).
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByRole("banner")).toBeFocused();
    await expect(toTop).toBeHidden();
  });
});

test.describe("없는 주소(404)", () => {
  test("404 상태로 안내하고 목록으로 돌아갈 수 있다", async ({ page }) => {
    // goto는 응답(response)을 돌려줘요. status()로 서버가 보낸 상태 번호를 확인해요.
    const response = await page.goto("/reviews/no-such-review");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "찾는 화면이 없습니다" })).toBeVisible();
    await expectNoA11yViolations(page);

    await page.getByRole("link", { name: "목록으로 가기" }).click();
    await expect(page.getByRole("region", { name: "영화 목록" })).toBeVisible();
  });
});

test.describe("키보드", () => {
  // 휴대폰(터치) 화면에서는 Tab 키를 쓰지 않으니 데스크톱에서만 확인해요.
  test.skip(({ isMobile }) => isMobile, "키보드 시험은 데스크톱에서만");

  test("처음 Tab을 누르면 '본문 바로가기'가 보이고, Enter로 본문에 초점이 간다", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "본문 바로가기" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
  });

  test("목록에서 ▼ ▲ Home End로 리뷰를 고르고, Enter로 연다", async ({ page }) => {
    await openHome(page);
    const alpha = page.getByRole("link", { name: "알파 정거장" });

    await page.keyboard.press("ArrowDown");
    await expect(alpha).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("link", { name: "베타 로맨스" })).toBeFocused();
    // End: 지금 불러온 리뷰 가운데 마지막(목록 끝으로 스크롤되면서 나머지가 저절로 불러와질 수도 있어서 둘 중 하나예요)
    await page.keyboard.press("End");
    await expect.poll(() => page.evaluate(() => document.activeElement?.textContent)).toMatch(/^(카파 사건|람다 질주)$/);
    await page.keyboard.press("Home");
    await expect(alpha).toBeFocused();
    // 고른 항목은 반전되어 보여요(초록 바탕). 키보드로 고른 초점이라 :focus-visible이에요.
    expect(await alpha.evaluate((link) => link.matches(":focus-visible"))).toBe(true);

    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "알파 정거장" })).toBeVisible();
  });

  test("목록에서 ◀ ▶로도 이전·다음 리뷰를 고르고, 키보드 조작 안내에도 ◀ ▶가 있다", async ({ page, isMobile }) => {
    await openHome(page);
    const alpha = page.getByRole("link", { name: "알파 정거장" });

    // 목록 밖에서 ▶: 화면에 보이는 첫 리뷰로 들어가요(▼와 같아요).
    await page.keyboard.press("ArrowRight");
    await expect(alpha).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("link", { name: "베타 로맨스" })).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(alpha).toBeFocused();

    // 키보드 조작 안내(넓은 화면에만 보여요)에 ◀ ▶ "이전·다음 리뷰"가 있어요.
    if (!isMobile) {
      await page.getByRole("button", { name: "키보드 조작" }).click();
      await expect(page.getByRole("definition").filter({ hasText: "이전·다음 리뷰" })).toBeVisible();
      await expect(page.getByRole("term").filter({ hasText: "◀" })).toBeVisible();
    }
  });

  test("키보드로 [더 보기]에 가면 나머지를 불러오고, 새로 나온 첫 리뷰로 초점이 간다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openHome(page);
    // 단추에 초점이 가면 화면이 단추까지 스크롤되면서 저절로 불러오기가 일어나요.
    // 그때 단추가 사라져도 초점을 잃지 않고, 새로 나온 첫 리뷰(람다 질주)로 옮겨 가요.
    await page.getByRole("button", { name: "1편 더 보기" }).focus();
    await page.keyboard.press("Enter").catch(() => {});
    await expect(page.getByRole("link", { name: "람다 질주" })).toBeFocused();
  });

  test("검색창(추천이 없을 때)과 장르 단추에서는 방향키를 가로채지 않는다", async ({ page }) => {
    await openHome(page);
    await searchBox(page).focus();
    await page.keyboard.press("ArrowDown");
    await expect(searchBox(page)).toBeFocused();

    // 라디오 단추에서 ▼는 다음 장르(가나다순 첫 장르인 공포)를 고르는 원래 기능 그대로예요. 초점도 목록으로 끌려가지 않고 그 단추에 있어요.
    await page.getByRole("radio", { name: "전체 11편" }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio", { name: "전체 11편" })).not.toBeChecked();
    const next = page.getByRole("radio", { name: "공포 1편" });
    await expect(next).toBeChecked();
    await expect(next).toBeFocused();
  });

  test("상세에서 ◀ ▶로 이전·다음 리뷰를 넘기고, Esc로 목록에 돌아온다", async ({ page }) => {
    // 준비된 처음 화면에서 링크로 들어가요. 이렇게 옮긴 화면은 보이는 순간 키 기능도 붙어 있어요(review-keys.tsx).
    await openHome(page);
    await page.getByRole("link", { name: "베타 로맨스" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "베타 로맨스" })).toBeVisible();

    await page.keyboard.press("ArrowRight"); // 다음(더 최근) 리뷰
    await expect(page.getByRole("heading", { level: 1, name: "알파 정거장" })).toBeVisible();
    await page.keyboard.press("ArrowLeft"); // 이전(더 예전) 리뷰
    await expect(page.getByRole("heading", { level: 1, name: "베타 로맨스" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("region", { name: "영화 목록" })).toBeVisible();
  });

  test("키보드 조작 안내: 단추로 여닫고, 열어 둔 상태를 기억하며, Esc는 안내부터 닫는다", async ({ page }) => {
    await openHome(page);
    await page.getByRole("link", { name: "알파 정거장" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "알파 정거장" })).toBeVisible();
    const toggle = page.getByRole("button", { name: "키보드 조작" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    // 단추에는 ▲▼ 아이콘 없이 글자만 있어요.
    await expect(toggle).toHaveText("키보드 조작");

    await toggle.click();
    await expect(page.getByRole("heading", { name: "이 화면의 키" })).toBeVisible();
    // 상세 화면에서는 상세 화면의 키를 안내해요. (안내는 바닥글 안에 있어요. 본문의 다른 목록과 섞이지 않게 범위를 좁혀요.)
    await expect(page.getByRole("contentinfo").getByRole("definition")).toHaveText(["이전·다음 리뷰", "목록으로", "다음 항목으로"]);
    await expectNoA11yViolations(page);

    // 새로 고쳐도 열린 채로 있어요(브라우저 저장소에 기억). 화면이 준비되면서 저장된 값으로 열려요.
    await page.reload();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    // 첫 Esc는 안내만 닫고(화면은 그대로), 두 번째 Esc가 목록으로 가요.
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("heading", { level: 1, name: "알파 정거장" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("region", { name: "영화 목록" })).toBeVisible();
  });

  test("좁은 화면에서 숨은 안내는 열림 상태여도 Esc를 가져가지 않는다", async ({ page }) => {
    await openHome(page);
    await page.evaluate(() => localStorage.setItem("blog:keyboard-help", "open"));
    await page.getByRole("link", { name: "알파 정거장" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "알파 정거장" })).toBeVisible();

    // 640px보다 좁히면 안내가 통째로 숨어요. 이때 Esc는 바로 목록으로 가요.
    await page.setViewportSize({ width: 600, height: 800 });
    await expect(page.getByRole("button", { name: "키보드 조작" })).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("region", { name: "영화 목록" })).toBeVisible();
  });
});
