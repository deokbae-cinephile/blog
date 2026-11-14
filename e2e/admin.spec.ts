/**
 * @file 글쓴이 기능 E2E 테스트 (e2e/admin.spec.ts)
 *
 * 진짜 브라우저로 글쓴이 기능을 처음부터 끝까지 써 보며 확인해요.
 *   - proxy.ts: 로그인하지 않으면 글쓰기 화면은 로그인 화면으로, 저장 API는 401로 막는지
 *   - 로그인: 틀리면 알리고, 맞으면 원래 가려던 화면으로 돌아가는지
 *   - 리뷰 라이터: 리뷰 추가(포스터·장면 사진 포함)를 저장하면 저장소(가짜 GitHub)에 커밋이 올라가는지,
 *     본문 미리 보기가 넓은 화면은 나란히, 좁은 화면은 탭으로 보이는지
 *   - 수정·삭제, 로그아웃
 *   - 접근성: 로그인·글쓰기 화면 axe 검사
 *
 * 저장소는 가짜 GitHub 서버(e2e/mock-github.mjs)예요. 시작할 때 처음 모습으로 되돌려요.
 * 글쓰기는 저장소를 바꾸는 시험이라, 데스크톱에서 차례대로(serial) 한 번만 돌려요.
 * (블로그 화면은 빌드할 때 만든 그대로라, 저장해도 E2E 중에는 목록이 바뀌지 않아요. 결과는 커밋 기록으로 확인해요.)
 */

import path from "node:path";

import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

import { E2E_ADMIN } from "./admin-account";
import { expectNoA11yViolations, expectNoHorizontalScroll } from "./helpers";

/** 가짜 GitHub 서버 주소(playwright.config.ts와 같아요) */
const GITHUB = `http://127.0.0.1:${process.env.MOCK_GITHUB_PORT ?? 3101}`;
/** 시험용 그림(화면 조정 무늬, 200×300 PNG) */
const PICTURE = path.resolve("public/posters/test-pattern.png");

/** 가짜 GitHub에 올라온 커밋 목록 */
type Commit = { message: string; added: string[]; deleted: string[]; texts: Record<string, string> };

/** 로그인 화면에서 아이디·비밀번호를 넣고 로그인해요. */
async function login(page: Page, password: string = E2E_ADMIN.password) {
  await page.getByLabel(/아이디/).fill(E2E_ADMIN.id);
  await page.getByLabel(/비밀번호/, { exact: false }).and(page.locator("input")).fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
}

test.describe("로그인 전(proxy.ts가 막기)", () => {
  test("글쓰기 화면에 가면 로그인 화면으로 보내고, 원래 주소를 기억한다", async ({ page }) => {
    await page.goto("/write");
    await expect(page).toHaveURL(/\/login\?next=%2Fwrite$/);
    await expect(page.getByRole("heading", { level: 1, name: "글쓴이 로그인" })).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("저장 API는 로그인 없이 부르면 401로 답한다", async ({ request }) => {
    const response = await request.post("/api/reviews", { data: {} });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ message: "로그인이 필요합니다. 다시 로그인한 뒤 시도하세요." });
  });

  test("로그인 전에는 [+](리뷰 추가)·[수정]·[삭제]가 보이지 않는다", async ({ page }) => {
    await page.goto("/reviews/alpha-station");
    await expect(page.getByRole("link", { name: "수정" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "삭제" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "리뷰 추가" })).toHaveCount(0);
    // 방문자에게는 로그인 링크도 보이지 않아요(글쓴이는 /login으로 직접 가요).
    await expect(page.getByRole("contentinfo").getByRole("link", { name: /로그인/ })).toHaveCount(0);
  });
});

