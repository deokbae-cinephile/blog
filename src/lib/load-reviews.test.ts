// @vitest-environment node
// ↑ 파일을 다루는 테스트라 Node.js 환경에서 돌려요.

/**
 * @file load-reviews.ts 테스트
 *
 * 진짜 파일을 읽는 함수를 어떻게 테스트할까요?
 *   테스트마다 "임시 폴더"를 새로 만들고, 그 안에 시험용 원고를 써 넣은 뒤 읽어 봐요.
 *   테스트가 끝나면 임시 폴더를 지워요. 실제 원고(content/reviews)는 건드리지 않아요.
 *
 *   - beforeEach(할 일) : 테스트가 하나 시작될 때마다 "할 일"을 해요(여기서는 임시 폴더 만들기).
 *   - afterEach(할 일)  : 테스트가 하나 끝날 때마다 "할 일"을 해요(임시 폴더 지우기).
 *   - mkdtemp           : 겹치지 않는 이름의 임시 폴더를 만들어요.
 */

import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadReviews, ReviewContentError, writeReviewsData } from "./load-reviews";

/**
 * 시험용 원고 글자를 만드는 도우미예요.
 * { title: "제목", year: "2024" } → "---\ntitle: 제목\nyear: 2024\n---\n\n본문\n"
 */
const review = (fields: Record<string, string>, body = "본문") =>
  `---\n${Object.entries(fields)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n")}\n---\n\n${body}\n`;

/** 꼭 필요한 항목만 들어 있는 올바른 원고 정보 */
const base = {
  title: "겨울 정류장",
  year: "2024",
  director: "한서윤",
  genres: "[드라마, 로맨스]",
  rating: "4.5",
  oneLiner: "기다림은 끝내 도착한다",
  publishedAt: "2026-11-08",
};

/** 테스트마다 새로 만드는 임시 폴더 경로 */
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "reviews-"));
});

afterEach(async () => {
  // recursive: 안의 파일까지 모두, force: 없어도 오류 내지 않기
  await rm(dir, { recursive: true, force: true });
});

