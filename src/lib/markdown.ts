/**
 * @file 원고 본문(Markdown)을 HTML로 바꾸기 (markdown.ts)
 *
 * 이 파일이 하는 일
 *   리뷰 원고의 본문(Markdown 글)을 웹 브라우저가 보여 줄 수 있는 HTML로 바꿉니다.
 *   예: "## 좋았던 점" → "<h2>좋았던 점</h2>"
 *
 * 맡은 기능
 *   1. Markdown 기본 문법과 GitHub식 확장 문법(표, 각주, 취소선)을 HTML로 바꾸기
 *   2. 본문 제목 높이 맞추기: 화면의 h1은 영화 제목 하나뿐이라, 본문의 가장 큰 제목을 h2로 맞춰요.
 *   3. 사진만 있는 문단을 "사진 액자(figure)"로 바꾸기. 사진 > 글 > 사진 > 사진 > 글처럼 섞어 쓸 수 있어요.
 *   4. 바깥 링크 보안 설정, 이미지 늦게 받기, 표를 가로 스크롤 영역으로 감싸기
 *   5. 본문의 사진 목록 찾기(findImages). 원고 검사(lib/load-reviews.ts)와 저장 API(lib/review-form.ts)가
 *      사진 파일과 설명을 확인할 때 써요.
 *
 * unified가 뭔가요?
 *   글을 "나무 구조(트리)"로 바꿔 차례차례 손본 뒤 다시 글로 내보내는 도구예요. 공장 컨베이어 벨트처럼
 *   `.use(도구)`를 이어 붙이면 위에서부터 순서대로 일을 합니다.
 *
 *     Markdown 글
 *       → remark-parse      : Markdown을 Markdown 나무(mdast)로
 *       → remark-gfm        : 표·각주 같은 GitHub식 문법도 알아듣게
 *       → (우리 도구) 제목 높이 맞추기
 *       → remark-rehype     : Markdown 나무를 HTML 나무(hast)로
 *       → (우리 도구) 사진 액자 만들기
 *       → (우리 도구) 바깥 링크·이미지·표 손보기
 *       → rehype-stringify  : HTML 나무를 HTML 글자로
 *
 * 누가 쓰나요?
 *   lib/load-reviews.ts가 원고를 읽을 때 본문을 이 함수로 바꿉니다. 빌드할 때 한 번만 돌아가요.
 *   (그래서 이 변환 도구들은 방문자의 브라우저로 가지 않아요. 화면이 가벼운 이유 중 하나예요.)
 */

import type { Element, ElementContent, Root as HastRoot } from "hast";
import type { Root as MdastRoot } from "mdast";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { SKIP, visit } from "unist-util-visit";

/** 사진 한 장의 크기(px). 가로(width)와 세로(height) */
export type ImageSize = { width: number; height: number };

/** 본문에 넣은 사진 하나: 주소(src)와 설명(alt) */
export type BodyImage = { src: string; alt: string };

/**
 * 사진 크기 표. "사진 주소 → 크기"를 짝지어 둔 Map이에요.
 * 원고 검사(lib/load-reviews.ts)가 사진 파일을 열어 크기를 재고, 이 표를 renderMarkdown에 넘겨줘요.
 * ReadonlyMap: 읽기만 하는 Map이라는 뜻이에요. 이 파일은 표를 고치지 않아요.
 */
export type ImageSizes = ReadonlyMap<string, ImageSize>;

/**
 * [우리 도구 1] 본문의 가장 큰 제목을 h2로 맞춥니다.
 *
 * 왜 필요할까요?
 *   한 페이지에서 h1(가장 큰 제목)은 영화 제목 하나여야 화면 낭독기 사용자가 구조를 이해하기 쉬워요.
 *   그런데 글쓴이가 본문에 "# 소제목"(h1)을 쓸 수도 있죠. 그래서 본문 제목 전체를 한 단계씩 내려 줍니다.
 *   반대로 "### 소제목"부터 썼다면 h2로 올려 줘요. 제목끼리의 높낮이 차이는 그대로 유지합니다.
 *
 * unified 도구는 "함수를 돌려주는 함수"예요. 돌려준 함수가 나무(tree)를 받아 손봅니다.
 */
function remarkNormalizeHeadings() {
  return (tree: MdastRoot) => {
    // 1단계: 본문에서 가장 큰 제목(가장 작은 depth)을 찾아요. depth 1이 #, 2가 ## 입니다.
    let top = 7; // 제목이 하나도 없으면 7로 남아요(제목 단계는 최대 6).
    // visit(나무, "heading", 할 일)은 나무 안의 모든 제목 마디를 하나씩 방문하며 "할 일"을 실행해요.
    visit(tree, "heading", (node) => {
      top = Math.min(top, node.depth);
    });

    // 제목이 없으면 할 일이 없어요.
    if (top > 6) return;

    // 2단계: 가장 큰 제목이 depth 2(h2)가 되도록 얼마나 옮길지 정해요. 예: top이 1이면 +1, 3이면 -1
    const shift = 2 - top;
    visit(tree, "heading", (node) => {
      // 옮긴 결과가 6을 넘지 않게 Math.min으로 막아요.
      // `as typeof node.depth`는 "이 숫자는 1~6 중 하나예요"라고 TypeScript에 알려 주는 표시입니다.
      node.depth = Math.min(6, node.depth + shift) as typeof node.depth;
    });
  };
}

