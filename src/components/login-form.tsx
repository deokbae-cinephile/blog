/**
 * @file 글쓴이 로그인 폼 (login-form.tsx)
 *
 * 이 파일이 하는 일
 *   아이디와 비밀번호를 받아 로그인해요. 이 블로그는 글쓴이 한 사람만 로그인할 수 있어요.
 *   로그인하면 원래 가려던 화면(주소의 ?next=, 없으면 처음 화면)으로 돌아가요.
 *
 * 접근성 포인트 (KWCAG 7.3.2 레이블, 7.3.3 접근 가능한 인증)
 *   - 칸마다 눈에 보이는 이름(<label>)이 있어요. "(필수)"도 글자로 적어요.
 *   - autoComplete="username" / "current-password": 비밀번호 관리자가 채워 줄 수 있어요.
 *     비밀번호 붙여 넣기도 막지 않아요. 외워서 쳐야만 하는 로그인은 누군가에게는 어려운 일이에요.
 *   - [비밀번호 보기] 단추로 친 글자를 확인할 수 있어요(aria-pressed로 켜짐·꺼짐을 알려 줘요).
 *   - 틀리면: 틀린 칸에 aria-invalid와 오류 문구(aria-describedby·aria-errormessage)를 이어 주고,
 *     그 칸으로 초점을 옮겨요. 화면 낭독기는 칸 이름과 함께 오류 문구를 읽어요.
 *
 * 두 번 누름 막기
 *   [로그인]을 빠르게 두 번 눌러도 요청은 한 번만 가요(useRef 잠금).
 *   로그인에 성공하면 화면을 떠나므로 잠금을 풀지 않고, 실패했을 때만 풀어요.
 *
 * 누가 쓰나요?
 *   app/login/page.tsx
 */

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";

import { login } from "@/lib/admin-api";
import { adminHintStore } from "@/lib/admin-hint";

/** 칸별 오류 문구(없으면 빈 칸) */
type Errors = { id?: string; password?: string; form?: string };

/**
 * 로그인 뒤에 갈 주소를 안전하게 골라요.
 * "/write"처럼 우리 사이트 안의 주소만 받아요. "//nasty.example"이나 "https://..."처럼
 * 다른 사이트로 보내는 주소가 들어오면 처음 화면("/")으로 가요(로그인 화면을 이용한 피싱 막기).
 */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

/** 로그인 폼 */
export function LoginForm() {
  const router = useRouter();
  // 주소의 ?next= 값. proxy.ts가 로그인 화면으로 보낼 때 원래 주소를 적어 줘요.
  const next = safeNext(useSearchParams().get("next"));

  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  // 두 번 누름 막기 잠금
  const lockRef = useRef(false);
  // 오류가 난 칸으로 초점을 옮길 때 쓰는 손잡이
  const idRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  // label·오류 문구를 이을 id
  const fieldId = useId();

  /** [로그인]을 누르거나 Enter를 치면 실행돼요. */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // 페이지를 새로 고치는 폼의 기본 동작을 막아요. 우리가 직접 요청을 보내요.
    event.preventDefault();
    if (lockRef.current) return;

    // 1) 빈 칸 확인. 비어 있으면 서버에 보내지 않고 바로 알려요.
    const empty: Errors = {};
    if (id.trim() === "") empty.id = "아이디를 입력하세요.";
    if (password === "") empty.password = "비밀번호를 입력하세요.";
    if (empty.id || empty.password) {
      setErrors(empty);
      // 첫 번째 빈 칸으로 초점을 옮겨요.
      (empty.id ? idRef : passwordRef).current?.focus();
      return;
    }

    // 2) 서버에 확인을 맡겨요.
    lockRef.current = true;
    setPending(true);
    setErrors({});
    const result = await login(id.trim(), password);

    if (result.ok) {
      // 성공: 쿠키가 바뀌었다고 화면에 알리고, 원래 가려던 곳으로 가요. 화면을 떠나니 잠금은 그대로 둬요.
      adminHintStore.notify();
      router.replace(next);
      router.refresh();
      return;
    }

    // 3) 실패: 이유를 보여 주고 다시 시도할 수 있게 잠금을 풀어요.
    lockRef.current = false;
    setPending(false);
    if (result.status === 401) {
      // 아이디·비밀번호 중 무엇이 틀렸는지는 일부러 알려 주지 않아요(아이디를 알아내는 데 쓰일 수 있어서요).
      setErrors({ password: result.message });
      passwordRef.current?.focus();
    } else {
      setErrors({ form: result.message });
    }
  }

  // 칸마다 오류 문구의 id. 오류가 있을 때만 aria-describedby·aria-errormessage로 이어요.
  const idErrorId = `${fieldId}-id-error`;
  const passwordErrorId = `${fieldId}-password-error`;

  return (
    // noValidate: 브라우저가 띄우는 기본 오류 말풍선 대신 우리 문구를 보여 줘요(언어와 모양을 맞추려고요).
    <form onSubmit={handleSubmit} noValidate className="grid gap-6">
      <div className="grid gap-2">
        <label htmlFor={`${fieldId}-id`} className="glow">
          아이디 <span className="text-crt-dim">(필수)</span>
        </label>
        <input
          ref={idRef}
          id={`${fieldId}-id`}
          name="username"
          type="text"
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={id}
          onChange={(event) => setId(event.target.value)}
          aria-invalid={errors.id ? true : undefined}
          aria-describedby={errors.id ? idErrorId : undefined}
          aria-errormessage={errors.id ? idErrorId : undefined}
          className="field"
        />
        <p id={idErrorId} className="field-error">
          {errors.id}
        </p>
      </div>

      <div className="grid gap-2">
        <label htmlFor={`${fieldId}-password`} className="glow">
          비밀번호 <span className="text-crt-dim">(필수)</span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={passwordRef}
            id={`${fieldId}-password`}
            name="password"
            // 보기를 켜면 글자로(type="text"), 끄면 가린 글자로(type="password") 보여요.
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? passwordErrorId : undefined}
            aria-errormessage={errors.password ? passwordErrorId : undefined}
            className="field min-w-0 flex-1 basis-56"
          />
          {/* 토글 단추: 글자는 그대로 두고 눌림 상태(aria-pressed)로 켜짐·꺼짐을 알려요. */}
          <button type="button" aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)} className="btn-line">
            비밀번호 보기
          </button>
        </div>
        <p id={passwordErrorId} className="field-error">
          {errors.password}
        </p>
      </div>

      {/* 칸과 상관없는 오류(서버 설정 없음, 연결 끊김 등). role="alert": 나타나면 바로 읽어 줘요.
          영역은 처음부터 두고 글자만 바꿔요. 비어 있을 때는 화면에서만 숨겨(empty:sr-only) 빈 간격이 생기지 않게 해요. */}
      <p role="alert" className="alert-text empty:sr-only">
        {errors.form}
      </p>

      <div>
        <button type="submit" disabled={pending} className="btn-inverse">
          {pending ? "확인하는 중…" : "로그인"}
        </button>
      </div>
    </form>
  );
}
