/**
 * @file 앱 설치 안내 (install-prompt.tsx)
 *
 * 이 파일이 하는 일
 *   이 블로그를 "앱으로 설치"할 수 있다고 알려 줘요. 브라우저마다 설치 방법이 달라서 세 가지로 나눠요.
 *     1. 크롬·엣지·삼성 인터넷처럼 설치 단추를 띄울 수 있는 브라우저 → [앱으로 설치] 단추
 *     2. 아이폰·아이패드(Safari) → "공유 단추 → 홈 화면에 추가" 안내 글
 *     3. 이미 앱으로 열었거나, 설치를 지원하지 않는 브라우저 → 아무것도 보이지 않음
 *
 * beforeinstallprompt 이벤트가 뭔가요?
 *   크롬 계열 브라우저는 "이 사이트를 설치할 수 있어요"라는 때가 되면 이 이벤트를 보내요.
 *   이벤트를 붙잡아 두었다가(preventDefault) 사용자가 단추를 누를 때 prompt()로 설치 창을 띄워요.
 *   Safari에는 이 이벤트가 없어서(Next.js 공식 문서도 같은 이유로) iOS에는 안내 글을 보여 줘요.
 *
 * 누가 쓰나요?
 *   components/site-footer.tsx(바닥글)
 */

// 브라우저의 이벤트와 화면 상태를 읽어야 해서 클라이언트 컴포넌트예요.
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/** beforeinstallprompt 이벤트의 모양. TypeScript 기본 타입에 아직 없어서 직접 적어요. */
type InstallPromptEvent = Event & {
  /** 설치 창 띄우기 */
  prompt: () => Promise<void>;
  /** 사용자가 설치했는지(accepted) 닫았는지(dismissed) */
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** "설치한 앱으로 열었는지"를 알려 주는 미디어 쿼리 */
const STANDALONE = "(display-mode: standalone)";

/** 아이폰·아이패드인지. iPadOS는 맥처럼 보이므로 "맥인데 터치가 된다"도 함께 확인해요. */
function getIsIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** 설치한 앱으로 열었는지. iOS Safari는 navigator.standalone으로 따로 알려 줘요. */
function getIsStandalone() {
  return window.matchMedia(STANDALONE).matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** 앱 창으로 바뀌는 것을 지켜보다가 알려 주는 함수(useSyncExternalStore에 넘겨요) */
function subscribeStandalone(onChange: () => void) {
  const query = window.matchMedia(STANDALONE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** 바뀌지 않는 값(iOS 여부)을 지켜볼 때 쓰는 "아무것도 하지 않는" 구독 함수 */
function subscribeNothing() {
  return () => {};
}

/** 서버(미리 만든 HTML)에서는 브라우저 정보를 모르니 늘 false로 봐요. */
const onServer = () => false;

/** 앱 설치 안내 */
export function InstallPrompt() {
  // useSyncExternalStore: React 바깥의 값(브라우저 상태)을 안전하게 읽는 훅이에요.
  //   (지켜보는 함수, 브라우저에서 값을 읽는 함수, 서버에서 쓸 값)을 넘겨요.
  //   미리 만든 HTML과 브라우저의 첫 화면이 어긋나지 않게(하이드레이션 오류 없이) 해 줘요.
  const isIOS = useSyncExternalStore(subscribeNothing, getIsIOS, onServer);
  const isStandalone = useSyncExternalStore(subscribeStandalone, getIsStandalone, onServer);

  // 붙잡아 둔 설치 이벤트. 있으면 [앱으로 설치] 단추를 보여요.
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    /** 브라우저가 "설치할 수 있어요"라고 알려 주면 붙잡아 둬요. */
    function handlePrompt(event: Event) {
      // 브라우저가 스스로 띄우는 설치 안내를 막고, 우리 단추로 띄우게 해요.
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    }
    /** 설치가 끝나면 단추를 숨겨요. */
    function handleInstalled() {
      setInstallEvent(null);
    }
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    // 컴포넌트가 사라질 때 지켜보기를 그만둬요(정리 함수).
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  /** [앱으로 설치] 단추를 누르면 설치 창을 띄워요. 설치 창은 한 번만 띄울 수 있어서 누른 뒤에는 단추를 숨겨요. */
  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  // 이미 앱으로 열었으면 안내할 필요가 없어요.
  if (isStandalone) return null;

  if (installEvent) {
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span>이 블로그를 앱으로 설치할 수 있어요.</span>
        <button type="button" onClick={handleInstall} className="btn-line">
          앱으로 설치
        </button>
      </p>
    );
  }

  if (isIOS) {
    return <p>아이폰·아이패드에서는 Safari의 공유 단추를 누르고 ‘홈 화면에 추가’를 고르면 앱으로 설치할 수 있어요.</p>;
  }

  return null;
}
