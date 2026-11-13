/**
 * @file 리뷰 원고 읽기 (load-reviews.ts)
 *
 * 이 파일이 하는 일
 *   content/reviews 폴더의 리뷰 원고(.md 파일)를 읽어, 화면에서 쓸 수 있는 리뷰 데이터로 바꿉니다.
 *
 * 맡은 기능
 *   1. 폴더 안의 원고 파일 목록 읽기 (이름이 _로 시작하는 파일은 건너뜀. 예: 쓰다 만 _draft.md)
 *   2. 원고 맨 위 정보 영역(frontmatter) 읽기 → lib/review-schema.ts 규칙으로 검사
 *   3. 포스터를 적었다면 public/posters에 그 파일이 정말 있는지 확인하기
 *   4. 본문 사진마다 설명(대체 텍스트)을 적었는지, 파일이 public 폴더에 정말 있는지 확인하고 크기 재기
 *   5. 본문(Markdown)을 HTML로 바꾸기 → lib/markdown.ts
 *   6. 고칠 곳이 있으면 빌드를 멈추고, 파일 이름과 고치는 방법을 한꺼번에 알려 주기
 *   7. 화면이 쓰기 편한 함수 제공: 전체 목록, 한 편 찾기, 앞뒤 리뷰 찾기
 *
 * 이 코드는 언제, 어디서 돌아가나요?
 *   "빌드할 때 서버(내 컴퓨터, CI, 호스팅의 빌드 서버)"에서만 돌아갑니다.
 *   목록·상세 화면은 빌드할 때 미리 만들어 두기 때문에, 방문자가 올 때는 이 코드가 다시 돌지 않아요.
 *   (글쓴이가 새 리뷰를 저장하면 저장소에 원고가 올라가고, 호스팅이 다시 빌드하면서 이 코드가 새 원고를 읽어요.)
 *   파일을 읽는 node:fs는 브라우저에는 없어서, 이 파일을 브라우저용 코드에서 가져오면 안 돼요.
 *   맨 위의 `import "server-only"`가 그런 실수를 막아 줍니다(실수로 가져오면 빌드가 오류를 냅니다).
 *
 * 누가 쓰나요?
 *   app/page.tsx(목록), app/reviews/[slug]/page.tsx(상세), app/sitemap.ts
 */

import "server-only";

// node:fs/promises는 Node.js가 주는 "파일 다루기" 도구예요. promises 버전이라 await로 기다릴 수 있습니다.
// access는 "파일이 있는지(읽을 수 있는지)" 확인할 때 써요. 없으면 오류를 던져요.
import { access, readdir, readFile } from "node:fs/promises";
// node:path는 폴더·파일 경로를 운영체제에 맞게 이어 붙이거나 계산해 주는 도구예요.
import path from "node:path";

// image-size: 그림 파일(JPG·PNG·WebP·GIF 등)의 앞부분만 읽어 가로·세로 크기를 알려 주는 도구예요.
import { imageSizeFromFile } from "image-size/fromFile";
// VFile은 "가상 파일"이에요. 파일 내용과 경로, 부가 정보(data)를 한 묶음으로 들고 다닙니다.
import { VFile } from "vfile";
// matter는 가상 파일 맨 위의 YAML 정보 영역(---로 감싼 부분)을 읽어 file.data.matter에 넣어 줘요.
import { matter } from "vfile-matter";

import { findImages, type ImageSize, renderMarkdown } from "./markdown";
import { compareLatest, type Review, type ReviewSummary } from "./review";
// SLUG: 원고 파일 이름(= 주소) 규칙, imageRefProblems: 사진 설명·주소 규칙. 글쓰기 저장 API(lib/review-form.ts)와 함께 써요.
import { imageRefProblems, reviewFrontmatterSchema, safeDecode, SLUG, WEB_IMAGE_TYPES } from "./review-schema";

/**
 * 원고에 고칠 곳이 있을 때 던지는 오류예요.
 *
 * 그냥 Error를 쓰지 않고 따로 만든 이유:
 *   고칠 곳 목록(problems)을 함께 담아 두면, 테스트에서 "어떤 문제가 몇 개인지" 정확히 확인할 수 있어요.
 *
 * `class A extends Error`는 "Error의 성질을 물려받은 A라는 새 종류의 오류"를 만든다는 뜻입니다.
 */
