'use client'

import { useEffect, useState } from 'react'

export function usePendingApprovals() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    fetch('/api/conteudos?status=aguardando_aprovacao&count=true')
      .then((r) => r.json())
      .then((data) => setCount(data.count ?? 0))
      .catch(() => setCount(0))

    const interval = setInterval(() => {
      fetch('/api/conteudos?status=aguardando_aprovacao&count=true')
        .then((r) => r.json())
        .then((data) => setCount(data.count ?? 0))
        .catch(() => {})
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  return { count }
}
