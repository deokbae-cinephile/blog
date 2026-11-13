/**
 * @file 브라우저 저장소에 값 기억하기 (stored-value.ts)
 *
 * 이 파일이 하는 일
 *   localStorage(브라우저 저장소)에 값을 넣고 꺼내는 일을 안전하게 묶어 둔 도구예요.
 *   React의 useSyncExternalStore와 함께 쓰면, 저장소 값이 바뀔 때 화면도 저절로 다시 그려져요.
 *
 *     const store = createStoredValue("이름표", 읽기 함수, 쓰기 함수);
 *     const value = useSyncExternalStore(store.subscribe, store.get, () => 기본값);
 *     store.set(새 값); // 저장하고, 이 값을 보는 화면에 "바뀌었어요"라고 알려요.
 *
 * 왜 "안전하게"가 필요할까요?
 *   - 개인 정보 보호 모드 등에서는 저장소를 쓸 수 없어 오류가 나요. → 이번 방문 동안은 memory 변수에 기억해요.
 *   - 저장된 글자가 깨져 있을 수 있어요. → 읽기 함수(parse)가 기본값으로 돌려놓아요.
 *   - useSyncExternalStore는 값이 그대로면 "같은 객체"를 받아야 해요(아니면 끝없이 다시 그려요).
 *     → 저장된 글자가 같으면 지난번에 만든 값을 그대로 돌려줘요.
 *
 * 누가 쓰나요?
 *   components/keyboard-help.tsx(키보드 조작 안내의 열림 상태)
 */

/** createStoredValue가 돌려주는 도구 묶음 */
export type StoredValue<T> = {
  /** 지금 값을 읽어요. 값이 그대로면 늘 같은 객체를 돌려줘요. */
  get: () => T;
  /** 값을 저장하고, 보고 있는 화면에 알려요. */
  set: (value: T) => void;
  /** 값이 바뀌면 알려 달라고 등록해요. 돌려준 함수를 부르면 등록을 풀어요. */
  subscribe: (listener: () => void) => () => void;
};

/**
 * 브라우저 저장소의 값 하나를 다루는 도구를 만들어요.
 *
 * @param key 저장소 이름표. 다른 기능과 겹치지 않게 "blog:"로 시작해요.
 * @param parse 저장된 글자(없으면 null)를 값으로 바꾸는 함수. 깨진 글자도 기본값으로 바꿔야 해요.
 * @param serialize 값을 저장할 글자로 바꾸는 함수
 */
export function createStoredValue<T>(
  key: string,
  parse: (raw: string | null) => T,
  serialize: (value: T) => string,
): StoredValue<T> {
  /** 저장소를 쓸 수 없을 때 대신 기억하는 글자 */
  let memory: string | null = null;
  /** 이번 방문에서 저장(setItem)에 실패한 적이 있는지. 그 뒤로는 저장소의 예전 값보다 memory를 믿어요. */
  let writeFailed = false;
  /** 값이 바뀌면 알려 줄 대상(화면)들 */
  const listeners = new Set<() => void>();
  /** 지난번에 읽은 글자와 그때 만든 값(같은 글자면 같은 값을 돌려주려고 기억해 둬요) */
  let cachedRaw: string | null | undefined;
  let cachedValue: T;

  /**
   * 저장된 글자를 읽어요.
   *   - 저장에 실패한 적이 있으면: 방금 정한 값(memory)을 써요. 저장소에는 예전 값이 남아 있을 수 있거든요.
   *   - 저장소를 읽을 수 있으면: 읽은 값을 그대로 써요. 다른 탭에서 지워서 null이면 null(= 기본값)이에요.
   *   - 저장소를 읽을 수 없으면(오류): memory를 써요.
   */
  function readRaw(): string | null {
    if (writeFailed) return memory;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memory;
    }
  }

  return {
    get() {
      const raw = readRaw();
      // 글자가 지난번과 다를 때만 새로 바꿔요.
      if (raw !== cachedRaw) {
        cachedRaw = raw;
        cachedValue = parse(raw);
      }
      return cachedValue;
    },

    set(value) {
      const raw = serialize(value);
      memory = raw;
      try {
        window.localStorage.setItem(key, raw);
        // 저장에 성공했으면 저장소를 다시 믿어요(다른 탭의 변경도 다시 읽혀요).
        writeFailed = false;
      } catch {
        // 저장소를 쓸 수 없으면 memory만으로 기억해요(새로 고치면 잊어요).
        writeFailed = true;
      }
      listeners.forEach((listener) => listener());
    },

    subscribe(listener) {
      listeners.add(listener);
      // "storage" 이벤트: 같은 블로그를 연 다른 탭에서 저장소를 바꾸면 알려 줘요. 탭끼리 상태가 맞춰져요.
      const onStorage = (event: StorageEvent) => {
        if (event.key === key || event.key === null) listener();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}
