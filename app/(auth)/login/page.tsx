'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { ShoppingBag, Loader2, AlertCircle } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha muito curta'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginForm) {
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    })

    if (result?.error) {
      if (result.error.includes('PENDENTE')) {
        setError('Sua conta está aguardando aprovação do administrador.')
      } else if (result.error.includes('BLOQUEADO')) {
        setError('Sua conta foi bloqueada. Entre em contato com o administrador.')
      } else {
        setError('Email ou senha inválidos.')
      }
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 border border-accent/30 mb-4">
          <ShoppingBag className="w-7 h-7 text-accent" />
        </div>
        <h1 className="text-2xl font-bold text-white">Patrono Seller IA</h1>
        <p className="text-sm text-white/50 mt-1">Seu assistente de vendas inteligente</p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-border bg-card p-8">
        <h2 className="text-lg font-semibold text-white mb-6">Entrar na plataforma</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-white/70 block mb-1.5">Email</label>
            <input
              {...register('email')}
              type="email"
              placeholder="admin@patronosellerai.com"
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm
                         text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-accent
                         transition-colors"
            />
            {errors.email && (
              <p className="text-danger text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-white/70 block mb-1.5">Senha</label>
            <input
              {...register('password')}
              type="password"
              placeholder="••••••••"
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm
                         text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-accent
                         transition-colors"
            />
            {errors.password && (
              <p className="text-danger text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-danger shrink-0" />
              <p className="text-danger text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-primary-dark
                       hover:bg-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-white/50 mt-6">
        Não tem acesso?{' '}
        <Link href="/register" className="text-accent hover:underline">
          Solicitar cadastro
        </Link>
      </p>
      <p className="text-center text-xs text-white/30 mt-2">
        Patrono Seller IA — Grupo Patrono
      </p>
    </div>
  )
}
