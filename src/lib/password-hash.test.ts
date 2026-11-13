// @vitest-environment node

/**
 * @file password-hash.ts 테스트
 *
 * 비밀번호를 해시로 바꾸고, 같은 비밀번호만 맞다고 하는지 확인해요.
 */

import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password-hash";

describe("hashPassword / verifyPassword", () => {
  it("만든 해시는 같은 비밀번호로만 확인된다", async () => {
    const hash = await hashPassword("영화 좋아 2026!");
    expect(hash).toMatch(/^scrypt\.[\w-]+\.[\w-]+$/);
    expect(await verifyPassword("영화 좋아 2026!", hash)).toBe(true);
    expect(await verifyPassword("영화 좋아 2025!", hash)).toBe(false);
  });

  it("같은 비밀번호라도 소금이 달라 해시가 매번 다르다", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("한글 조합 방식(NFC·NFD)이 달라도 같은 비밀번호로 본다", async () => {
    const hash = await hashPassword("비밀".normalize("NFC"));
    expect(await verifyPassword("비밀".normalize("NFD"), hash)).toBe(true);
  });

  it.each(["", "plain-password", "scrypt.only-two", "bcrypt.a.b", "scrypt.AAAA.BBBB.extra"])(
    "모양이 틀린 저장값 %s로는 확인되지 않는다",
    async (stored) => {
      expect(await verifyPassword("anything", stored)).toBe(false);
    },
  );
});
