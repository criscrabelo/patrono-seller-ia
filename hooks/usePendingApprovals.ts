'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * P2.15.6: o selo de "Aprovações" consultava o servidor a cada 30 s, mesmo com
 * a aba escondida (~2.900 chamadas por dia por aba aberta, 1,4 s cada em
 * Production). Agora: a cada 3 min, só com a aba visível; ao voltar para a
 * aba, atualiza se a última leitura tiver mais de 1 min.
 */
export const INTERVALO_DO_SELO_MS = 3 * 60_000
const ATUALIZAR_AO_VOLTAR_MS = 60_000

export function usePendingApprovals() {
  const [count, setCount] = useState(0)
  const ultimaLeitura = useRef(0)

  useEffect(() => {
    let vivo = true
    const ler = () => {
      ultimaLeitura.current = Date.now()
      fetch('/api/conteudos?status=aguardando_aprovacao&count=true')
        .then((r) => r.json())
        .then((data) => vivo && setCount(data.count ?? 0))
        .catch(() => {})
    }
    const visivel = () => typeof document === 'undefined' || document.visibilityState === 'visible'

    ler()
    const interval = setInterval(() => {
      if (visivel()) ler()
    }, INTERVALO_DO_SELO_MS)
    const aoMudarVisibilidade = () => {
      if (visivel() && Date.now() - ultimaLeitura.current > ATUALIZAR_AO_VOLTAR_MS) ler()
    }
    document.addEventListener('visibilitychange', aoMudarVisibilidade)

    return () => {
      vivo = false
      clearInterval(interval)
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
    }
  }, [])

  return { count }
}
