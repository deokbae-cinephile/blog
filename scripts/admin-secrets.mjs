/**
 * @file 글쓴이 로그인 비밀 값 만들기 (scripts/admin-secrets.mjs)
 *
 * 이 파일이 하는 일
 *   글쓴이 비밀번호를 두 번 입력받아(화면에 보이지 않게), 서버 환경 변수에 넣을 두 값을 만들어 보여 줘요.
 *     ADMIN_PASSWORD_HASH : 비밀번호의 해시(되돌릴 수 없는 글자). 비밀번호 자체는 어디에도 저장하지 않아요.
 *     SESSION_SECRET      : 로그인 표에 서명할 무작위 비밀 열쇠(48바이트)
 *   두 값을 .env.local이나 호스팅의 환경 변수 설정에 넣으면 돼요(.env.example 참고).
 *   비밀번호를 바꾸고 싶으면 다시 실행해 새 해시로 바꿔 넣어요. SESSION_SECRET을 바꾸면 모든 로그인이 풀려요.
 *
 * 실행: pnpm admin-secrets
 *
 * 해시는 블로그 서버와 똑같은 방법(src/lib/password-hash.ts)으로 만들어요.
 * Node.js 24는 TypeScript 파일을 바로 불러올 수 있어서(타입 지우기) .ts 파일을 그대로 가져와요(scripts/make-icons.mjs와 같아요).
 */

import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";

import { hashPassword } from "../src/lib/password-hash.ts";

/**
 * 입력 창구(readline)를 하나 만들어 두 물음에 함께 써요.
 * - 친 글자를 화면에 다시 찍어 주는 동작(_writeToOutput)을 막아, 비밀번호가 화면에 보이지 않게 해요.
 * - 줄을 "차례로 꺼내 쓰는" 방식(async iterator)이라, 입력을 파이프로 한꺼번에 넘겨도 두 줄을 순서대로 읽어요.
 */
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY === true });
rl._writeToOutput = () => {};
const lines = rl[Symbol.asyncIterator]();

/**
 * 물음을 보이고, 화면에 글자를 보이지 않고 한 줄을 입력받아요.
 * @param question 물음 글자
 */
async function askHidden(question) {
  process.stdout.write(question);
  const { value } = await lines.next();
  process.stdout.write("\n");
  return value ?? "";
}

const password = await askHidden("새 비밀번호: ");
const again = await askHidden("한 번 더: ");
rl.close();

if (password.length < 12) {
  console.error("비밀번호는 12글자 이상으로 정해 주세요. 길수록 알아맞히기 어려워요.");
  process.exit(1);
}
if (password !== again) {
  console.error("두 번 입력한 비밀번호가 다릅니다. 다시 실행해 주세요.");
  process.exit(1);
}

console.log("\n아래 두 줄을 .env.local(또는 호스팅의 환경 변수)에 넣으세요.\n");
console.log(`ADMIN_PASSWORD_HASH=${await hashPassword(password)}`);
// base64url: 주소·환경 변수에 곤란한 글자(+, /, =)가 없는 모양
console.log(`SESSION_SECRET=${randomBytes(48).toString("base64url")}`);
