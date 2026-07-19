'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { BrandMark } from '@/components/shared/BrandMark'

const schema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword'],
})

type Form = z.infer<typeof schema>

export default function RegisterPage() {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: Form) {
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: data.name, email: data.email, password: data.password }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Erro ao criar conta.')
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  const inputClass = `w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm
    text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-accent transition-colors`

  if (success) {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 border border-accent/30 mb-6">
          <CheckCircle className="w-7 h-7 text-accent" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Solicitação enviada!</h1>
        <p className="text-sm text-white/50 mb-6">
          Sua conta foi criada e está aguardando aprovação do administrador.
          Você receberá acesso assim que for aprovado.
        </p>
        <Link href="/login" className="text-accent text-sm hover:underline">
          ← Voltar ao login
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="inline-flex justify-center mb-4">
          <BrandMark size={56} />
        </div>
        <h1 className="text-2xl font-bold text-white">Patrono Seller IA</h1>
        <p className="text-sm text-white/50 mt-1">Solicitar acesso à plataforma</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-8">
        <h2 className="text-lg font-semibold text-white mb-6">Criar conta</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-white/70 block mb-1.5">Nome completo</label>
            <input {...register('name')} placeholder="Seu nome" className={inputClass} />
            {errors.name && <p className="text-danger text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-white/70 block mb-1.5">Email</label>
            <input {...register('email')} type="email" placeholder="seu@email.com" className={inputClass} />
            {errors.email && <p className="text-danger text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-white/70 block mb-1.5">Senha</label>
            <input {...register('password')} type="password" placeholder="••••••••" className={inputClass} />
            {errors.password && <p className="text-danger text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-white/70 block mb-1.5">Confirmar senha</label>
            <input {...register('confirmPassword')} type="password" placeholder="••••••••" className={inputClass} />
            {errors.confirmPassword && <p className="text-danger text-xs mt-1">{errors.confirmPassword.message}</p>}
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
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Enviando...</> : 'Solicitar acesso'}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-white/50 mt-6">
        Já tem conta?{' '}
        <Link href="/login" className="text-accent hover:underline">Entrar</Link>
      </p>
      <p className="text-center text-xs text-white/30 mt-2">Patrono Seller IA — Grupo Patrono</p>
    </div>
  )
}
