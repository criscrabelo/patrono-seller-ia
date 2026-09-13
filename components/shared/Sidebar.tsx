'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  Package,
  Zap,
  Library,
  CheckCircle,
  Calendar,
  BarChart2,
  Video,
  LogOut,
  ChevronRight,
  Plug,
  Link2,
  DollarSign,
  ImagePlus,
  Users,
  X,
  Facebook,
  Film,
  MessageCircle,
  SlidersHorizontal,
  Handshake,
  Receipt,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePendingApprovals } from '@/hooks/usePendingApprovals'
import { useModulosLiberados } from '@/hooks/useModulosLiberados'
import { useSidebar } from './SidebarContext'
import { BrandMark } from './BrandMark'
import type { ModuloKey } from '@/lib/modulos'

const navItems: Array<{ href: string; label: string; icon: typeof LayoutDashboard; modulo: ModuloKey; badge?: boolean }> = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, modulo: 'dashboard' },
  { href: '/produtos', label: 'Produtos', icon: Package, modulo: 'produtos' },
  { href: '/produtos/imagens', label: 'Importar Imagens', icon: ImagePlus, modulo: 'produtos-imagens' },
  { href: '/conteudos/gerar', label: 'Gerar Conteúdo', icon: Zap, modulo: 'conteudos-gerar' },
  { href: '/conteudos', label: 'Banco de Conteúdos', icon: Library, modulo: 'conteudos' },
  { href: '/videos', label: 'Vídeos Gerados', icon: Film, modulo: 'videos' },
  { href: '/aprovacao', label: 'Aprovações', icon: CheckCircle, modulo: 'aprovacao', badge: true },
  { href: '/calendario', label: 'Calendário', icon: Calendar, modulo: 'calendario' },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart2, modulo: 'relatorios' },
  { href: '/links', label: 'Links Dinâmicos', icon: Link2, modulo: 'links' },
  { href: '/programas', label: 'Meus Programas', icon: Handshake, modulo: 'programas' },
  { href: '/vendas-comissoes', label: 'Vendas e Comissões', icon: Receipt, modulo: 'vendas-comissoes' },
  { href: '/monetizacao', label: 'Monetização', icon: DollarSign, modulo: 'monetizacao' },
  { href: '/integracoes', label: 'Integrações', icon: Plug, modulo: 'integracoes' },
  { href: '/whatsapp', label: 'WhatsApp em Massa', icon: MessageCircle, modulo: 'whatsapp' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { count } = usePendingApprovals()
  const { temAcesso } = useModulosLiberados()
  const { isOpen, close } = useSidebar()

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={close}
        />
      )}

    <aside className={cn(
      'fixed inset-y-0 left-0 z-40 w-64 shrink-0 flex flex-col bg-primary border-r border-border transition-transform duration-300',
      'lg:static lg:translate-x-0 lg:w-60',
      isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
    )}>
      {/* Logo */}
      <div className="flex items-center justify-between gap-2.5 px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <BrandMark size={32} />
          <div>
            <p className="text-sm font-bold text-white leading-tight">Patrono Seller</p>
            <p className="text-[10px] text-accent font-semibold tracking-wider">IA</p>
          </div>
        </div>
        <button onClick={close} className="lg:hidden text-white/40 hover:text-white p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.filter((item) => temAcesso(item.modulo)).map(({ href, label, icon: Icon, badge }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn('sidebar-item', isActive && 'active')}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-sm">{label}</span>
              {badge && count > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-danger text-white text-[10px] font-bold">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </Link>
          )
        })}

        {/* Separador */}
        {temAcesso('video-seller') && (
          <div className="py-2">
            <div className="border-t border-border" />
          </div>
        )}

        {/* Video Seller */}
        {temAcesso('video-seller') && (
          <Link
            href="/video-seller"
            className={cn(
              'sidebar-item',
              pathname.startsWith('/video-seller') && 'active'
            )}
          >
            <Video className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-sm">Video Seller</span>
            <ChevronRight className="w-3 h-3 opacity-50" />
          </Link>
        )}

        {/* Admin: só para admins */}
        {session?.user?.role === 'admin' && (
          <>
            <div className="py-2">
              <div className="border-t border-border" />
            </div>
            <Link
              href="/admin/usuarios"
              className={cn('sidebar-item', pathname.startsWith('/admin/usuarios') && 'active')}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-sm">Usuários</span>
            </Link>
            <Link
              href="/admin/permissoes"
              className={cn('sidebar-item', pathname.startsWith('/admin/permissoes') && 'active')}
            >
              <SlidersHorizontal className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-sm">Permissões</span>
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <Link
          href="/conta"
          title="Minha conta"
          className={cn(
            'flex items-center gap-2.5 px-2 py-1.5 mb-1 rounded-md hover:bg-secondary/60 transition-colors',
            pathname.startsWith('/conta') && 'bg-secondary/60'
          )}
        >
          <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
            <span className="text-xs font-bold text-accent">
              {session?.user?.name?.[0] ?? 'A'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">
              {session?.user?.name ?? 'Usuário'}
            </p>
            <p className="text-[10px] text-white/40 truncate">{session?.user?.email}</p>
          </div>
        </Link>
        <a
          href="https://web.facebook.com/profile.php?id=61589588903488"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-white/50
                     hover:text-[#1877F2] hover:bg-[#1877F2]/10 transition-colors mb-0.5"
        >
          <Facebook className="w-3.5 h-3.5" />
          Siga-nos no Facebook
        </a>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-white/50
                     hover:text-danger hover:bg-danger/10 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sair
        </button>
      </div>
    </aside>
    </>
  )
}
