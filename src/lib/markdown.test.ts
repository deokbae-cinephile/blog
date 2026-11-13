// @vitest-environment node
// ↑ 이 테스트는 브라우저 흉내(jsdom)가 필요 없어서 Node.js 환경에서 돌려요. 더 빠르고 서버 코드와 같은 환경이에요.

/**
 * @file markdown.ts 테스트
 *
 * 원고 본문(Markdown)이 기대한 HTML로 바뀌는지 확인해요.
 * 특히 우리가 직접 만든 도구(제목 높이 맞추기, 링크·표 손보기)가 잘 동작하는지 봐요.
 *
 * async/await 테스트
 *   renderMarkdown은 비동기 함수라, 테스트 함수도 async로 만들고 결과를 await로 기다려요.
 */

import { describe, expect, it } from "vitest";

import { findImages, renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("문단과 강조를 HTML로 바꾼다", async () => {
    expect(await renderMarkdown("눈이 **그친** 뒤에야 _들리는_ 이야기")).toBe(
      "<p>눈이 <strong>그친</strong> 뒤에야 <em>들리는</em> 이야기</p>",
    );
  });

  it("# 제목부터 쓰면 한 단계씩 내려 가장 큰 본문 제목을 h2로 맞춘다", async () => {
    const html = await renderMarkdown("# 좋았던 점\n\n## 장면\n\n# 아쉬운 점");
    expect(html).toBe("<h2>좋았던 점</h2>\n<h3>장면</h3>\n<h2>아쉬운 점</h2>");
  });

  it("## 제목부터 쓴 원고는 그대로 둔다", async () => {
    expect(await renderMarkdown("## 소제목\n\n### 작은 제목")).toBe("<h2>소제목</h2>\n<h3>작은 제목</h3>");
  });

  it("원고 안의 HTML 태그는 옮기지 않는다(스크립트가 실행되지 않게)", async () => {
    const html = await renderMarkdown('글 <script>alert("x")</script> 끝');
    expect(html).not.toContain("<script");
  });

  it("사이트 안 링크·이미지 주소는 그대로 두고, 바깥 링크는 opener를 넘기지 않는다", async () => {
    const html = await renderMarkdown(
      "[다른 리뷰](/reviews/winter-stop) · [바깥](https://example.com) ![스틸컷](/images/a.jpg)",
    );
    expect(html).toContain('href="/reviews/winter-stop"');
    expect(html).toContain('href="https://example.com" rel="noopener noreferrer"');
    expect(html).toContain('src="/images/a.jpg" alt="스틸컷" loading="lazy" decoding="async"');
  });

  it("표는 키보드로 스크롤할 수 있는 이름 있는 영역으로 감싸고, 이름이 겹치지 않게 번호를 붙인다", async () => {
    const html = await renderMarkdown("| 장면 | 시간 |\n|---|---|\n| 첫눈 | 00:12 |\n\n| a |\n|---|\n| b |");
    expect(html).toContain('<div class="table-scroll" role="region" aria-label="표 1" tabindex="0"><table>');
    expect(html).toContain('aria-label="표 2"');
  });

  it("표 안의 이미지도 이미지 속성을 받는다", async () => {
    const html = await renderMarkdown("| 리뷰 | 스틸컷 |\n|---|---|\n| [겨울](/reviews/winter-stop) | ![장면](/images/a.jpg) |");
    expect(html).toContain('href="/reviews/winter-stop"');
    expect(html).toContain('src="/images/a.jpg" alt="장면" loading="lazy" decoding="async"');
    // 표는 한 번만 감싸요(상자가 겹겹이 생기지 않아요).
    expect(html.match(/table-scroll/g)).toHaveLength(1);
  });

  describe("사진", () => {
    it("사진만 있는 문단은 액자(figure)로 바꾸고, 따옴표 안의 글을 사진 설명으로 옮긴다", async () => {
      const html = await renderMarkdown('![영사실의 빛](/images/booth.jpg "사십 년 된 영사기")');
      expect(html).toBe(
        '<figure class="photo"><div class="photo-frame"><img src="/images/booth.jpg" alt="영사실의 빛" class="photo-image" loading="lazy" decoding="async"></div><figcaption>사십 년 된 영사기</figcaption></figure>',
      );
    });

    it("크기를 알면 width·height와 비율 변수를 달고, 원본 파일을 그대로 쓴다(크게 보기 링크는 없다)", async () => {
      const imageSizes = new Map([["/images/booth.jpg", { width: 1280, height: 720 }]]);
      const html = await renderMarkdown("![영사실의 빛](/images/booth.jpg)", { imageSizes });
      expect(html).toContain('<figure class="photo" style="--photo-ratio: 1.7778; --photo-width: 1280px">');
      expect(html).toContain('src="/images/booth.jpg" alt="영사실의 빛" width="1280" height="720"');
      expect(html).not.toContain("photo-link");
      // 설명이 없으면 figcaption을 만들지 않아요.
      expect(html).not.toContain("figcaption");
    });

    it("한 문단에 붙여 쓴 사진들은 나란히 놓는 상자로 묶고, 빈 줄로 띄운 사진은 따로 놓는다", async () => {
      const html = await renderMarkdown("![객석](/images/seats.jpg)\n![줄](/images/queue.jpg)\n\n![영사실](/images/booth.jpg)");
      expect(html).toMatch(/^<div class="photo-row"><figure class="photo">.*<\/figure><figure class="photo">.*<\/figure><\/div>\n<figure class="photo">/);
    });

    it("글과 사진이 섞인 문단, 링크 속 사진은 글 속의 그림으로 둔다", async () => {
      const html = await renderMarkdown("앞 글 ![작은 그림](/images/a.jpg) 뒷글\n\n[![링크 그림](/images/b.jpg)](/reviews/winter-stop)");
      expect(html).not.toContain("<figure");
      expect(html).toContain("<p>앞 글 <img");
    });
  });

  it("각주 제목과 돌아가기 링크 이름을 한국어로 쓴다", async () => {
    const html = await renderMarkdown("본문[^1]\n\n[^1]: 각주 내용");
    expect(html).toContain(">각주</h2>");
    expect(html).toContain('aria-label="1번 각주를 단 곳으로 돌아가기"');
  });
});

describe("findImages", () => {
  it("본문의 사진 주소와 설명을 나온 순서대로 찾는다(주소를 따로 적은 사진 포함)", async () => {
    const images = await findImages("글 ![첫 장면](/images/a.jpg)\n\n![](/images/b.jpg)\n\n![참조][c]\n\n[c]: /images/c.jpg");
    expect(images).toEqual([
      { src: "/images/a.jpg", alt: "첫 장면" },
      { src: "/images/b.jpg", alt: "" },
      { src: "/images/c.jpg", alt: "참조" },
    ]);
  });

  it("한글 파일 이름은 renderMarkdown과 같은 모양(%로 바꾼 글자)으로 돌려준다", async () => {
    const [image] = await findImages("![장면](/images/장면.png)");
    expect(image?.src).toBe("/images/%EC%9E%A5%EB%A9%B4.png");
  });
});
