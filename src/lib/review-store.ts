/**
 * @file 리뷰 추가·수정·삭제 (review-store.ts)
 *
 * 이 파일이 하는 일
 *   저장 API(app/api/reviews/**)가 받은 글쓰기 내용을 검사하고, GitHub 저장소에 커밋으로 올려요.
 *
 *     추가(create) : content/reviews/<주소>.md + 포스터 + 장면 사진을 커밋 하나로 더해요.
 *     수정(update) : 원고를 바꾸고, 더 쓰지 않는 이 리뷰의 포스터·장면 사진은 지워요(저장소를 가볍게).
 *     삭제(delete) : 원고와 이 리뷰의 포스터·장면 사진 폴더를 지워요.
 *     (단, 다른 리뷰 원고가 가져다 쓰는 파일은 지우지 않아요. withoutReferenced 참고)
 *
 * 저장 전에 하는 검사
 *   1. 칸 검사: 글쓰기 화면과 같은 규칙(lib/review-form.ts). 본문 사진은 빌드와 같은 도구로 한 번 더 봐요.
 *   2. 주소 겹침: 새 글의 주소가 이미 있으면 막아요.
 *   3. 고치는 사이 바뀜: 글쓰기 화면을 연 뒤 다른 곳(다른 탭 등)에서 먼저 고쳤으면 덮어쓰지 않고 알려요.
 *      수정 요청에는 처음 불러온 원고의 번호(baseSha)가 꼭 있어야 해요.
 *   4. 파일 확인: 포스터와 본문 사진이 저장소에 있거나 이번에 올린 파일인지(빌드할 때 원고 검사와 같은 확인)
 *   이 검사를 통과해야 커밋해요. 그래서 저장된 글 때문에 빌드가 실패하는 일이 없어요.
 *
 * 누가 쓰나요?
 *   app/api/reviews/route.ts(추가), app/api/reviews/[slug]/route.ts(수정·삭제), app/write/[slug]/page.tsx(고칠 원고 읽기)
 */

import "server-only";

import { commitChanges, createBlob, type FileChange, getSnapshot, readTextBlob, readTextFiles } from "./github";
import { type BodyImage, findImages } from "./markdown";
import { parseReviewFile, serializeReviewFile } from "./review-file";
import { type FieldErrors, validateReviewForm } from "./review-form";
import { imageRefProblems, safeDecode, SLUG } from "./review-schema";
import { EMPTY_VALUES, type ReviewFormValues } from "./review-values";

/** 저장하지 못한 이유. status는 API가 돌려줄 HTTP 상태 번호, errors는 칸별 오류(있을 때만)예요. */
export class ReviewStoreError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly errors?: FieldErrors,
  ) {
    super(message);
    this.name = "ReviewStoreError";
  }
}

/** 사진 올리기 API(app/api/images)가 돌려준 "올린 파일": 저장소 안 경로와 내용 번호(sha) */
export type Upload = { path: string; sha: string };

/** 저장 API가 받는 내용(화면이 보낸 JSON). 칸 값은 모두 글자예요(장르만 글자 목록). 알맞은 값인지는 validateReviewForm이 따로 검사해요. */
export type SavePayload = {
  values: Omit<ReviewFormValues, "genres"> & { genres: string[] };
  /** 이번에 올린 사진 목록 */
  uploads: Upload[];
  /** 수정 화면이 처음 불러온 원고의 sha. 그사이 바뀌었는지 확인하는 데 써요(새 글이면 없어요). */
  baseSha?: string;
};

/** 칸 값 가운데 글자 하나인 칸들(장르와 본문은 따로 봐요) */
const TEXT_FIELDS = [
  "slug",
  "title",
  "originalTitle",
  "year",
  "country",
  "director",
  "runtime",
  "rating",
  "oneLiner",
  "poster",
  "posterAlt",
  "publishedAt",
] as const satisfies readonly (keyof ReviewFormValues)[];

/** 본문은 넉넉히 20만 글자까지 받아요(아주 긴 글도 충분해요). */
const MAX_BODY = 200_000;
/** 장르는 20개까지(장르 목록이 10개라 넉넉해요). */
const MAX_GENRES = 20;
/** 이번에 올린 사진은 한 번에 50장까지 */
const MAX_UPLOADS = 50;

