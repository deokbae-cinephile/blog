/**
 * @file 설치형 웹 앱(PWA) E2E 테스트 (e2e/pwa.spec.ts)
 *
 * 진짜 브라우저(Chromium)로 확인해요.
 *   1. 설치 정보(매니페스트)와 아이콘이 있고, 앱으로 설치하는 데 필요한 값이 들어 있는지
 *   2. 서비스 워커가 켜진 뒤, 한 번 본 리뷰가 인터넷이 끊겨도 열리는지
 *   3. 처음 보는 화면은 오프라인 안내 화면으로 대신하는지
 *
 * 오프라인 흉내: context.setOffline(true)로 이 브라우저의 인터넷을 끊어요. 끝나면 다시 켜요.
 */

import { expect, test } from "@playwright/test";

import { expectNoA11yViolations, expectNoHorizontalScroll } from "./helpers";

test.describe("설치형 웹 앱(PWA)", () => {
  test("설치 정보(매니페스트)와 아이콘이 있다", async ({ page, request }) => {
    await page.goto("/");
    // Next.js가 모든 페이지 <head>에 매니페스트 링크를 달아 줘요(app/manifest.ts).
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(href).toBe("/manifest.webmanifest");

    // request: 브라우저 탭 없이 파일만 받아 오는 도구예요.
    const manifestUrl = new URL(href!, page.url());
    const manifest = await (await request.get(manifestUrl.href)).json();
    expect(manifest).toMatchObject({ name: "DMB", start_url: "./", scope: "./", display: "standalone" });

    // 매니페스트의 아이콘 주소는 상대 주소라 매니페스트 위치를 기준으로 풀어서 받아 봐요.
    for (const icon of manifest.icons as { src: string }[]) {
      const response = await request.get(new URL(icon.src, manifestUrl).href);
      expect(response.ok()).toBe(true);
      expect(response.headers()["content-type"]).toBe("image/png");
    }

    // 아이폰·아이패드 홈 화면 아이콘(app/apple-icon.png)
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-icon/);
  });

  test("한 번 본 리뷰는 오프라인에서도 열리고, 처음 보는 화면은 오프라인 안내를 보인다", async ({ page, context }) => {
    await page.goto("/reviews/alpha-station");

    // 서비스 워커가 켜질 때까지 기다려요.
    await page.evaluate(() => navigator.serviceWorker.ready);

    // 이 화면(페이지와 CSS)이 저장소에 들어갈 때까지 기다려요.
    // expect.poll: 함수를 여러 번 다시 불러, 기대한 값이 나올 때까지(최대 15초) 기다려요.
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            // 저장소 열쇠는 ?·#와 끝의 /를 뗀 주소예요(public/sw.js의 cacheKey).
            const pageCached = Boolean(await caches.match(`${location.origin}/reviews/alpha-station`));
            // 이 블로그의 CSS만 봐요(다른 사이트의 파일은 서비스 워커가 저장하지 않아요).
            const cssUrls = performance
              .getEntriesByType("resource")
              .map((entry) => entry.name)
              .filter((name) => name.startsWith(location.origin) && name.endsWith(".css"));
            const cssCached = await Promise.all(cssUrls.map((url) => caches.match(url)));
            return pageCached && cssUrls.length > 0 && cssCached.every(Boolean);
          }),
        { timeout: 15_000 },
      )
      .toBe(true);

    // 인터넷을 끊고 새로 고침해도 리뷰가 열려요.
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "알파 정거장" })).toBeVisible();
    // CSS도 저장본에서 와서 화면 모양이 그대로예요(화면 바탕색 #020802).
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(2, 8, 2)");

    // 처음 보는 리뷰는 저장본이 없으니 오프라인 안내 화면이 대신 보여요.
    // (알파 정거장 화면에 링크가 보이는 리뷰는 Next.js가 미리 받아 두면서 저장될 수 있어요. 그래서 링크가 없는 엡실론의 밤으로 확인해요.)
    await page.goto("/reviews/epsilon-night");
    await expect(page.getByRole("heading", { level: 1, name: "인터넷에 연결되어 있지 않습니다" })).toBeVisible();
    // 오프라인 안내 화면도 접근성 규칙을 지키고, 좁은 화면에서 넘치지 않아야 해요.
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);

    await context.setOffline(false);
  });

  test("목록에서 링크로 들어간 리뷰도 오프라인에서 다시 열린다", async ({ page, context }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);

    // 링크로 옮기면 Next.js는 HTML 대신 화면 데이터(RSC)만 받아요. 그래도 그 화면 HTML이 저장되는지 확인해요.
    await page.getByRole("link", { name: "베타 로맨스" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "베타 로맨스" })).toBeVisible();
    await expect
      .poll(() => page.evaluate(async () => Boolean(await caches.match(`${location.origin}/reviews/beta-romance`))), {
        timeout: 15_000,
      })
      .toBe(true);

    await context.setOffline(true);
    await page.goto("/reviews/beta-romance");
    await expect(page.getByRole("heading", { level: 1, name: "베타 로맨스" })).toBeVisible();
    await context.setOffline(false);
  });

  test("글쓴이 화면(로그인·글쓰기)과 API, 화면 데이터(RSC) 요청은 저장해 두지 않는다", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.goto("/");
    await page.getByRole("link", { name: "베타 로맨스" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "베타 로맨스" })).toBeVisible();

    // 저장소의 모든 열쇠를 모아, 로그인 화면·API·_rsc가 없는지 확인해요.
    const keys = await page.evaluate(async () => {
      const names = await caches.keys();
      const all = await Promise.all(names.map(async (name) => (await (await caches.open(name)).keys()).map((request) => request.url)));
      return all.flat();
    });
    expect(keys.some((url) => /\/login|\/write|\/api\/|_rsc=/.test(url))).toBe(false);
  });
});
