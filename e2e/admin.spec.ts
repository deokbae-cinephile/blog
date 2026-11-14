/**
 * @file 글쓴이 기능 E2E 테스트 (e2e/admin.spec.ts)
 *
 * 진짜 브라우저로 글쓴이 기능을 처음부터 끝까지 써 보며 확인해요.
 *   - proxy.ts: 로그인하지 않으면 글쓰기 화면은 로그인 화면으로, 저장 API는 401로 막는지
 *   - 로그인: 틀리면 알리고, 맞으면 원래 가려던 화면으로 돌아가는지
 *   - 리뷰 라이터: 리뷰 추가(포스터·장면 사진 포함)를 저장하면 저장소(가짜 GitHub)에 커밋이 올라가는지,
 *     본문 미리 보기가 넓은 화면은 나란히, 좁은 화면은 탭으로 보이는지
 *   - 수정·삭제(v3 전까지는 상세를 글쓴이에게도 열지 않아, 목록 한 편 아래의 [수정]·[삭제]로 해요), 로그아웃
 *   - 접근성: 로그인·글쓰기 화면 axe 검사
 *
 * 저장소는 가짜 GitHub 서버(e2e/mock-github.mjs)예요. 시작할 때 처음 모습으로 되돌려요.
 * 글쓰기는 저장소를 바꾸는 시험이라, 데스크톱에서 차례대로(serial) 한 번만 돌려요.
 * (블로그 화면은 빌드할 때 만든 그대로라, 저장해도 E2E 중에는 목록이 바뀌지 않아요. 결과는 커밋 기록으로 확인해요.)
 */

import path from "node:path";

import { expect, type Page, test } from "@playwright/test";

