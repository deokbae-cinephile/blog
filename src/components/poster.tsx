/**
 * @file 영화 포스터 (poster.tsx)
 *
 * 이 파일이 하는 일
 *   리뷰의 포스터 이미지를 "형광 초록 CRT 화면"에 맞게 바꿔 보여 줍니다.
 *   포스터를 올리지 않은 리뷰는 기본 포스터(필름 그림 + NO POSTER)를 대신 보여 줘요.
 *
 * 어떻게 초록으로 바뀌나요?
 *   원본 이미지 파일은 그대로 두고, 화면에 그릴 때만 CSS 필터(filter: url(#crt-phosphor))를 씌워요.
 *   필터는 app/layout.tsx에 넣어 둔 SVG 필터예요. 이런 순서로 색을 바꿉니다.
 *     1. 흑백으로 바꾸기(밝기만 남기기)
 *     2. 밝기를 4단계로 줄이기(옛 화면처럼 계단진 명암)
 *     3. 밝기를 형광 초록으로 칠하기
 *   그 위에 촘촘한 주사선 무늬를 덮어 브라운관 느낌을 더해요(globals.css의 .poster-frame).
 *
 * 비율은 늘 가로 2 : 세로 3이에요
 *   상자를 2:3으로 고정하고(aspect-[2/3]) 그림을 꽉 채워요(object-cover). 비율이 다른 그림은 가운데를 기준으로 잘려요.
 *
 * 크기 두 가지
 *   - thumb: 목록의 썸네일(꾸밈). 바로 옆에 제목이 있어 화면 낭독기가 같은 말을 두 번 읽지 않게 alt를 비워요.
 *   - large: 상세 화면의 큰 포스터(내용). "영화 ‘겨울 정류장’ 포스터" 같은 대체 텍스트를 읽어 줘요.
 *     넓은 화면에서는 상세 화면 왼쪽 칸 너비에 맞춰 커져요.
 *
 * 누가 쓰나요?
 *   components/review-list-item.tsx(썸네일), components/review-article.tsx(큰 포스터)
 */

// next/image: Next.js의 이미지 컴포넌트. 화면 크기에 맞게 줄인 파일을 받고(최적화), 화면에 가까워질 때 받아요(lazy).
import Image from "next/image";

import { PixelArt } from "./pixel-art";

/** 기본 포스터 가운데에 그리는 필름 조각 픽셀 그림(양옆에 구멍이 뚫린 필름 한 칸) */
const EMPTY_FILM = [
  "#.########.#",
  "############",
  "#.#......#.#",
  "###......###",
  "#.#......#.#",
  "###......###",
  "#.#......#.#",
  "############",
  "#.########.#",
] as const;

/** Poster가 받는 값 */
type Props = {
  /** 포스터 주소(예: "/posters/winter-stop.jpg"). 없으면 기본 포스터를 보여 줘요. */
  src?: string;
  /** 대체 텍스트. 꾸밈 그림이면 빈 글자("")를 줘요. 기본 포스터일 때도 이 글자를 읽어요. */
  alt: string;
  /** thumb(목록 썸네일) 또는 large(상세 화면) */
  size: "thumb" | "large";
  /** 첫 화면에 바로 보이는 큰 포스터라면 true. 브라우저가 먼저 받아 화면이 빨리 완성돼요. */
  preload?: boolean;
  /** 바깥에서 더할 CSS 클래스 */
  className?: string;
};

/** 형광 초록으로 바꿔 보이는 포스터 */
export function Poster({ src, alt, size, preload = false, className = "" }: Props) {
  // 크기별 너비. 높이는 포스터 비율(가로 2 : 세로 3)로 정해져요(aspect-[2/3]).
  //  - thumb: 휴대폰 3.5rem(56px), 넓은 화면 4rem(64px). 목록 한 편의 글 세 줄(제목·정보·한줄평) 높이에 맞춰요.
  //  - large의 lg:w-full: 넓은 화면(1024px~)의 상세 화면에서는 왼쪽 칸(16~18rem)을 꽉 채워요.
  const width = size === "thumb" ? "w-14 sm:w-16" : "w-48 sm:w-56 lg:w-full";

  return (
    // relative: 안의 이미지를 상자 크기에 꽉 채우기(fill) 위한 기준이에요.
    // poster-frame: 어두운 바탕 + 테두리 + 주사선 무늬(globals.css)
    <span className={`poster-frame relative block aspect-[2/3] shrink-0 ${width} ${className}`}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          // fill: 부모 상자(relative) 크기에 맞춰 꽉 채워요. 너비·높이를 따로 몰라도 돼요.
          fill
          // sizes: 화면에 그려질 실제 크기 힌트. Next.js가 이 크기에 맞게 줄인 파일을 골라 줘서 썸네일이 가벼워요.
          sizes={size === "thumb" ? "64px" : "(min-width: 1024px) 288px, 224px"}
          preload={preload}
          // object-cover: 비율이 조금 달라도 상자를 꽉 채우고 넘치는 부분을 잘라요.
          // poster-image: 형광 초록 필터(globals.css)
          className="poster-image object-cover"
        />
      ) : (
        <DefaultPoster alt={alt} size={size} />
      )}
    </span>
  );
}

/**
 * 기본 포스터: 포스터를 올리지 않은 리뷰에 보여 줘요.
 * 가운데에 빈 필름 그림과 "NO POSTER" 글자를 둔, 포스터 비율(2:3)의 상자예요.
 *
 * 접근성: 대체 텍스트(alt)가 있으면 role="img"로 "그림 하나"라고 알리고 그 글자를 읽어요.
 * alt가 비어 있으면(목록 썸네일) 꾸밈이라 화면 낭독기에서 통째로 숨겨요.
 */
function DefaultPoster({ alt, size }: { alt: string; size: Props["size"] }) {
  // 읽어 줄 글자가 있을 때와 없을 때의 속성. 상세 화면은 "포스터 없음"이라고 알려 줘요.
  const a11y = alt ? { role: "img", "aria-label": `${alt}(포스터 없음)` } : { "aria-hidden": true };

  return (
    // grid h-full place-content-center: 상자 가운데에 필름 그림과 글자를 세로로 쌓아요.
    // text-crt-line: 어두운 초록. 기본 포스터라는 것이 실제 포스터보다 덜 눈에 띄게 해요.
    <span {...a11y} className="grid h-full place-content-center justify-items-center gap-2 text-crt-line">
      {/* 썸네일은 작아서 칸 하나를 2px, 큰 포스터는 5px로 그려요. */}
      <PixelArt rows={EMPTY_FILM} cell={size === "thumb" ? 2 : 5} />
      {/* 큰 포스터에만 글자를 넣어요(썸네일에는 자리가 좁아요). 글자는 위의 role="img" 이름이 대신 읽어 줘요. */}
      {size === "large" && (
        <span aria-hidden="true" className="text-crt-dim">
          NO POSTER
        </span>
      )}
    </span>
  );
}
