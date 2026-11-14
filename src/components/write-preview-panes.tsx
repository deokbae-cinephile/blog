/**
 * @file 본문 쓰기 칸과 미리 보기 (write-preview-panes.tsx)
 *
 * 이 파일이 하는 일
 *   글쓰기 화면의 본문 영역을 두 쪽으로 나눠 보여 줘요.
 *
 *     넓은 화면(1024px~): 나란히                좁은 화면: 탭으로 바꿔 보기
 *     ┌ 본문(Markdown) ──┐ ┌ 미리 보기 ──────┐    [Markdown 입력] [미리 보기]
 *     │ ## 좋았던 점      │ │ 좋았던 점        │    ┌──────────────────┐
 *     │ 첫 장면부터 ...   │ │ 첫 장면부터 ...  │    │ (고른 쪽 하나만)  │
 *     └──────────────────┘ └─────────────────┘    └──────────────────┘
 *
 *   넓은 화면의 미리 보기는 쓰기 칸과 높이가 같고, 글이 길면 그 안에서 스크롤해요(키보드로도 스크롤할 수 있어요).
 *
 * 탭(좁은 화면)의 접근성: WAI-ARIA 탭 패턴
 *   - tablist > tab(aria-selected는 true/false를 모두 적고, aria-controls로 내용을 가리켜요) + tabpanel(aria-labelledby로 탭과 이어요)
 *   - ← → 로 탭을 옮기면 바로 그 쪽이 보여요. Home·End는 처음·마지막 탭. Tab 키로는 고른 탭 하나에만 들어가요(roving tabindex).
 *   - 보이지 않는 쪽은 hidden으로 숨겨 화면 낭독기에도 나오지 않아요.
 *   넓은 화면에서는 두 쪽이 다 보여서 탭이 필요 없어요. 그래서 탭 단추를 숨기고(lg:hidden) 탭 역할도 붙이지 않아요.
 *
 * 화면 너비는 어떻게 아나요?
 *   보이는 모양은 CSS(lg:, max-lg:)가 정해서 화면이 처음 그려질 때부터 맞아요.
 *   탭 역할(role)처럼 CSS로 할 수 없는 것만 useMediaQuery로 너비를 보고 붙여요.
 *
 * 누가 쓰나요?
 *   components/review-writer.tsx의 본문 칸
 */

"use client";

import { type KeyboardEvent, type ReactNode, useId } from "react";

import { useMediaQuery } from "./use-media-query";

/** 지금 보이는 쪽: 쓰기 칸(input) 또는 미리 보기(preview). 좁은 화면에서만 뜻이 있어요. */
export type PaneView = "input" | "preview";

/** 탭 순서와 이름 */
const PANES: readonly { view: PaneView; label: string }[] = [
  { view: "input", label: "Markdown 입력" },
  { view: "preview", label: "미리 보기" },
];

/** 넓은 화면 기준(Tailwind의 lg와 같은 1024px = 64rem) */
const WIDE = "(min-width: 64rem)";

/** WritePreviewPanes가 받는 값 */
type Props = {
  /** 쓰기 칸(본문 이름표 + 글상자 + 오류 문구) */
  input: ReactNode;
  /** 미리 보기 내용 */
  preview: ReactNode;
  /** 지금 보이는 쪽(좁은 화면) */
  view: PaneView;
  /** 탭을 바꿀 때 불러요 */
  onViewChange: (view: PaneView) => void;
};