/**
 * [우리 도구 2] 사진만 있는 문단을 "사진 액자(figure)"로 바꿉니다.
 *
 * 원고에 이렇게 쓰면 (따옴표 안의 글은 사진 아래 설명이 돼요)
 *
 *   ![영사실 창으로 새어 나오는 빛](/images/before-the-last-reel/booth.jpg "사십 년 동안 돌아간 영사기")
 *
 * 이런 HTML이 돼요.
 *
 *   <figure class="photo">                       ← 사진과 설명을 한 덩어리로 묶는 태그
 *     <div class="photo-frame">                  ← 형광 초록 액자와 주사선(globals.css)
 *       <img class="photo-image" ...>            ← 원본 파일 그대로. 화면에서만 형광 초록 4단계 명암으로 보여요(SVG 필터)
 *     </div>
 *     <figcaption>사십 년 동안 돌아간 영사기</figcaption>  ← 사진 설명(캡션)
 *   </figure>
 *
 * 한 문단에 사진을 여러 장 붙여 쓰면(빈 줄 없이 다음 줄에) 나란히 놓는 상자(div.photo-row)로 묶어요.
 * 빈 줄로 띄우면 문단이 나뉘어 위아래로 놓여요.
 * 글과 사진이 한 문단에 섞여 있으면 바꾸지 않아요(글 속의 작은 그림으로 둬요).
 *
 * 사진 크기를 알면(imageSizes) <img>에 width·height를 달아요.
 * 그러면 브라우저가 사진이 도착하기 전에 자리를 미리 비워 둬서, 사진이 늦게 와도 글이 밀려 흔들리지 않아요.
 *
 * @param options.imageSizes 사진 크기 표(주소 → 크기)
 */
function rehypePhotos({ imageSizes }: { imageSizes: ImageSizes }) {
  return (tree: HastRoot) => {
    // [1번째 방문] 모든 <img>에 크기를 달아요. 크기 표의 열쇠는 원고에 적은 사진 주소예요.
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "img") return;
      const size = imageSizes.get(String(node.properties.src));
      if (size) {
        node.properties.width = size.width;
        node.properties.height = size.height;
      }
    });

    // [2번째 방문] 사진만 있는 문단(<p>)을 액자로 바꿔요.
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "p" || !parent || index === undefined) return;

      // 문단 안의 사진들. filter(isImage): 사진만 골라요.
      const images = node.children.filter(isImage);
      // 문단이 "사진과 빈칸(줄바꿈)"으로만 되어 있는지. every: 모든 칸이 조건을 만족하면 true예요.
      const onlyImages = node.children.every((child) => isImage(child) || (child.type === "text" && child.value.trim() === ""));
      if (images.length === 0 || !onlyImages) return;

      // 사진마다 액자(figure)를 만들고, 한 장이면 그대로, 여러 장이면 나란히 놓는 상자로 묶어요.
      const figures = images.map(toFigure);
      parent.children[index] =
        figures.length === 1 ? figures[0]! : { type: "element", tagName: "div", properties: { className: ["photo-row"] }, children: figures };
      // 방금 바꿔 넣은 액자 안쪽은 다시 방문하지 않고 다음 자리로 넘어가요(표 감싸기와 같은 요령).
      return [SKIP, index + 1];
    });
  };
}

/**
 * HTML 나무의 한 칸이 <img>인지 알려 줘요.
 * `node is Element`(타입 가드): true를 돌려주면 TypeScript가 "이 칸은 Element"라고 알아들어요.
 */
function isImage(node: ElementContent): node is Element {
  return node.type === "element" && node.tagName === "img";
}

/**
 * <img> 하나를 사진 액자(figure)로 감싸요.
 *
 * - 사진 설명(title, 원고에서 따옴표 안의 글)은 <figcaption>으로 옮기고, img의 title은 지워요.
 *   (그대로 두면 마우스를 올렸을 때 같은 글이 말풍선으로 또 나오고, 화면 낭독기도 두 번 읽어요.)
 * - 크기를 알면 figure에 CSS 변수로 비율과 너비를 적어 둬요. 세로로 긴 사진이 화면보다 커지지 않게 할 때 써요(globals.css).
 */
