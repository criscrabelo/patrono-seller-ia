import { cookies } from 'next/headers'

export const CONTA_ATIVA_COOKIE = 'contaAtivaId'

export async function getContaAtivaIdCookie(): Promise<string | null> {
  const store = await cookies()
  return store.get(CONTA_ATIVA_COOKIE)?.value ?? null
}
