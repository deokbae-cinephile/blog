/**
 * @file 포스터 그림과 그림이 오기 전의 스켈레톤 (poster-image.tsx)
 *
 * 이 파일이 하는 일
 *   포스터 그림(next/image)을 그리고, 그림이 도착하기 전까지는 액자 안에 스켈레톤(움직이지 않는 옅은 초록)을 보여 줘요.
 *   그림이 다 오면(onLoad) 스켈레톤을 치워요.
 *   그림을 받지 못하면(onError: 파일이 없거나 연결이 끊김) 스켈레톤을 치우고, 받은 대신 그림(fallback, 기본 포스터)을 보여 줘요.
 *   (화면이 준비되기 전에 실패했어도 next/image가 onError를 다시 알려 줘서, 스켈레톤이 남지 않아요.)
 *
 *     ┌──────┐            ┌──────┐
 *     │░░▒▒░░│  그림 도착  │ 포스터 │
 *     │░░▒▒░░│  ───────>  │      │
 *     └──────┘            └──────┘
 *
 *   이미 받아 둔 그림이라 화면이 준비되기 전에 다 와 있어도, next/image가 준비되자마자 onLoad를 알려 줘서 스켈레톤이 남지 않아요.
 *
 * 왜 따로 떼었나요?
 *   "그림이 왔는지"를 기억하려면 브라우저에서 도는 코드(use client)가 필요해요.
 *   포스터 액자(components/poster.tsx)는 서버 컴포넌트로 두고, 이 작은 조각만 브라우저 코드로 만들었어요.
 *
 * 누가 쓰나요?
 *   components/poster.tsx(목록 썸네일, 상세 화면의 큰 포스터)
 */

"use client";

import Image, { type ImageProps } from "next/image";
import { type ReactNode, useState } from "react";

/** PosterImage가 받는 값: next/image의 값(alt 필수) + 그림을 받지 못했을 때 대신 보일 것 */
type Props = ImageProps & {
  /** 그림을 받지 못했을 때 대신 보일 것(예: 기본 포스터). 없으면 브라우저의 깨진 그림 표시가 남아요. */
  fallback?: ReactNode;
};

/** 포스터 그림 */
export function PosterImage({ alt, onLoad, onError, fallback, ...props }: Props) {
  // 그림 상태: loading(오는 중) → loaded(다 옴) 또는 failed(받지 못함)
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");

  // 받지 못했으면 대신 보일 것을 그려요(기본 포스터).
  if (state === "failed" && fallback) return <>{fallback}</>;

  return (
    <>
      {/* 스켈레톤: 액자를 꽉 채워(absolute inset-0) 그림이 올 자리에 깔아요. 꾸밈이라 읽지 않아요. */}
      {state === "loading" && <span aria-hidden="true" className="skeleton absolute inset-0" />}
      <Image
        {...props}
        // 대체 텍스트는 받은 그대로 넘겨요(꾸밈 그림이면 빈 글자).
        alt={alt}
        // 그림이 다 오면 스켈레톤을 치워요. 넘겨받은 onLoad가 있으면 그것도 불러요.
        onLoad={(event) => {
          setState("loaded");
          onLoad?.(event);
        }}
        // 받지 못해도 스켈레톤을 치우고 대신 보일 것으로 바꿔요. 넘겨받은 onError가 있으면 그것도 불러요.
        onError={(event) => {
          setState("failed");
          onError?.(event);
        }}
      />
    </>
  );
}