test.describe("글쓴이 기능", () => {
  test.skip(({ isMobile }) => isMobile, "저장소를 바꾸는 시험이라 데스크톱에서 한 번만 돌려요");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ request }) => {
    // 가짜 저장소를 처음 모습(시험용 원고)으로 되돌려요.
    await request.post(`${GITHUB}/__reset`);
  });

  test("비밀번호가 틀리면 알리고, 맞으면 원래 가려던 글쓰기 화면으로 돌아간다", async ({ page }) => {
    await page.goto("/write");
    await login(page, "wrong-password");
    await expect(page.getByText("아이디나 비밀번호가 맞지 않습니다. 다시 확인해 입력하세요.")).toBeVisible();

    await login(page);
    await expect(page).toHaveURL(/\/write$/);
    await expect(page.getByRole("heading", { level: 1, name: "리뷰 추가" })).toBeVisible();
    // 글쓰기 화면에서는 떠 있는 [+](리뷰 추가)와 왼쪽 아래 "키보드 조작" 단추를 숨겨요.
    await expect(page.getByRole("link", { name: "리뷰 추가" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "키보드 조작" })).toHaveCount(0);
    await expectNoA11yViolations(page);

    // 다른 화면에서는 오른쪽 아래 구석에 44 × 44px [+]가 떠 있고, 누르면 글쓰기 화면으로 가요.
    await page.goto("/");
    const add = page.getByRole("link", { name: "리뷰 추가" });
    await expect(add).toBeVisible();
    const box = (await add.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect([Math.round(box.width), Math.round(box.height)]).toEqual([44, 44]);
    // 오른쪽·아래 끝에서 16px 안쪽
    expect([Math.round(viewport.width - (box.x + box.width)), Math.round(viewport.height - (box.y + box.height))]).toEqual([16, 16]);
    // 내려 읽어 [맨 위로]가 나타나면 [+]의 왼쪽에 붙고(사이 8px), [+]는 그 자리 그대로예요.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const toTop = page.getByRole("button", { name: "맨 위로" });
    await expect(toTop).toBeVisible();
    const topBox = (await toTop.boundingBox())!;
    expect(Math.round(box.x - (topBox.x + topBox.width))).toBe(8);
    expect(Math.round((await add.boundingBox())!.x)).toBe(Math.round(box.x));
    await expectNoA11yViolations(page);
    await add.click();
    await expect(page).toHaveURL(/\/write$/);
  });

  test("리뷰 추가: 포스터와 장면 사진을 넣고 저장하면, 원고·사진이 커밋 하나로 저장소에 올라간다", async ({ page, request }) => {
    await page.goto("/login?next=/write");
    await login(page);
    await expect(page.getByRole("heading", { level: 1, name: "리뷰 추가" })).toBeVisible();

    // 틀린 칸 먼저: 빈 칸으로 저장하면 고칠 곳 목록이 나오고 초점이 그리로 가요.
    await page.getByRole("button", { name: "리뷰 저장" }).click();
    await expect(page.getByRole("group", { name: /고칠 곳 \d+개/ })).toBeFocused();

    await page.getByLabel(/^주소\(영문\)/).fill("e2e-new-review");
    await page.getByLabel(/^제목/).fill("E2E 새 리뷰");
    await page.getByLabel(/^개봉 연도/).fill("2026");
    await page.getByLabel(/^감독/).fill("시험감독");
    await page.getByRole("checkbox", { name: "로맨스" }).check();
    // 평점은 처음에 5.0이 골라져 있어요("고르세요"가 없어요).
    await expect(page.getByLabel(/^평점/)).toHaveValue("5.0");
    await page.getByLabel(/^평점/).selectOption("3.5");
    await page.getByLabel(/^한줄평/).fill("끝까지 저장되는지 보는 한줄평");
    await page.getByLabel("포스터 고르기").setInputFiles(PICTURE);
    // [포스터 고르기]·[포스터 빼기]는 포스터와 같은 너비예요.
    const frame = (await page.getByRole("group", { name: "포스터" }).locator(".poster-frame").boundingBox())!;
    for (const button of [page.getByText("포스터 고르기", { exact: true }), page.getByRole("button", { name: "포스터 빼기" })]) {
      expect(Math.round((await button.boundingBox())!.width)).toBe(Math.round(frame.width));
    }
    // 평점 칸: ▼와 칸 오른쪽 끝 사이가, 글자와 칸 왼쪽 끝 사이(테두리 + 안쪽 여백)와 같아요(좌우 같은 간격).
    const inset = await page.getByLabel(/^평점/).evaluate((select) => {
      const style = getComputedStyle(select);
      const arrow = select.parentElement!.querySelector("svg")!.getBoundingClientRect();
      return {
        left: parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
        right: select.getBoundingClientRect().right - arrow.right,
      };
    });
    expect(Math.round(inset.right)).toBe(Math.round(inset.left));
    const body = page.getByRole("textbox", { name: "본문(Markdown)" });
    await body.fill("첫 문단입니다.");
    await page.getByLabel("장면 사진 넣기").setInputFiles(PICTURE);

    // 사진 줄이 들어가고, 커서는 설명 자리([ ] 안)에 있어요. 설명을 적어요.
    await expect(body).toHaveValue("첫 문단입니다.\n\n![](/images/e2e-new-review/scene-1.png)\n\n");
    await page.keyboard.type("화면 조정 무늬");
    await expect(body).toHaveValue("첫 문단입니다.\n\n![화면 조정 무늬](/images/e2e-new-review/scene-1.png)\n\n");

    // 넓은 화면은 본문 칸 오른쪽에 미리 보기가 나란히 있고, 높이가 같아요.
    // 아직 올리지 않은 사진도 고른 파일(임시 주소 blob:)로 보여요.
    const preview = page.getByRole("region", { name: "미리 보기" });
    await expect(preview.getByText("첫 문단입니다.")).toBeVisible();
    await expect(preview.getByRole("img", { name: "화면 조정 무늬" })).toHaveAttribute("src", /^blob:/);
    const bodyBox = (await body.boundingBox())!;
    const previewBox = (await preview.boundingBox())!;
    expect(previewBox.x).toBeGreaterThan(bodyBox.x + bodyBox.width);
    expect(Math.abs(previewBox.y - bodyBox.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(previewBox.height - bodyBox.height)).toBeLessThanOrEqual(2);
    await expectNoA11yViolations(page);

    await page.getByRole("button", { name: "리뷰 저장" }).click();
    await expect(page.getByRole("heading", { name: "저장했습니다" })).toBeFocused();

    // 가짜 GitHub에 커밋이 하나 올라갔는지, 무엇이 들어갔는지 확인해요.
    const commits = (await (await request.get(`${GITHUB}/__commits`)).json()) as Commit[];
    const commit = commits.find((item) => item.message === "리뷰 추가: E2E 새 리뷰")!;
    expect(commit.added.sort()).toEqual([
      "content/reviews/e2e-new-review.md",
      "public/images/e2e-new-review/scene-1.png",
      "public/posters/e2e-new-review.png",
    ]);
    expect(commit.texts["content/reviews/e2e-new-review.md"]).toContain("genres: [로맨스]\nrating: 3.5\n");
    expect(commit.texts["content/reviews/e2e-new-review.md"]).toContain("![화면 조정 무늬](/images/e2e-new-review/scene-1.png)");
  });

  test("본문에서 Tab으로 목록을 들여 써 중첩 목록을 만들고(미리 보기에도), Esc 다음 Tab으로 빠져나간다", async ({ page }) => {
    await page.goto("/login?next=/write");
    await login(page);
    const body = page.getByRole("textbox", { name: "본문(Markdown)" });
    await body.click();
    await page.keyboard.type("- 가");
    await page.keyboard.press("Enter");
    await page.keyboard.type("- 나");

    // Tab: 다음 칸(미리 보기)으로 넘어가지 않고, 목록 줄 맨 앞에 Tab 문자를 넣어 안쪽 목록으로 만들어요.
    await page.keyboard.press("Tab");
    await expect(body).toHaveValue("- 가\n\t- 나");
    await expect(body).toBeFocused();
    // 미리 보기에서도 "나"가 "가" 안쪽 목록이에요.
    await expect(page.getByRole("region", { name: "미리 보기" }).locator("ul ul li")).toHaveText("나");
    // 되돌리기(Ctrl·Cmd+Z)로 들여쓰기를 취소할 수 있어요(브라우저가 글을 끼워 넣어서).
    await page.keyboard.press("ControlOrMeta+z");
    await expect(body).toHaveValue("- 가\n- 나");

    // Shift+Tab: 내어쓰기
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(body).toHaveValue("- 가\n- 나");

    // Esc를 누른 다음 Tab은 원래대로 다음 칸으로 넘어가요.
    await page.keyboard.press("Escape");
    await page.keyboard.press("Tab");
    await expect(body).not.toBeFocused();
    await expect(body).toHaveValue("- 가\n- 나");
  });

  test("Markdown 파일을 불러오면 칸이 바로 채워진다", async ({ page }) => {
    await page.goto("/login?next=/write");
    await login(page);
    await page.getByLabel("Markdown 파일 불러오기").setInputFiles(path.resolve("e2e/fixtures/reviews/epsilon-night.md"));
    await expect(page.getByLabel(/^제목/)).toHaveValue("엡실론의 밤");
    await expect(page.getByLabel(/^주소\(영문\)/)).toHaveValue("epsilon-night");
    await expect(page.getByLabel(/^평점/)).toHaveValue("3.5");
    await expect(page.getByRole("checkbox", { name: "스릴러" })).toBeChecked();
  });

  test("수정 화면은 저장소에서 원고를 읽는 동안 로딩 UI와 글쓰기 스켈레톤을 보이고, 다 읽으면 폼으로 바뀐다", async ({ page, request }) => {
    await page.goto("/login?next=/write");
    await login(page);
    await expect(page.getByRole("heading", { level: 1, name: "리뷰 추가" })).toBeVisible();

    // 느린 GitHub 흉내: 요청마다 0.7초 늦게 답해요(원고 하나를 읽는 데 요청이 여러 번 들어요).
    await request.post(`${GITHUB}/__delay?ms=700`);
    try {
      // commit: 화면을 다 받기 전, 응답이 시작되자마자 돌아와요. 먼저 오는 로딩 화면을 보려고요.
      await page.goto("/write/alpha-station", { waitUntil: "commit" });
      const status = page.getByRole("status").filter({ hasText: "글쓰기 화면을 불러오는 중" });
      await expect(status).toBeVisible();
      await expect(page.locator(".skeleton").first()).toBeVisible();
      await expectNoA11yViolations(page);
      await expectNoHorizontalScroll(page);

      // 원고를 다 읽으면 로딩 화면은 사라지고 수정 화면이 보여요.
      await expect(page.getByRole("heading", { level: 1, name: "리뷰 수정: alpha-station" })).toBeVisible({ timeout: 15_000 });
      await expect(status).toHaveCount(0);
    } finally {
      await request.post(`${GITHUB}/__delay?ms=0`);
    }
  });

  test("수정: 상세 화면의 [수정]으로 들어가 저장소 원고를 고치면, 고친 원고가 커밋된다", async ({ page, request }) => {
    await page.goto("/login?next=/reviews/alpha-station");
    await login(page);
    await page.getByRole("link", { name: "수정" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "리뷰 수정: alpha-station" })).toBeVisible();
    await expect(page.getByLabel(/^제목/)).toHaveValue("알파 정거장");

    await page.getByLabel(/^한줄평/).fill("고친 한줄평");
    await page.getByRole("button", { name: "수정한 내용 저장" }).click();
    await expect(page.getByRole("heading", { name: "저장했습니다" })).toBeVisible();

    const commits = (await (await request.get(`${GITHUB}/__commits`)).json()) as Commit[];
    const commit = commits.find((item) => item.message === "리뷰 수정: 알파 정거장")!;
    expect(commit.texts["content/reviews/alpha-station.md"]).toContain("oneLiner: 고친 한줄평");
  });

  test("삭제: 확인 창에서 [삭제]를 누르면 원고를 지우는 커밋이 올라가고, 로그아웃하면 다시 막힌다", async ({ page, request }) => {
    await page.goto("/login?next=/reviews/epsilon-night");
    await login(page);
    await page.getByRole("button", { name: "삭제" }).click();
    const dialog = page.getByRole("alertdialog", { name: "리뷰를 삭제할까요?" });
    await expect(dialog).toBeVisible();
    // 처음 초점은 되돌리기 쉬운 [취소]에 있어요.
    await expect(dialog.getByRole("button", { name: "취소" })).toBeFocused();
    await expectNoA11yViolations(page);

    await dialog.getByRole("button", { name: "삭제" }).click();
    await expect(page.getByRole("status").filter({ hasText: "리뷰를 삭제했습니다" })).toBeVisible();
    await expect(page.getByRole("link", { name: "목록으로", exact: true }).last()).toBeFocused();

    const commits = (await (await request.get(`${GITHUB}/__commits`)).json()) as Commit[];
    expect(commits.find((item) => item.message === "리뷰 삭제: 엡실론의 밤")?.deleted).toEqual(["content/reviews/epsilon-night.md"]);

    // 로그아웃하면 단추가 사라지고, 글쓰기 화면은 다시 로그인 화면으로 보내요.
    await page.getByRole("contentinfo").getByRole("button", { name: "로그아웃" }).click();
    await expect(page.getByRole("contentinfo").getByRole("button", { name: "로그아웃" })).toHaveCount(0);
    await page.goto("/write");
    await expect(page).toHaveURL(/\/login\?next=%2Fwrite$/);
  });
});

