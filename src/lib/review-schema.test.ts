/**
 * @file review-schema.ts 테스트
 *
 * 원고 검사 규칙이 "맞는 원고는 통과시키고, 틀린 원고는 고치는 방법과 함께 거절하는지" 확인해요.
 *
 * 알아 두면 좋은 테스트 도구
 *   - it.each([값들])("이름 %s", (값) => ...) : 같은 테스트를 값만 바꿔 여러 번 돌려요. %s 자리에 값이 들어가요.
 *   - toEqual : 배열·객체의 "내용"이 같은지 비교해요. (toBe는 "같은 물건"인지 비교해서 배열·객체에는 안 맞아요.)
 *   - toContain : 글자 안에 어떤 글자가 들어 있는지 확인해요.
 */

import { describe, expect, it } from "vitest";

import { imageRefProblems, reviewFrontmatterSchema, safeDecode, SLUG } from "./review-schema";

/** 모든 항목이 올바르게 들어 있는 원고 정보. 테스트마다 여기서 한 곳만 바꿔 틀린 원고를 만들어요. */
const valid = {
  title: "겨울 정류장",
  originalTitle: "Winter Stop",
  year: 2024,
  country: "한국",
  director: "한서윤",
  runtime: 112,
  genres: ["드라마", "로맨스"],
  rating: 4.5,
  oneLiner: "버스는 오지 않아도, 기다림은 끝내 도착한다.",
  publishedAt: "2026-11-08",
};

