/**
 * @file 본문 미리 보기 (markdown-preview.tsx)
 *
 * 이 파일이 하는 일
 *   글쓰기 화면에서 쓰고 있는 본문(Markdown)을, 저장한 뒤 상세 화면에 보일 모습 그대로 보여 줘요.
 *
 * 어떻게 똑같이 보여 주나요?
 *   상세 화면이 쓰는 변환 함수(lib/markdown.ts의 renderMarkdown)를 그대로 쓰고, 같은 본문 상자(.prose)에 넣어요.
 *   변환 도구는 필요할 때만 따로 받아 와요(import()). 처음 화면을 여는 데 드는 시간이 늘지 않게요.
 *
 * 미리 보기에만 있는 일
 *   - 아직 올리지 않은 장면 사진: 본문에는 저장될 주소(/images/<주소>/scene-1.jpg)가 적혀 있지만 그 파일은 아직 없어요.
 *     그래서 고른 파일로 브라우저 안의 임시 주소(blob:)를 만들어 바꿔 보여 줘요.
 *   - 링크: 눌러도 쓰던 글을 떠나지 않게 새 탭에서 열어요.
 *   - 글자를 칠 때마다 바로 바꾸지 않고, 화면이 한가할 때 따라가요(useDeferredValue). 입력이 버벅이지 않게요.
 *
 * 보안 메모
 *   원고 안의 HTML 태그는 변환할 때 버리고, javascript: 같은 위험한 링크 주소도 지워요(상세 화면과 같아요).
 *
 * 누가 쓰나요?
 *   components/review-writer.tsx가 본문 칸 옆(좁은 화면은 [미리 보기] 탭)에 놓아요.
 */

"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";

/** MarkdownPreview가 받는 값 */
type Props = {
  /** 본문(Markdown) 글자 */
  markdown: string;
  /** 아직 올리지 않은 장면 사진: 본문에 적힌 사진 주소 → 고른 파일 */
  images: ReadonlyMap<string, File>;
};

/** 본문 미리 보기 */
export function MarkdownPreview({ markdown, images }: Props) {
  // 바로 바뀌는 값 대신 "조금 늦게 따라오는 값". 빠르게 칠 때는 미리 보기를 건너뛰고 마지막 글만 그려요.
  const deferredMarkdown = useDeferredValue(markdown);
  // 변환한 HTML 글자
  const [html, setHtml] = useState("");
  // 파일마다 만든 임시 주소(blob:). 같은 파일은 같은 주소를 다시 써서, 글자를 칠 때마다 사진을 새로 읽지 않아요.
  const fileUrlsRef = useRef(new Map<File, string>());

  // 사진 파일이 바뀌면 임시 주소를 맞춰요: 새 파일은 주소를 만들고, 빠진 파일의 주소는 지워 브라우저 메모리를 돌려줘요.
  useEffect(() => {
    const urls = fileUrlsRef.current;
    const files = new Set(images.values());
    for (const file of files) if (!urls.has(file)) urls.set(file, URL.createObjectURL(file));
    for (const [file, url] of urls) {
      if (files.has(file)) continue;
      URL.revokeObjectURL(url);
      urls.delete(file);
    }
  }, [images]);

  // 화면을 떠나면 남은 임시 주소를 모두 지워요.
  useEffect(() => {
    const urls = fileUrlsRef.current;
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  // 본문이나 사진이 바뀌면 다시 변환해요.
  useEffect(() => {
    // 늦게 끝난 예전 변환이 새 결과를 덮어쓰지 않게, 이 차례가 끝났는지 기억해요.
    let cancelled = false;
    // 원고의 사진 주소 → 임시 주소
    const imageSources = new Map<string, string>();
    for (const [path, file] of images) {
      const url = fileUrlsRef.current.get(file);
      if (url) imageSources.set(path, url);
    }
    // import(): 변환 도구를 이때 처음 받아 와요(한 번 받으면 다시 받지 않아요).
    import("@/lib/markdown")
      .then(({ renderMarkdown }) => renderMarkdown(deferredMarkdown, { imageSources, openLinksInNewTab: true }))
      .then((result) => {
        if (!cancelled) setHtml(result);
      })
      // 변환 중 문제가 생겨도 쓰기는 계속할 수 있게, 미리 보기만 비워요.
      .catch(() => {
        if (!cancelled) setHtml("");
      });
    return () => {
      cancelled = true;
    };
  }, [deferredMarkdown, images]);

  if (deferredMarkdown.trim() === "") {
    return <p className="text-crt-dim">본문을 쓰면 여기에 저장한 뒤의 모습으로 보여요.</p>;
  }

  return (
    // .prose: 상세 화면의 본문과 같은 꾸밈(globals.css).
    // [&>:first-child]:mt-0: 미리 보기 상자 맨 위에 빈 공간이 생기지 않게, 첫 요소(예: 소제목)의 위 여백만 없애요.
    // dangerouslySetInnerHTML: HTML 글자를 그대로 넣는 React 기능이에요. 변환할 때 위험한 태그와 주소를 이미 걸렀어요.
    <div className="prose [&>:first-child]:mt-0" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