/** 본문 쓰기 칸과 미리 보기 */
export function WritePreviewPanes({ input, preview, view, onViewChange }: Props) {
  const baseId = useId();
  const tabId = (pane: PaneView) => `${baseId}-${pane}-tab`;
  const panelId = (pane: PaneView) => `${baseId}-${pane}-panel`;
  const previewLabelId = `${baseId}-preview-label`;
  // 넓은 화면인지. 서버에서는 넓은 화면으로 보고 그려요(좁은 화면의 모양은 CSS가 먼저 맞춰 둬요).
  const tabs = !useMediaQuery(WIDE, true);

  /** 탭에서 ← → Home End를 누르면 다른 탭으로 옮기고 그 쪽을 보여 줘요. */
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = PANES.findIndex((pane) => pane.view === view);
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: PANES.length - 1 };
    const next = moves[event.key];
    if (next === undefined) return;
    // 방향키가 화면을 스크롤하지 않게 막아요.
    event.preventDefault();
    // 끝에서 한 번 더 가면 반대쪽 끝으로 돌아가요(+ 길이 후 나머지).
    const target = PANES[(next + PANES.length) % PANES.length]!.view;
    onViewChange(target);
    document.getElementById(tabId(target))?.focus();
  }

  return (
    <div className="grid gap-4">
      {/* 탭: 좁은 화면에서만 보여요(lg:hidden). 고른 탭은 반전(btn-inverse)이라 색이 아니라 모양으로도 알 수 있어요. */}
      <div role={tabs ? "tablist" : undefined} aria-label={tabs ? "본문 보기" : undefined} className="flex flex-wrap gap-2 lg:hidden">
        {PANES.map((pane) => {
          const selected = view === pane.view;
          return (
            <button
              key={pane.view}
              id={tabId(pane.view)}
              type="button"
              role={tabs ? "tab" : undefined}
              aria-selected={tabs ? selected : undefined}
              aria-controls={tabs ? panelId(pane.view) : undefined}
              // roving tabindex: 고른 탭만 Tab 순서에 들어가고, 나머지는 방향키로 옮겨 가요.
              tabIndex={tabs && !selected ? -1 : undefined}
              onClick={() => onViewChange(pane.view)}
              onKeyDown={tabs ? handleKeyDown : undefined}
              className={selected ? "btn-inverse" : "btn-line"}
            >
              {pane.label}
            </button>
          );
        })}
      </div>

      {/* 넓은 화면은 2칸으로 나란히(lg:grid-cols-2). 좁은 화면은 고른 쪽만 보여요(max-lg:hidden). */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 쓰기 칸. content-start: 위에서부터 놓여요. */}
        <div
          id={panelId("input")}
          role={tabs ? "tabpanel" : undefined}
          aria-labelledby={tabs ? tabId("input") : undefined}
          tabIndex={tabs ? 0 : undefined}
          hidden={tabs && view !== "input"}
          className={`grid content-start gap-4 ${view === "input" ? "" : "max-lg:hidden"}`}
        >
          {input}
        </div>

        {/* 미리 보기. 넓은 화면에서는 [이름표 / 상자] 두 줄로, 상자가 쓰기 칸 높이에 맞춰 남은 자리를 채워요. */}
        <div
          id={panelId("preview")}
          role={tabs ? "tabpanel" : undefined}
          aria-labelledby={tabs ? tabId("preview") : undefined}
          tabIndex={tabs ? 0 : undefined}
          hidden={tabs && view !== "preview"}
          className={`grid content-start gap-2 lg:grid-rows-[auto_minmax(0,1fr)] lg:content-stretch ${view === "preview" ? "" : "max-lg:hidden"}`}
        >
          {/* 이름표: 넓은 화면에서만 보여요(좁은 화면은 탭 이름이 같은 일을 해요). 본문 칸 이름표와 같은 모양이에요. */}
          <p id={previewLabelId} className="glow max-lg:hidden">
            미리 보기
          </p>
          {/* relative: 넓은 화면에서 안쪽 상자를 이 칸에 꽉 맞춰 놓는 기준이에요. */}
          <div className="relative">
            {/* 넓은 화면: 쓰기 칸과 높이를 맞추고(absolute inset-0) 넘치면 안에서 스크롤해요.
                스크롤 영역은 키보드로도 스크롤할 수 있게 초점을 받고(tabIndex 0), "미리 보기"라는 이름을 가진 영역이에요.
                좁은 화면: 글 길이만큼 늘어나고(최소 15rem), 탭 내용(tabpanel)이 초점을 받아요. */}
            <div
              role={tabs ? undefined : "region"}
              aria-labelledby={tabs ? undefined : previewLabelId}
              tabIndex={tabs ? undefined : 0}
              className="min-h-60 border-2 border-crt-line p-4 lg:absolute lg:inset-0 lg:min-h-0 lg:overflow-y-auto"
            >
              {preview}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
