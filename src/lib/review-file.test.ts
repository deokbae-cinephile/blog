/**
 * @file review-file.ts 테스트
 *
 * 원고 글자 ↔ 글쓰기 칸 값이 서로 잘 바뀌는지 확인해요.
 *   - 불러오기(parseReviewFile): 원고 틀 모양의 파일을 고르면 칸이 바로 채워져야 해요.
 *   - 저장(serializeReviewFile): 저장한 원고가 빌드할 때 원고 검사(lib/load-reviews.ts)를 통과하는 모양이어야 해요.
 */

import { describe, expect, it } from "vitest";

import { parseReviewFile, serializeReviewFile } from "./review-file";
import { checkFrontmatter } from "./review-schema";

/** 원고 틀과 같은 모양의 원고 */
const SOURCE = `---
title: 겨울 정류장
originalTitle: Winter Stop
year: 2024
director: 한서윤
cast: 레오나르도 디카프리오, 마크 러팔로
runtime: 112
genres: [드라마, 로맨스]
rating: 4.5
oneLiner: 버스는 오지 않아도, 기다림은 끝내 도착한다.
publishedAt: 2026-11-08
poster: winter-stop.jpg
---

첫 문단

## 좋았던 점
`;

/** 검사를 통과한 원고 정보를 만들어요(틀리면 문구와 함께 시험을 멈춰요). */
function parse(input: unknown) {
  const result = checkFrontmatter(input);
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join("\n"));
  return result.value;
}

describe("parseReviewFile", () => {
  it("원고 틀 모양의 파일을 칸 값으로 바꾼다(숫자는 글자로, 평점은 소수 한 자리로)", () => {
    const parsed = parseReviewFile(SOURCE);
    expect(parsed).toEqual({
      ok: true,
      ignoredKeys: [],
      values: {
        title: "겨울 정류장",
        originalTitle: "Winter Stop",
        year: "2024",
        director: "한서윤",
        cast: "레오나르도 디카프리오, 마크 러팔로",
        runtime: "112",
        genres: ["드라마", "로맨스"],
        rating: "4.5",
        oneLiner: "버스는 오지 않아도, 기다림은 끝내 도착한다.",
        poster: "winter-stop.jpg",
        posterAlt: "",
        publishedAt: "2026-11-08",
        // 정보 영역 뒤의 빈 줄과 끝의 줄바꿈은 지워요.
        body: "첫 문단\n\n## 좋았던 점",
      },
    });
  });

  it("예전 원고의 쓰지 않는 항목(watchedAt, sample)은 빼고 알려 준다", () => {
    const parsed = parseReviewFile(SOURCE.replace("rating: 4.5", "rating: 4.5\nwatchedAt: 2026-11-06\nsample: true"));
    expect(parsed.ok && parsed.ignoredKeys).toEqual(["watchedAt", "sample"]);
  });

  it("장르를 하나만 적거나, 목록에 없는 장르(예전 장르)를 적어도 읽을 수 있는 것만 남긴다", () => {
    const one = parseReviewFile(SOURCE.replace("genres: [드라마, 로맨스]", "genres: 드라마"));
    expect(one.ok && one.values.genres).toEqual(["드라마"]);
    const old = parseReviewFile(SOURCE.replace("genres: [드라마, 로맨스]", "genres: [SF, 드라마, 음악]"));
    expect(old.ok && old.values.genres).toEqual(["드라마"]);
  });

  it("감독 목록은 쉼표로 잇고, /posters/ 경로는 파일 이름만 남기고, 윈도 줄바꿈도 읽는다", () => {
    const parsed = parseReviewFile(
      SOURCE.replace("director: 한서윤", "director: [가, 나]").replace("poster: winter-stop.jpg", "poster: /posters/a.jpg").replaceAll("\n", "\r\n"),
    );
    expect(parsed.ok && parsed.values.director).toBe("가, 나");
    expect(parsed.ok && parsed.values.poster).toBe("a.jpg");
  });

  it("정보 영역이 없거나 YAML 문법이 틀리면 고치는 방법을 알려 준다", () => {
    expect(parseReviewFile("그냥 글")).toEqual({ ok: false, message: expect.stringContaining("원고 틀") });
    expect(parseReviewFile("---\ntitle: [닫히지 않은 괄호\n---\n")).toEqual({ ok: false, message: expect.stringContaining("따옴표 짝") });
    expect(parseReviewFile("---\n- 목록\n---\n")).toEqual({ ok: false, message: expect.stringContaining("이름: 값") });
  });

  it("출연 목록에 이름이 아닌 값(숫자·true)이 있으면 바꾸거나 빼지 않고 고치는 방법을 알려 준다", () => {
    for (const cast of ["[이배우, 1987]", "[이배우, true]"]) {
      expect(parseReviewFile(SOURCE.replace("cast: 레오나르도 디카프리오, 마크 러팔로", `cast: ${cast}`))).toEqual({
        ok: false,
        message: expect.stringContaining("cast(출연) 목록에 이름이 아닌 값"),
      });
    }
    // 이름만 있는 목록은 "A, B"로 이어 칸에 넣어요.
    const parsed = parseReviewFile(SOURCE.replace("cast: 레오나르도 디카프리오, 마크 러팔로", "cast: [이배우, 박배우]"));
    expect(parsed.ok && parsed.values.cast).toBe("이배우, 박배우");
  });
});