export class ReviewContentError extends Error {
  /**
   * @param problems 고칠 곳 목록. 한 줄에 "파일 경로: 고치는 방법"이 들어 있어요.
   * @param what 무슨 원고인지. 메시지 첫 줄에 써요. 기본 "리뷰 원고"
   */
  constructor(
    readonly problems: readonly string[],
    what = "리뷰 원고",
  ) {
    // super(...)는 부모(Error)의 생성자를 부르는 것으로, 넘긴 글자가 오류 메시지(message)가 됩니다.
    super(
      [
        `${what} ${problems.length}곳을 고쳐야 합니다.`,
        // 고칠 곳마다 앞에 "- "를 붙여 목록처럼 보이게 해요.
        ...problems.map((problem) => `- ${problem}`),
        "원고 틀: content/templates/review.md",
      ].join("\n"), // 줄바꿈(\n)으로 이어 여러 줄 메시지로 만듭니다.
    );
    // 오류 이름. 터미널에 "ReviewContentError: ..."처럼 보여요.
    this.name = "ReviewContentError";
  }
}

/**
 * 폴더 안의 리뷰 원고를 모두 읽어, 최근에 쓴 글부터 돌려줍니다.
 *
 * 고칠 곳을 하나 찾자마자 멈추지 않고 끝까지 살펴본 뒤 한꺼번에 알려 줘요.
 * 글쓴이가 고치고 빌드하고, 또 다른 오류를 보고 다시 고치는 일을 줄이려는 거예요.
 *
 * @param dir 원고 폴더 경로
 * @param options.publicDir 포스터(posters/)와 본문 사진이 있는 폴더. 기본은 public (테스트에서는 임시 폴더를 넘겨요)
 * @returns 리뷰 목록(최신순)
 * @throws {ReviewContentError} 고칠 곳이 하나라도 있으면
 */
