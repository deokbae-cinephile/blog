/**
 * @file 서비스 워커 (public/sw.js → 주소 "/sw.js")
 *
 * 서비스 워커가 뭔가요?
 *   브라우저와 인터넷 사이에 서서 "요청을 대신 받아 주는" 작은 프로그램이에요.
 *   페이지가 파일을 달라고 하면 서비스 워커가 먼저 받아서, 인터넷에서 가져올지 저장해 둔 것(캐시)을 줄지 정해요.
 *   그래서 인터넷이 끊겨도 한 번 본 화면을 보여 줄 수 있어요. 앱으로 설치하는 데에도 필요해요.
 *
 * 이 파일이 하는 일
 *   1. 설치(install): 처음 화면과 오프라인 안내 화면을 미리 저장해요.
 *   2. 켜기(activate): 예전 판의 저장소를 지우고, 열려 있는 페이지를 바로 맡아요.
 *   3. 요청 가로채기(fetch): 파일 종류마다 다른 규칙으로 답해요.
 *        - 페이지(HTML): 네트워크 먼저 → 끊기면 저장해 둔 것 → 그것도 없으면 오프라인 안내
 *        - 이름에 해시가 붙은 빌드 파일(_next/static/): 저장해 둔 것 먼저(내용이 바뀌면 이름도 바뀌어서 안전해요)
 *        - 그 밖의 파일(포스터, 줄인 포스터, 아이콘 등): 네트워크 먼저 → 끊기면 저장해 둔 것
 *        - 손대지 않는 요청: 로그인·글쓰기 화면과 API(늘 서버의 최신 답이 필요해요),
 *          Next.js의 화면 데이터(RSC) 요청(오프라인이면 Next.js가 알아서 페이지 이동으로 바꾸고, 그때 저장해 둔 HTML을 줘요)
 *   4. 메시지(message): 페이지가 화면을 옮길 때마다 "지금 화면 주소와 쓴 파일들"을 알려 주면 저장해요
 *      (처음 연 화면과 링크로 옮긴 화면도 오프라인에서 다시 열리게).
 *
 * 왜 "네트워크 먼저"인가요?
 *   글쓴이가 새 리뷰를 올리면 인터넷이 될 때는 늘 최신 글을 보여 줘야 하니까요.
 *   저장해 둔 것은 인터넷이 끊겼을 때만 써요.
 *
 * 이 파일은 Next.js가 빌드하지 않고 public 폴더에서 그대로 복사돼요. 그래서 TypeScript가 아니라 자바스크립트예요.
 * 페이지 쪽에서 등록하는 코드는 src/components/service-worker.tsx에 있어요.
 *
 * 저장 규칙을 바꿨다면 아래 VERSION을 올려 주세요(v1 → v2). 예전 저장소를 지우고 새로 시작해요.
 */

/** 저장소(캐시) 판 번호 */
const VERSION = "v1";
/** 이 블로그가 만든 저장소임을 알아보는 이름 앞부분 */
const PREFIX = "blog-";
/** 페이지(HTML)를 담는 저장소 */
const PAGE_CACHE = `${PREFIX}pages-${VERSION}`;
/** 이름에 해시가 붙은 빌드 파일(_next/static)을 담는 저장소 */
const STATIC_CACHE = `${PREFIX}static-${VERSION}`;
/** 그 밖의 파일(포스터, 줄인 포스터, 아이콘, 매니페스트)을 담는 저장소 */
const RUNTIME_CACHE = `${PREFIX}runtime-${VERSION}`;
/** 빌드 파일 저장소에 남겨 둘 최대 개수. 배포할 때마다 새 파일이 생기니 오래된 것부터 지워요. */
const STATIC_LIMIT = 200;

/**
 * 이 서비스 워커가 맡는 주소 범위("/"). sw.js가 놓인 폴더가 곧 범위예요.
 * self는 서비스 워커 자기 자신이에요(페이지의 window와 비슷해요).
 */
const SCOPE = new URL(self.registration.scope).pathname;
/** 오프라인 안내 화면 주소(src/app/offline/page.tsx) */
const OFFLINE_URL = `${SCOPE}offline`;
/** 서비스 워커가 손대지 않는 주소 앞부분: 저장 API, 로그인·글쓰기 화면(글쓴이 화면은 저장해 두지 않아요) */
const BYPASS = [`${SCOPE}api/`, `${SCOPE}login`, `${SCOPE}write`];

/**
 * 손대지 않을 요청인지 알려 줘요.
 * - BYPASS의 주소
 * - Next.js가 링크를 누를 때 받는 "화면 데이터(RSC)" 요청: 머리글에 RSC가 있거나 주소에 _rsc가 붙어 있어요.
 *   같은 주소의 HTML과 섞여 저장되면 오프라인에서 엉뚱한 글자가 보일 수 있어서 저장하지 않아요.
 *
 * @param {Request} request 요청
 * @param {URL} url 요청 주소
 */
