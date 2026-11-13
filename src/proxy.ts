/**
 * @file 쓰기 화면·API 문지기 (src/proxy.ts)
 *
 * 이 파일이 하는 일
 *   Next.js 16의 Proxy(예전 이름 Middleware)예요. 아래 config.matcher에 적은 주소로 요청이 오면,
 *   페이지나 API가 일을 시작하기 "전에" 이 함수가 먼저 받아서 로그인했는지 확인해요.
 *     - 로그인했으면: 그대로 통과(NextResponse.next())
 *     - 로그인하지 않았으면:
 *         글쓰기 화면(/write...) → 로그인 화면(/login?next=원래 주소)으로 보내요(redirect).
 *         저장 API(/api/reviews..., /api/images) → 401(로그인 필요) JSON으로 바로 답해요.
 *   그래서 로그인하기 전에는 리뷰를 쓰거나(C) 고치거나(U) 지울(D) 수 없어요. 읽기(R)는 누구나 할 수 있어요.
 *
 * 파일 위치와 이름(Next.js 약속)
 *   src 폴더를 쓰는 프로젝트는 app 폴더 옆(src/proxy.ts)에 둬요. 프로젝트에 하나만 둘 수 있어요.
 *   JSX(화면)가 없어서 .tsx가 아니라 .ts예요.
 *
 * 이것만으로 충분한가요?
 *   아니요. Next.js 문서도 proxy는 "빠른 1차 확인"으로만 쓰고, 데이터를 다루는 곳에서 다시 확인하라고 권해요.
 *   그래서 API와 글쓰기 화면도 lib/admin-auth.ts로 한 번 더 확인해요(이중 잠금).
 *
 * 어디서 돌아가나요?
 *   Next.js 16에서 proxy는 기본으로 Node.js 런타임에서 돌아요. 호스팅에 따라 엣지(가까운 서버)에서 돌기도 해서,
 *   세션 확인(lib/session.ts)은 어디에나 있는 웹 표준 Web Crypto만 써요.
 */

import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_HINT_COOKIE, SESSION_COOKIE } from "@/lib/auth-cookies";
import { isValidSession } from "@/lib/session";

/**
 * 요청마다 실행되는 문지기 함수예요. 이름이 proxy인 함수를 내보내면 Next.js가 찾아 써요.
 *
 * @param request 들어온 요청. request.cookies로 쿠키를, request.nextUrl로 주소를 읽어요.
 */
export async function proxy(request: NextRequest) {
  // 1) 세션 쿠키의 표가 진짜이고 기한이 남았으면 통과
  if (await isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  // 2) 로그인하지 않은 요청
  const { pathname, search } = request.nextUrl;
  const response = pathname.startsWith("/api/")
    ? // API: 화면이 알아듣는 JSON으로 "로그인이 필요해요"(401)
      NextResponse.json({ message: "로그인이 필요합니다. 다시 로그인한 뒤 시도하세요." }, { status: 401 })
    : // 화면: 로그인 화면으로 보내고, 로그인한 뒤 원래 보려던 주소로 돌아오게 next에 적어 둬요.
      NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname + search)}`, request.url));

  // 표가 없거나 만료됐는데 "로그인 표시" 쿠키만 남아 있으면 화면이 단추를 잘못 보여 줘요. 함께 지워요.
  response.cookies.delete(ADMIN_HINT_COOKIE);
  return response;
}

/**
 * 문지기가 지킬 주소들이에요. 여기에 없는 주소(목록, 상세, 로그인 화면, 이미지 등)는 문지기를 거치지 않아 빨라요.
 *
 *   :path* — "그 아래 주소 0개 이상"이라는 뜻이라 /write 자체와 /write/winter-stop 모두 지켜요.
 *
 * Next.js 약속: matcher는 빌드할 때 읽어서, 변수 말고 글자 그대로 적어야 해요.
 */
export const config = {
  matcher: ["/write/:path*", "/api/reviews/:path*", "/api/images/:path*"],
};
