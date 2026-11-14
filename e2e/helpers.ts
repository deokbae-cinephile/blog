/**
 * @file E2E 테스트 도우미 (e2e/helpers.ts)
 *
 * 여러 E2E 테스트 파일(blog.spec.ts, pwa.spec.ts)이 함께 쓰는 확인 함수를 모아 둬요.
 * 이름이 .spec.ts로 끝나지 않아서 Playwright가 테스트 파일로 실행하지는 않아요.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

import { E2E_ADMIN } from "./admin-account";

/**
 * axe로 접근성 규칙 위반이 없는지 검사해요.
 * withTags: WCAG 2.0·2.1·2.2의 A, AA 수준 규칙만 골라 검사해요.
 * 위반이 있으면 "규칙 이름: 문제 요소" 목록이 실패 메시지에 나와 무엇을 고칠지 알 수 있어요.
 * (axe는 Playwright가 페이지에 직접 넣어 실행해서, 인터넷이 끊긴 화면에서도 검사할 수 있어요.)
 */
export async function expectNoA11yViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
}

/** 문서 너비가 화면 너비보다 넓으면(가로 스크롤이 생기면) 실패해요. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/**
 * 글쓴이로 로그인해요(로그인 API를 바로 불러 세션 쿠키를 받아요. 로그인 화면을 거치지 않아 빨라요).
 * v3 전까지 리뷰 상세는 글쓴이만 볼 수 있어서(lib/site.ts의 REVIEW_DETAIL_PUBLIC), 상세 화면 시험은 먼저 이 함수를 불러요.
 * page.request는 브라우저 탭과 쿠키를 함께 써서, 받은 세션 쿠키가 그대로 탭에도 들어가요.
 *
 * @param page 시험할 브라우저 탭
 * @param baseURL 시험용 블로그 주소(playwright.config.ts의 use.baseURL). 로그인 API는 같은 곳에서 온 요청(Origin)만 받아요.
 */
export async function loginAsAuthor(page: Page, baseURL: string) {
  // 계정은 시험용 서버와 같은 것을 써요(admin-account.ts).
  const response = await page.request.post("/api/session", {
    data: { id: E2E_ADMIN.id, password: E2E_ADMIN.password },
    headers: { Origin: new URL(baseURL).origin },
  });
  expect(response.ok(), `로그인 실패: ${response.status()}`).toBe(true);
}