function shouldBypass(request, url) {
  return BYPASS.some((prefix) => url.pathname.startsWith(prefix)) || request.headers.has("RSC") || url.searchParams.has("_rsc");
}

/**
 * 저장소에서 쓸 "열쇠(키)"를 만들어요.
 * - ?q= 같은 조건과 #은 떼요. 목록·상세 화면은 조건이 달라도 같은 HTML이에요.
 *   단, 줄인 포스터(/_next/image?url=...&w=96)는 조건마다 다른 그림이라 조건을 남겨 둬요.
 * - 끝의 /도 떼요(맨 처음 주소는 빼고). "/reviews/a"와 "/reviews/a/"를 같은 페이지로 보게 해요.
 *
 * @param {string} href 주소
 * @returns {string} 열쇠로 쓸 주소
 */
function cacheKey(href) {
  const url = new URL(href, self.location.origin);
  if (!url.pathname.startsWith(`${SCOPE}_next/image`)) url.search = "";
  url.hash = "";
  if (url.pathname !== SCOPE && url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1);
  return url.href;
}

/**
 * 주소를 받아 저장소에 넣어요. 실패해도(인터넷이 없거나 파일이 없어도) 조용히 넘어가요.
 *
 * @param {string} cacheName 넣을 저장소 이름
 * @param {string} href 받아 올 주소
 * @param {{ skipIfCached?: boolean }} [options] skipIfCached: 이미 저장돼 있으면 다시 받지 않아요(빌드 파일·포스터용).
 */
async function store(cacheName, href, { skipIfCached = false } = {}) {
  try {
    if (skipIfCached && (await caches.match(cacheKey(href)))) return;
    const response = await fetch(href);
    // ok(200번대)인 응답만 넣어요. 404 같은 실패 응답을 저장해 두면 나중에 그 오류를 계속 보여 주게 돼요.
    if (response.ok) await (await caches.open(cacheName)).put(cacheKey(href), response);
  } catch {
    // 아무것도 하지 않아요.
  }
}

/** 어떤 저장소에 넣을지 주소로 정해요. */
function cacheNameFor(url) {
  if (url.pathname.startsWith(`${SCOPE}_next/static/`)) return STATIC_CACHE;
  return RUNTIME_CACHE;
}

/** 저장소에 너무 많이 쌓이면 오래된 것(먼저 넣은 것)부터 지워요. */
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(key);
}

/**
 * 응답을 저장소에 넣어요. 저장에 실패해도(예: 기기 저장 공간이 부족해 QuotaExceededError) 조용히 넘어가요.
 * 저장은 "덤"이에요. 저장에 실패했다고 이미 받은 응답까지 버리면 안 되니까, 받기와 저장을 따로 처리해요.
 *
 * @param {string} cacheName 넣을 저장소 이름
 * @param {Request | string} key 열쇠
 * @param {Response} response 넣을 응답(원본은 화면에 줘야 하니 복사본을 넘겨요)
 */
async function putSafely(cacheName, key, response) {
  try {
    await (await caches.open(cacheName)).put(key, response);
  } catch {
    // 아무것도 하지 않아요.
  }
}

/**
 * [규칙] 네트워크 먼저
 * 인터넷에서 받아 오면 저장소에도 넣고, 받기에 실패하면 저장해 둔 것을 줘요.
 *
 * @param {Request} request 요청
 * @param {string} cacheName 넣을 저장소
 * @param {string} [fallback] 저장해 둔 것도 없을 때 대신 줄 주소(페이지면 오프라인 안내)
 */
async function networkFirst(request, cacheName, fallback) {
  const key = cacheKey(request.url);
  let response;
  try {
    response = await fetch(request);
  } catch {
    // 받기에 실패했어요(인터넷이 끊겼어요). 저장해 둔 것을 찾아봐요.
    const cached = await caches.match(key);
    if (cached) return cached;
    if (fallback) {
      const offline = await caches.match(cacheKey(fallback));
      if (offline) return offline;
    }
    // 줄 것이 없으면 "네트워크 오류"로 답해요(페이지가 알아서 처리해요).
    return Response.error();
  }
  // 받기에 성공했어요. ok(200번대)면 저장소에도 넣어요. 저장에 실패해도 받은 응답은 그대로 줘요.
  if (response.ok) await putSafely(cacheName, key, response.clone());
  // 404 같은 응답도 그대로 돌려줘요(저장만 하지 않아요).
  return response;
}

