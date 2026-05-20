'use client'

import { ShoppingCart, TrendingUp, Zap } from 'lucide-react'

export function BoraBanner() {
  return (
    <div className="relative overflow-hidden rounded-xl mb-6 select-none">
      {/* Fundo gradiente navy + amarelo */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #1A1A3E 0%, #2a2a5e 45%, #1A1A3E 70%, #0d0d28 100%)',
        }}
      />

      {/* Círculos decorativos */}
      <div
        className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-15"
        style={{ background: '#F5C000' }}
      />
      <div
        className="absolute -bottom-12 right-24 w-56 h-56 rounded-full opacity-10"
        style={{ background: '#F5C000' }}
      />
      <div
        className="absolute top-0 left-1/3 w-24 h-24 rounded-full opacity-5"
        style={{ background: '#F5C000' }}
      />

      {/* Faixa amarela superior */}
      <div
        className="absolute top-0 left-0 right-0 h-1.5"
        style={{ background: 'linear-gradient(90deg, #F5C000, #ffd93d, #F5C000)' }}
      />

      {/* Conteúdo */}
      <div className="relative z-10 flex items-center justify-between px-5 py-4 gap-4">
        {/* Lado esquerdo: logo + tagline */}
        <div className="flex items-center gap-4">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-xl shrink-0"
            style={{
              background: 'linear-gradient(135deg, #F5C000, #ffd93d)',
              boxShadow: '0 4px 14px rgba(245, 192, 0, 0.4)',
            }}
          >
            <ShoppingCart className="w-6 h-6" style={{ color: '#1A1A3E' }} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-xl font-extrabold tracking-tight"
                style={{ color: '#F5C000' }}
              >
                Bora
              </span>
              <span className="text-xl font-extrabold tracking-tight text-white">
                Comprar
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                style={{ background: '#F5C000', color: '#1A1A3E' }}
              >
                IA
              </span>
            </div>
            <p className="text-xs text-white/60 mt-0.5">
              Automatize seus conteúdos e venda mais todos os dias
            </p>
          </div>
        </div>

        {/* Lado direito: métricas visuais */}
        <div className="hidden sm:flex items-center gap-5">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(245, 192, 0, 0.15)', border: '1px solid rgba(245, 192, 0, 0.3)' }}
            >
              <Zap className="w-4 h-4" style={{ color: '#F5C000' }} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white leading-tight">IA Gerando</p>
              <p className="text-[10px] text-white/40">Conteúdo 24h</p>
            </div>
          </div>

          <div className="w-px h-8 bg-white/10" />

          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(245, 192, 0, 0.15)', border: '1px solid rgba(245, 192, 0, 0.3)' }}
            >
              <TrendingUp className="w-4 h-4" style={{ color: '#F5C000' }} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white leading-tight">Mais Vendas</p>
              <p className="text-[10px] text-white/40">Automático</p>
            </div>
          </div>
        </div>
      </div>

      {/* Faixa amarela inferior */}
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 opacity-40"
        style={{ background: 'linear-gradient(90deg, transparent, #F5C000, transparent)' }}
      />
    </div>
  )
}
