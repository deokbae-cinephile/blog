/**
 * @file 없는 주소 화면 = 404 (app/not-found.tsx)
 *
 * 이 파일이 하는 일
 *   없는 주소로 들어왔을 때 보이는 화면이에요. "신호 없음" 텔레비전 그림과 함께
 *   왜 이 화면이 나왔는지, 어떻게 하면 되는지 알려 주고 목록으로 돌아가는 단추를 둬요.
 *
 * 언제 보이나요?
 *   - 사이트에 없는 주소로 들어왔을 때(서버가 404 상태와 함께 이 화면을 보여 줘요)
 *   - 리뷰 상세 화면에서 notFound()를 불렀을 때
 *
 * 좋은 오류 화면의 조건
 *   "에러!"만 말하지 않고 (1) 무슨 일인지 (2) 왜 그런지 (3) 이제 어떻게 하면 되는지 알려 줘요.
 */

import type { Metadata } from "next";
import Link from "next/link";

/** 탭 제목: "찾는 화면이 없습니다 — 덕배의 영화 블로그" */
export const metadata: Metadata = {
  title: "찾는 화면이 없습니다",
};

/**
 * "신호 없음" 텔레비전 ASCII 그림. 꾸밈이라 화면 낭독기에서는 숨겨요.
 * String.raw는 역슬래시(\)를 특수 문자로 바꾸지 않고 "있는 그대로" 쓰는 글자예요. ASCII 그림에는 \ 가 많아서 이렇게 씁니다.
 */
const NO_SIGNAL = String.raw` .-------------------------.
 | ####################### |
 | #                     # |
 | #      NO  SIGNAL     # |
 | #         404         # |
 | #                     # |
 | ####################### |
 '-------------------------'
        _/           \_`;

/** 404 화면 */
export default function NotFoundPage() {
  return (
    // justify-items-center + text-center: 모든 것을 가운데 정렬해요.
    <section aria-labelledby="not-found-title" className="mx-auto grid max-w-[42rem] justify-items-center gap-6 py-10 text-center">
      <pre aria-hidden="true" className="glow leading-tight">
        {NO_SIGNAL}
      </pre>
      {/* (1) 무슨 일인지 */}
      <h1 id="not-found-title" className="glow text-big">
        찾는 화면이 없습니다
      </h1>
      {/* (2) 왜 그런지, (3) 어떻게 하면 되는지 */}
      <p className="text-crt-dim">
        주소가 바뀌었거나 지워진 리뷰일 수 있습니다.
        <br />
        주소를 다시 확인하거나 목록에서 찾아 주세요.
      </p>
      <Link href="/" className="btn-inverse">
        목록으로 가기
      </Link>
    </section>
  );
}