/** 배열이 아닌 객체인지 */
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * 화면이 보낸 JSON이 약속한 모양(SavePayload)인지 확인하고, 약속한 항목만 골라 돌려줘요. 모양이 틀리면 null이에요.
 * (값이 알맞은지 — 평점 범위, 날짜 모양 등 — 는 여기서 보지 않고 saveReview의 validateReviewForm이 봐요.)
 *
 * @param input request.json()으로 읽은 값
 * @returns 약속한 모양이면 그 값(모르는 항목은 뺀 새 객체), 아니면 null
 */
export function readSavePayload(input: unknown): SavePayload | null {
  if (!isRecord(input) || !isRecord(input.values)) return null;
  const raw = input.values;

  const values: Partial<SavePayload["values"]> = {};
  for (const field of TEXT_FIELDS) {
    const value = raw[field];
    if (typeof value !== "string") return null;
    values[field] = value;
  }
  if (typeof raw.body !== "string" || raw.body.length > MAX_BODY) return null;
  values.body = raw.body;
  if (!Array.isArray(raw.genres) || raw.genres.length > MAX_GENRES || !raw.genres.every((genre) => typeof genre === "string")) return null;
  values.genres = [...(raw.genres as string[])];

  if (!Array.isArray(input.uploads) || input.uploads.length > MAX_UPLOADS) return null;
  const uploads: Upload[] = [];
  for (const upload of input.uploads) {
    if (!isRecord(upload) || typeof upload.path !== "string" || typeof upload.sha !== "string") return null;
    uploads.push({ path: upload.path, sha: upload.sha });
  }

  if (input.baseSha !== undefined && typeof input.baseSha !== "string") return null;
  return {
    values: values as SavePayload["values"],
    uploads,
    ...(typeof input.baseSha === "string" ? { baseSha: input.baseSha } : {}),
  };
}

/** 파일 내용 번호(sha)의 모양: 0-9a-f 40글자 */
const SHA = /^[0-9a-f]{40}$/;

/** 원고 파일 경로 */
const reviewPath = (slug: string) => `content/reviews/${slug}.md`;
/** 포스터 파일 경로 */
const posterPath = (file: string) => `public/posters/${file}`;
/** 이 리뷰의 장면 사진 폴더(끝에 / 포함) */
const imagesDir = (slug: string) => `public/images/${slug}/`;

/**
 * 이 리뷰가 올린 파일의 경로로 알맞은지 확인해요. 다른 리뷰의 파일이나 엉뚱한 폴더에 쓰지 못하게 막아요.
 *   - 포스터: public/posters/<주소>.<jpg|jpeg|png|webp|avif>
 *   - 장면 사진: public/images/<주소>/<이름>.<jpg|jpeg|png|gif|webp|avif>
 */
export function isUploadPathFor(path: string, slug: string): boolean {
  const poster = new RegExp(`^public/posters/${slug}\\.(?:jpe?g|png|webp|avif)$`);
  const scene = new RegExp(`^public/images/${slug}/[a-z0-9]+(?:-[a-z0-9]+)*\\.(?:jpe?g|png|gif|webp|avif)$`);
  return SLUG.test(slug) && (poster.test(path) || scene.test(path));
}

/** 포스터 파일이 "이 리뷰 것"인지(이름이 <주소>.확장자인지). 다른 리뷰와 함께 쓰는 포스터는 지우지 않으려고 확인해요. */
function isOwnPoster(file: string, slug: string): boolean {
  return new RegExp(`^${slug}\\.(?:jpe?g|png|webp|avif)$`).test(file);
}

/** 원고 글자에서 포스터 파일 이름을 읽어요. 읽지 못하면 ""예요. */
function posterOf(source: string): string {
  const parsed = parseReviewFile(source);
  return parsed.ok ? parsed.values.poster : "";
}

/**
 * 본문의 사진 주소를 저장소 경로로 바꿔 모아요. 예: "/images/a/%EC%9E%A5%EB%A9%B4.jpg" → "public/images/a/장면.jpg"
 * 사진은 Markdown 변환 도구(findImages)로 찾아서 넘겨받아요. 빌드할 때와 똑같이 찾으려고요. 사이트 안 주소(/로 시작)만 모아요.
 */
