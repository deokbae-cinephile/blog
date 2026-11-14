/**
 * @file 본문 글상자의 Tab 들여쓰기 (indent.ts)
 *
 * 이 파일이 하는 일
 *   글쓰기 화면의 본문(Markdown) 칸에서 Tab을 누르면 다음 칸으로 넘어가지 않고 들여쓰기를 해요.
 *   목록 안의 목록(중첩 목록)을 만들 때 써요.
 *
 *     - 영화의 좋은 점          Tab →     - 영화의 좋은 점
 *     - 음악                              <Tab>- 음악        ← 한 단계 안쪽 목록이 돼요
 *
 *   - Tab        : 들여쓰기. 커서가 목록 줄(-, *, +, 1.)에 있거나 여러 줄을 골랐으면 그 줄들 맨 앞에 Tab 문자를 넣어요.
 *                  그 밖에는 커서 자리에 Tab 문자를 넣어요.
 *   - Shift+Tab  : 내어쓰기. 고른 줄들(또는 커서가 있는 줄) 맨 앞의 Tab 하나(또는 띄어쓰기 4칸까지)를 지워요.
 *
 * 왜 Tab 문자를 넣나요?
 *   Markdown은 Tab을 4칸으로 읽어요. 그래서 "- " 목록(2칸)과 "1. " 목록(3칸) 모두 한 번만 눌러도 안쪽 목록이 돼요.
 *   글상자에서는 2칸 너비로 보이게 해 둬서(tab-size) 눈으로 보기에도 가벼워요.
 *
 * 이 파일은 글자 계산만 해요(화면 코드 없음). 그래서 시험하기 쉬워요.
 *
 * 누가 쓰나요?
 *   components/review-writer.tsx(본문 글상자의 onKeyDown)
 */

/** 들여쓰기 한 번에 넣는 글자 */
export const INDENT = "\t";

/** 목록 줄: 앞에 공백이 있어도 되고, -, *, + 또는 숫자. / 숫자) 다음에 띄어쓰기가 와요. */
const LIST_ITEM = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]/;

/** 들여쓰기 결과: 바뀐 글 전체와, 바꾼 범위(이 범위를 replacement로 바꾸면 돼요), 바꾼 뒤 고를 범위 */
export type IndentResult = {
  /** 바뀐 글 전체 */
  value: string;
  /** 바꾼 범위의 시작(원래 글 기준) */
  from: number;
  /** 바꾼 범위의 끝(원래 글 기준) */
  to: number;
  /** from~to 자리에 들어갈 글 */
  replacement: string;
  /** 바꾼 뒤 고를 범위(커서) 시작 */
  selectionStart: number;
  /** 바꾼 뒤 고를 범위(커서) 끝 */
  selectionEnd: number;
};

/**
 * Tab(들여쓰기)·Shift+Tab(내어쓰기)을 눌렀을 때 글이 어떻게 바뀌는지 계산해요.
 *
 * @param value 글상자의 글 전체
 * @param start 고른 범위 시작(selectionStart). 고른 것이 없으면 커서 자리
 * @param end 고른 범위 끝(selectionEnd)
 * @param outdent true면 내어쓰기(Shift+Tab)
 * @returns 바뀐 글과 바꾼 범위, 새 커서 범위
 * @example
 * indentText("- 가\n- 나", 6, 6, false).value; // "- 가\n\t- 나"
 */
export function indentText(value: string, start: number, end: number, outdent: boolean): IndentResult {
  // 고른 범위가 닿은 줄들: 첫 줄의 시작부터 마지막 줄의 끝까지.
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  // 범위 끝이 줄 맨 앞이면(다음 줄 첫 글자 바로 앞) 그 줄은 고르지 않은 것으로 봐요.
  const lastIndex = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const nextBreak = value.indexOf("\n", lastIndex);
  const blockEnd = nextBreak === -1 ? value.length : nextBreak;
  const lines = value.slice(lineStart, blockEnd).split("\n");

  // 그냥 커서 자리에 Tab 넣기: 고른 것이 없고, 목록 줄이 아닐 때
  if (!outdent && start === end && !LIST_ITEM.test(lines[0]!)) {
    return {
      value: value.slice(0, start) + INDENT + value.slice(end),
      from: start,
      to: end,
      replacement: INDENT,
      selectionStart: start + INDENT.length,
      selectionEnd: start + INDENT.length,
    };
  }

  // 줄마다 들여쓰기(맨 앞에 Tab) 또는 내어쓰기(맨 앞의 Tab 하나 또는 띄어쓰기 4칸까지 지우기)
  const removed: number[] = [];
  const changed = lines.map((line) => {
    if (!outdent) return INDENT + line;
    const cut = line.startsWith("\t") ? 1 : (/^ {1,4}/.exec(line)?.[0].length ?? 0);
    removed.push(cut);
    return line.slice(cut);
  });
  const replacement = changed.join("\n");

  // 커서 범위 옮기기: 들여쓰기는 첫 줄 앞에 1글자, 끝은 줄 수만큼 뒤로. 내어쓰기는 지운 만큼 앞으로(줄 맨 앞보다는 앞으로 가지 않게).
  const firstShift = outdent ? -Math.min(removed[0] ?? 0, start - lineStart) : INDENT.length;
  const totalShift = outdent ? -removed.reduce((sum, cut) => sum + cut, 0) : INDENT.length * lines.length;
  const selectionStart = start + firstShift;
  const selectionEnd = start === end ? selectionStart : Math.max(selectionStart, end + totalShift);

  return {
    value: value.slice(0, lineStart) + replacement + value.slice(blockEnd),
    from: lineStart,
    to: blockEnd,
    replacement,
    selectionStart,
    selectionEnd,
  };
}