test.describe("조회수", () => {
  test.skip(({ isMobile }) => isMobile, "서버의 조회수를 함께 쓰는 시험이라 데스크톱에서 한 번만 돌려요");
  test.describe.configure({ mode: "serial" });

  /** API로 리뷰 하나의 조회수를 읽어요(세지 않아요). */
  const viewsOf = async (request: APIRequestContext, slug: string) => ((await (await request.get(`/api/views/${slug}`)).json()) as { count: number }).count;

  test("로그인하지 않은 방문자가 상세를 열면 한 번 세고, 같은 탭에서 새로 고치면 다시 세지 않는다", async ({ page, request }) => {
    const before = await viewsOf(request, "theta-court");
    await page.goto("/reviews/theta-court");
    // 머리 안내판의 정보 줄 끝에 " · 조회 N"
    const header = page.locator("article > header");
    await expect(header).toContainText(`· 조회 ${before + 1}`);
    expect(await viewsOf(request, "theta-court")).toBe(before + 1);

    await page.reload();
    await expect(header).toContainText(`· 조회 ${before + 1}`);
    expect(await viewsOf(request, "theta-court")).toBe(before + 1);
  });

  test("글쓴이로 로그인해 상세를 열면 세지 않는다", async ({ page, request }) => {
    const before = await viewsOf(request, "theta-court");
    await page.goto("/login?next=/reviews/theta-court");
    await login(page);
    await expect(page.locator("article > header")).toContainText(`· 조회 ${before}`);
    expect(await viewsOf(request, "theta-court")).toBe(before);
  });

  test("목록에 조회수가 보이고, 조회순을 고르면 조회수가 많은 리뷰부터 보인다", async ({ page, request, baseURL }) => {
    // 서로 다른 방문자(접속 주소가 다름)가 iota-ranch를 6번 본 것처럼 세요. 다른 사이트 요청이 아니게 Origin을 붙여요.
    for (let index = 1; index <= 6; index += 1) {
      await request.post("/api/views/iota-ranch", { headers: { origin: baseURL!, "x-forwarded-for": `198.51.100.${index}` } });
    }
    const iota = await viewsOf(request, "iota-ranch");
    expect(iota).toBeGreaterThanOrEqual(6);

    await page.goto("/");
    const list = page.getByRole("region", { name: "영화 목록" });
    await page.getByRole("radio", { name: "조회순" }).check();
    await expect(page).toHaveURL(/sort=views/);
    // 맨 위가 가장 많이 본 이오타 목장이고, 둘째 줄에 조회수가 보여요.
    const first = list.getByRole("listitem").first();
    await expect(first.getByRole("heading", { level: 3 })).toHaveText("이오타 목장");
    await expect(first).toContainText(`조회 ${iota}`);
    await expectNoA11yViolations(page);
  });
});

