/**
 * @file 자동완성 검색창 (search-box.tsx)
 *
 * 이 파일이 하는 일
 *   검색창에 글자를 치면 바로 아래에 추천 검색어 층(레이어)을 띄워요.
 *
 *     [겨울______________] [찾기]
 *     ┌──────────────────────┐
 *     │ 겨울 정류장     제목  │ ← ▲ ▼로 고르고 Enter, 또는 눌러서 바로 찾기
 *     │ 겨울나기        원제  │
 *     └──────────────────────┘
 *
 *   추천은 리뷰의 제목·원제·감독에서 찾아요(lib/browse.ts의 suggest). 서버에 묻지 않아서 바로 떠요.
 *
 * 키보드 (WAI-ARIA APG의 "콤보박스 + 목록 상자" 패턴)
 *   ▼        : 추천 층을 열고, 다음 추천으로
 *   ▲        : 이전 추천으로
 *   Enter    : 고른 추천으로 바로 찾기. 고른 추천이 없으면 친 글자 그대로 찾기(폼 제출)
 *   Esc      : 추천 층 닫기
 *   초점은 늘 검색창에 있어요. 고른 추천은 aria-activedescendant로 화면 낭독기에 알려 줘요.
 *
 * 접근성 포인트
 *   - <input role="combobox" aria-expanded aria-controls aria-autocomplete="list">
 *   - 추천 층은 <ul role="listbox">, 추천 하나는 <li role="option" aria-selected>
 *   - 닫힌 층은 hidden으로 숨겨요(화면에도, 화면 낭독기에도 나오지 않아요).
 *
 * 누가 쓰나요?
 *   components/review-browser.tsx(처음 화면 검색 영역)
 */

"use client";

import { type KeyboardEvent, type RefObject, useMemo, useState } from "react";

import { suggest, type Suggestion } from "@/lib/browse";
import type { ReviewSummary } from "@/lib/review";

/** SearchBox가 받는 값 */
type Props = {
  /** 검색창의 id. 바깥의 <label htmlFor>와 연결돼요. 추천 층의 id도 이 값으로 만들어요. */
  id: string;
  /** 검색창에 지금 쳐 둔 글자 */
  value: string;
  /** 글자가 바뀌면 부르는 함수 */
  onValueChange: (value: string) => void;
  /** 추천을 고르면 그 글자로 바로 찾으라고 부르는 함수 */
  onSearch: (q: string) => void;
  /** 추천을 만들 전체 리뷰 */
  reviews: readonly ReviewSummary[];
  /** true면 사용할 수 없게(미리 만든 HTML) */
  disabled?: boolean;
  /** 검색창 손잡이. "검색 조건 지우기" 뒤에 바깥에서 초점을 옮길 때 써요. */
  inputRef?: RefObject<HTMLInputElement | null>;
};