describe("serializeReviewFile", () => {
  it("검사를 통과한 정보와 본문으로 원고 틀과 같은 순서의 원고를 만든다", () => {
    const frontmatter = parse({
      title: "겨울 정류장",
      year: 2024,
      director: "한서윤",
      genres: ["드라마", "로맨스"],
      rating: 4.5,
      oneLiner: "버스는 오지 않아도, 기다림은 끝내 도착한다.",
      publishedAt: "2026-11-08",
    });
    expect(serializeReviewFile(frontmatter, "첫 문단\r\n\r\n둘째 문단")).toBe(
      [
        "---",
        "title: 겨울 정류장",
        "year: 2024",
        "director: 한서윤",
        "genres: [드라마, 로맨스]",
        "rating: 4.5",
        "oneLiner: 버스는 오지 않아도, 기다림은 끝내 도착한다.",
        "publishedAt: 2026-11-08",
        "---",
        "",
        "첫 문단",
        "",
        "둘째 문단",
        "",
      ].join("\n"),
    );
  });

  it("콜론·#처럼 특별한 글자나 숫자처럼 보이는 글자는 따옴표로 감싸서 다시 읽어도 같다", () => {
    const frontmatter = parse({
      title: "1987",
      originalTitle: "Mission: Impossible #2",
      year: 2024,
      director: "한서윤",
      genres: ["액션"],
      rating: 3,
      oneLiner: "true",
      publishedAt: "2026-11-08",
    });
    const text = serializeReviewFile(frontmatter, "");
    const parsed = parseReviewFile(text);
    expect(parsed.ok && parsed.values).toMatchObject({ title: "1987", originalTitle: "Mission: Impossible #2", oneLiner: "true", rating: "3.0" });
    // 저장한 원고는 빌드 때 원고 검사도 통과해야 해요(따옴표로 감싼 "1987"은 글자 제목이에요).
    expect(text).toContain('title: "1987"');
  });

  it("줄바꿈이 든 값도 한 줄 따옴표로 적어서, 다시 읽으면 같은 값이 된다(틀린 YAML이 되지 않게)", () => {
    const frontmatter = parse({
      title: "겨울 정류장",
      year: 2024,
      director: "한서윤",
      genres: ["드라마"],
      rating: 4,
      oneLiner: "첫 줄\n둘째 줄",
      publishedAt: "2026-11-08",
    });
    const text = serializeReviewFile(frontmatter, "");
    expect(text).toContain('oneLiner: "첫 줄\\n둘째 줄"');
    const parsed = parseReviewFile(text);
    expect(parsed.ok && parsed.values.oneLiner).toBe("첫 줄\n둘째 줄");
  });
});
