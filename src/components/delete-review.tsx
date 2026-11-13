/**
 * @file 리뷰 지우기 (delete-review.tsx)
 *
 * 이 파일이 하는 일
 *   [지우기] 단추를 누르면 "정말 지울까요?" 확인 창을 띄우고, [지우기]를 한 번 더 눌러야 지워요.
 *   지우면 저장소에서 원고와 그 리뷰의 포스터·장면 사진을 지우는 커밋이 올라가고,
 *   호스팅이 다시 배포하면(보통 1~2분) 블로그에서도 사라져요.
 *
 * 확인 창: 네이티브 <dialog> + showModal()
 *   브라우저가 화면 맨 위에 띄우고, 창 밖은 누를 수 없게 막고, 초점을 창 안에 가두고, Esc로 닫아 줘요.
 *   직접 만들면 이 일을 모두 손으로 해야 해서, 브라우저 기능을 먼저 써요.
 *   확인·취소만 받는 창이라 role="alertdialog"로 "중요한 확인 창"이라고 알리고,
 *   제목(aria-labelledby)과 설명(aria-describedby)을 이어 화면 낭독기가 창이 열리자마자 읽게 해요.
 *   처음 초점은 되돌리기 쉬운 [취소]에 둬요(실수로 Enter를 눌러도 지워지지 않게요).
 *
 * 두 번 누름 막기
 *   [지우기]를 아주 빠르게 두 번 눌러도 요청은 한 번만 가요. useState는 다음 그리기에야 바뀌어서
 *   useRef 잠금을 함께 써요. 지우기에 성공하면 잠금을 풀지 않아요(이미 지운 리뷰를 또 지울 일이 없으니까요).
 *
 * 누가 쓰나요?
 *   components/admin-review-actions.tsx(상세 화면, 로그인했을 때만)
 */

"use client";

import { useId, useRef, useState } from "react";

import { deleteReview } from "@/lib/admin-api";

/** DeleteReview가 받는 값 */
type Props = {
  /** 지울 리뷰 주소 */
  slug: string;
  /** 리뷰 제목(확인 문구에 써요) */
  title: string;
  /** 지우기에 성공하면 안내 문구와 함께 불러요. 안내를 보여 주는 일은 부르는 쪽이 해요. */
  onDeleted: (message: string) => void;
};

/** [지우기] 단추와 확인 창 */
export function DeleteReview({ slug, title, onDeleted }: Props) {
  // 확인 창(<dialog>)의 손잡이. showModal()로 열고 close()로 닫아요.
  const dialogRef = useRef<HTMLDialogElement>(null);
  // 지우는 중인지(단추를 잠시 막고 글자를 바꿔요)
  const [deleting, setDeleting] = useState(false);
  // 실패 문구(창 안에 보여요)
  const [error, setError] = useState("");
  // 두 번 누름 막기 잠금
  const lockRef = useRef(false);
  // 창 제목·설명의 id
  const id = useId();

  /** 확인 창의 [지우기]를 누르면 실행돼요. */
  async function handleConfirm() {
    if (lockRef.current) return;
    lockRef.current = true;
    setDeleting(true);
    setError("");

    const result = await deleteReview(slug);
    setDeleting(false);
    if (result.ok) {
      // 창을 닫고 부르는 쪽에 알려요. 잠금은 풀지 않아요(다시 지울 일이 없어요).
      dialogRef.current?.close();
      onDeleted(`‘${title}’ 리뷰를 지웠습니다. 블로그를 다시 배포하면(보통 1~2분) 목록에서도 사라집니다.`);
      return;
    }
    // 실패: 이유를 보여 주고, 다시 누를 수 있게 잠금을 풀어요.
    setError(result.message);
    lockRef.current = false;
  }

  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()} className="btn-line">
        지우기
      </button>

      {/* 확인 창. 닫혀 있으면 화면에 보이지 않아요(브라우저 기본). confirm-dialog: 모양(globals.css)
          onClose: Esc로 닫혀도 실패 문구를 지워, 다음에 열 때 깨끗하게 보여요. */}
      <dialog
        ref={dialogRef}
        role="alertdialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        onClose={() => setError("")}
        className="confirm-dialog"
      >
        <h2 id={`${id}-title`} className="inverse px-4 py-1">
          리뷰를 지울까요?
        </h2>
        <div className="grid gap-4 px-4 py-4">
          <p id={`${id}-desc`}>
            ‘{title}’ 리뷰와 이 리뷰의 포스터·장면 사진을 저장소에서 지웁니다. 지운 뒤에는 이 화면에서 되돌릴 수 없습니다.
          </p>
          {/* role="alert": 실패하면 바로 읽어 줘요. 영역은 늘 두고 글자만 바꿔요. */}
          <p role="alert">{error}</p>
          <div className="flex flex-wrap justify-end gap-2">
            {/* autoFocus: 창이 열리면 [취소]에 먼저 초점이 가요(되돌리기 어려운 [지우기]가 아니라). */}
            {/* eslint-disable-next-line jsx-a11y/no-autofocus -- 확인 창의 처음 초점은 덜 위험한 단추에 두는 것이 APG 권장이에요. */}
            <button type="button" autoFocus onClick={() => dialogRef.current?.close()} className="btn-line">
              취소
            </button>
            <button type="button" onClick={handleConfirm} disabled={deleting} className="btn-inverse">
              {deleting ? "지우는 중…" : "지우기"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