describe("loadReviews", () => {
  it("원고를 읽어 본문을 HTML로 바꾸고, 최근에 쓴 글부터 돌려준다", async () => {
    // 준비: 원고 두 편을 써 넣어요(예전 글이 이름순으로는 뒤에 와요).
    await writeFile(path.join(dir, "winter-stop.md"), review(base, "## 좋았던 점\n\n눈 내리는 소리"));
    await writeFile(path.join(dir, "older.md"), review({ ...base, title: "예전 글", publishedAt: "2026-01-01" }));

    // 실행
    const reviews = await loadReviews(dir);

    // 확인: 최신순, 그리고 글자로 쓴 값(year: "2024")이 숫자(2024)로 읽혔는지
    expect(reviews.map((r) => r.slug)).toEqual(["winter-stop", "older"]);
    // toMatchObject: 객체에 이 항목들이 "들어 있는지"만 확인해요(다른 항목이 더 있어도 괜찮아요).
    expect(reviews[0]).toMatchObject({
      slug: "winter-stop",
      title: "겨울 정류장",
      year: 2024,
      genres: ["드라마", "로맨스"],
      rating: 4.5,
      html: "<h2>좋았던 점</h2>\n<p>눈 내리는 소리</p>",
    });
  });

  it("_로 시작하는 파일과 Markdown이 아닌 파일은 읽지 않는다", async () => {
    await writeFile(path.join(dir, "_template.md"), "---\ntitle:\n---\n");
    await writeFile(path.join(dir, "notes.txt"), "메모");
    await writeFile(path.join(dir, "winter-stop.md"), review(base));
    expect((await loadReviews(dir)).map((r) => r.slug)).toEqual(["winter-stop"]);
  });

  it("고칠 곳을 파일마다 모두 모아 한꺼번에 알려 준다", async () => {
    // 세 가지 실수: 평점 단위, 한글 파일 이름, YAML 문법(닫히지 않은 괄호)
    await writeFile(path.join(dir, "bad-rating.md"), review({ ...base, rating: "4.3" }));
    await writeFile(path.join(dir, "겨울.md"), review(base));
    await writeFile(path.join(dir, "broken-yaml.md"), "---\ntitle: [닫히지 않은 괄호\n---\n");

    // 오류를 던지는 함수는 .catch로 받아 오류 객체를 꺼내 확인해요.
    const error = await loadReviews(dir).catch((e: unknown) => e);

    // toBeInstanceOf: 우리가 만든 ReviewContentError 종류의 오류인지 확인해요.
    expect(error).toBeInstanceOf(ReviewContentError);
    const { problems, message } = error as ReviewContentError;
    expect(problems).toHaveLength(3);
    expect(problems.find((p) => p.includes("bad-rating.md"))).toContain("rating(평점)은 0.5부터 5까지");
    expect(problems.find((p) => p.includes("겨울.md"))).toContain("파일 이름은 영어 소문자, 숫자, 하이픈(-)으로만");
    expect(problems.find((p) => p.includes("broken-yaml.md"))).toContain("맨 위 --- 사이의 항목을 읽지 못했습니다");
    expect(message).toContain("리뷰 원고 3곳을 고쳐야 합니다.");
    expect(message).toContain("content/templates/review.md");
  });

  it("포스터 파일이 있으면 주소(/posters/...)로 바꿔 넣는다", async () => {
    // public 폴더 흉내: 임시 폴더 안에 posters 폴더를 만들어요.
    await mkdir(path.join(dir, "posters"));
    await writeFile(path.join(dir, "posters", "winter-stop.jpg"), "가짜 이미지");
    await writeFile(path.join(dir, "winter-stop.md"), review({ ...base, poster: "winter-stop.jpg" }));

    const [first] = await loadReviews(dir, { publicDir: dir });

    expect(first?.poster).toBe("/posters/winter-stop.jpg");
  });

  it("포스터를 적었는데 파일이 없으면 넣을 폴더와 함께 알려 준다", async () => {
    await writeFile(path.join(dir, "winter-stop.md"), review({ ...base, poster: "missing.jpg" }));
    const error = (await loadReviews(dir, { publicDir: dir }).catch((e: unknown) => e)) as ReviewContentError;
    expect(error.problems).toEqual([
      expect.stringContaining("포스터 파일을 찾을 수 없습니다: public/posters/missing.jpg"),
    ]);
  });

  it("포스터가 없는 원고에는 poster 항목 자체를 만들지 않는다", async () => {
    await writeFile(path.join(dir, "winter-stop.md"), review(base));
    const [first] = await loadReviews(dir);
    // toHaveProperty: 객체에 그 항목이 있는지 확인해요. not으로 "없어야 한다"를 확인합니다.
    expect(first).not.toHaveProperty("poster");
  });

  describe("본문 사진", () => {
    /** 진짜 그림 파일(200×300 PNG)을 임시 public 폴더의 images 폴더에 복사해 둬요. */
    beforeEach(async () => {
      await mkdir(path.join(dir, "images"), { recursive: true });
      await copyFile(path.resolve("public/posters/test-pattern.png"), path.join(dir, "images", "장면.png"));
    });

    it("사진 크기를 재서 width·height를 달고, 사진만 있는 문단은 액자(figure)로 바꾼다", async () => {
      await writeFile(path.join(dir, "winter-stop.md"), review(base, '![눈 내리는 정류장](/images/장면.png "첫 장면")'));

      const [first] = await loadReviews(dir, { publicDir: dir });

      expect(first?.html).toContain('<figure class="photo" style="--photo-ratio: 0.6667; --photo-width: 200px">');
      expect(first?.html).toContain('alt="눈 내리는 정류장" width="200" height="300"');
      expect(first?.html).toContain("<figcaption>첫 장면</figcaption>");
      // 200px 사진은 사본을 만들지 않아서 srcset이 없어요.
      expect(first?.html).not.toContain("srcset");
    });

    it("빌드할 때 만든 작은 사본(_resized)이 있으면 srcset에 넣고, 만들지 않은 너비는 넣지 않는다", async () => {
      // 1600 × 900 사진과, 그 사본 가운데 480·800만 있는 상황(1200 사본은 없어요)
      await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#c87828" } })
        .jpeg()
        .toFile(path.join(dir, "images", "넓은.jpg"));
      for (const width of [480, 800]) {
        const file = path.join(dir, "_resized", String(width), "images", "넓은.jpg.webp");
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, "사본");
      }
      await writeFile(path.join(dir, "winter-stop.md"), review(base, "![넓은 장면](/images/넓은.jpg)"));

      const [first] = await loadReviews(dir, { publicDir: dir });

      // 원고의 한글 주소는 %로 바뀌어 들어가요(브라우저가 같은 파일을 찾아요).
      const src = "/images/%EB%84%93%EC%9D%80.jpg";
      expect(first?.html).toContain(`srcset="/_resized/480${src}.webp 480w, /_resized/800${src}.webp 800w, ${src} 1600w"`);
      expect(first?.html).toContain('sizes="(min-width: 1024px) min(calc(100vw - 27rem), 1600px, calc(80vh * 1.7778))');
    });

    it("사진 설명(대체 텍스트)이 비어 있으면 적으라고 알려 준다", async () => {
      await writeFile(path.join(dir, "winter-stop.md"), review(base, "![](/images/장면.png)"));
      const error = (await loadReviews(dir, { publicDir: dir }).catch((e: unknown) => e)) as ReviewContentError;
      expect(error.problems).toEqual([expect.stringContaining("사진 /images/장면.png에 설명을 적어 주세요")]);
    });

    it("사진 파일이 없거나 바깥 주소면, 고칠 곳을 모두 알려 준다", async () => {
      await writeFile(
        path.join(dir, "winter-stop.md"),
        review(base, "![없는 사진](/images/없음.jpg)\n\n![바깥 사진](https://example.com/a.jpg)\n\n![폴더 밖](/images/..%2F..%2Fsecret.png)"),
      );
      const error = (await loadReviews(dir, { publicDir: dir }).catch((e: unknown) => e)) as ReviewContentError;
      expect(error.problems).toEqual([
        expect.stringContaining("사진 파일을 찾을 수 없거나 읽을 수 없습니다: public/images/없음.jpg"),
        expect.stringContaining("사진 https://example.com/a.jpg: 사진은 public 폴더에 넣고 /로 시작하는 주소로 적어 주세요"),
        expect.stringContaining("사진 파일을 찾을 수 없거나 읽을 수 없습니다"),
      ]);
    });

    it("주소에 ./ 이나 ../가 있으면 처음부터 적으라고 알려 준다(엉뚱한 폴더를 가리키지 않게)", async () => {
      await writeFile(path.join(dir, "winter-stop.md"), review(base, "![장면](/images/../images/장면.png)"));
      const error = (await loadReviews(dir, { publicDir: dir }).catch((e: unknown) => e)) as ReviewContentError;
      expect(error.problems).toEqual([expect.stringContaining("주소에 ./ 이나 ../를 쓰지 말고")]);
    });

    it("크기는 재지만 브라우저가 보여 주지 못하는 형식(포토샵 파일 등)이면 바꿔 올리라고 알려 준다", async () => {
      // 포토샵(PSD) 파일의 머리 부분만 흉내 내요: "8BPS" 표시, 14번째 바이트부터 세로, 18번째부터 가로(큰 수가 앞에 오는 4바이트 수)
      const psd = Buffer.alloc(26);
      psd.write("8BPS", 0, "ascii");
      psd.writeUInt16BE(1, 4);
      psd.writeUInt32BE(300, 14);
      psd.writeUInt32BE(200, 18);
      await writeFile(path.join(dir, "images", "작업.psd"), psd);
      await writeFile(path.join(dir, "winter-stop.md"), review(base, "![작업 중인 그림](/images/작업.psd)"));

      const error = (await loadReviews(dir, { publicDir: dir }).catch((e: unknown) => e)) as ReviewContentError;
      expect(error.problems).toEqual([expect.stringContaining("블로그에서 보여 줄 수 없는 형식(psd)입니다. JPG·PNG·WebP·AVIF·GIF로")]);
    });

    it("그림이 아닌 파일은 읽을 수 없다고 알려 준다", async () => {
      await writeFile(path.join(dir, "images", "메모.png"), "그림이 아닌 글자");
      await writeFile(path.join(dir, "winter-stop.md"), review(base, "![메모](/images/메모.png)"));
      const error = (await loadReviews(dir, { publicDir: dir }).catch((e: unknown) => e)) as ReviewContentError;
      expect(error.problems).toEqual([expect.stringContaining("public/images/메모.png")]);
    });
  });

  it("맨 위 정보 영역이 없는 원고는 빠진 항목을 알려 준다", async () => {
    await writeFile(path.join(dir, "no-matter.md"), "본문만 있는 원고\n");
    const error = (await loadReviews(dir).catch((e: unknown) => e)) as ReviewContentError;
    expect(error.problems[0]).toContain("title(한국어 제목)을 적어 주세요");
  });
});

