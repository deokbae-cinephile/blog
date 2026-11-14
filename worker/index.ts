/**
 * @file Cloudflare Worker 시작 파일 (worker/index.ts)
 *
 * 이 파일이 하는 일
 *   Cloudflare가 요청을 받으면 맨 먼저 부르는 파일이에요(wrangler.jsonc의 main).
 *   - 블로그 화면과 API는 OpenNext가 만든 처리기(.open-next/worker.js)에 그대로 넘겨요.
 *   - 조회수 저장소인 Durable Object(ViewCounter)를 함께 내보내요. Cloudflare는 Worker가 내보낸 클래스로 Durable Object를 만들어요.
 *
 * 왜 따로 두나요?
 *   OpenNext가 만드는 파일은 빌드할 때마다 새로 생겨서 고칠 수 없어요. 그래서 OpenNext 안내(custom worker)대로
 *   그 파일을 가져다 쓰는 시작 파일을 따로 두고, 여기에 우리 Durable Object를 더해요.
 */

// @ts-expect-error -- .open-next/worker.js는 `opennextjs-cloudflare build`가 만드는 파일이라 타입이 없어요(빌드 전에는 파일도 없어요).
import { default as handler } from "../.open-next/worker.js";

export { ViewCounter } from "./view-counter";

export default {
  // 모든 요청은 OpenNext 처리기가 맡아요.
  fetch: handler.fetch,
} satisfies ExportedHandler;