export async function loadReviews(
  dir: string,
  // turbopackIgnore: 아래 reviewsDir() 설명 참고(빌드할 때만 읽는 폴더라 서버 묶음에 넣지 않아요).
  { publicDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "public") }: { publicDir?: string } = {},
): Promise<Review[]> {
  // 1) 폴더 안의 파일 이름을 모두 읽은 뒤
  //    - .md로 끝나고
  //    - _로 시작하지 않는(_draft.md 같은 쓰다 만 글 제외)
  //    이름만 남겨 가나다·알파벳 순으로 정렬해요. 정렬해 두면 오류 메시지 순서가 늘 같습니다.
  const names = (await readdir(dir)).filter((name) => name.endsWith(".md") && !name.startsWith("_")).sort();

  // 고칠 곳과 읽어 낸 리뷰를 모을 빈 배열을 준비해요.
  const problems: string[] = [];
  const reviews: Review[] = [];

  // 2) 파일을 하나씩 차례로 처리합니다. (for...of는 배열을 처음부터 끝까지 도는 반복문이에요.)
  for (const name of names) {
    // 폴더 경로 + 파일 이름 = 파일의 전체 경로
    const file = path.join(dir, name);
    // 오류 메시지에는 "content/reviews/a.md"처럼 프로젝트 기준의 짧은 경로를 보여 줍니다.
    const where = path.relative(process.cwd(), file);
    // "winter-stop.md"에서 끝의 ".md"(3글자)를 잘라 "winter-stop"을 만들어요. 이것이 주소가 됩니다.
    const slug = name.slice(0, -".md".length);

    // 2-1) 파일 이름 검사. 틀리면 고칠 곳에 적고(push) 다음 파일로 넘어가요(continue).
    if (!SLUG.test(slug)) {
      problems.push(`${where}: 파일 이름은 영어 소문자, 숫자, 하이픈(-)으로만 짓습니다. 예: winter-stop.md`);
      continue;
    }

    // 2-2) 파일 내용을 글자(utf8)로 읽어 가상 파일에 담아요.
    const vfile = new VFile({ path: file, value: await readFile(file, "utf8") });

    // 2-3) 맨 위 정보 영역을 읽어요. strip: true면 정보 영역을 본문에서 떼어 냅니다(본문만 남아요).
    //      YAML 문법이 틀리면(괄호 짝이 안 맞는 등) 오류가 나므로 try...catch로 붙잡아 고칠 곳에 적어요.
    try {
      matter(vfile, { strip: true });
    } catch (error) {
      // 오류 메시지는 여러 줄일 수 있어 첫 줄만 덧붙입니다.
      const reason = (error as Error).message.split("\n")[0];
      problems.push(
        `${where}: 맨 위 --- 사이의 항목을 읽지 못했습니다. 콜론(:) 뒤에 한 칸을 띄웠는지, 따옴표 짝이 맞는지 확인하세요. (${reason})`,
      );
      continue;
    }

    // 2-4) 읽어 낸 정보를 검사 규칙에 넣어 봐요.
    //      safeParse는 실패해도 오류를 던지지 않고 { success: false, error }를 돌려줘서 다루기 편해요.
    const parsed = reviewFrontmatterSchema.safeParse(vfile.data.matter);
    if (!parsed.success) {
      // 문제(issue)마다 "파일 경로: 문구" 한 줄씩 고칠 곳에 더합니다.
      problems.push(...parsed.error.issues.map((issue) => `${where}: ${issue.message}`));
      continue;
    }

    // 2-5) 포스터를 적었다면 그 파일이 public/posters에 정말 있는지 확인해요.
    //      파일 이름 모양은 검사 규칙이 이미 봤지만, 파일을 빠뜨리고 올리는 실수는 여기서만 잡을 수 있어요.
    const { poster, ...frontmatter } = parsed.data;
    if (poster) {
      try {
        await access(path.join(publicDir, "posters", poster));
      } catch {
        problems.push(
          `${where}: 포스터 파일을 찾을 수 없습니다: public/posters/${poster}. 그 폴더에 파일을 넣었는지, 이름이 똑같은지 확인하세요.`,
        );
        continue;
      }
    }

    // 2-6) 본문 사진을 확인하고 크기를 재요. 고칠 곳이 있으면 적어 두고 다음 파일로 넘어가요.
    const body = String(vfile.value);
    const images = await checkImages(body, publicDir);
    if (images.problems.length > 0) {
      problems.push(...images.problems.map((problem) => `${where}: ${problem}`));
      continue;
    }

    // 2-7) 통과! 주소(slug) + 검사한 정보 + 포스터 주소 + 본문 HTML을 합쳐 리뷰 한 편을 만들어요.
    //      `...객체`는 "펼치기" 문법으로, 객체 안의 항목을 모두 꺼내 새 객체에 넣습니다.
    //      `...(조건 ? { a: 1 } : {})`는 조건이 참일 때만 a 항목을 넣는 요령이에요(포스터가 없으면 항목 자체를 만들지 않아요).
    reviews.push({
      slug,
      ...frontmatter,
      ...(poster ? { poster: `/posters/${poster}` } : {}),
      html: await renderMarkdown(body, { imageSizes: images.sizes }),
    });
  }

  // 3) 고칠 곳이 하나라도 있으면 오류를 던져 빌드를 멈춰요. 잘못된 글이 블로그에 올라가지 않게 하는 안전장치입니다.
  if (problems.length > 0) throw new ReviewContentError(problems);

  // 4) 최신순으로 정렬해 돌려줘요.
  return reviews.sort(compareLatest);
}

/**
 * 원고 본문의 사진을 하나씩 확인하고 크기를 재요.
 *
 * 확인하는 것
 *   1~3. 설명(대체 텍스트)을 적었는지, /로 시작하는 사이트 안 주소인지, 주소에 ./ 이나 ../가 없는지
 *        → 글쓰기 저장 API도 똑같이 검사해서 lib/review-schema.ts의 imageRefProblems로 나눠 두었어요.
 *   4. 파일이 public 폴더에 정말 있고, 브라우저가 보여 줄 수 있는 그림 형식(JPG·PNG·WebP·AVIF·GIF)인지: 크기를 재 보면서 함께 확인해요.
 *
 * @param markdown 원고 본문
 * @param publicDir public 폴더 경로
 * @returns sizes: 사진 크기 표(주소 → 크기), problems: 고칠 곳 목록(파일 경로는 부르는 쪽이 붙여요)
 */