function toFigure(image: Element): Element {
  const { title, width, height } = image.properties;
  delete image.properties.title;
  image.properties.className = ["photo-image"];

  // 사진을 액자(div.photo-frame)에 넣어요. 액자가 테두리와 주사선 무늬를 그려 줘요.
  const children: ElementContent[] = [{ type: "element", tagName: "div", properties: { className: ["photo-frame"] }, children: [image] }];
  if (typeof title === "string" && title.trim() !== "") {
    children.push({ type: "element", tagName: "figcaption", properties: {}, children: [{ type: "text", value: title }] });
  }

  // --photo-ratio: 가로 ÷ 세로(예: 1280×720 → 1.7778), --photo-width: 원본 가로 크기(이보다 크게 늘리지 않으려고요)
  const style =
    typeof width === "number" && typeof height === "number"
      ? `--photo-ratio: ${(width / height).toFixed(4)}; --photo-width: ${width}px`
      : undefined;

  return { type: "element", tagName: "figure", properties: { className: ["photo"], style }, children };
}

/** 링크 주소로 받아 주는 방식(scheme). 사이트 안 주소(/, #, ./, ../)는 방식이 없어서 따로 받아 줘요. */
const SAFE_SCHEMES = new Set(["http", "https", "mailto"]);

/**
 * 링크로 남겨도 안전한 주소인지 확인해요.
 *
 * "javascript:alert(1)" 같은 주소를 링크로 두면, 독자가 누르는 순간 우리 블로그에서 스크립트가 돌아요(XSS).
 * 그래서 http·https·mailto와 사이트 안 주소만 받아요.
 * 주소 해석기는 탭·줄바꿈·공백을 지우고 읽어서("java\tscript:"도 javascript:가 돼요), 그것들을 지운 뒤 판단해요.
 */
export function isSafeHref(href: string): boolean {
  const value = href.replace(/[\u0000- \u007f]/g, "");
  // "글자:" 모양으로 시작하면 방식(scheme)이 있는 주소예요. 예: javascript:, data:, https:
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  return !scheme || SAFE_SCHEMES.has(scheme[1]!.toLowerCase());
}

/**
 * [우리 도구 3] HTML 나무를 손봅니다.
 *
 * - 위험한 방식의 링크(javascript: 등)는 주소를 지우고 글자만 남겨요(isSafeHref).
 * - 바깥 링크에는 rel="noopener noreferrer"를 달아, 열린 사이트가 우리 페이지를 조작하지 못하게 해요.
 * - 이미지는 loading="lazy"로 화면에 가까워질 때 받아 첫 화면을 빠르게 해요.
 * - 표는 좁은 화면에서 넘치지 않게 가로 스크롤 영역으로 감싸요. 키보드 사용자도 스크롤할 수 있게
 *   tabindex="0"(초점 받기)과 이름(aria-label)을 붙입니다.
 */
function rehypeSiteContent() {
  return (tree: HastRoot) => {
    // 일을 두 번에 나눠 방문해요.
    //  1번째: 모든 요소(표 안의 링크·이미지까지)의 주소와 속성을 손봐요.
    //  2번째: 표를 상자로 감싸요. 감싼 뒤에는 그 안을 다시 방문하지 않아서(SKIP),
    //         한 번에 같이 하면 표 안의 링크·이미지를 건너뛰게 되거든요.

    // [1번째 방문] HTML 나무의 모든 요소(element)를 방문해요.
    visit(tree, "element", (node: Element) => {
      // 위험한 방식의 링크는 주소(href)를 지워요. <a>는 남아서 글자는 그대로 보이지만 누를 수는 없어요.
      if (node.tagName === "a" && typeof node.properties.href === "string" && !isSafeHref(node.properties.href)) {
        delete node.properties.href;
      }

      // <a>이면서 http:// 또는 https://로 시작하는 바깥 링크라면 rel을 달아요.
      // /^https?:\/\//는 정규식이에요. "http"로 시작하고 s는 있어도 없어도 되며(?) 뒤에 "://"가 오는 글자를 찾습니다.
      if (node.tagName === "a" && typeof node.properties.href === "string" && /^https?:\/\//.test(node.properties.href)) {
        node.properties.rel = ["noopener", "noreferrer"];
      }

      // 이미지는 늦게 받고(lazy), 그리는 일을 따로 처리하게(async) 합니다.
      if (node.tagName === "img") {
        node.properties.loading = "lazy";
        node.properties.decoding = "async";
      }
    });

    // [2번째 방문] 표를 가로 스크롤 상자로 감싸요.
    // 표가 여러 개면 "표 1", "표 2"처럼 서로 다른 이름을 붙이려고 셉니다.
    let tables = 0;
    // index는 부모 안에서 몇 번째인지, parent는 부모 요소예요.
    visit(tree, "element", (node: Element, index, parent) => {
      // <table>을 만나면 <div class="table-scroll" role="region" ...>으로 감싸요.
      if (node.tagName === "table" && parent && index !== undefined) {
        tables += 1;
        // 새 상자(div)를 만들고 그 안(children)에 원래 표를 넣습니다.
        const wrapper: ElementContent = {
          type: "element",
          tagName: "div",
          properties: { className: ["table-scroll"], role: "region", ariaLabel: `표 ${tables}`, tabIndex: 0 },
          children: [node],
        };
        // 부모의 index번째 자리를 원래 표 대신 새 상자로 바꿔 끼워요.
        parent.children[index] = wrapper;
        // [SKIP, index + 1]: 방금 넣은 상자 안쪽은 다시 방문하지 말고 다음 자리로 넘어가라는 뜻이에요.
        // (안 그러면 상자 안의 표를 또 만나 상자를 끝없이 씌우게 됩니다.)
        return [SKIP, index + 1];
      }
    });
  };
}

