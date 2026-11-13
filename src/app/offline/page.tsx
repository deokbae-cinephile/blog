/**
 * @file 오프라인 안내 화면 (app/offline/page.tsx → 주소 "/offline/")
 *
 * 이 파일이 하는 일
 *   인터넷이 끊겼는데 아직 저장해 두지 않은 화면을 열려고 할 때, 서비스 워커(public/sw.js)가 대신 보여 주는 화면이에요.
 *   서비스 워커가 설치될 때 이 화면을 미리 저장해 둬요.
 *
 * 화면 구성
 *   옛날 모뎀이 연결이 끊기면 띄우던 "NO CARRIER"를 ASCII 그림으로 보여 주고,
 *   (1) 무슨 일인지 (2) 지금 할 수 있는 것 (3) 갈 곳(목록)을 알려 줘요.
 *
 * 검색엔진에는 보이지 않게 해요(robots: noindex). 블로그 글이 아니라 안내 화면이니까요.
 */

import type { Metadata } from "next";
import Link from "next/link";

/** 탭 제목 "오프라인 — 덕배의 영화 블로그", 그리고 검색엔진에 올리지 않기 */
export const metadata: Metadata = {
  title: "오프라인",
  robots: { index: false },
};

/** 모뎀 연결이 끊긴 단말기 화면 ASCII 그림. 꾸밈이라 화면 낭독기에서는 숨겨요. */
const NO_CARRIER = String.raw` .---------------------------.
 | ATDT 0000-0000            |
 | DIALING...                |
 |                           |
 | NO CARRIER                |
 | _                         |
 '---------------------------'`;

/** 오프라인 안내 화면 */
export default function OfflinePage() {
  return (
    <section aria-labelledby="offline-title" className="mx-auto grid max-w-[42rem] justify-items-center gap-6 py-10 text-center">
      <pre aria-hidden="true" className="glow text-left leading-tight">
        {NO_CARRIER}
      </pre>
      {/* (1) 무슨 일인지 */}
      <h1 id="offline-title" className="glow text-big">
        인터넷에 연결되어 있지 않습니다
      </h1>
      {/* (2) 지금 할 수 있는 것 */}
      <p className="text-crt-dim">
        한 번 열어 본 리뷰는 지금도 읽을 수 있습니다.
        <br />
        연결되면 이 화면을 새로 고쳐 주세요.
      </p>
      {/* (3) 갈 곳 */}
      <Link href="/" className="btn-inverse">
        목록으로 가기
      </Link>
    </section>
  );
}
