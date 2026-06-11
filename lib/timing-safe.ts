// Edge-compatible constant-time сравнение строк (секреты, токены, хэши).
// Не используем crypto.timingSafeEqual из node:crypto, чтобы работало и в Edge runtime.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}
