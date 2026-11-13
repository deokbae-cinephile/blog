/**
 * @file 글쓴이 기능 E2E 테스트 (e2e/admin.spec.ts)
 *
 * 진짜 브라우저로 글쓴이 기능을 처음부터 끝까지 써 보며 확인해요.
 *   - proxy.ts: 로그인하지 않으면 글쓰기 화면은 로그인 화면으로, 저장 API는 401로 막는지
 *   - 로그인: 틀리면 알리고, 맞으면 원래 가려던 화면으로 돌아가는지
 *   - 리뷰 라이터: 새 리뷰(포스터·장면 사진 포함)를 저장하면 저장소(가짜 GitHub)에 커밋이 올라가는지
 *   - 고치기·지우기, 로그아웃
 *   - 접근성: 로그인·글쓰기 화면 axe 검사
 *
 * 저장소는 가짜 GitHub 서버(e2e/mock-github.mjs)예요. 시작할 때 처음 모습으로 되돌려요.
 * 글쓰기는 저장소를 바꾸는 시험이라, 데스크톱에서 차례대로(serial) 한 번만 돌려요.
 * (블로그 화면은 빌드할 때 만든 그대로라, 저장해도 E2E 중에는 목록이 바뀌지 않아요. 결과는 커밋 기록으로 확인해요.)
 */