// 리뷰 상세를 여는지(v3 전까지 false). 열면 [수정]·[삭제]가 목록이 아니라 상세 맨 윗줄에 있어요.
import { REVIEW_DETAIL_PUBLIC } from "../src/lib/site";
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

  test("로그인 전에는 목록에 [+](리뷰 추가)·[수정]·[삭제]가 보이지 않는다", async ({ page }) => {
    // (상세 주소로 오면 목록으로 옮기는지는 blog.spec.ts의 "리뷰 상세(v3 전)"에서 확인해요.)
    await page.goto("/");
    await expect(page.getByRole("region", { name: "영화 목록" })).toBeVisible();
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

  test.beforeAll(async ({ request }, testInfo) => {
    // 위의 건너뛰기 조건(isMobile)은 시험마다 보는 값이라, 휴대폰 프로젝트에서도 이 준비는 먼저 돌 수 있어요.
    // 그러면 데스크톱에서 저장하던 중에 저장소가 처음 모습으로 돌아가 커밋이 거절돼요(422). 그래서 데스크톱에서만 되돌려요.
    if (testInfo.project.name !== "desktop") return;
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

    // 꼭 적어야 하는 칸은 이름 앞에 "[필수]"를 보여요(화면 낭독기는 "필수 주소"로 읽어요). 따로 뜻을 풀이하는 글은 없어요.
    // 칸 이름에는 "(영문)" 같은 덧붙임이 없고, 제목 칸은 "한글 제목"·"영문 제목"이에요.
    await expect(page.locator("form")).not.toContainText("표시는 꼭 적어야 하는 칸입니다");
    await expect(page.locator("form")).not.toContainText("(영문)");
    const slug = page.getByRole("textbox", { name: "필수 주소", exact: true });
    await expect(slug).toHaveAttribute("required", "");
    await expect(page.locator(`label[for="${await slug.getAttribute("id")}"]`)).toHaveText("[필수] 주소");
    await expect(page.getByRole("textbox", { name: "필수 한글 제목", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "영문 제목", exact: true })).not.toHaveAttribute("required", "");
    await page.getByLabel(/주소$/).fill("e2e-new-review");
    await page.getByLabel(/한글 제목$/).fill("E2E 새 리뷰");
    await page.getByLabel(/개봉 연도$/).fill("2026");
    await page.getByLabel(/감독$/).fill("시험감독");
    // 출연: 배우 이름을 쉼표로 나눠 적어요. 빈칸이 들쭉날쭉해도 원고에는 "A, B"로 가지런히 들어가요.
    await page.getByRole("textbox", { name: "출연", exact: true }).fill("시험배우1,시험배우2 ");
    await page.getByRole("checkbox", { name: "로맨스" }).check();
    // 평점은 처음에 5.0이 골라져 있어요("고르세요"가 없어요).
    await expect(page.getByLabel(/평점$/)).toHaveValue("5.0");
    await page.getByLabel(/평점$/).selectOption("3.5");
    await page.getByLabel(/한 줄 평$/).fill("끝까지 저장되는지 보는 한 줄 평");
    // 포스터를 고르기 전에는 상세 화면과 같은 기본 포스터(빈 필름 그림 + NO POSTER)가 보여요.
    const posterFrame = page.getByRole("group", { name: "포스터" }).locator(".poster-frame");
    await expect(posterFrame).toContainText("NO POSTER");
    await expect(posterFrame.locator("svg")).toBeVisible();
    await page.getByLabel("포스터 고르기").setInputFiles(PICTURE);
    // 고르면 기본 포스터 대신 고른 사진이 보여요.
    await expect(posterFrame.locator("img")).toBeVisible();
    await expect(posterFrame).not.toContainText("NO POSTER");
    // [포스터 고르기]·[포스터 빼기]는 포스터와 같은 너비예요.
    const frame = (await page.getByRole("group", { name: "포스터" }).locator(".poster-frame").boundingBox())!;
    for (const button of [page.getByText("포스터 고르기", { exact: true }), page.getByRole("button", { name: "포스터 빼기" })]) {
      expect(Math.round((await button.boundingBox())!.width)).toBe(Math.round(frame.width));
    }
    // 평점 칸: ▼와 칸 오른쪽 끝 사이가, 글자와 칸 왼쪽 끝 사이(테두리 + 안쪽 여백)와 같아요(좌우 같은 간격).
    const inset = await page.getByLabel(/평점$/).evaluate((select) => {
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
    expect(commit.texts["content/reviews/e2e-new-review.md"]).toContain("director: 시험감독\ncast: 시험배우1, 시험배우2\n");
    expect(commit.texts["content/reviews/e2e-new-review.md"]).toContain("genres: [로맨스]\nrating: 3.5\n");
    expect(commit.texts["content/reviews/e2e-new-review.md"]).toContain("![화면 조정 무늬](/images/e2e-new-review/scene-1.png)");
  });

  test("임시 저장: 쓰다 만 글을 사진과 함께 이 브라우저에 저장하고, 새로 고친 뒤 불러와 이어 쓰고, 저장하면 임시 저장본이 지워진다", async ({ page, request }) => {
    await page.goto("/login?next=/write");
    await login(page);
    const body = page.getByRole("textbox", { name: "본문(Markdown)" });

    // 쓰다 만 글: 주소·제목·포스터·장면 사진만 넣고 [임시 저장](검사하지 않아요).
    await page.getByLabel(/주소$/).fill("e2e-draft");
    await page.getByLabel(/한글 제목$/).fill("임시 저장 시험");
    await page.getByLabel("포스터 고르기").setInputFiles(PICTURE);
    await expect(page.getByText(/포스터로 test-pattern\.png을\(를\) 골랐습니다/)).toBeVisible();
    await body.fill("쓰던 문단");
    await page.getByLabel("장면 사진 넣기").setInputFiles(PICTURE);
    await expect(body).toHaveValue("쓰던 문단\n\n![](/images/e2e-draft/scene-1.png)\n\n");
    await page.getByRole("button", { name: "임시 저장" }).click();
    // 저장하는 동안 단추 아래의 안내 영역(role="status")에 로딩 UI가 보이고(적어도 0.4초), 끝나면 같은 영역이 결과 글자로 바뀌어요.
    const saveStatus = page.getByRole("status").filter({ hasText: /임시 저장하는 중|에 임시 저장했습니다/ });
    await expect(saveStatus).toHaveText(/임시 저장하는 중/);
    await expect(saveStatus).toHaveText(/에 임시 저장했습니다\. 이 브라우저에 저장했고/);
    await expect(page.getByRole("group", { name: /고칠 곳/ })).toHaveCount(0);

    // 새로 고쳐도(임시 저장한 뒤라 떠날지 묻지 않아요) 목록에 남아 있어요. 불러오면 칸과 사진이 그대로예요.
    await page.reload();
    const drafts = page.getByRole("region", { name: "임시 저장한 글 (1)" });
    await expect(drafts).toContainText("임시 저장 시험");
    await expectNoA11yViolations(page);
    await drafts.getByRole("button", { name: "불러오기" }).click();
    await expect(page.getByLabel(/한글 제목$/)).toHaveValue("임시 저장 시험");
    await expect(page.getByLabel(/주소$/)).toHaveValue("e2e-draft");
    await expect(body).toHaveValue("쓰던 문단\n\n![](/images/e2e-draft/scene-1.png)\n\n");
    await expect(page.getByRole("group", { name: "포스터" }).locator("img")).toHaveAttribute("src", /^blob:/);
    await expect(page.getByRole("region", { name: "미리 보기" }).locator("img")).toHaveAttribute("src", /^blob:/);

    // 이어 써서 리뷰로 저장해요. 포스터·장면 사진도 함께 올라가요.
    await page.getByLabel(/개봉 연도$/).fill("2026");
    await page.getByLabel(/감독$/).fill("시험감독");
    await page.getByRole("checkbox", { name: "드라마" }).check();
    await page.getByLabel(/한 줄 평$/).fill("임시 저장에서 이어 쓴 한 줄 평");
    await body.fill("쓰던 문단\n\n![화면 조정 무늬](/images/e2e-draft/scene-1.png)\n");
    // 저장소(가짜 GitHub)의 답을 늦춰, 저장하는 동안 단추 아래에 로딩 UI가 보이는지 확인해요.
    await request.post(`${GITHUB}/__delay?ms=700`);
    try {
      await page.getByRole("button", { name: "리뷰 저장" }).click();
      await expect(page.getByRole("status").filter({ hasText: /사진을 올리는 중\(\d\/2\)|리뷰를 저장하는 중/ })).toBeVisible();
      await expect(page.getByRole("heading", { name: "저장했습니다" })).toBeFocused({ timeout: 15_000 });
    } finally {
      await request.post(`${GITHUB}/__delay?ms=0`);
    }
    const commits = (await (await request.get(`${GITHUB}/__commits`)).json()) as Commit[];
    const commit = commits.find((item) => item.message === "리뷰 추가: 임시 저장 시험")!;
    expect(commit.added.sort()).toEqual(["content/reviews/e2e-draft.md", "public/images/e2e-draft/scene-1.png", "public/posters/e2e-draft.png"]);

    // 다 쓴 글이라 임시 저장본은 지워졌어요.
    await page.goto("/write");
    await expect(page.getByLabel(/한글 제목$/)).toBeVisible();
    await expect(page.getByRole("region", { name: /임시 저장한 글/ })).toHaveCount(0);
  });

  test("큰 사진은 줄여서 올린다(포스터는 JPG, 장면 사진은 WebP, 긴 변 1600px)", async ({ page, request }) => {
    await page.goto("/login?next=/write");
    await login(page);
    // 2400 × 1800 PNG를 브라우저에서 그려 만들어요(긴 변이 1600px보다 커서 줄여야 해요).
    const bigPng = Buffer.from(
      await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 2400;
        canvas.height = 1800;
        const context = canvas.getContext("2d")!;
        const gradient = context.createLinearGradient(0, 0, 2400, 1800);
        gradient.addColorStop(0, "#39ff14");
        gradient.addColorStop(1, "#020802");
        context.fillStyle = gradient;
        context.fillRect(0, 0, 2400, 1800);
        return canvas.toDataURL("image/png").split(",")[1]!;
      }),
      "base64",
    );
    const big = (name: string) => ({ name, mimeType: "image/png", buffer: bigPng });

    await page.getByLabel(/주소$/).fill("e2e-big-photo");
    await page.getByLabel("포스터 고르기").setInputFiles(big("big-poster.png"));
    await expect(page.getByText(/포스터로 big-poster\.png을\(를\) 골랐습니다\. 큰 사진이라 .+에서 .+로 줄였습니다\./)).toBeVisible();
    // 미리보기 그림의 실제 크기가 긴 변 1600px이에요.
    const posterImage = page.getByRole("group", { name: "포스터" }).locator("img");
    await expect.poll(() => posterImage.evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight])).toEqual([1600, 1200]);

    const body = page.getByRole("textbox", { name: "본문(Markdown)" });
    await page.getByLabel("장면 사진 넣기").setInputFiles(big("big-scene.png"));
    await expect(body).toHaveValue("![](/images/e2e-big-photo/scene-1.webp)\n\n");

    // 나머지 칸을 채워 저장하면, 줄인 파일(.jpg, .webp)이 올라가요(사진 올리기 API가 파일 앞부분으로 형식도 확인해요).
    await page.getByLabel(/한글 제목$/).fill("큰 사진 시험");
    await page.getByLabel(/개봉 연도$/).fill("2026");
    await page.getByLabel(/감독$/).fill("시험감독");
    await page.getByRole("checkbox", { name: "액션" }).check();
    await page.getByLabel(/한 줄 평$/).fill("줄여서 올라가는지 보는 한 줄 평");
    await body.fill("![초록 그러데이션](/images/e2e-big-photo/scene-1.webp)\n");
    await page.getByRole("button", { name: "리뷰 저장" }).click();
    await expect(page.getByRole("heading", { name: "저장했습니다" })).toBeFocused();
    const commits = (await (await request.get(`${GITHUB}/__commits`)).json()) as Commit[];
    const commit = commits.find((item) => item.message === "리뷰 추가: 큰 사진 시험")!;
    expect(commit.added.sort()).toEqual([
      "content/reviews/e2e-big-photo.md",
      "public/images/e2e-big-photo/scene-1.webp",
      "public/posters/e2e-big-photo.jpg",
    ]);
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

  test("Markdown 파일 불러오기 단추는 없다(2.0.0에서 없앴다)", async ({ page }) => {
    await page.goto("/login?next=/write");
    await login(page);
    await expect(page.getByLabel(/한글 제목$/)).toBeVisible();
    await expect(page.getByText("Markdown 파일 불러오기")).toHaveCount(0);
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

  test("수정: [수정](v3 전에는 목록 한 편 아래)으로 들어가 저장소 원고를 고치면, 고친 원고가 커밋된다", async ({ page, request }) => {
    // v3 전까지는 상세를 글쓴이에게도 열지 않아, [수정]이 목록 한 편 아래에 있어요(상세를 열면 상세 맨 윗줄).
    await page.goto(REVIEW_DETAIL_PUBLIC ? "/login?next=/reviews/alpha-station" : "/login?next=/");
    await login(page);
    const where = REVIEW_DETAIL_PUBLIC ? page.getByRole("main") : page.getByRole("article", { name: "알파 정거장" });
    await where.getByRole("link", { name: "수정" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "리뷰 수정: alpha-station" })).toBeVisible();
    await expect(page.getByLabel(/한글 제목$/)).toHaveValue("알파 정거장");
    // 출연 칸에 원고의 배우들이 들어 있어요.
    await expect(page.getByRole("textbox", { name: "출연", exact: true })).toHaveValue("이배우, 박배우");
    // 주소는 바꿀 수 없어요. "(수정할 때는 바꿀 수 없습니다.)"는 주소 다음 줄에 보여요.
    const slugLabel = (await page.getByText("주소:", { exact: true }).boundingBox())!;
    const slugNote = (await page.getByText("(수정할 때는 바꿀 수 없습니다.)", { exact: true }).boundingBox())!;
    expect(slugNote.y).toBeGreaterThanOrEqual(slugLabel.y + slugLabel.height - 1);
    expect(Math.round(slugNote.x)).toBe(Math.round(slugLabel.x));

    await page.getByLabel(/한 줄 평$/).fill("고친 한 줄 평");
    await page.getByRole("button", { name: "수정한 내용 저장" }).click();
    await expect(page.getByRole("heading", { name: "저장했습니다" })).toBeVisible();

    const commits = (await (await request.get(`${GITHUB}/__commits`)).json()) as Commit[];
    const commit = commits.find((item) => item.message === "리뷰 수정: 알파 정거장")!;
    expect(commit.texts["content/reviews/alpha-station.md"]).toContain("oneLiner: 고친 한 줄 평");
  });

  test("삭제(v3 전, 목록): 확인 창에서 [삭제]를 누르면 로딩 UI를 보이고 원고를 지우는 커밋이 올라가며, 안내로 초점이 가고, 로그아웃하면 다시 막힌다", async ({ page, request }) => {
    test.skip(REVIEW_DETAIL_PUBLIC, "상세를 열면(v3) 상세 맨 윗줄에서 지워요(다음 시험)");
    await page.goto("/login?next=/");
    await login(page);
    const item = page.getByRole("article", { name: "엡실론의 밤" });
    const edit = item.getByRole("link", { name: "수정" });
    const remove = item.getByRole("button", { name: "삭제" });

    // 한 줄 평 아래(12px)에 [수정] [삭제]가 같은 높이(44px)로 한 줄에 있고, 사이는 8px예요.
    await expect(page.locator(".boot-overlay")).toBeHidden();
    await expect(remove).toBeVisible();
    const [editBox, removeBox] = (await Promise.all([edit, remove].map(async (control) => (await control.boundingBox())!))) as [DOMRect, DOMRect];
    for (const box of [editBox, removeBox]) expect(Math.round(box.height)).toBe(44);
    expect(Math.abs(editBox.y - removeBox.y)).toBeLessThan(1);
    expect(Math.round(removeBox.x - (editBox.x + editBox.width))).toBe(8);
    const oneLiner = (await item.locator("p", { hasText: "한 줄 평:" }).boundingBox())!;
    expect(Math.round(editBox.y - (oneLiner.y + oneLiner.height))).toBe(12);

    await remove.click();
    const dialog = page.getByRole("alertdialog", { name: "리뷰를 삭제할까요?" });
    await expect(dialog).toBeVisible();
    // 처음 초점은 되돌리기 쉬운 [취소]에 있어요.
    await expect(dialog.getByRole("button", { name: "취소" })).toBeFocused();
    await expectNoA11yViolations(page);

    // 느린 GitHub 흉내(0.8초): 삭제하는 동안 창 안에 로딩 UI가 보이고, 두 단추는 막혀요.
    await request.post(`${GITHUB}/__delay?ms=800`);
    try {
      const confirm = dialog.getByRole("button", { name: "삭제" });
      await confirm.click();
      await expect(dialog.getByRole("status")).toHaveText(/리뷰를 삭제하는 중/);
      await expect(dialog.getByRole("button", { name: "취소" })).toHaveAttribute("aria-disabled", "true");
      await expect(confirm).toHaveAttribute("aria-disabled", "true");
      // 막아도 초점은 누른 [삭제]에 그대로 있고, Esc로도 닫히지 않아요. 끝날 때까지 결과를 기다려요.
      await expect(confirm).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();

      // 다 지우면 창이 닫히고, 그 리뷰 아래에 안내가 보이며, 초점은 안내로 가요(누른 [삭제]가 사라져서요).
      const notice = item.getByRole("status").filter({ hasText: "리뷰를 삭제했습니다" });
      await expect(notice).toBeVisible({ timeout: 15_000 });
      await expect(dialog).toBeHidden();
      await expect(notice).toBeFocused();
      await expect(notice).toHaveText("‘엡실론의 밤’ 리뷰를 삭제했습니다. 블로그를 다시 배포하면(몇 분 뒤) 목록에서도 사라집니다.");
    } finally {
      await request.post(`${GITHUB}/__delay?ms=0`);
    }
    // 지운 리뷰의 [수정]·[삭제]는 치워요(다른 리뷰의 단추는 그대로예요).
    await expect(edit).toHaveCount(0);
    await expect(remove).toHaveCount(0);
    await expect(page.getByRole("article", { name: "알파 정거장" }).getByRole("link", { name: "수정" })).toBeVisible();
    await expectNoA11yViolations(page);

    const commits = (await (await request.get(`${GITHUB}/__commits`)).json()) as Commit[];
    expect(commits.find((commit) => commit.message === "리뷰 삭제: 엡실론의 밤")?.deleted).toEqual(["content/reviews/epsilon-night.md"]);

    // 로그아웃하면 목록의 [수정]·[삭제]가 모두 사라지고, 글쓰기 화면은 다시 로그인 화면으로 보내요.
    await page.getByRole("contentinfo").getByRole("button", { name: "로그아웃" }).click();
    await expect(page.getByRole("contentinfo").getByRole("button", { name: "로그아웃" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "수정" })).toHaveCount(0);
    await page.goto("/write");
    await expect(page).toHaveURL(/\/login\?next=%2Fwrite$/);
  });

  test("삭제(상세): 확인 창에서 [삭제]를 누르면 로딩 UI를 보이고 원고를 지우는 커밋이 올라가며, 로그아웃하면 다시 막힌다", async ({ page, request }) => {
    test.skip(!REVIEW_DETAIL_PUBLIC, "v3 전까지 리뷰 상세는 아무도(글쓴이도) 열 수 없어요(앞 시험이 목록에서 지워요)");
    await page.goto("/login?next=/reviews/epsilon-night");
    await login(page);
    const back = page.getByRole("link", { name: "목록으로", exact: true });
    const share = page.getByRole("button", { name: "공유하기" });
    const edit = page.getByRole("link", { name: "수정" });
    const remove = page.getByRole("button", { name: "삭제" });

    // 맨 윗줄: [◀ 목록으로] … [공유하기] [수정] [삭제]가 모두 같은 높이(44px)로, 세로 가운데가 정확히 같아요.
    // (예전에는 [수정]·[삭제] 묶음 아래의 빈 안내 칸 때문에 [공유하기]만 2px 내려가 있었어요.)
    await expect(page.locator(".boot-overlay")).toBeHidden();
    const boxes = await Promise.all([back, share, edit, remove].map(async (control) => (await control.boundingBox())!));
    const center = boxes[0]!.y + boxes[0]!.height / 2;
    for (const box of boxes) {
      expect(Math.round(box.height)).toBe(44);
      expect(Math.abs(box.y + box.height / 2 - center)).toBeLessThan(1);
    }
    // [공유하기] [수정] [삭제] 사이는 모두 8px로 같아요.
    const [, shareBox, editBox, removeBox] = boxes as [DOMRect, DOMRect, DOMRect, DOMRect];
    expect(Math.round(editBox.x - (shareBox.x + shareBox.width))).toBe(8);
    expect(Math.round(removeBox.x - (editBox.x + editBox.width))).toBe(8);
    // 좁은 휴대폰(360px)에서는 [공유하기] [수정] [삭제]가 다음 줄로 내려가고, [◀ 목록으로]와 왼쪽 끝이 맞아요(안쪽으로 밀리지 않아요).
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: 360, height: 740 });
    const [narrowBack, narrowShare, narrowEdit, narrowRemove] = await Promise.all(
      [back, share, edit, remove].map(async (control) => (await control.boundingBox())!),
    );
    expect(narrowShare!.y).toBeGreaterThanOrEqual(narrowBack!.y + narrowBack!.height);
    expect(Math.round(narrowShare!.x)).toBe(Math.round(narrowBack!.x));
    for (const box of [narrowEdit!, narrowRemove!]) expect(Math.abs(box.y - narrowShare!.y)).toBeLessThan(1);
    await page.setViewportSize(viewport);

    await remove.click();
    const dialog = page.getByRole("alertdialog", { name: "리뷰를 삭제할까요?" });
    await expect(dialog).toBeVisible();
    // 처음 초점은 되돌리기 쉬운 [취소]에 있어요.
    await expect(dialog.getByRole("button", { name: "취소" })).toBeFocused();
    await expectNoA11yViolations(page);

    // 느린 GitHub 흉내(0.8초): 삭제하는 동안 창 안에 로딩 UI가 보이고, 두 단추는 막혀요.
    await request.post(`${GITHUB}/__delay?ms=800`);
    try {
      const confirm = dialog.getByRole("button", { name: "삭제" });
      await confirm.click();
      await expect(dialog.getByRole("status")).toHaveText(/리뷰를 삭제하는 중/);
      await expect(dialog.getByRole("button", { name: "취소" })).toHaveAttribute("aria-disabled", "true");
      await expect(confirm).toHaveAttribute("aria-disabled", "true");
      // 막아도 초점은 누른 [삭제]에 그대로 있어요(문서 전체로 빠지지 않아요).
      await expect(confirm).toBeFocused();
      // Esc로도 닫히지 않고, 상세 화면의 "Esc = 목록으로"도 쉬어요(창이 떠 있는 동안). 끝날 때까지 결과를 기다려요.
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();
      await expect(page).toHaveURL(/\/reviews\/epsilon-night$/);

      // 다 지우면 창이 닫히고, 맨 윗줄 아래에 화면 너비로 안내가 보이며, 초점은 [목록으로]에 있어요.
      const notice = page.getByRole("status").filter({ hasText: "리뷰를 삭제했습니다" });
      await expect(notice).toBeVisible({ timeout: 15_000 });
      await expect(dialog).toBeHidden();
      await expect(back).toBeFocused();
    } finally {
      await request.post(`${GITHUB}/__delay?ms=0`);
    }
    // 오른쪽 단추([공유하기]·[수정]·[삭제])는 치워요. 안내는 윗줄 아래, 윗줄과 같은 너비예요(좁은 칸에 끼어 깨지지 않아요).
    await expect(share).toHaveCount(0);
    await expect(edit).toHaveCount(0);
    await expect(remove).toHaveCount(0);
    const notice = (await page.getByRole("status").filter({ hasText: "리뷰를 삭제했습니다" }).boundingBox())!;
    const row = (await back.locator("..").boundingBox())!;
    expect(notice.y).toBeGreaterThanOrEqual(row.y + row.height);
    expect(Math.round(notice.x)).toBe(Math.round(row.x));
    expect(Math.round(notice.width)).toBe(Math.round(row.width));
    await expectNoA11yViolations(page);

    const commits = (await (await request.get(`${GITHUB}/__commits`)).json()) as Commit[];
    expect(commits.find((item) => item.message === "리뷰 삭제: 엡실론의 밤")?.deleted).toEqual(["content/reviews/epsilon-night.md"]);

    // 로그아웃하면 단추가 사라지고, 글쓰기 화면은 다시 로그인 화면으로 보내요.
    await page.getByRole("contentinfo").getByRole("button", { name: "로그아웃" }).click();
    await expect(page.getByRole("contentinfo").getByRole("button", { name: "로그아웃" })).toHaveCount(0);
    await page.goto("/write");
    await expect(page).toHaveURL(/\/login\?next=%2Fwrite$/);
  });
});

