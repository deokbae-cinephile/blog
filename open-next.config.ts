/**
 * @file Cloudflare Workers용 OpenNext 설정 (open-next.config.ts)
 *
 * 이 파일이 하는 일
 *   Next.js 앱을 Cloudflare Workers에서 돌아가게 바꿔 주는 도구(OpenNext Cloudflare 어댑터)의 설정이에요.
 *   `opennextjs-cloudflare build`가 이 파일을 읽고, `next build` 결과를 Workers용 코드(.open-next/)로 바꿔요.
 *
 * 정한 것
 *   1. 미리 만든 화면(정적 생성)의 캐시를 Workers의 정적 파일(Static Assets)에 함께 올려 두고 거기서 읽어요.
 *      이 블로그는 화면을 빌드할 때만 만들고(시간이 지나면 다시 만드는 ISR 없음), 글이 바뀌면 다시 배포해요.
 *      그래서 읽기 전용 캐시로 충분하고, R2·KV 같은 저장소를 따로 만들 필요가 없어요(설정도 비용도 없음).
 *   2. 캐시 가로채기: 미리 만든 화면은 Next.js 서버 코드를 불러오지 않고 캐시에서 바로 돌려줘요.
 *      워커가 막 깨어난 뒤 첫 요청의 CPU 시간이 크게 줄어요(이 컴퓨터에서 재 보니 약 270ms → 10ms).
 *      무료 플랜은 요청 하나에 CPU 10ms까지라, 방문자 화면이 이 한도 안에 들어오게 하려고 켰어요.
 *
 * 참고: https://opennext.js.org/cloudflare/caching
 */

// defineCloudflareConfig: 설정 모양을 검사해 주고 Cloudflare에 맞는 기본값을 채워 주는 함수예요.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
// 정적 파일(Static Assets)에서 화면 캐시를 읽는 방식. 빌드 때 만든 화면만 있는(SSG) 앱에 맞춰져 있어요.
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
  // 미리 만든 화면을 정적 파일에서 읽어요(읽기 전용).
  incrementalCache: staticAssetsIncrementalCache,
  // 미리 만든 화면은 Next.js 서버를 거치지 않고 바로 돌려줘요.
  // (화면 일부만 미리 만드는 PPR을 쓰면 꺼야 하지만, 이 블로그는 PPR을 쓰지 않아요.)
  enableCacheInterception: true,
});