import path from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { E2E_ADMIN } from "./admin-account";
import { expectNoA11yViolations } from "./helpers";

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

  test("로그인 전에는 [새 리뷰]·[고치기]·[지우기]가 보이지 않는다", async ({ page }) => {
    await page.goto("/reviews/alpha-station");
    await expect(page.getByRole("link", { name: "고치기" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "지우기" })).toHaveCount(0);
    await expect(page.getByRole("banner").getByRole("link", { name: "새 리뷰" })).toHaveCount(0);
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "글쓴이 로그인" })).toBeVisible();
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
    await expect(page.getByRole("heading", { level: 1, name: "새 리뷰 쓰기" })).toBeVisible();
    // 로그인하면 머리글에 [새 리뷰]가 보여요(지금 화면이라 aria-current="page").
    await expect(page.getByRole("banner").getByRole("link", { name: "새 리뷰" })).toHaveAttribute("aria-current", "page");
    await expectNoA11yViolations(page);
  });

  test("새 리뷰: 포스터와 장면 사진을 넣고 저장하면, 원고·사진이 커밋 하나로 저장소에 올라간다", async ({ page, request }) => {
    await page.goto("/login?next=/write");
    await login(page);
    await expect(page.getByRole("heading", { level: 1, name: "새 리뷰 쓰기" })).toBeVisible();

    // 틀린 칸 먼저: 빈 칸으로 저장하면 고칠 곳 목록이 나오고 초점이 그리로 가요.
    await page.getByRole("button", { name: "리뷰 저장" }).click();
    await expect(page.getByRole("group", { name: /고칠 곳 \d+개/ })).toBeFocused();

    await page.getByLabel(/^주소\(영문\)/).fill("e2e-new-review");
    await page.getByLabel(/^제목/).fill("E2E 새 리뷰");
    await page.getByLabel(/^개봉 연도/).fill("2026");
    await page.getByLabel(/^감독/).fill("시험감독");
    await page.getByRole("checkbox", { name: "음악" }).check();
    await page.getByLabel(/^평점/).selectOption("3.5");
    await page.getByLabel(/^한줄평/).fill("끝까지 저장되는지 보는 한줄평");
    await page.getByLabel("포스터 고르기").setInputFiles(PICTURE);
    await page.getByLabel(/^본문/).fill("첫 문단입니다.");
    await page.getByLabel("장면 사진 넣기").setInputFiles(PICTURE);

    // 사진 줄이 들어가고, 커서는 설명 자리([ ] 안)에 있어요. 설명을 적어요.
    const body = page.getByLabel(/^본문/);
    await expect(body).toHaveValue("첫 문단입니다.\n\n![](/images/e2e-new-review/scene-1.png)\n\n");
    await page.keyboard.type("화면 조정 무늬");
    await expect(body).toHaveValue("첫 문단입니다.\n\n![화면 조정 무늬](/images/e2e-new-review/scene-1.png)\n\n");

    await page.getByRole("button", { name: "리뷰 저장" }).click();
    await expect(page.getByRole("heading", { name: "저장했습니다" })).toBeFocused();

    // 가짜 GitHub에 커밋이 하나 올라갔는지, 무엇이 들어갔는지 확인해요.
    const commits = (await (await request.get(`${GITHUB}/__commits`)).json()) as Commit[];
    const commit = commits.find((item) => item.message === "리뷰 쓰기: E2E 새 리뷰")!;
    expect(commit.added.sort()).toEqual([
      "content/reviews/e2e-new-review.md",
      "public/images/e2e-new-review/scene-1.png",
      "public/posters/e2e-new-review.png",
    ]);
    expect(commit.texts["content/reviews/e2e-new-review.md"]).toContain("genres: [음악]\nrating: 3.5\n");
    expect(commit.texts["content/reviews/e2e-new-review.md"]).toContain("![화면 조정 무늬](/images/e2e-new-review/scene-1.png)");
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

  test("고치기: 상세 화면의 [고치기]로 들어가 저장소 원고를 고치면, 고친 원고가 커밋된다", async ({ page, request }) => {
    await page.goto("/login?next=/reviews/alpha-station");
    await login(page);
    await page.getByRole("link", { name: "고치기" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "리뷰 고치기: alpha-station" })).toBeVisible();
    await expect(page.getByLabel(/^제목/)).toHaveValue("알파 정거장");

    await page.getByLabel(/^한줄평/).fill("고친 한줄평");
    await page.getByRole("button", { name: "고친 내용 저장" }).click();
    await expect(page.getByRole("heading", { name: "저장했습니다" })).toBeVisible();

    const commits = (await (await request.get(`${GITHUB}/__commits`)).json()) as Commit[];
    const commit = commits.find((item) => item.message === "리뷰 고치기: 알파 정거장")!;
    expect(commit.texts["content/reviews/alpha-station.md"]).toContain("oneLiner: 고친 한줄평");
  });

  test("지우기: 확인 창에서 [지우기]를 누르면 원고를 지우는 커밋이 올라가고, 로그아웃하면 다시 막힌다", async ({ page, request }) => {
    await page.goto("/login?next=/reviews/epsilon-night");
    await login(page);
    await page.getByRole("button", { name: "지우기" }).click();
    const dialog = page.getByRole("alertdialog", { name: "리뷰를 지울까요?" });
    await expect(dialog).toBeVisible();
    // 처음 초점은 되돌리기 쉬운 [취소]에 있어요.
    await expect(dialog.getByRole("button", { name: "취소" })).toBeFocused();
    await expectNoA11yViolations(page);

    await dialog.getByRole("button", { name: "지우기" }).click();
    await expect(page.getByRole("status").filter({ hasText: "리뷰를 지웠습니다" })).toBeVisible();
    await expect(page.getByRole("link", { name: "목록으로", exact: true }).last()).toBeFocused();

    const commits = (await (await request.get(`${GITHUB}/__commits`)).json()) as Commit[];
    expect(commits.find((item) => item.message === "리뷰 지우기: 엡실론의 밤")?.deleted).toEqual(["content/reviews/epsilon-night.md"]);

    // 로그아웃하면 단추가 사라지고, 글쓰기 화면은 다시 로그인 화면으로 보내요.
    await page.getByRole("contentinfo").getByRole("button", { name: "로그아웃" }).click();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "글쓴이 로그인" })).toBeVisible();
    await page.goto("/write");
    await expect(page).toHaveURL(/\/login\?next=%2Fwrite$/);
  });
});