function toRepoPaths(images: BodyImage[]): string[] {
  const paths = images
    .map(({ src }) => src)
    .filter((src) => src.startsWith("/") && !src.startsWith("//"))
    // ?나 # 뒤는 떼고, %EA... 모양의 한글은 되돌려요.
    .map((src) => `public${safeDecode(new URL(src, "http://localhost").pathname)}`);
  // 같은 사진을 여러 번 넣었어도 한 번만 세요.
  return [...new Set(paths)];
}

/**
 * 지울 후보 가운데 다른 리뷰 원고가 쓰는 파일은 빼고 돌려줘요.
 *
 * 파일 이름이나 폴더가 "이 리뷰 것"이어도, 다른 리뷰 원고가 같은 사진을 가져다 쓸 수 있어요.
 * 그래서 다른 리뷰 원고를 한 번에 읽어(readTextFiles), 파일 주소가 원고 어딘가에 적혀 있으면 지우지 않아요.
 *   - 포스터는 원고에 파일 이름으로 적혀요(poster: winter-stop.jpg).
 *   - 본문 사진은 /images/... 주소로 적혀요. %EA...나 %6F처럼 인코딩해 적을 수도 있어서, 원고의 인코딩을 풀고 찾아봐요.
 * 원고를 읽지 못하면 아무것도 지우지 않아요. 남은 파일은 저장소를 조금 무겁게 할 뿐 블로그를 깨뜨리지 않거든요.
 *
 * @param candidates 지울 후보 파일 경로들
 * @param commitSha 지금 저장소의 커밋 번호(이 모습의 원고들을 읽어요)
 * @param slug 지금 저장하는(지우는) 리뷰 주소. 이 리뷰 원고는 비교에서 빼요.
 */
async function withoutReferenced(candidates: string[], commitSha: string, slug: string): Promise<string[]> {
  if (candidates.length === 0) return candidates;
  let texts: Map<string, string>;
  try {
    texts = await readTextFiles(commitSha, "content/reviews");
  } catch {
    return [];
  }
  // 다른 원고들. %XX 덩어리는 풀어 둬요(풀 수 없는 덩어리는 그대로). 저장소 경로는 풀린 이름이라 같은 모양으로 비교할 수 있어요.
  const others = [...texts]
    .filter(([path]) => path !== reviewPath(slug))
    .map(([, text]) => text.replace(/(?:%[0-9a-f]{2})+/gi, (run) => safeDecode(run)));
  return candidates.filter((path) => {
    // 원고에 적히는 모양: 포스터는 파일 이름, 본문 사진은 public을 뗀 주소
    const written = path.startsWith("public/posters/") ? path.slice("public/posters/".length) : path.slice("public".length);
    return !others.some((text) => text.includes(written));
  });
}

/**
 * 수정 화면에 보여 줄 원고를 저장소에서 읽어요.
 *
 * @param slug 리뷰 주소
 * @returns 원고 글자(source), 그 내용 번호(sha, 저장할 때 바뀌었는지 비교해요). 없는 리뷰면 null
 */
export async function loadReviewSource(slug: string): Promise<{ source: string; sha: string } | null> {
  if (!SLUG.test(slug)) return null;
  const snapshot = await getSnapshot();
  const sha = snapshot.files.get(reviewPath(slug));
  if (!sha) return null;
  return { source: await readTextBlob(sha), sha };
}

/**
 * 리뷰를 새로 쓰거나 고쳐서 저장소에 커밋해요.
 *
 * @param mode "create"(추가) 또는 "update"(수정)
 * @param slug 리뷰 주소(추가면 칸에 적은 주소, 수정이면 화면 주소의 것)
 * @param payload 화면이 보낸 칸 값·올린 사진·처음 원고 sha
 * @returns 새 커밋 번호와 저장한 주소
 * @throws {ReviewStoreError} 칸 오류(422), 주소 겹침·그사이 바뀜(409), 없는 리뷰(404), 올린 파일 경로 오류(400)
 */
