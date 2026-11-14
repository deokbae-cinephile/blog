/**
 * @file 임시 저장 (drafts.ts)
 *
 * 이 파일이 하는 일
 *   글쓰기 화면의 [임시 저장]이 쓰던 리뷰를 이 브라우저에 저장하고, 나중에 다시 불러오고, 지워요.
 *
 *     [임시 저장] ──> 칸 값 + 고른 포스터·장면 사진 파일 ──> 이 브라우저의 IndexedDB("dmb-drafts")
 *     [불러오기]  <── 저장해 둔 그대로(사진 파일까지) ─────────┘
 *
 * 왜 브라우저에 저장하나요?
 *   서버(워커)에 저장 기능을 더하지 않아도 돼서 블로그가 가벼워요. 저장소(GitHub)는 공개라서 쓰다 만 글을 올리지 않아요.
 *   대신 이 브라우저에서만 다시 불러올 수 있어요(다른 기기·다른 브라우저에서는 보이지 않아요).
 *   브라우저가 저장 공간이 모자랄 때 지우지 않게, 처음 저장할 때 "오래 보관"을 부탁해요(navigator.storage.persist).
 *
 * IndexedDB가 뭔가요?
 *   브라우저 안의 작은 데이터베이스예요. localStorage와 달리 사진 같은 파일(File)도 그대로 담을 수 있고, 넉넉하게 담아요.
 *   요청을 보내고 결과를 이벤트(onsuccess 등)로 받는 옛 방식이라, 여기서 Promise로 감싸 await로 쓰게 했어요.
 *
 * 누가 쓰나요?
 *   components/review-writer.tsx(글쓰기 화면의 [임시 저장]·임시 저장한 글 목록)
 */

import type { ReviewFormValues } from "./review-values";

/** 임시 저장한 글 하나 */
export type Draft = {
  /** 임시 저장한 글의 번호(겹치지 않는 무작위 글자) */
  id: string;
  /** 새 리뷰를 쓰다 저장했는지(create), 리뷰를 고치다 저장했는지(edit) */
  mode: "create" | "edit";
  /** 고치던 리뷰의 주소. 새 리뷰면 "" (수정 화면은 그 리뷰의 임시 저장본만 보여 줘요) */
  reviewSlug: string;
  /** 저장한 때(ms) */
  savedAt: number;
  /** 칸 값 전체 */
  values: ReviewFormValues;
  /** 수정: 처음 불러온 원고의 번호(sha). 이어서 저장할 때 그사이 다른 곳에서 고쳤는지 비교해요. */
  baseSha?: string;
  /** 새로 고른 포스터(없으면 null) */
  poster: { file: File; extension: string } | null;
  /** 본문에 넣은 장면 사진: [사이트 주소, 파일] 목록 */
  scenes: [string, File][];
  /** 장면 사진 주소에 들어 있는 리뷰 주소(주소 칸을 고치면 사진 주소도 따라 바꾸려고 기억해요) */
  imagesSlug: string;
};

/** 목록에 보일 짧은 정보 */
export type DraftSummary = Pick<Draft, "id" | "mode" | "reviewSlug" | "savedAt"> & {
  /** 제목 칸에 적은 글자(비었으면 "") */
  title: string;
};

/** 데이터베이스와 그 안의 저장 칸 이름 */
const DB_NAME = "dmb-drafts";
const STORE = "drafts";

/** 데이터베이스를 열어요. 처음이면 저장 칸("drafts", 번호 id가 열쇠)을 만들어요. */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 저장 칸에 일을 하나 시키고, 끝까지 쓰인 뒤(트랜잭션 완료) 결과를 돌려줘요.
 * @param mode "readonly"(읽기) 또는 "readwrite"(쓰기·지우기)
 * @param work 저장 칸에 보낼 요청(get, put 등)
 */
async function withStore<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = work(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

/** 임시 저장한 글 목록(최근에 저장한 것부터). 사진 파일은 목록에 넣지 않아요. */
export async function listDrafts(): Promise<DraftSummary[]> {
  const drafts = await withStore<Draft[]>("readonly", (store) => store.getAll());
  return drafts
    .map(({ id, mode, reviewSlug, savedAt, values }) => ({ id, mode, reviewSlug, savedAt, title: values.title.trim() }))
    .sort((a, b) => b.savedAt - a.savedAt);
}

/** 임시 저장한 글 하나를 사진 파일까지 읽어요. 없으면 undefined */
export function loadDraft(id: string): Promise<Draft | undefined> {
  return withStore<Draft | undefined>("readonly", (store) => store.get(id));
}

/** 임시 저장해요. 같은 번호(id)가 있으면 새 내용으로 바꿔요. */
export async function saveDraft(draft: Draft): Promise<void> {
  await withStore("readwrite", (store) => store.put(draft));
  // 브라우저에 "공간이 모자라도 이 사이트의 저장 내용은 지우지 말아 달라"고 부탁해요. 들어주지 않아도 저장은 돼요.
  void navigator.storage?.persist?.().catch(() => false);
}

/** 임시 저장한 글을 지워요(없으면 아무 일도 하지 않아요). */
export async function deleteDraft(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}