test.describe("글쓰기 화면(좁은 화면)", () => {
  test.skip(({ isMobile }) => !isMobile, "좁은 화면에서만 보이는 탭이라 휴대폰 화면에서만 돌려요");

  test("본문은 [Markdown 입력]·[미리 보기] 탭으로 바꿔 보고, 화면이 가로로 넘치지 않는다", async ({ page }) => {
    await page.goto("/login?next=/write");
    await login(page);
    await expect(page.getByRole("heading", { level: 1, name: "리뷰 추가" })).toBeVisible();

    const tabs = page.getByRole("tablist", { name: "본문 보기" });
    await expect(tabs).toBeVisible();
    const body = page.getByRole("textbox", { name: "본문(Markdown)" });
    await body.fill("## 좋았던 점");

    // [미리 보기] 탭을 누르면 쓰기 칸은 숨고, 저장한 뒤의 모습이 보여요.
    await tabs.getByRole("tab", { name: "미리 보기" }).click();
    const preview = page.getByRole("tabpanel", { name: "미리 보기" });
    await expect(preview.getByRole("heading", { level: 2, name: "좋았던 점" })).toBeVisible();
    await expect(body).toBeHidden();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);

    // ←로 [Markdown 입력] 탭으로 돌아오면 쓰기 칸이 다시 보여요.
    await page.keyboard.press("ArrowLeft");
    await expect(tabs.getByRole("tab", { name: "Markdown 입력" })).toBeFocused();
    await expect(body).toBeVisible();
    await expect(body).toHaveValue("## 좋았던 점");
  });
});
