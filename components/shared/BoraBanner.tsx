'use client'

import { TrendingUp, Zap } from 'lucide-react'

function LogoBoraComprar({ size = 56 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      style={{ flexShrink: 0 }}
    >
      {/* Círculo amarelo */}
      <circle cx="100" cy="100" r="100" fill="#F5C000" />

      {/* Carrinho — corpo */}
      <line x1="34" y1="58" x2="52" y2="58" stroke="#111" strokeWidth="8" strokeLinecap="round" />
      <path
        d="M52 58 L60 105 L148 105 L158 66 L56 66 Z"
        fill="none"
        stroke="#111"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      {/* Rodas */}
      <circle cx="78"  cy="120" r="9" fill="#F07820" stroke="#111" strokeWidth="5" />
      <circle cx="130" cy="120" r="9" fill="#F07820" stroke="#111" strokeWidth="5" />

      {/* Sacola laranja */}
      <rect x="70" y="46" width="68" height="62" rx="6" fill="#F07820" stroke="#111" strokeWidth="6" />
      {/* Alça */}
      <path d="M84 46 Q84 30 104 30 Q124 30 124 46" fill="none" stroke="#111" strokeWidth="6" strokeLinecap="round" />
      {/* Raios de clique */}
      <line x1="104" y1="72" x2="104" y2="62" stroke="#111" strokeWidth="4" strokeLinecap="round" />
      <line x1="104" y1="72" x2="114" y2="66" stroke="#111" strokeWidth="4" strokeLinecap="round" />
      <line x1="104" y1="72" x2="94"  y2="66" stroke="#111" strokeWidth="4" strokeLinecap="round" />

      {/* Mão branca */}
      <path
        d="M108 62 L108 90 Q108 100 118 100 L136 100 Q146 100 148 90 L150 72 Q150 64 142 64 Q140 56 134 58 Q132 50 126 52 Q122 44 116 48 L116 62 Z"
        fill="#FFF5E0"
        stroke="#111"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      {/* Dedo indicador */}
      <rect x="112" y="44" width="12" height="34" rx="6" fill="#FFF5E0" stroke="#111" strokeWidth="5" />

      {/* Texto */}
      <text
        x="100"
        y="158"
        fontFamily="Arial Black, Arial, sans-serif"
        fontSize="19"
        fontWeight="900"
        textAnchor="middle"
        fill="#111"
        letterSpacing="-0.5"
      >
        BoraComprar
      </text>
    </svg>
  )
}

export function BoraBanner() {
  return (
    <div className="relative overflow-hidden rounded-xl mb-6 select-none">
      {/* Fundo gradiente navy */}
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

      {/* Faixa amarela superior */}
      <div
        className="absolute top-0 left-0 right-0 h-1.5"
        style={{ background: 'linear-gradient(90deg, #F5C000, #ffd93d, #F5C000)' }}
      />

      {/* Conteúdo */}
      <div className="relative z-10 flex items-center justify-between px-5 py-3 gap-4">
        {/* Logomarca + tagline */}
        <div className="flex items-center gap-4">
          <div style={{ filter: 'drop-shadow(0 4px 12px rgba(245,192,0,0.5))' }}>
            <LogoBoraComprar size={56} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-xl font-extrabold tracking-tight"
                style={{ color: '#F5C000' }}
              >
                BoraComprar
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

        {/* Métricas visuais */}
        <div className="hidden sm:flex items-center gap-5">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(245,192,0,0.15)', border: '1px solid rgba(245,192,0,0.3)' }}
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
              style={{ background: 'rgba(245,192,0,0.15)', border: '1px solid rgba(245,192,0,0.3)' }}
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
