"use client";

/**
 * @file 머리글의 GitHub 링크와 "새 창" 안내 말풍선 (github-link.tsx)
 *
 * 이 파일이 하는 일
 *   머리글 오른쪽 끝의 GitHub 아이콘 링크예요. 누르면 이 블로그의 소스 코드 저장소를 새 창(새 탭)으로 열어요.
 *   화면에는 아이콘만 보이고, 마우스를 올리거나 초점이 가면 아래에 안내 말풍선(툴팁)이 떠요.
 *
 *     [GitHub 아이콘]
 *     ┌──────────────────────────────────┐
 *     │ 이 블로그의 소스 코드 저장소(새 창) │   ← 마우스를 올리거나 초점이 갈 때만 보여요. Esc를 누르면 닫혀요.
 *     └──────────────────────────────────┘
 *
 * 왜 말풍선을 두나요?
 *   누르면 예고 없이 새 창이 열리면 당황스러워요(KWCAG 7.2.1 사용자 요구에 따른 실행).
 *   화면 낭독기는 설명(aria-describedby)으로 "(새 창)"을 읽어 주지만, 눈으로 보는 사람에게도 누르기 전에 알려야 해요.
 *   아이콘만 두는 디자인은 그대로 두고, 가리키거나 초점이 갈 때만 말풍선으로 알려요.
 *
 * 말풍선 규칙(WAI-ARIA 툴팁)
 *   - role="tooltip" 글을 링크의 설명(aria-describedby)으로 이어요. 화면 낭독기는 "GitHub, 링크, 이 블로그의 소스 코드 저장소(새 창)"로 읽어요.
 *   - 숨겨 둔 동안에도(hidden) 설명으로는 늘 읽혀요. aria-describedby로 직접 가리킨 글은 숨어 있어도 읽어 줘요.
 *   - 마우스를 말풍선 위로 옮겨도 닫히지 않아요(말풍선이 링크와 같은 묶음 안에 있어요).
 *   - Esc를 누르면 초점은 그대로 둔 채 닫혀요. 이때 이 Esc는 "처리했어요"(preventDefault) 표시를 해서,
 *     상세 화면의 Esc(목록으로 가기, review-keys.tsx)는 이번에는 쉬어요(위에 덮인 것부터 닫기).
 *
 * 머리글(site-header.tsx)은 브라우저 코드가 없는 서버 컴포넌트이고, 브라우저에서 도는 건 이 작은 링크뿐이에요.
 */

import { useEffect, useState } from "react";

import { GITHUB_MARK_ROWS } from "@/lib/github-mark";
import { site } from "@/lib/site";

import { PixelArt } from "./pixel-art";

/** 말풍선 id. 머리글에 하나뿐이라 고정 이름을 써요(링크의 aria-describedby가 가리켜요). */
const TIP_ID = "github-link-tip";

/** 머리글 오른쪽 끝의 GitHub 아이콘 링크(새 창) + 안내 말풍선 */
export function GitHubLink() {
  const [open, setOpen] = useState(false);

  // 말풍선이 떠 있을 때만 Esc를 들어요. 마우스로 가리키기만 하고 초점은 다른 데 있어도 닫을 수 있게 document에서 들어요.
  // capture: true — 다른 곳(상세 화면의 Esc)보다 먼저 받아서, 닫았다는 표시(preventDefault)를 먼저 남겨요.
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [open]);

  return (
    // 링크와 말풍선을 한 묶음으로 둬요. 마우스가 묶음 안(링크 → 말풍선)에 있는 동안은 계속 보여요.
    // relative: 말풍선(absolute)을 이 묶음 아래에 띄우는 기준이에요.
    // -mr-2.5: 링크의 오른쪽 안쪽 여백(10px)만큼 바깥으로 당겨, 아이콘 오른쪽 끝을 본문 오른쪽 끝에 딱 맞춰요(누르는 영역은 그대로예요).
    // ml-auto: 점선이 없는 휴대폰에서도 오른쪽 끝에 붙어요. shrink-0: 좁아도 찌그러지지 않아요.
    // self-start: 아주 좁은 화면에서 왼쪽 묶음이 두 줄이 되어도 아이콘은 첫 줄(오른쪽 위)에 있어요.
    <span
      className="relative -mr-2.5 ml-auto shrink-0 self-start"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {/* 링크 이름은 화면 낭독기용 글자(sr-only) "GitHub"예요. 아이콘은 이 이름과 같은 뜻이라 꾸밈으로 둬요(읽지 않음).
          target="_blank": 새 창으로 열어요. rel="noopener noreferrer": 새 창이 이 블로그 창을 건드리지 못하게 하고, 어디서 왔는지 알리지 않아요.
          menu-link: 누르는 높이 44px, 좌우 안쪽 여백 10px → 아이콘 24px와 합쳐 44 × 44px. */}
      <a href={site.repo.url} target="_blank" rel="noopener noreferrer" aria-describedby={TIP_ID} className="menu-link">
        <PixelArt rows={GITHUB_MARK_ROWS} cell={2} />
        <span className="sr-only">GitHub</span>
      </a>
      {/* 말풍선. top-full: 링크 바로 아래, right-0: 오른쪽 끝을 링크에 맞춰 왼쪽으로 펼쳐져요(화면 밖으로 나가지 않게).
          pt-1: 링크와 상자 사이 4px 틈도 말풍선 안이라, 마우스를 옮기는 동안 닫히지 않아요.
          상자 모양은 키보드 조작 안내 창과 같아요(실선 테두리, 화면색 바탕, 은은한 빛). */}
      <span id={TIP_ID} role="tooltip" hidden={!open} className="absolute top-full right-0 z-50 pt-1">
        <span className="block border-2 border-crt-fg bg-crt-bg px-2.5 py-1 whitespace-nowrap shadow-[0_0_1rem_rgb(var(--glow-rgb)/0.3)]">
          이 블로그의 소스 코드 저장소(새 창)
        </span>
      </span>
    </span>
  );
}
