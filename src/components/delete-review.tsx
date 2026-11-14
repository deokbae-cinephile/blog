/**
 * @file 리뷰 삭제 (delete-review.tsx)
 *
 * 이 파일이 하는 일
 *   [삭제] 단추를 누르면 "리뷰를 삭제할까요?" 확인 창을 띄우고, [삭제]를 한 번 더 눌러야 삭제해요.
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
 *   [삭제]를 아주 빠르게 두 번 눌러도 요청은 한 번만 가요. useState는 다음 그리기에야 바뀌어서
 *   useRef 잠금을 함께 써요. 삭제에 성공하면 잠금을 풀지 않아요(이미 삭제한 리뷰를 또 삭제할 일이 없으니까요).
 *
 * 삭제하는 동안
 *   창 안에 로딩 UI를 보이고, [취소]·[삭제]는 aria-disabled로 막아요(흐리게 보여요). disabled로 막으면 누른 단추에서
 *   초점이 빠져 문서 전체로 가 버려요. aria-disabled는 초점을 그 자리에 두고 "쓸 수 없음"만 알려요(누름은 코드가 무시해요).
 *   Esc로도 창을 닫지 못해요(onCancel). 결과가 나올 때까지 기다려요.
 *
 * 누가 쓰나요?
 *   components/admin-review-actions.tsx(상세 화면, 로그인했을 때만)
 */

"use client";

import { useId, useRef, useState } from "react";

import { deleteReview } from "@/lib/admin-api";

import { LoadingStatus } from "./loading-status";

/** DeleteReview가 받는 값 */
type Props = {
  /** 지울 리뷰 주소 */
  slug: string;
  /** 리뷰 제목(확인 문구에 써요) */
  title: string;
  /** 삭제에 성공하면 안내 문구와 함께 불러요. 안내를 보여 주는 일은 부르는 쪽이 해요. */
  onDeleted: (message: string) => void;
};

/** [삭제] 단추와 확인 창 */
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

  /** 확인 창의 [삭제]를 누르면 실행돼요. */
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
      onDeleted(`‘${title}’ 리뷰를 삭제했습니다. 블로그를 다시 배포하면(몇 분 뒤) 목록에서도 사라집니다.`);
      return;
    }
    // 실패: 이유를 보여 주고, 다시 누를 수 있게 잠금을 풀어요.
    setError(result.message);
    lockRef.current = false;
  }

  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()} className="btn-line">
        삭제
      </button>

      {/* 확인 창. 닫혀 있으면 화면에 보이지 않아요(브라우저 기본). confirm-dialog: 모양(globals.css)
          onClose: Esc로 닫혀도 실패 문구를 지워, 다음에 열 때 깨끗하게 보여요.
          onCancel: 삭제하는 동안에는 Esc로 창을 닫지 못하게 막아요(끝날 때까지 결과를 기다려요). */}
      <dialog
        ref={dialogRef}
        role="alertdialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        onClose={() => setError("")}
        onCancel={(event) => {
          if (deleting) event.preventDefault();
        }}
        className="confirm-dialog"
      >
        <h2 id={`${id}-title`} className="inverse px-4 py-1">
          리뷰를 삭제할까요?
        </h2>
        <div className="grid gap-4 px-4 py-4">
          <p id={`${id}-desc`}>
            ‘{title}’ 리뷰와 이 리뷰의 포스터·장면 사진을 저장소에서 삭제합니다. 삭제한 뒤에는 이 화면에서 되돌릴 수 없습니다.
          </p>
          {/* 진행·실패 안내를 한 칸에 묶어요. 둘 다 비어 있을 때 그리드 줄(과 사이 간격)이 하나만 생겨, 평소 창 모양이 예전과 같아요. */}
          <div>
            {/* 삭제하는 동안의 로딩 UI(깜빡이는 커서와 16칸 막대). 안내 칸(role="status")은 늘 두고 안쪽만 바꿔요.
                (몇 초 걸려요: 저장소에서 원고·사진을 지우는 커밋을 만들어요.) */}
            <div role="status">{deleting && <LoadingStatus label="리뷰를 삭제하는 중" live={false} />}</div>
            {/* role="alert": 실패하면 바로 읽어 줘요. 영역은 늘 두고 글자만 바꿔요. */}
            <p role="alert">{error}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {/* autoFocus: 창이 열리면 [취소]에 먼저 초점이 가요(되돌리기 어려운 [삭제]가 아니라). */}
            {/* 삭제하는 동안에는 두 단추를 모두 막아요(로딩 UI가 진행을 알려요). aria-disabled: 초점은 남기고 "쓸 수 없음"만 알려요.
                `deleting || undefined`: 막지 않을 때는 속성을 아예 달지 않아요. */}
            <button
              type="button"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- 확인 창의 처음 초점은 덜 위험한 단추에 두는 것이 APG 권장이에요.
              autoFocus
              onClick={() => {
                if (!deleting) dialogRef.current?.close();
              }}
              aria-disabled={deleting || undefined}
              className="btn-line"
            >
              취소
            </button>
            {/* 삭제 중에 다시 눌러도 handleConfirm의 잠금(lockRef)이 막아요. */}
            <button type="button" onClick={handleConfirm} aria-disabled={deleting || undefined} className="btn-inverse">
              삭제
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
