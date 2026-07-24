'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useModulosLiberados } from './useModulosLiberados'
import type { ModuloKey } from '@/lib/modulos'

// Redireciona pro Dashboard se o papel do usuário não tiver este módulo
// liberado. Não faz nada enquanto a sessão/permissões ainda carregam.
export function useGuardModulo(modulo: ModuloKey) {
  const { status } = useSession()
  const router = useRouter()
  const { modulos, loaded } = useModulosLiberados()

  useEffect(() => {
    if (status === 'loading' || !loaded) return
    if (!modulos.includes(modulo)) {
      router.replace('/dashboard')
    }
  }, [status, loaded, modulos, modulo])
}
