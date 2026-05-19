'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday, isSameDay, addMonths, subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Conteudo {
  id: string
  redeSocial: string
  status: string
  dataAgendamento: string | null
  dataPublicacao: string | null
  produto: { nome: string }
}

const REDE_CORES: Record<string, string> = {
  'TikTok': 'bg-pink-500/80',
  'Instagram Reels': 'bg-purple-500/80',
  'YouTube Shorts': 'bg-red-500/80',
  'WhatsApp': 'bg-green-600/80',
  'Facebook': 'bg-blue-600/80',
  'Marketplace': 'bg-orange-500/80',
  'Landing Page': 'bg-blue-500/80',
}

export default function CalendarioPage() {
  const [mes, setMes] = useState(new Date())
  const [conteudos, setConteudos] = useState<Conteudo[]>([])
  const [selecionado, setSelecionado] = useState<Date | null>(null)

  useEffect(() => {
    fetch('/api/conteudos')
      .then((r) => r.json())
      .then((data) => setConteudos(Array.isArray(data) ? data : []))
  }, [])

  const diasDoMes = eachDayOfInterval({
    start: startOfMonth(mes),
    end: endOfMonth(mes),
  })

  function conteudosDoDia(dia: Date) {
    return conteudos.filter((c) => {
      const data = c.dataAgendamento || c.dataPublicacao
      return data && isSameDay(new Date(data), dia)
    })
  }

  const conteudosSelecionados = selecionado ? conteudosDoDia(selecionado) : []

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white capitalize">
            {format(mes, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <p className="text-sm text-muted-foreground">Calendário editorial</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setMes(subMonths(mes, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMes(new Date())}>Hoje</Button>
          <Button size="sm" variant="outline" onClick={() => setMes(addMonths(mes, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendário */}
        <div className="lg:col-span-2 card-stat">
          {/* Dias da semana */}
          <div className="grid grid-cols-7 mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          {/* Offset do primeiro dia */}
          <div className="grid grid-cols-7 gap-1">
            {[...Array(startOfMonth(mes).getDay())].map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {diasDoMes.map((dia) => {
              const eventos = conteudosDoDia(dia)
              const isSel = selecionado && isSameDay(dia, selecionado)
              return (
                <button key={dia.toISOString()}
                  onClick={() => setSelecionado(isSel ? null : dia)}
                  className={cn(
                    'relative rounded-lg p-1 min-h-[52px] text-left transition-colors',
                    !isSameMonth(dia, mes) && 'opacity-30',
                    isToday(dia) && 'bg-accent/10 border border-accent/40',
                    isSel && 'bg-accent/20 border border-accent',
                    !isSel && !isToday(dia) && 'hover:bg-secondary/50'
                  )}>
                  <span className={cn(
                    'text-xs font-medium block mb-1',
                    isToday(dia) ? 'text-accent' : 'text-foreground'
                  )}>
                    {format(dia, 'd')}
                  </span>
                  <div className="space-y-0.5">
                    {eventos.slice(0, 2).map((e) => (
                      <div key={e.id} className={cn(
                        'text-[9px] px-1 py-0.5 rounded truncate text-white',
                        REDE_CORES[e.redeSocial] ?? 'bg-gray-500/80'
                      )}>
                        {e.produto.nome}
                      </div>
                    ))}
                    {eventos.length > 2 && (
                      <p className="text-[9px] text-muted-foreground pl-1">+{eventos.length - 2} mais</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Painel lateral */}
        <div className="card-stat">
          {selecionado ? (
            <>
              <h3 className="font-semibold text-white text-sm mb-1 capitalize">
                {format(selecionado, "d 'de' MMMM", { locale: ptBR })}
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                {conteudosSelecionados.length} conteúdo(s)
              </p>
              {conteudosSelecionados.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum conteúdo neste dia.</p>
              ) : (
                <div className="space-y-3">
                  {conteudosSelecionados.map((c) => (
                    <div key={c.id} className="rounded-lg border border-border p-3">
                      <p className="text-sm font-medium text-white">{c.produto.nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.redeSocial}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full text-white',
                          REDE_CORES[c.redeSocial] ?? 'bg-gray-500'
                        )}>
                          {c.status}
                        </span>
                        <Link href={`/conteudos/${c.id}`}
                          className="text-xs text-accent hover:underline">Ver</Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Calendar className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Clique em um dia para ver os conteúdos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