/** 자동완성 검색창 */
export function SearchBox({ id, value, onValueChange, onSearch, reviews, disabled = false, inputRef }: Props) {
  // 추천 층을 열어 두었는지(글자를 치거나 ▼를 누르면 열고, Esc·초점 떠남·고르기로 닫아요)
  const [open, setOpen] = useState(false);
  // 고른(밝게 표시한) 추천의 번호. 아무것도 고르지 않았으면 -1
  const [active, setActive] = useState(-1);

  // 친 글자로 만든 추천 목록. 글자나 리뷰가 바뀔 때만 다시 계산해요(useMemo).
  const suggestions = useMemo(() => suggest(reviews, value), [reviews, value]);
  // 추천 층이 실제로 보이는지: 열려 있고 추천이 하나 이상일 때
  const expanded = open && suggestions.length > 0;

  // 추천 층과 추천 하나하나의 id(aria-controls, aria-activedescendant가 가리켜요)
  const listboxId = `${id}-suggestions`;
  const optionId = (index: number) => `${id}-option-${index}`;

  /** 추천 하나를 골라 바로 찾아요. */
  function choose(suggestion: Suggestion) {
    onValueChange(suggestion.value);
    setOpen(false);
    setActive(-1);
    onSearch(suggestion.value);
  }

  /** 검색창에서 키를 누르면 실행돼요. 처리한 키는 preventDefault로 브라우저의 원래 동작(커서 이동 등)을 막아요. */
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // 한글을 조합하는 중에 누른 키는 입력기(IME)가 먼저 써요. 건드리지 않아요.
    if (event.nativeEvent.isComposing) return;
    const count = suggestions.length;

    switch (event.key) {
      case "ArrowDown":
        if (count === 0) return;
        event.preventDefault();
        // 닫혀 있으면 열고 첫 추천을, 열려 있으면 다음 추천을 골라요(끝에서는 처음으로 돌아가요).
        if (!expanded) {
          setOpen(true);
          setActive(0);
        } else {
          setActive((index) => (index + 1) % count);
        }
        return;
      case "ArrowUp":
        if (!expanded) return;
        event.preventDefault();
        // 이전 추천으로(처음에서는 끝으로 돌아가요).
        setActive((index) => (index <= 0 ? count - 1 : index - 1));
        return;
      case "Enter":
        // 고른 추천이 있으면 그 추천으로 찾아요. 폼 제출(친 글자 그대로 찾기)은 막아요.
        if (expanded && active >= 0) {
          event.preventDefault();
          choose(suggestions[active]!);
        }
        return;
      case "Escape":
        // 추천 층이 열려 있으면 닫기만 해요. preventDefault: 검색창의 기본 동작(글자 지우기)도 막아요.
        if (expanded) {
          event.preventDefault();
          setOpen(false);
          setActive(-1);
        }
        return;
    }
  }

  return (
    // relative: 추천 층(absolute)이 이 상자 바로 아래에 붙도록 기준을 잡아요.
    // flex-1 basis-40: 남는 너비를 쓰고, 좁으면 "찾기" 단추가 다음 줄로 내려가요.
    <div className="relative min-w-0 flex-1 basis-40">
      <input
        ref={inputRef}
        id={id}
        // type="search": 휴대폰 자판에 "검색" 단추가 나오고, 검색 입력란이라는 뜻을 브라우저가 알아요.
        type="search"
        name="q"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listboxId}
        // 고른 추천이 있으면 그 추천의 id. 초점은 검색창에 둔 채로 화면 낭독기가 고른 추천을 읽어 줘요.
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        // 안내 글자: 좁은 검색 칸에도 다 들어가는 흔한 문구예요. 무엇을 찾는지는 "검색" 이름표와 추천 층이 알려 줘요.
        placeholder="검색어를 입력하세요"
        disabled={disabled}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          // 글자가 바뀌면 추천 층을 다시 열고, 고른 추천은 풀어요.
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={handleKeyDown}
        // 초점이 떠나면(Tab 등) 추천 층을 닫아요.
        onBlur={() => {
          setOpen(false);
          setActive(-1);
        }}
        // 브라우저가 예전에 쓴 글자를 따로 띄우지 않게 해요(우리 추천 층과 겹치지 않게).
        autoComplete="off"
        enterKeyHint="search"
        // 맞춤법 검사 빨간 줄을 꺼요(영화 제목은 고유명사가 많아요).
        spellCheck={false}
        // field: 글쓰기 화면의 입력 칸(원제·출연 등)과 같은 모양이에요(globals.css). 높이 44px, 2px 테두리,
        //   초점이 오면 테두리가 밝아져요.
        // placeholder:text-crt-dim: 안내 글자는 보조 글자색(바탕과의 명도 대비 10:1 이상)으로 또렷하게 보여요.
        className="field w-full caret-crt-fg placeholder:text-crt-dim"
      />

      {/* 추천 층. 닫혀 있으면 hidden으로 숨기지만 요소는 남겨 둬서 aria-controls가 늘 가리킬 수 있어요. */}
      <ul id={listboxId} role="listbox" aria-label="추천 검색어" hidden={!expanded} className="search-suggestions">
        {suggestions.map((suggestion, index) => (
          // 추천 하나. 마우스로 누르면 바로 찾아요.
          // onMouseDown의 preventDefault: 누르는 순간 검색창 초점이 떠나 층이 닫히는 것을 막아요(그래야 onClick까지 가요).
          // 키보드는 검색창이 맡아서(위의 handleKeyDown) 추천 하나하나는 초점을 받지 않아요. 그래서 키 처리 규칙을 꺼 둬요.
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events
          <li
            key={`${suggestion.kind}-${suggestion.value}`}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(suggestion)}
            className="search-option"
          >
            <span className="min-w-0">{suggestion.value}</span>
            {/* 무엇의 이름인지(제목·원제·감독·출연). 화면 낭독기도 "겨울 정류장 제목"처럼 함께 읽어요.
                {" "}: 두 글자 사이의 띄어쓰기. 없으면 이름이 "겨울 정류장제목"처럼 붙어 읽혀요. */}{" "}
            <span className="shrink-0 text-crt-dim">{suggestion.kind}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
