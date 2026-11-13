/**
 * @file E2E 시험용 글쓴이 계정 (e2e/admin-account.ts)
 *
 * E2E 테스트에서만 쓰는 아이디·비밀번호예요. 진짜 비밀 값이 아니에요.
 *   - playwright.config.ts: 이 비밀번호로 해시를 만들어 블로그 서버의 환경 변수(ADMIN_ID, ADMIN_PASSWORD_HASH)로 넘겨요.
 *   - e2e/admin.spec.ts: 이 아이디·비밀번호로 로그인해 글쓰기·고치기·지우기를 시험해요.
 * 이름이 .spec.ts로 끝나지 않아서 Playwright가 테스트 파일로 실행하지는 않아요.
 */
export const E2E_ADMIN = { id: "e2e-admin", password: "e2e-password-1234" } as const;
