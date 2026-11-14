"use client";

/**
 * @file 리뷰 상세에서 옮겨 갈 때의 로딩 (review-navigation.tsx)
 *
 * 이 파일이 하는 일
 *   상세 화면에서 이전·다음 리뷰나 목록으로 옮겨 갈 때, 새 화면을 받는 동안 화면 가운데에 로딩 UI를 보여 줘요.
 *     - 이전·다음 리뷰: [◀ 이전 리뷰]·[다음 리뷰 ▶]를 누르거나 키보드 ◀ ▶
 *     - 목록: [◀ 목록으로]를 누르거나 키보드 Esc
 *   마우스로 눌러도, 키보드로 옮겨 가도 같은 로딩이 보여요.
 *
 *     ┌──────────────────────────────────────────┐
 *     │             (화면을 어둡게 덮어요)            │
 *     │   ┌──────────────────────────────────┐   │
 *     │   │ 다음 리뷰를 불러오는 중▮ [■■■□□□□□] │   │  ← role="status"(화면 낭독기가 읽어요)
 *     │   └──────────────────────────────────┘   │
 *     └──────────────────────────────────────────┘
 *
 * 어떻게 "받는 중"을 아나요?
 *   React의 useTransition으로 이동(router.push)을 시작하면, 새 화면을 다 그릴 때까지 pending이 true예요.
 *   링크를 누를 때는 Next.js <Link>의 onNavigate에서 원래 이동을 멈추고(preventDefault) 같은 방법으로 옮겨 가요.
 *   (Ctrl·⌘을 누른 채 눌러 새 탭으로 여는 것은 onNavigate가 불리지 않아 브라우저 그대로예요.)
 *   미리 받아 둔 리뷰라 0.1초 안에 끝나면 로딩이 번쩍이지 않게, 0.1초 뒤부터 보여요(globals.css의 .nav-loading).
 *
 * 누가 쓰나요?
 *   components/review-article.tsx(상세 화면 전체를 ReviewNavigation으로 감싸고, 이전·다음 링크는 ReviewNavLink),
 *   components/review-toolbar.tsx([◀ 목록으로]도 ReviewNavLink), components/review-keys.tsx(키보드 ◀ ▶ Esc, useReviewNavigate)
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ComponentProps, createContext, type ReactNode, useCallback, useContext, useState, useTransition } from "react";

import { LoadingStatus } from "./loading-status";

/** 어디로 가는지: 이전 리뷰(목록에서 바로 위), 다음 리뷰(목록에서 바로 아래), 목록(처음 화면) */
export type NavTarget = "previous" | "next" | "list";

/** 이동 함수: 갈 주소와 갈 곳을 받아, 로딩을 보이며 옮겨 가요. */
type Navigate = (href: string, target: NavTarget) => void;

/** 로딩 UI에 보일 글자 */
const LOADING_LABELS: Record<NavTarget, string> = {
  previous: "이전 리뷰를 불러오는 중",
  next: "다음 리뷰를 불러오는 중",
  list: "목록을 불러오는 중",
};

/** 상세 화면 안의 링크·키보드가 같은 이동 함수를 쓰도록 나눠 주는 통로(컨텍스트) */
const NavigateContext = createContext<Navigate | null>(null);

/** 상세 화면을 감싸, 이동 함수와 로딩 UI를 마련해요. */
export function ReviewNavigation({ children }: { children: ReactNode }) {
  const router = useRouter();
  // pending: 새 리뷰를 받아 그리는 동안 true. startTransition 안에서 시작한 이동이 끝나면 저절로 false가 돼요.
  const [pending, startTransition] = useTransition();
  // 어디로 가는 중인지(로딩 글자를 고르려고 기억해요)
  const [target, setTarget] = useState<NavTarget>("next");

  // useCallback: 그릴 때마다 새 함수를 만들지 않게 해요(키보드 듣기를 매번 다시 걸지 않게요).
  const navigate = useCallback<Navigate>(
    (href, to) => {
      setTarget(to);
      startTransition(() => router.push(href));
    },
    [router],
  );

  return (
    <NavigateContext value={navigate}>
      {children}
      {/* 로딩 안내 칸(role="status"). 처음부터 두고 안쪽만 바꿔야 화면 낭독기가 읽어요. 비어 있으면 아무 자리도 차지하지 않아요. */}
      <div role="status">
        {pending && (
          // nav-loading: 화면 전체를 어둡게 덮고 가운데에 상자를 놓아요(globals.css). 누름은 막지 않아요.
          <div className="nav-loading">
            {/* 상자 모양은 확인 창·키보드 안내 창과 같아요(실선 테두리, 화면색 바탕, 은은한 빛). */}
            <div className="border-2 border-crt-fg bg-crt-bg px-5 py-4 shadow-[0_0_1rem_rgb(var(--glow-rgb)/0.3)]">
              {/* live={false}: 바깥 칸이 이미 role="status"라 겹치지 않게 해요. */}
              <LoadingStatus label={LOADING_LABELS[target]} live={false} />
            </div>
          </div>
        )}
      </div>
    </NavigateContext>
  );
}

/**
 * 이동 함수를 꺼내 써요. ReviewNavigation 밖(예: 시험에서 따로 그린 화면)이면 로딩 없이 바로 옮겨 가요.
 * @returns (주소, 갈 곳) => void
 */
export function useReviewNavigate(): Navigate {
  const navigate = useContext(NavigateContext);
  const router = useRouter();
  // 감싼 곳 밖에서 쓸 때의 대신할 함수. useCallback으로 그릴 때마다 새로 만들지 않아요.
  const plain = useCallback<Navigate>((href) => router.push(href), [router]);
  return navigate ?? plain;
}

/** ReviewNavLink가 받는 값: <Link>와 같고, 갈 곳(target)을 더 받아요. */
type ReviewNavLinkProps = Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & {
  /** 갈 주소. 예: "/reviews/winter-stop", "/" */
  href: string;
  /** 이전 리뷰·다음 리뷰·목록 중 어디인지(로딩 글자에 써요) */
  target: NavTarget;
};

/** 이전·다음 리뷰, 목록으로 가는 링크. 누르면 로딩 UI를 보이며 옮겨 가요. */
export function ReviewNavLink({ href, target, ...props }: ReviewNavLinkProps) {
  const navigate = useReviewNavigate();
  return (
    <Link
      {...props}
      href={href}
      // onNavigate: 이 앱 안에서 옮겨 갈 때만 불려요. 원래 이동은 멈추고, 로딩을 보이는 같은 이동으로 바꿔요.
      onNavigate={(event) => {
        event.preventDefault();
        navigate(href, target);
      }}
    />
  );
}