export async function checkImages(markdown: string, publicDir: string) {
  const sizes = new Map<string, ImageSize>();
  const problems: string[] = [];

  for (const { src, alt } of await findImages(markdown)) {
    // 오류 메시지에 보여 줄 주소. 한글 파일 이름은 %EA%B2%A8처럼 바뀌어 있어서 사람이 읽을 수 있게 되돌려요.
    const shown = safeDecode(src);

    // 1~3번(설명, /로 시작하는 주소, ./ ../ 없음)은 글쓰기 저장 API도 똑같이 검사해서 함께 쓰는 함수로 나눠 두었어요(lib/review-schema.ts).
    const refProblems = imageRefProblems(src, alt);
    problems.push(...refProblems.messages);
    // 주소 모양이 틀렸으면 파일을 찾아볼 수 없으니 다음 사진으로 넘어가요.
    if (!refProblems.pathOk) continue;
    // 같은 사진을 두 번 넣었으면 한 번만 재요.
    if (sizes.has(src)) continue;

    // new URL(...).pathname은 ?나 # 뒤를 떼어 낸 주소를 줘요.
    const { pathname } = new URL(src, "http://localhost");

    let info: Awaited<ReturnType<typeof imageSizeFromFile>>;
    try {
      // 주소 → 파일 경로. decodeURIComponent는 %EA%B2%A8 같은 글자를 한글로 되돌려요.
      const file = path.join(publicDir, decodeURIComponent(pathname));
      // %2F(/를 바꾼 글자)로 숨긴 "../"가 public 폴더 밖의 파일을 가리키지 못하게 막아요. relative가 ".."로 시작하면 폴더 밖이에요.
      if (path.relative(publicDir, file).startsWith("..")) throw new Error("public 폴더 밖");
      info = await imageSizeFromFile(file);
    } catch {
      problems.push(
        `사진 파일을 찾을 수 없거나 읽을 수 없습니다: public${shown}. 그 폴더에 파일을 넣었는지, 이름이 똑같은지, 그림 파일인지 확인하세요.`,
      );
      continue;
    }

    // 크기는 쟀어도 브라우저가 보여 주지 못하는 형식이면 받지 않아요.
    if (!WEB_IMAGE_TYPES.has(info.type ?? "")) {
      problems.push(
        `사진 ${shown}: 블로그에서 보여 줄 수 없는 형식(${info.type ?? "알 수 없음"})입니다. JPG·PNG·WebP·AVIF·GIF로 바꿔 올려 주세요(아이폰 사진 HEIC는 JPG로).`,
      );
      continue;
    }

    // 휴대폰 사진에는 "돌려서 보여 줘"라는 표시(orientation)가 들어 있기도 해요. 5~8은 90도로 돌리라는 뜻이라,
    // 브라우저가 보여 주는 모양에 맞춰 가로와 세로를 바꿔 적어요.
    const { width, height, orientation } = info;
    sizes.set(src, orientation !== undefined && orientation >= 5 ? { width: height, height: width } : { width, height });
  }

  return { sizes, problems };
}


/**
 * 원고 폴더의 위치를 정합니다.
 *
 * 평소에는 content/reviews를 읽어요. E2E 테스트는 결과가 늘 같도록
 * 환경 변수 REVIEWS_DIR로 시험용 원고 폴더(e2e/fixtures/reviews)를 대신 읽게 합니다.
 * process.cwd()는 명령을 실행한 위치(프로젝트 폴더)예요.
 */
function reviewsDir(): string {
  // turbopackIgnore: 빌드 도구(Turbopack)에게 "이 경로는 따라가 묶지 마"라고 알려요.
  //   원고는 빌드할 때만 읽어서 서버 실행 파일에 넣을 필요가 없어요. 따라가면 프로젝트 전체가 서버 묶음에 들어가 배포가 무거워져요.
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.REVIEWS_DIR ?? "content/reviews");
}

