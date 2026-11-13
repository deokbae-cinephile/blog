/**
 * @file 픽셀 그림 → SVG 경로 바꾸기 (pixel-path.ts)
 *
 * 이 파일이 하는 일
 *   글자로 그린 격자 그림(예: ["..#..", ".###."])을 SVG가 그릴 수 있는 "경로(path) 명령"으로 바꿔요.
 *
 * 누가 쓰나요?
 *   - components/pixel-art.tsx : 화면의 픽셀 그림(별, 로고, ↵ 아이콘)
 *   - scripts/make-icons.mjs   : 브라우저 탭 아이콘과 설치 앱 아이콘
 *   화면 코드(JSX)가 없는 파일이라, 아이콘 스크립트(Node.js)도 그대로 불러 쓸 수 있어요.
 */

/**
 * 글자 그림에서 같은 글자가 가로로 이어진 칸을 막대 하나로 묶어 SVG 경로(path) 명령으로 만들어요.
 *
 * SVG 경로 명령 읽는 법 (예: "M0 0h2v1h-2z")
 *   M0 0  : 펜을 (0, 0)으로 옮겨요(Move).
 *   h2    : 오른쪽으로 2칸 그어요(horizontal).
 *   v1    : 아래로 1칸 그어요(vertical).
 *   h-2   : 왼쪽으로 2칸 돌아와요.
 *   z     : 시작점으로 닫아요 → 가로 2칸, 세로 1칸짜리 직사각형 완성!
 *
 * 칸마다 사각형을 하나씩 만들 수도 있지만, 이어진 칸을 묶으면 명령이 짧아져 그림이 가벼워져요.
 *
 * @param rows 글자 그림(한 줄에 한 문자열)
 * @param char 색칠할 글자(예: "#")
 * @param offset 그림 전체를 옮길 칸 수(아이콘 가운데에 놓을 때 써요). 기본 { x: 0, y: 0 }
 * @returns SVG path의 d 속성에 넣을 글자
 * @example
 * pixelPath(["##.#"], "#"); // "M0 0h2v1h-2zM3 0h1v1h-1z"
 */
export function pixelPath(rows: readonly string[], char: string, offset = { x: 0, y: 0 }): string {
  let d = ""; // 완성할 경로 명령을 여기에 이어 붙여요.

  // forEach는 배열을 차례로 돌며, 각 줄(row)과 그 줄의 번호(y)를 넘겨줘요. 줄 번호가 곧 세로 위치입니다.
  rows.forEach((row, y) => {
    let x = 0; // 지금 보고 있는 가로 위치(칸 번호)

    // 줄의 끝까지 한 칸씩 살펴봐요.
    while (x < row.length) {
      // 색칠할 글자가 아니면 다음 칸으로 넘어가요.
      if (row[x] !== char) {
        x += 1;
        continue;
      }
      // 색칠할 칸을 찾았어요! 같은 글자가 어디까지 이어지는지 end를 오른쪽으로 옮기며 찾습니다.
      let end = x;
      while (end < row.length && row[end] === char) end += 1;
      // x부터 end 직전까지가 한 막대예요. 너비는 end - x 칸이고, offset만큼 옮겨 그려요.
      d += `M${x + offset.x} ${y + offset.y}h${end - x}v1h${x - end}z`;
      // 막대 끝 다음 칸부터 다시 살펴봐요.
      x = end;
    }
  });

  return d;
}
