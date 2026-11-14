/**
 * @file 블로그 버전 (version.ts)
 *
 * 이 파일이 하는 일
 *   package.json의 version(예: "1.2.0")을 꺼내 화면에 쓸 수 있게 해요. 머리글 왼쪽 이름 옆에 "(v1.2.0)"처럼 보여요.
 *   버전은 package.json 한 곳에만 적어요. 새 버전을 낼 때 package.json만 바꾸면 화면도 따라 바뀌어요.
 *
 * 서버에서만 읽어요
 *   머리글(components/site-header.tsx)은 서버 컴포넌트라, package.json 내용이 방문자 브라우저로 가지 않고 버전 글자만 HTML에 들어가요.
 *
 * 누가 쓰나요?
 *   components/site-header.tsx
 */

import packageJson from "../../package.json";

/** 지금 버전. 예: "1.2.0" */
export const APP_VERSION: string = packageJson.version;
