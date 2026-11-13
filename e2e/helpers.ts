/**
 * @file E2E 테스트 도우미 (e2e/helpers.ts)
 *
 * 여러 E2E 테스트 파일(blog.spec.ts, pwa.spec.ts)이 함께 쓰는 확인 함수를 모아 둬요.
 * 이름이 .spec.ts로 끝나지 않아서 Playwright가 테스트 파일로 실행하지는 않아요.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

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