test.describe("로그아웃 단추(왼쪽 아래에 고정)", () => {
  test("로그인 전에는 없고, 로그인하면 왼쪽 아래 키보드 조작 오른쪽(휴대폰은 왼쪽 끝)에 떠 있으며, 방문자 수 기능은 없다", async ({ page, request, isMobile }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "로그아웃" })).toHaveCount(0);
    // 방문자 수는 2.0.0 핫픽스에서 세는 코드·숫자 API·저장소까지 모두 지웠어요.
    expect((await request.get("/api/visits")).status()).toBe(404);
    await expect(page.getByText(/^방문자 .+명$/)).toHaveCount(0);

    // 로그인하면 [로그아웃]이 방문자 수가 있던 자리(왼쪽 아래)에 떠 있어요.
    await page.goto("/login?next=/");
    await login(page);
    await expect(page).toHaveURL(/\/$/);
    const logout = page.getByRole("contentinfo").getByRole("button", { name: "로그아웃" });
    await expect(logout).toBeVisible();
    const box = (await logout.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(Math.round(viewport.height - (box.y + box.height))).toBe(16);
    if (isMobile) {
      // 휴대폰에는 키보드 조작 단추가 없어서 왼쪽 끝(16px)에 있어요.
      expect(Math.round(box.x)).toBe(16);
    } else {
      // 넓은 화면: 키보드 조작 단추 바로 오른쪽(8px)에, 바닥을 맞춰 있고 높이도 같아요(떠 있는 단추 모양).
      const keys = (await page.getByRole("button", { name: "키보드 조작" }).boundingBox())!;
      expect(Math.round(box.x)).toBe(Math.round(keys.x + keys.width + 8));
      expect(Math.round(box.y + box.height)).toBe(Math.round(keys.y + keys.height));
      expect(Math.round(box.height)).toBe(Math.round(keys.height));
      // 키보드 안내를 펼쳐도 [로그아웃]은 그 자리에 있어요(안내 창은 단추 위에 떠요).
      await page.getByRole("button", { name: "키보드 조작" }).click();
      expect(Math.round((await logout.boundingBox())!.x)).toBe(Math.round(box.x));
      await page.keyboard.press("Escape");
    }
    // 내려 읽어도 같은 자리에 붙어 있어요(position: fixed).
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    expect(Math.round(viewport.height - ((await logout.boundingBox())!.y + box.height))).toBe(16);
    await expectNoA11yViolations(page);

    // 로그아웃에 실패하면(연결이 끊김) 단추 위에 안내 상자가 뜨고, 화면 오른쪽 밖으로 넘치지 않아요(640px 너비 포함).
    await page.route("**/api/session", (route) => (route.request().method() === "DELETE" ? route.abort() : route.continue()));
    for (const width of isMobile ? [viewport.width] : [640, viewport.width]) {
      await page.setViewportSize({ width, height: viewport.height });
      await logout.click();
      const alert = page.getByRole("alert").filter({ hasText: "서버에 연결하지 못했습니다" });
      await expect(alert).toBeVisible();
      const alertBox = (await alert.boundingBox())!;
      expect(alertBox.x).toBeGreaterThanOrEqual(0);
      expect(alertBox.x + alertBox.width).toBeLessThanOrEqual(width);
      // 안내 상자는 단추 위에 떠요(단추를 가리지 않아요).
      expect(alertBox.y + alertBox.height).toBeLessThanOrEqual((await logout.boundingBox())!.y);
    }
    await page.setViewportSize(viewport);
    await page.unroute("**/api/session");

    // 다시 누르면 로그아웃되고 단추가 사라져요.
    await logout.click();
    await expect(page.getByRole("button", { name: "로그아웃" })).toHaveCount(0);
  });
});

test.describe("조회수(모두 지움)", () => {
  test("목록에 조회수가 없고, 조회수 API도 더는 없다(404)", async ({ page, request }) => {
    // (상세는 v3 전까지 아무도 열 수 없어요. 상세에 조회수가 없는지는 단위 시험(review-article.test.tsx)에서 봐요.)
    await page.goto("/");
    await expect(page.getByRole("article", { name: "세타 궁정" })).toContainText("시험감독3");
    await expect(page.locator("main")).not.toContainText("조회");
    // 2.0.0 핫픽스에서 서버의 조회수 API와 저장소까지 지웠어요.
    expect((await request.get("/api/views")).status()).toBe(404);
    expect((await request.post("/api/views/theta-court")).status()).toBe(404);
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