/**
 * [규칙] 저장한 것 먼저
 * 이름에 해시가 붙은 빌드 파일은 내용이 바뀌면 이름도 바뀌어요. 그래서 한 번 받은 것은 언제나 맞아요.
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await putSafely(STATIC_CACHE, request, response.clone());
    // 정리에 실패해도 받은 파일은 그대로 줘요.
    await trim(STATIC_CACHE, STATIC_LIMIT).catch(() => {});
  }
  return response;
}

/* ──────────────────────────────────────────────────────────────
 * 1. 설치: 처음 화면과 오프라인 안내 화면을 미리 저장해요.
 * ────────────────────────────────────────────────────────────── */
self.addEventListener("install", (event) => {
  // waitUntil: 안의 일이 끝날 때까지 "설치 중"으로 기다려 달라는 뜻이에요.
  event.waitUntil(Promise.all([store(PAGE_CACHE, SCOPE), store(PAGE_CACHE, OFFLINE_URL)]));
  // 새 판이 설치되면 기다리지 않고 바로 켜요(예전 판이 열린 창이 모두 닫히기를 기다리지 않아요).
  self.skipWaiting();
});

/* ──────────────────────────────────────────────────────────────
 * 2. 켜기: 예전 판 저장소를 지우고, 열려 있는 페이지를 바로 맡아요.
 * ────────────────────────────────────────────────────────────── */
self.addEventListener("activate", (event) => {
  const current = [PAGE_CACHE, STATIC_CACHE, RUNTIME_CACHE];
  event.waitUntil(
    caches
      .keys()
      // 이 블로그의 저장소(PREFIX로 시작) 중 지금 판이 아닌 것만 지워요. 다른 사이트 것은 건드리지 않아요.
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && !current.includes(key)).map((key) => caches.delete(key))))
      // clients.claim(): 새로 고침하지 않아도 지금 열린 페이지들을 바로 맡아요.
      .then(() => self.clients.claim()),
  );
});

/* ──────────────────────────────────────────────────────────────
 * 3. 요청 가로채기: 파일 종류마다 다른 규칙으로 답해요.
 * ────────────────────────────────────────────────────────────── */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  // 파일을 "받기만" 하는 GET 요청만 다뤄요.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // 다른 사이트의 파일, 맡은 범위 밖의 주소, 손대지 않을 요청(API·글쓴이 화면·화면 데이터)은 브라우저가 평소대로 처리해요.
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE) || shouldBypass(request, url)) return;

  // 페이지 이동(주소창 입력, 링크 새 창, 새로 고침)
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGE_CACHE, OFFLINE_URL));
    return;
  }
  // 이름에 해시가 붙은 빌드 파일
  if (url.pathname.startsWith(`${SCOPE}_next/static/`)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  // 그 밖의 파일(포스터, 줄인 포스터, 아이콘, 매니페스트)
  event.respondWith(networkFirst(request, cacheNameFor(url)));
});

/* ──────────────────────────────────────────────────────────────
 * 4. 메시지: 페이지가 알려 준 주소들을 저장해요(src/components/service-worker.tsx가 보내요).
 *    - 처음 연 화면: 서비스 워커가 그 화면이 다 뜬 "뒤에" 켜져서, 그 화면의 파일(CSS, JS, 글꼴)을 거치지 않았어요.
 *    - 링크로 옮긴 화면: Next.js가 HTML 대신 "화면 데이터(RSC)"만 받아서, 그 화면의 HTML이 여기를 거치지 않았어요.
 *    그래서 페이지가 화면을 옮길 때마다 "지금 화면 주소와 쓴 파일 목록"을 보내 주면 여기서 받아 저장해요.
 * ────────────────────────────────────────────────────────────── */
self.addEventListener("message", (event) => {
  // ?.는 data가 비어 있으면 type을 읽지 않고 넘어간다는 뜻이에요.
  if (event.data?.type !== "CACHE_URLS") return;
  const { pages = [], assets = [] } = event.data;
  /** 저장해도 되는 주소인지: 같은 사이트, 맡은 범위 안, 손대지 않을 주소가 아님(화면 데이터 _rsc 포함) */
  const allowed = (url) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith(SCOPE) &&
    !BYPASS.some((prefix) => url.pathname.startsWith(prefix)) &&
    !url.searchParams.has("_rsc");
  const jobs = [
    // 페이지는 늘 새로 받아 저장해요(글이 고쳐졌을 수 있으니까요). 글쓴이 화면은 빼요.
    ...pages.filter((href) => allowed(new URL(href, self.location.origin))).map((href) => store(PAGE_CACHE, href)),
    ...assets
      .map((href) => new URL(href, self.location.origin))
      .filter(allowed)
      // 파일은 이미 저장했으면 건너뛰어요. 화면을 옮길 때마다 같은 파일을 다시 받지 않게요.
      .map((url) => store(cacheNameFor(url), url.href, { skipIfCached: true })),
  ];
  event.waitUntil(Promise.all(jobs));
});
