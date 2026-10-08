'use client'

import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { useSidebar } from './SidebarContext'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/produtos': 'Produtos',
  '/produtos/novo': 'Novo Produto',
  '/produtos/imagens': 'Importar Imagens',
  '/oportunidades': 'Oportunidades',
  '/conteudos': 'Banco de Conteúdos',
  '/conteudos/gerar': 'Gerar Conteúdo',
  '/aprovacao': 'Aprovações',
  '/calendario': 'Calendário Editorial',
  '/relatorios': 'Relatórios',
  '/links': 'Links Dinâmicos',
  '/monetizacao': 'Monetização',
  '/integracoes': 'Integrações',
  '/video-seller': 'Patrono Video Seller',
  '/admin/usuarios': 'Usuários',
  '/whatsapp': 'WhatsApp em Massa',
}

export function Header() {
  const pathname = usePathname()
  const { toggle } = useSidebar()

  const title =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))?.[1] ??
    'Patrono Seller IA'

  return (
    <header className="h-14 shrink-0 border-b border-border flex items-center gap-3 px-4 lg:px-6">
      <button
        onClick={toggle}
        className="lg:hidden text-white/60 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5" />
      </button>
      <h1 className="text-base font-semibold text-white">{title}</h1>
    </header>
  )
}
