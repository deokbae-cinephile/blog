/**
 * @file 칩 모양 고르기 단추 (choice-chips.tsx)
 *
 * 이 파일이 하는 일
 *   여러 개 중에서 고르는 "단추 묶음"을 단말기 칩 모양으로 그려요.
 *
 *     장르   [▶전체 15편] [드라마 5편] [코미디 2편] ...
 *     정렬   [▶최신순] [평점순]
 *
 * 맡은 기능
 *   - ChoiceGroup: 묶음 이름(legend)과 칩들을 놓아요(<fieldset>).
 *   - Choice: 칩 하나. 진짜 단추(라디오 또는 체크박스)를 투명하게 덮어 두어,
 *     키보드로 고르기·화면 낭독기 읽기를 브라우저가 그대로 해 줘요.
 *       radio   : 하나만 고르기(장르 필터, 정렬)
 *       checkbox: 여러 개 고르기(글쓰기 화면의 장르)
 *
 * 누가 쓰나요?
 *   components/review-browser.tsx(장르·정렬), components/review-writer.tsx(리뷰 장르)
 */

import type { ReactNode } from "react";

/** ChoiceGroup이 받는 값 */
type GroupProps = {
  /** 묶음 이름. 화면 낭독기는 칩에 초점이 오면 "장르, 그룹"처럼 이 이름을 먼저 알려 줘요. */
  legend: ReactNode;
  /** true면 묶음 안의 단추를 모두 사용할 수 없게 해요(미리 만든 HTML에서 써요). 기본 false */
  disabled?: boolean;
  /**
   * 이름과 칩의 놓는 방법
   *   - "side"(기본): 640px 이상 화면에서 왼쪽 칸(4rem)에 이름, 오른쪽에 칩
   *   - "aside": 위와 같지만, 1024px 이상에서는 목록 옆의 좁은 검색 칸에 놓이므로 이름을 칩 위로 올려요
   */
  layout?: "side" | "aside";
  /** 묶음 설명(오류 문구 등)의 id. 화면 낭독기가 묶음에 들어갈 때 함께 읽어 줘요. */
  describedBy?: string;
  /** 칩들(Choice) */
  children: ReactNode;
};

/**
 * 고르기 단추 묶음
 *
 * <fieldset>은 관련된 입력들을 한 묶음으로, <legend>는 그 묶음의 이름이에요.
 */
export function ChoiceGroup({ legend, disabled = false, layout = "side", describedBy, children }: GroupProps) {
  // Tailwind는 클래스 이름을 코드에서 글자 그대로 찾아 만들기 때문에, 두 경우를 통째로 적어 둬요.
  // gap-x-4: 이름 칸과 칩 사이 간격. 검색 칸(review-browser.tsx)도 같은 간격을 써서 세 줄이 가지런해요.
  const columns =
    layout === "aside" ? "sm:grid-cols-[4rem_minmax(0,1fr)] lg:grid-cols-1" : "sm:grid-cols-[4rem_minmax(0,1fr)]";

  return (
    // disabled를 <fieldset>에 주면 그 안의 단추가 모두 사용할 수 없게 돼요(HTML 기본 기능).
    <fieldset disabled={disabled} aria-describedby={describedBy} className={`grid gap-x-4 gap-y-2 ${columns}`}>
      {/* float-left: legend는 원래 fieldset 테두리 위에 특별하게 그려지는데, float를 주면 보통 칸처럼 배치할 수 있어요. */}
      <legend className="glow float-left sm:mt-2">{legend}</legend>
      {/* items-start: 칩이 줄 높이만큼 세로로 늘어나지 않고 제 키를 지켜요. */}
      <div className="flex flex-wrap items-start gap-2">{children}</div>
    </fieldset>
  );
}

/** Choice가 받는 값 */
type ChoiceProps = {
  /** 같은 묶음끼리 같은 이름을 써요. 라디오 단추는 이름이 같은 것 중 하나만 고를 수 있어요. */
  name: string;
  /** 단추 종류. radio(하나만) 또는 checkbox(여러 개). 기본 radio */
  type?: "radio" | "checkbox";
  /** 골라져 있는지 */
  checked: boolean;
  /** 고르거나 풀었을 때 실행할 함수 */
  onChange: () => void;
  /** 진짜 단추의 id. 오류가 났을 때 첫 칩으로 초점을 옮기려고 붙여요(없어도 돼요). */
  id?: string;
  /** 단추에 보일 내용 */
  children: ReactNode;
};

/**
 * 칩 모양 고르기 단추 하나
 *
 * 진짜 단추(<input type="radio|checkbox">)를 투명하게 칩 위에 덮어 두었어요(globals.css의 .chip).
 * 겉모습은 칩이지만 키보드로 고르기, 화면 낭독기 읽기 같은 단추 기능은 그대로 써요.
 * 직접 만든 가짜 단추보다 진짜 단추를 꾸미는 쪽이 훨씬 안전합니다.
 */
export function Choice({ name, type = "radio", checked, onChange, id, children }: ChoiceProps) {
  return (
    // <label>로 감싸면 칩 어디를 눌러도 안의 단추가 골라져요. 칩의 글자가 단추 이름이 돼요.
    <label className="chip">
      <input id={id} type={type} name={name} checked={checked} onChange={onChange} />
      <span className="chip-face">
        {/* 고른 칩에만 보이는 ▶ 표시. 색만으로 구분하지 않게 모양으로도 알려 줘요. 꾸밈이라 읽지 않아요.
            고르지 않은 칩에서는 자리도 차지하지 않아서(globals.css), 글자 왼쪽이 비지 않아요. */}
        <span aria-hidden="true" className="chip-mark">
          ▶
        </span>
        {children}
      </span>
    </label>
  );
}