/** 한 번 읽은 결과를 담아 두는 곳(캐시)이에요. 처음에는 비어 있습니다(undefined). */
let loaded: Promise<Review[]> | undefined;

/**
 * 모든 리뷰를 돌려줍니다(최신순).
 *
 * - 빌드할 때(production): 리뷰 페이지가 여러 장 만들어지는데, 그때마다 원고를 다시 읽으면 느리겠죠.
 *   그래서 처음 한 번 읽은 결과를 `loaded`에 담아 두고 계속 다시 씁니다.
 * - 개발 서버(pnpm dev): 원고를 고치면 새로 고침만 해도 바로 보여야 하니 매번 새로 읽어요.
 */
export function getAllReviews(): Promise<Review[]> {
  // NODE_ENV는 Next.js가 정해 주는 값이에요. 빌드하면 "production", 개발 서버면 "development"입니다.
  if (process.env.NODE_ENV !== "production") return loadReviews(reviewsDir());
  // `A ??= B`는 "A가 비어 있을 때만 B를 넣는다"는 뜻이에요. 두 번째부터는 담아 둔 결과를 그대로 씁니다.
  loaded ??= loadReviews(reviewsDir());
  return loaded;
}

/**
 * 리뷰에서 본문(html)을 뺀 목록용 정보만 남깁니다.
 * 처음 화면은 목록 전체를 브라우저로 보내므로 본문을 빼 가볍게 해요.
 */
function toSummary(review: Review): ReviewSummary {
  // 구조 분해: html은 따로 꺼내고, 나머지 항목은 모두 summary에 모아요.
  const { html, ...summary } = review;
  // html은 쓰지 않는다고 분명히 해 둡니다. (안 쓰는 변수가 있다는 린트 경고를 피하는 관용 표현이에요.)
  void html;
  return summary;
}

/** 목록 화면용: 모든 리뷰의 목록 정보(본문 제외)를 최신순으로 돌려줘요. */
export async function getReviewSummaries(): Promise<ReviewSummary[]> {
  return (await getAllReviews()).map(toSummary);
}

/**
 * 상세 화면용: 주소(slug)에 맞는 리뷰 한 편을 찾아요.
 *
 * @param slug 원고 파일 이름(확장자 제외)
 * @returns 리뷰. 없으면 null
 */
export async function getReviewBySlug(slug: string): Promise<Review | null> {
  // find는 조건에 맞는 첫 항목을, 없으면 undefined를 돌려줘요. `?? null`로 "없음"을 null로 통일합니다.
  return (await getAllReviews()).find((review) => review.slug === slug) ?? null;
}

/**
 * 상세 화면 아래의 "이전 리뷰 / 다음 리뷰" 링크용으로, 쓴 날 순서의 바로 앞뒤 리뷰를 찾아요.
 *
 * 목록이 최신순이라 배열에서 한 칸 앞(index - 1)이 "더 최근에 쓴 글(다음)",
 * 한 칸 뒤(index + 1)가 "더 예전에 쓴 글(이전)"이에요.
 *
 * @param slug 지금 보고 있는 리뷰의 주소
 */
export async function getNeighbors(
  slug: string,
): Promise<{ newer: ReviewSummary | null; older: ReviewSummary | null }> {
  const reviews = await getAllReviews();
  // findIndex는 조건에 맞는 항목의 위치(0부터)를, 없으면 -1을 돌려줘요.
  const index = reviews.findIndex((review) => review.slug === slug);
  if (index === -1) return { newer: null, older: null };

  // 배열 범위를 벗어난 칸(맨 앞의 앞, 맨 뒤의 뒤)은 undefined가 나와요.
  const newer = reviews[index - 1];
  const older = reviews[index + 1];
  // 있으면 목록 정보로 줄이고, 없으면 null을 돌려줍니다.
  return { newer: newer ? toSummary(newer) : null, older: older ? toSummary(older) : null };
}

