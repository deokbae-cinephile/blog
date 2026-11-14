/**
 * @file 서비스 워커 등록 (service-worker.tsx)
 *
 * 이 파일이 하는 일
 *   1. 브라우저에 서비스 워커(public/sw.js)를 등록해요. 등록하면
 *      - 이 블로그를 앱으로 설치할 수 있고(설치 정보 app/manifest.ts와 함께),
 *      - 한 번 본 리뷰를 인터넷이 끊겨도 다시 읽을 수 있어요.
 *   2. 화면을 옮길 때마다 "지금 화면과 그 화면에 쓴 파일"을 저장해 달라고 서비스 워커에 알려요.
 *
 * 왜 2번이 필요할까요?
 *   - 처음 연 화면: 서비스 워커는 그 화면이 다 뜬 "뒤에" 켜져서, 그 화면의 파일을 거치지 못했어요.
 *   - 링크로 옮긴 화면: Next.js는 링크를 누르면 HTML이 아니라 "화면 데이터(RSC)"만 받아 화면을 바꿔요.
 *     그래서 그 화면의 HTML은 서비스 워커를 거치지 않아 저장되지 않아요.
 *   두 경우 모두 오프라인에서 그 화면을 다시 열 수 없으니, 화면을 옮길 때마다 직접 알려 줘요.
 *
 * 화면에는 아무것도 그리지 않아요(return null). 일만 하는 "보이지 않는 컴포넌트"예요.
 *
 * 누가 쓰나요?
 *   app/layout.tsx가 모든 페이지에 한 번 넣어요.
 */

// 브라우저에서만 할 수 있는 일(navigator.serviceWorker)이라 클라이언트 컴포넌트예요.
"use client";

// usePathname: 지금 주소의 경로. 화면을 옮기면 값이 바뀌어요.
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** 서비스 워커를 쓸지: 운영 빌드이고, 브라우저가 지원할 때만 */
function canUseServiceWorker() {
  // 개발 서버(pnpm dev)에서는 켜지 않아요. 고친 코드가 저장소(캐시)에 갇혀 안 바뀌는 것처럼 보일 수 있거든요.
  return process.env.NODE_ENV === "production" && "serviceWorker" in navigator;
}

/** 서비스 워커를 등록하고, 화면을 옮길 때마다 저장을 부탁하는 보이지 않는 컴포넌트 */
/**
 * 서비스 워커에 이미 보낸 파일 주소들. 화면을 옮길 때마다 아직 보내지 않은 파일만 보내려고 기억해요.
 * (개수로 자르면 안 돼요: 성능 기록은 "받기 시작한 순서"로 쌓여서, 먼저 시작해 늦게 끝난 파일이 앞쪽에 끼어들 수 있거든요.)
 * 페이지를 처음부터 다시 열면(새로 고침) 비어서 다시 시작해요.
 */
const sentResources = new Set<string>();

/** 아직 보내지 않은 주소만 골라 "보냄"으로 표시하고 돌려줘요. */
function unsent(names: string[]): string[] {
  const fresh = names.filter((name) => !sentResources.has(name));
  for (const name of fresh) sentResources.add(name);
  return fresh;
}

export function ServiceWorker() {
  const pathname = usePathname();

  // [1] 등록: 처음 한 번만(빈 배열 [])
  useEffect(() => {
    if (!canUseServiceWorker()) return;
    navigator.serviceWorker
      .register("/sw.js", {
        // 맡을 범위: 블로그 전체("/")
        scope: "/",
        // sw.js를 고쳐 배포했는지 확인할 때 브라우저 저장본(HTTP 캐시)을 거치지 않고 늘 서버에 물어봐요.
        updateViaCache: "none",
      })
      // 등록에 실패해도(예: 사생활 보호 모드) 블로그는 그대로 쓸 수 있으니 조용히 넘어가요.
      .catch(() => {});
  }, []);

  // [2] 저장 부탁: 화면을 옮길 때마다(pathname이 바뀔 때마다)
  useEffect(() => {
    if (!canUseServiceWorker()) return;
    // 효과가 정리된 뒤(화면을 또 옮긴 뒤)에 늦게 도착한 일은 하지 않으려고 표시해 둬요.
    let cancelled = false;
    // 나중에 다 받아지는 파일을 지켜보는 관찰자. 효과를 정리할 때 멈춰요.
    let observer: PerformanceObserver | undefined;

    // ready: 서비스 워커가 켜질 때까지 기다려요(처음 방문이면 위의 등록이 끝난 뒤에 이어져요).
    navigator.serviceWorker.ready
      .then((registration) => {
        if (cancelled) return;
        /** 서비스 워커에 "이 주소들을 저장해 줘"라고 보내요. */
        const send = (assets: string[], pages: string[] = []) =>
          registration.active?.postMessage({ type: "CACHE_URLS", pages, assets });

        // 이 화면들을 그리는 데 쓴 파일(CSS, JS, 글꼴, 포스터) 목록을 성능 기록(performance)에서 모아요.
        // 지난번에 보낸 뒤 새로 받은 파일만 보내요. 성능 기록에는 지금까지 받은 파일이 모두 쌓여 있어서, 통째로 다시 보내면
        // 서비스 워커가 상한에 맞춰 지운 예전 사진을 화면을 옮길 때마다 다시 받게 돼요(public/sw.js의 저장소 상한).
        const used = unsent(performance.getEntriesByType("resource").map((entry) => entry.name));
        // 본문 사진은 화면에 가까워질 때 받아서(loading="lazy"), 아직 스크롤하지 않은 아래쪽 사진은 성능 기록에 없어요.
        // 그래서 화면에 있는 모든 그림(document.images)의 주소도 함께 보내요. 오프라인에서도 사진까지 끝까지 읽을 수 있어요.
        // currentSrc: 브라우저가 실제로 고른 주소. 아직 받지 않은 그림은 비어 있어서 src를 대신 써요.
        const images = Array.from(document.images, (image) => image.currentSrc || image.src);
        send([...used, ...images], [location.href]);

        // 성능 기록에는 "다 받은" 파일만 올라와요. 아직 받는 중이던 파일(큰 포스터, 글꼴)은 위 목록에 없으니,
        // PerformanceObserver로 지켜보다가 다 받아지는 대로 이어서 알려요.
        if ("PerformanceObserver" in window) {
          // 여기서 보낸 파일도 "보냄"으로 표시해, 다음 화면에서 다시 보내지 않아요.
          observer = new PerformanceObserver((list) => {
            const fresh = unsent(list.getEntries().map((entry) => entry.name));
            if (fresh.length > 0) send(fresh);
          });
          observer.observe({ type: "resource" });
        }
      })
      .catch(() => {});

    // 정리 함수: 화면을 옮기거나 컴포넌트가 사라지면 지켜보기를 멈춰요.
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [pathname]);

  return null;
}