describe("writeReviewsData(빌드 직전에 리뷰 데이터 파일 쓰기)", () => {
  it("원고를 읽어 최신순 리뷰 데이터(본문 HTML 포함)를 JSON으로 쓰고, 쓴 편 수를 돌려준다", async () => {
    await writeFile(path.join(dir, "winter-stop.md"), review(base, "## 좋았던 점"));
    await writeFile(path.join(dir, "older.md"), review({ ...base, title: "예전 글", publishedAt: "2026-01-01" }));
    const outFile = path.join(dir, ".generated", "reviews.json");

    expect(await writeReviewsData(outFile, dir)).toBe(2);
    const written = JSON.parse(await readFile(outFile, "utf8"));
    expect(written.map((item: { slug: string }) => item.slug)).toEqual(["winter-stop", "older"]);
    expect(written[0].html).toContain("<h2>좋았던 점</h2>");
  });

  it("고칠 곳이 있으면 파일을 쓰지 않고 ReviewContentError를 던진다(빌드가 멈춰요)", async () => {
    await writeFile(path.join(dir, "Bad_Name.md"), review(base));
    const outFile = path.join(dir, ".generated", "reviews.json");

    await expect(writeReviewsData(outFile, dir)).rejects.toBeInstanceOf(ReviewContentError);
    await expect(access(outFile)).rejects.toThrow();
  });
});