export async function saveReview(mode: "create" | "update", slug: string, payload: SavePayload): Promise<{ commitSha: string; slug: string }> {
  // 화면이 보낸 칸 값을 타입에 맞춰요. 장르는 검사에서 걸러지니 여기서는 글자 그대로 넘겨요.
  const values: ReviewFormValues = { ...EMPTY_VALUES, ...payload.values, slug, genres: payload.values.genres as ReviewFormValues["genres"] };

  // 1) 칸 검사(새 글이면 주소도). 틀린 칸이 있으면 칸별 문구와 함께 돌려보내요.
  const check = validateReviewForm(values, { checkSlug: true });
  if (!check.ok) throw new ReviewStoreError(422, "고칠 곳이 있습니다. 표시한 칸을 확인해 주세요.", check.errors);
  const { frontmatter } = check;

  // 1-2) 본문 사진을 빌드와 같은 도구(findImages)로 찾아 같은 규칙(설명, /로 시작하는 주소)으로 검사해요.
  //      화면 검사는 ![설명](주소) 모양만 찾아서, ![설명][이름] 같은 "참조형" 사진은 여기서 걸러요.
  //      여기서 막지 않으면 저장은 되는데 빌드에서 원고 검사가 실패해 배포가 멈춰요.
  const bodyImages = await findImages(values.body);
  const imageMessages = bodyImages.flatMap(({ src, alt }) => imageRefProblems(src, alt).messages);
  if (imageMessages.length > 0) {
    throw new ReviewStoreError(422, "고칠 곳이 있습니다. 표시한 칸을 확인해 주세요.", { body: imageMessages.join(" ") });
  }

  // 2) 올린 사진 목록 검사: 이 리뷰의 경로이고, sha 모양이 맞아야 해요.
  for (const upload of payload.uploads) {
    if (!isUploadPathFor(upload.path, slug) || !SHA.test(upload.sha)) {
      throw new ReviewStoreError(400, "올린 사진의 저장 위치가 올바르지 않습니다. 화면을 새로 고친 뒤 사진을 다시 넣어 주세요.");
    }
  }
  // 경로 → sha 표. 같은 경로를 두 번 올렸으면 나중 것을 써요.
  const uploaded = new Map(payload.uploads.map((upload) => [upload.path, upload.sha] as const));

  // 3) 원고 글자를 만들고 blob으로 올려 둬요(다시 시도할 때도 같은 내용이라 한 번만 올려요).
  const posterFile = frontmatter.poster;
  const markdown = serializeReviewFile(frontmatter, values.body);
  const markdownSha = await createBlob(new TextEncoder().encode(markdown));
  const images = toRepoPaths(bodyImages);
  // 이 원고가 실제로 쓰는 파일들(포스터 + 본문 사진)
  const used = new Set([...images, ...(posterFile ? [posterPath(posterFile)] : [])]);

  const message = mode === "create" ? `리뷰 추가: ${frontmatter.title}` : `리뷰 수정: ${frontmatter.title}`;
  const commitSha = await commitChanges(message, async (snapshot) => {
    const currentSha = snapshot.files.get(reviewPath(slug));

    // 4) 주소 겹침과 그사이 바뀜 확인
    if (mode === "create" && currentSha) {
      throw new ReviewStoreError(409, "같은 주소의 리뷰가 이미 있습니다.", { slug: "이미 같은 주소의 리뷰가 있습니다. 다른 주소를 적어 주세요. 예: winter-stop-2" });
    }
    if (mode === "update" && !currentSha) {
      throw new ReviewStoreError(404, "수정하려는 리뷰가 저장소에 없습니다. 다른 곳에서 삭제했을 수 있습니다. 목록에서 다시 확인해 주세요.");
    }
    if (mode === "update" && !payload.baseSha) {
      throw new ReviewStoreError(400, "처음 불러온 원고 정보가 없어 저장하지 않았습니다. 화면을 새로 고친 뒤 다시 수정해 주세요.");
    }
    if (mode === "update" && currentSha !== payload.baseSha) {
      throw new ReviewStoreError(409, "이 리뷰를 다른 곳에서 먼저 수정했습니다. 내용을 따로 복사해 둔 뒤 화면을 새로 고쳐 최신 원고에서 다시 수정해 주세요.");
    }

    // 5) 파일 확인: 저장소에 있거나 이번에 올린 파일이어야 해요.
    const exists = (path: string) => snapshot.files.has(path) || uploaded.has(path);
    const errors: FieldErrors = {};
    if (posterFile && !exists(posterPath(posterFile))) {
      errors.poster = `포스터 파일(public/posters/${posterFile})이 저장소에 없습니다. 포스터를 다시 골라 주세요.`;
    }
    const missing = images.filter((path) => !exists(path));
    if (missing.length > 0) {
      errors.body = `본문의 사진 파일이 저장소에 없습니다: ${missing.map((path) => path.slice("public".length)).join(", ")}. [장면 사진 넣기]로 다시 넣어 주세요.`;
    }
    if (Object.keys(errors).length > 0) throw new ReviewStoreError(422, "고칠 곳이 있습니다. 표시한 칸을 확인해 주세요.", errors);

    // 6) 바꿀 파일 목록: 원고 + 이번에 올린 파일 중 실제로 쓰는 것
    const changes: FileChange[] = [{ path: reviewPath(slug), sha: markdownSha }];
    for (const [path, sha] of uploaded) if (used.has(path)) changes.push({ path, sha });

    // 7) 더 쓰지 않는 이 리뷰의 파일 지우기
    //    - 예전 포스터: 이름이 <주소>.확장자인 "이 리뷰 것"이고, 새 원고가 쓰지 않을 때
    //    - 장면 사진 폴더(public/images/<주소>/)의 사진 중 새 본문이 쓰지 않는 것
    //    - 단, 다른 리뷰 원고가 쓰는 파일은 빼요(withoutReferenced).
    const candidates: string[] = [];
    if (mode === "update" && currentSha) {
      const oldPoster = posterOf(await readTextBlob(currentSha));
      if (oldPoster && isOwnPoster(oldPoster, slug) && !used.has(posterPath(oldPoster)) && snapshot.files.has(posterPath(oldPoster))) {
        candidates.push(posterPath(oldPoster));
      }
    }
    for (const path of snapshot.files.keys()) {
      if (path.startsWith(imagesDir(slug)) && !used.has(path)) candidates.push(path);
    }
    for (const path of await withoutReferenced(candidates, snapshot.commitSha, slug)) changes.push({ path, sha: null });
    return changes;
  });

  return { commitSha, slug };
}