/** 검사해 보고 실패하면 오류 문구 목록을, 통과하면 빈 목록을 돌려주는 도우미 */
const messages = (input: unknown) => {
  const result = reviewFrontmatterSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("reviewFrontmatterSchema", () => {
  it("올바른 원고를 그대로 읽는다", () => {
    expect(reviewFrontmatterSchema.parse(valid)).toEqual(valid);
  });

  it("선택 항목(원제·국가·상영 시간)은 없어도 된다", () => {
    // 구조 분해로 선택 항목을 빼고 나머지(required)만 남겨요. void [...]는 "안 쓰는 변수" 경고를 피하는 표시예요.
    const { originalTitle, country, runtime, ...required } = valid;
    void [originalTitle, country, runtime];
    expect(reviewFrontmatterSchema.safeParse(required).success).toBe(true);
  });

  it("장르가 하나면 괄호 없이 적어도 받는다", () => {
    expect(reviewFrontmatterSchema.parse({ ...valid, genres: "드라마" }).genres).toEqual(["드라마"]);
  });

  it("공동 감독을 목록으로 적으면 쉼표로 잇는다", () => {
    expect(reviewFrontmatterSchema.parse({ ...valid, director: ["가", "나"] }).director).toBe("가, 나");
  });

  it("YAML이 날짜를 Date로 읽어도 YYYY-MM-DD로 맞춘다", () => {
    const result = reviewFrontmatterSchema.parse({ ...valid, publishedAt: new Date("2026-11-08T00:00:00Z") });
    expect(result.publishedAt).toBe("2026-11-08");
  });

  // 0.5 단위가 아닌 값(4.3), 범위 밖의 값(0점은 없어요, 5.5), 글자("4.5")를 모두 거절하는지 한 번에 확인해요.
  it.each([4.3, 0, 5.5, "4.5"])("평점 %s는 고치는 방법과 함께 거절한다", (rating) => {
    expect(messages({ ...valid, rating })).toEqual([
      "rating(평점)은 0.5부터 5까지 0.5 단위 숫자로 적습니다(0점은 없습니다). 예: rating: 4.5",
    ]);
  });

  it("예전 원고의 본 날(watchedAt)·견본 표시(sample)는 이제 쓰지 않는 항목이라 알려 준다", () => {
    expect(messages({ ...valid, watchedAt: "2026-11-06" })[0]).toContain("알 수 없는 항목입니다: watchedAt");
    expect(messages({ ...valid, sample: true })[0]).toContain("알 수 없는 항목입니다: sample");
  });

  // 장르 목록(lib/genres.ts)에 없는 장르는 쓸 수 없어요. 예전에 있다가 뺀 장르도 마찬가지예요.
  it.each(["SF", "판타지", "미스터리", "음악", "전쟁", "역사", "모험", "서부"])("목록에 없는 장르 %s는 거절한다", (genre) => {
    expect(messages({ ...valid, genres: [genre] })[0]).toContain("쓸 수 있는 장르가 아닙니다");
  });

  it("목록에 없는 장르는 쓸 수 있는 장르를 알려 준다", () => {
    const [message] = messages({ ...valid, genres: ["드라마", "멜로"] });
    expect(message).toContain('"멜로"은(는) 쓸 수 있는 장르가 아닙니다');
    expect(message).toContain("다큐멘터리");
  });

  it("같은 장르를 두 번 적으면 거절한다", () => {
    expect(messages({ ...valid, genres: ["드라마", "드라마"] })).toEqual([
      "genres(장르)에 같은 장르를 두 번 적었습니다. 하나만 남겨 주세요.",
    ]);
  });

  it("빠진 필수 항목을 한꺼번에 모두 알려 준다", () => {
    expect(messages({})).toEqual([
      "title(한국어 제목)을 적어 주세요. 예: title: 겨울 정류장",
      "year(개봉 연도)는 숫자 네 자리로 적습니다. 예: year: 2024",
      "director(감독)를 적어 주세요. 여러 명이면 쉼표로 나눕니다. 예: director: 한서윤",
      "genres(장르)를 하나 이상 적어 주세요. 예: genres: [드라마, 로맨스]",
      "rating(평점)은 0.5부터 5까지 0.5 단위 숫자로 적습니다(0점은 없습니다). 예: rating: 4.5",
      "oneLiner(한줄평)를 적어 주세요. 예: oneLiner: 눈이 그친 뒤에야 들리는 이야기",
      "publishedAt(글 쓴 날)은 YYYY-MM-DD 형식으로 적습니다. 예: publishedAt: 2026-10-05",
    ]);
  });

  it("날짜 형식이 틀리면 거절한다", () => {
    expect(messages({ ...valid, publishedAt: "2026.11.08" })).toEqual([
      "publishedAt(글 쓴 날)은 YYYY-MM-DD 형식으로 적습니다. 예: publishedAt: 2026-10-05",
    ]);
  });

  it("알 수 없는 항목(오타)을 알려 준다", () => {
    const [message] = messages({ ...valid, ratting: 4 });
    expect(message).toContain("알 수 없는 항목입니다: ratting");
    expect(message).toContain("쓸 수 있는 항목: title");
  });

  it("포스터 파일 이름과 설명을 받는다", () => {
    const result = reviewFrontmatterSchema.parse({ ...valid, poster: "winter-stop.jpg", posterAlt: "눈 내리는 정류장" });
    expect(result.poster).toBe("winter-stop.jpg");
    expect(result.posterAlt).toBe("눈 내리는 정류장");
  });

  // 폴더를 거슬러 올라가는 이름(../), 대문자, 이미지가 아닌 확장자는 모두 막아요.
  it("/posters/파일 모양으로 적어도 파일 이름만 남겨 받는다", () => {
    expect(reviewFrontmatterSchema.parse({ ...valid, poster: "/posters/winter-stop.jpg" }).poster).toBe("winter-stop.jpg");
  });

  it.each(["../secret.jpg", "Winter.JPG", "poster.gif", "posters/a.jpg", "/posters/../a.jpg"])("포스터 파일 이름 %s는 거절한다", (poster) => {
    const [message] = messages({ ...valid, poster });
    expect(message).toContain("poster(포스터)에는 public/posters 폴더에 넣은 파일 이름을 적습니다");
  });

  it("공백만 있는 제목은 빈 제목으로 보고 거절한다", () => {
    expect(messages({ ...valid, title: "   " })).toEqual(["title(한국어 제목)을 적어 주세요. 예: title: 겨울 정류장"]);
  });
});

describe("SLUG", () => {
  it.each(["winter-stop", "3am-store", "a1"])("%s는 원고 파일 이름(주소)으로 쓸 수 있다", (slug) => {
    expect(SLUG.test(slug)).toBe(true);
  });

  it.each(["Winter-Stop", "겨울", "a--b", "-a", "a b", ""])("%s는 쓸 수 없다", (slug) => {
    expect(SLUG.test(slug)).toBe(false);
  });
});

describe("imageRefProblems", () => {
  it("설명이 있고 사이트 안 주소면 문제가 없다", () => {
    expect(imageRefProblems("/images/a/scene-1.jpg", "영사실 빛")).toEqual({ messages: [], pathOk: true });
  });

  it("설명이 비어 있으면 예시와 함께 적으라고 알려 준다(주소는 맞음)", () => {
    const result = imageRefProblems("/images/a/scene-1.jpg", " ");
    expect(result.pathOk).toBe(true);
    expect(result.messages[0]).toContain("설명을 적어 주세요");
  });

  it.each(["https://example.com/a.jpg", "//cdn.example.com/a.jpg", "images/a.jpg"])("바깥 주소·상대 주소 %s는 막는다", (src) => {
    const result = imageRefProblems(src, "설명");
    expect(result.pathOk).toBe(false);
    expect(result.messages[0]).toContain("/로 시작하는 주소로");
  });

  it("주소에 ../가 있으면 처음부터 적으라고 알려 준다", () => {
    const result = imageRefProblems("/images/../secret.jpg", "설명");
    expect(result.pathOk).toBe(false);
    expect(result.messages[0]).toContain("./ 이나 ../를 쓰지 말고");
  });

  it("오류 문구의 한글 주소는 읽을 수 있게 되돌린다", () => {
    expect(safeDecode("/images/%EC%9E%A5%EB%A9%B4.jpg")).toBe("/images/장면.jpg");
    // 되돌릴 수 없는 모양(%가 깨진 글자)은 그대로 둬요.
    expect(safeDecode("/images/%E0%A4%A.jpg")).toBe("/images/%E0%A4%A.jpg");
  });
});
