/**
 * @file keyboard.ts 테스트
 *
 * "우리가 처리할 키인지" 고르는 판단이 맞는지 확인해요.
 * new KeyboardEvent("keydown", { key, ...옵션 })으로 가짜 키 누름을 만들어 넣어 봅니다.
 */

import { describe, expect, it } from "vitest";

import { isPlainKeyPress, keepsOwnKeys } from "./keyboard";

/** 가짜 키 누름을 만드는 도우미. cancelable: true여야 preventDefault가 먹혀요. */
const press = (init: KeyboardEventInit) => new KeyboardEvent("keydown", { cancelable: true, ...init });

describe("isPlainKeyPress", () => {
  it("다른 키 없이 누른 키는 처리한다", () => {
    expect(isPlainKeyPress(press({ key: "ArrowDown" }))).toBe(true);
  });

  it("Alt·Ctrl·Shift·⌘를 함께 누르면 브라우저 단축키라 처리하지 않는다", () => {
    expect(isPlainKeyPress(press({ key: "ArrowLeft", altKey: true }))).toBe(false);
    expect(isPlainKeyPress(press({ key: "ArrowLeft", ctrlKey: true }))).toBe(false);
    expect(isPlainKeyPress(press({ key: "ArrowDown", shiftKey: true }))).toBe(false);
    expect(isPlainKeyPress(press({ key: "ArrowRight", metaKey: true }))).toBe(false);
  });

  it("한글을 조합하는 중이면 처리하지 않는다", () => {
    expect(isPlainKeyPress(press({ key: "Escape", isComposing: true }))).toBe(false);
  });

  it("다른 코드가 이미 처리한(preventDefault) 키는 처리하지 않는다", () => {
    const event = press({ key: "Escape" });
    event.preventDefault();
    expect(isPlainKeyPress(event)).toBe(false);
  });
});

describe("keepsOwnKeys", () => {
  it("입력란·라디오 단추·글상자·고르기 상자는 키를 스스로 쓴다", () => {
    for (const html of ['<input type="search">', '<input type="radio">', "<textarea></textarea>", "<select></select>"]) {
      document.body.innerHTML = html;
      expect(keepsOwnKeys(document.body.firstElementChild)).toBe(true);
    }
  });

  it("본문의 가로 스크롤 표 안쪽도 키를 스스로 쓴다", () => {
    document.body.innerHTML = '<div class="table-scroll" tabindex="0"><table><tr><td><a href="/">링크</a></td></tr></table></div>';
    expect(keepsOwnKeys(document.querySelector("a"))).toBe(true);
  });

  it("화면 위에 뜬 창(dialog) 안은 키를 스스로 쓴다(Esc는 창을 닫는 데 써요)", () => {
    document.body.innerHTML = '<dialog open><button type="button">닫기</button></dialog>';
    expect(keepsOwnKeys(document.querySelector("button"))).toBe(true);
  });

  it("링크·단추·본문은 키를 스스로 쓰지 않는다", () => {
    document.body.innerHTML = '<a href="/">링크</a><button type="button">단추</button>';
    expect(keepsOwnKeys(document.querySelector("a"))).toBe(false);
    expect(keepsOwnKeys(document.querySelector("button"))).toBe(false);
    expect(keepsOwnKeys(document.body)).toBe(false);
  });

  it("요소가 아닌 곳(document 등)은 스스로 쓰지 않는다고 본다", () => {
    expect(keepsOwnKeys(document)).toBe(false);
    expect(keepsOwnKeys(null)).toBe(false);
  });
});