/**
 * 리뷰와 이 리뷰의 포스터·장면 사진을 저장소에서 지워요.
 *
 * @param slug 지울 리뷰 주소
 * @returns 커밋 번호와 지운 리뷰 제목
 * @throws {ReviewStoreError} 없는 리뷰면 404
 */
export async function deleteReview(slug: string): Promise<{ commitSha: string; title: string }> {
  // 커밋 메시지에 제목을 넣으려고 먼저 원고를 읽어요.
  const current = await loadReviewSource(slug);
  if (!current) throw new ReviewStoreError(404, "삭제하려는 리뷰가 저장소에 없습니다. 이미 삭제했을 수 있습니다.");
  const parsed = parseReviewFile(current.source);
  const title = parsed.ok && parsed.values.title ? parsed.values.title : slug;

  const commitSha = await commitChanges(`리뷰 삭제: ${title}`, async (snapshot) => {
    const sha = snapshot.files.get(reviewPath(slug));
    if (!sha) throw new ReviewStoreError(404, "삭제하려는 리뷰가 저장소에 없습니다. 이미 삭제했을 수 있습니다.");
    const changes: FileChange[] = [{ path: reviewPath(slug), sha: null }];
    const candidates: string[] = [];
    // 포스터: "이 리뷰 것"일 때만 지울 후보예요.
    const poster = parsed.ok ? parsed.values.poster : "";
    if (poster && isOwnPoster(poster, slug) && snapshot.files.has(posterPath(poster))) candidates.push(posterPath(poster));
    // 장면 사진 폴더의 파일은 모두 지울 후보예요.
    for (const path of snapshot.files.keys()) if (path.startsWith(imagesDir(slug))) candidates.push(path);
    // 다른 리뷰 원고가 쓰는 파일은 빼고 지워요.
    for (const path of await withoutReferenced(candidates, snapshot.commitSha, slug)) changes.push({ path, sha: null });
    return changes;
  });

  return { commitSha, title };
}
