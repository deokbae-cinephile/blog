"use client";

/**
 * @file 리뷰 공유 단추 (share-button.tsx)
 *
 * 이 파일이 하는 일
 *   상세 화면 맨 윗줄 오른쪽의 [공유하기] 단추예요. 누르면 휴대폰(과 지원하는 컴퓨터)의 공유 창이 열려요.
 *
 *     ◀ 목록으로                 (링크를 복사했어요.) [공유하기] [수정] [삭제]
 *                                       ↑ 공유 창이 없을 때만 보이는 안내
 *     [공유하기] → 휴대폰 공유 창: 카카오톡·메시지·메일 등 → 받는 쪽에는 포스터가 들어간 미리 보기 카드가 보여요
 *
 * 포스터는 어떻게 보이나요?
 *   공유하는 것은 리뷰 주소(링크)예요. 메신저·SNS는 링크를 받으면 그 화면의 공유 미리 보기 정보(og:image)를 읽어
 *   카드로 보여 주는데, 리뷰 화면은 그 그림이 포스터예요(app/reviews/[slug]/page.tsx, 포스터가 없으면 블로그 기본 그림).
 *   포스터 파일을 따로 보내지 않는 까닭: 앱에 따라 그림만 가고 링크가 빠지기도 해서예요. 링크 하나면 어디서나 포스터와 함께 보여요.
 *
 * 공유 창이 없는 브라우저는요?
 *   (예: 컴퓨터의 Firefox) 공유 창 대신 주소를 복사하고 "링크를 복사했어요"라고 알려 줘요. 복사도 안 되면 주소를 보여 줘요.
 *   공유 창을 열었다가 닫으면(취소) 아무 일도 하지 않아요.
 *
 * 접근성
 *   - 진짜 <button>이라 키보드(Tab, Enter·Space)로 쓸 수 있어요.
 *   - 결과 안내는 처음부터 있는 role="status" 칸에 글만 바꿔 넣어요(화면 낭독기가 읽어 줘요, 초점은 옮기지 않아요).
 */

import { useState } from "react";

/** ShareButton이 받는 값 */
type Props = {
  /** 공유할 리뷰의 전체 주소. 예: "https://deokbae.blog/reviews/winter-stop" */
  url: string;
  /** 공유 창에 보일 제목. 예: "겨울 정류장 리뷰" */
  title: string;
  /** 링크와 함께 보낼 글. 예: "평점 4.5 · 기다림은 끝내 도착한다" */
  text: string;
};

/** 리뷰 공유 단추 */
export function ShareButton({ url, title, text }: Props) {
  // 결과 안내 글. 비어 있으면 안내 칸만 있고 아무것도 읽지 않아요.
  const [message, setMessage] = useState("");

  async function share() {
    // 같은 안내를 다시 넣어도 화면 낭독기가 또 읽도록, 누를 때마다 먼저 비워요.
    setMessage("");

    // 1) 공유 창(Web Share API)이 있으면 열어요. 휴대폰 브라우저와 컴퓨터의 Safari·Edge·Chrome(Windows·macOS)에 있어요.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        // 공유 창을 닫았으면(AbortError) 아무 일도 하지 않아요. 다른 까닭으로 못 열었으면 아래 복사로 넘어가요.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    // 2) 공유 창이 없으면 주소를 복사해요.
    try {
      await navigator.clipboard.writeText(url);
      setMessage("링크를 복사했어요.");
    } catch {
      // 복사도 막혀 있으면(권한 등) 주소를 보여 줘서 직접 복사할 수 있게 해요.
      setMessage(`링크를 복사하지 못했어요. 이 주소를 직접 복사해 주세요: ${url}`);
    }
  }

  return (
    // 단추와 안내를 한 줄에. 안내는 단추 왼쪽에 나타나서(order-first), 안내가 생겨도 단추 자리는 그대로예요.
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      <button type="button" onClick={share} className="btn-line">
        공유하기
      </button>
      {/* 결과 안내(처음부터 있는 칸, 내용만 바꿔요). 비어 있으면 아무 자리도 차지하지 않아요.
          break-all: 복사하지 못해 주소를 보여 줄 때 긴 주소가 화면 밖으로 나가지 않게 아무 데서나 줄을 바꿔요. */}
      <p role="status" className="order-first break-all text-crt-dim">
        {message}
      </p>
    </div>
  );
}