/**
 * 변환 공장(processor)을 만듭니다.
 * `.use(도구, 설정)` 순서가 곧 작업 순서예요(파일 맨 위 설명 참고).
 *
 * 원고마다 사진 크기 표가 달라서, 원고를 바꿀 때마다 공장을 새로 만들어요(만드는 데 드는 시간은 아주 짧아요).
 *
 * @param imageSizes 이 원고의 사진 크기 표
 */
function createProcessor(imageSizes: ImageSizes) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkNormalizeHeadings)
    .use(remarkRehype, {
      // 각주 영역의 제목과 "돌아가기" 링크 이름을 한국어로 바꿔요(기본값은 영어 Footnotes).
      footnoteLabel: "각주",
      footnoteBackLabel: (referenceIndex) => `${referenceIndex + 1}번 각주를 단 곳으로 돌아가기`,
    })
    .use(rehypePhotos, { imageSizes })
    .use(rehypeSiteContent)
    .use(rehypeStringify);
}

/**
 * 원고 본문(Markdown)을 HTML 글자로 바꿉니다.
 *
 * 보안 메모: 원고 안에 HTML 태그를 직접 쓰면 옮기지 않고 버려요(remark-rehype의 기본 동작).
 * 실수로 <script> 같은 태그가 들어가도 화면에 나가지 않습니다.
 *
 * `async`/`await`: 변환은 시간이 걸릴 수 있는 일이라 "기다렸다가 결과를 받는" 비동기 함수로 만들었어요.
 *
 * @param markdown 원고 본문 글자
 * @param options.imageSizes 사진 크기 표(주소 → 크기). 주면 사진에 width·height를 달아요. 기본은 빈 표
 * @returns HTML 글자
 * @example
 * await renderMarkdown("**굵게**"); // "<p><strong>굵게</strong></p>"
 */
export async function renderMarkdown(markdown: string, { imageSizes = new Map() }: { imageSizes?: ImageSizes } = {}): Promise<string> {
  // process()의 결과는 "가상 파일(VFile)"이라 String(...)으로 글자만 꺼냅니다.
  return String(await createProcessor(imageSizes).process(markdown));
}

/**
 * Markdown을 HTML 나무(hast)로만 바꾸는 작은 공장이에요. 사진 찾기(findImages)에 써요.
 * renderMarkdown과 같은 도구(remark-rehype)로 바꾸기 때문에, 찾은 사진 주소가 renderMarkdown 안의 주소와 글자 하나까지 같아요.
 * (예: 한글 파일 이름은 두 곳 모두 %EA%B2%A8...처럼 바뀐 모양이 돼요.)
 */
const toHtmlTree = unified().use(remarkParse).use(remarkGfm).use(remarkRehype);

/**
 * 원고 본문에 넣은 사진(![설명](주소))을 모두 찾아요.
 *
 * `![설명][이름]` + `[이름]: 주소`처럼 주소를 따로 적은 사진도 찾아요(HTML 나무로 바꾸면 주소가 채워져 있어요).
 *
 * @param markdown 원고 본문 글자
 * @returns 사진 목록(나온 순서대로)
 * @example
 * await findImages("![영사실](/images/booth.jpg)"); // [{ src: "/images/booth.jpg", alt: "영사실" }]
 */
export async function findImages(markdown: string): Promise<BodyImage[]> {
  // parse: 글 → Markdown 나무, run: Markdown 나무 → HTML 나무
  const tree = await toHtmlTree.run(toHtmlTree.parse(markdown));
  const images: BodyImage[] = [];
  visit(tree, "element", (node: Element) => {
    // `?? ""`: 값이 없으면(설명을 비워 둔 사진) 빈 글자로 해요.
    if (node.tagName === "img") images.push({ src: String(node.properties.src ?? ""), alt: String(node.properties.alt ?? "") });
  });
  return images;
}
