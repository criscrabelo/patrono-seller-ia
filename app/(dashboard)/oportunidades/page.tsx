'use client'

// P2.14.5.13 — Curadoria: os 3 melhores candidatos do motor de oportunidades.
// A titular escolhe 1; o produto é cadastrado (ou ligado, se já existe).
// Nada é gerado nem publicado aqui. Dado desconhecido aparece como
// "desconhecido" — nunca escondido, nunca preenchido.

import { useEffect, useState } from 'react'
import { RefreshCw, AlertCircle, Package, CheckCircle2, XCircle, Plus, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { useGuardModulo } from '@/hooks/useGuardModulo'
import { CATEGORIAS } from '@/types'
import type { CandidatoNaTela } from '@/lib/curadoria-http'
import { estadoDaCuradoria, textoDoResumo, type UltimaColetaNaTela } from '@/lib/curadoria-estado'

const DESCONHECIDO = 'desconhecido'
const reais = (v: number | null) => (v === null ? DESCONHECIDO : `R$ ${v.toFixed(2).replace('.', ',')}`)
const numero = (v: number | null, sufixo = '') => (v === null ? DESCONHECIDO : `${v}${sufixo}`)

const ROTULO_DA_FONTE: Record<string, string> = {
  CATALOGO: 'Catálogo do Patrono',
  USER_PROVIDED: 'Informado pela titular',
}

const ROTULO_DA_CONFIANCA: Record<string, string> = {
  ALTA: 'alta',
  MEDIA: 'média',
  BAIXA: 'baixa',
  SEM_HISTORICO_REAL: 'sem histórico real',
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className={valor === DESCONHECIDO ? 'text-muted-foreground italic' : 'text-white'}>{valor}</span>
    </div>
  )
}

function Lista({ titulo, itens, cor }: { titulo: string; itens: string[]; cor: string }) {
  return (
    <div>
      <p className={`text-xs font-medium ${cor}`}>{titulo}</p>
      {itens.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">nenhum</p>
      ) : (
        <ul className="mt-1 space-y-0.5 list-disc pl-4">
          {itens.map((t, i) => (
            <li key={i} className="text-xs text-white/80">{t}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CardDoCandidato({
  c,
  ocupado,
  onEscolher,
  onDescartar,
}: {
  c: CandidatoNaTela
  ocupado: boolean
  onEscolher: () => void
  onDescartar: () => void
}) {
  return (
    <div className="card-stat flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold text-accent">{c.posicao}º</span>
        <span className="text-[11px] text-muted-foreground">{ROTULO_DA_FONTE[c.fonte] ?? c.providerId ?? c.fonte}</span>
      </div>

      <div className="w-full h-32 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
        {c.imagem ? (
          <img src={c.imagem} alt={c.nome} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 px-2 text-center">
            <Package className="w-8 h-8 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {c.imagemInformadaSemDireito ? 'Imagem sem direito de uso verificado — não exibida' : 'Sem imagem'}
            </span>
          </div>
        )}
      </div>

      <div>
        <p className="font-semibold text-white text-sm">{c.nome}</p>
        <p className="text-xs text-muted-foreground">{c.categoria ?? 'Outros'}</p>
        {c.linkProduto && (
          <a href={c.linkProduto} target="_blank" rel="noopener noreferrer" className="text-[11px] text-accent inline-flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> abrir link
          </a>
        )}
      </div>

      <div className="space-y-1">
        <Linha rotulo="Score" valor={`${c.score}/100`} />
        <Linha rotulo="Base de evidência" valor={`${c.baseDeEvidencia}/100`} />
        <Linha rotulo="Confiança" valor={ROTULO_DA_CONFIANCA[c.confianca] ?? c.confianca} />
        <Linha rotulo="Aderência BoraComprar" valor={c.aderenciaDoPerfil === null ? DESCONHECIDO : `${c.aderenciaDoPerfil}/80`} />
        <Linha rotulo="Afinidade da titular" valor={`${c.afinidade}/20`} />
        <Linha rotulo="Preço" valor={reais(c.preco)} />
        <Linha
          rotulo="Comissão"
          valor={c.comissaoPercentual === null ? DESCONHECIDO : `${c.comissaoPercentual}%${c.comissaoValor !== null ? ` (${reais(c.comissaoValor)})` : ''}`}
        />
        <Linha rotulo="Vendas" valor={numero(c.vendas)} />
        <Linha rotulo="Avaliação" valor={c.avaliacao === null ? DESCONHECIDO : `${c.avaliacao} (${numero(c.numeroDeAvaliacoes, ' avaliações')})`} />
        <Linha rotulo="Estoque" valor={numero(c.estoque)} />
        {c.nivelDeRisco && <Linha rotulo="Risco" valor={c.nivelDeRisco.toLowerCase()} />}
      </div>

      <Lista titulo="Motivos positivos" itens={c.motivosPositivos} cor="text-success" />
      <Lista titulo="Riscos" itens={c.riscos} cor="text-warning" />
      <Lista titulo="Dados desconhecidos" itens={c.desconhecidos} cor="text-muted-foreground" />
      <Lista titulo="Por que está nesta posição" itens={c.porqueDestaPosicao} cor="text-white" />

      <div className="flex gap-2 pt-2 border-t border-border mt-auto">
        <Button size="sm" className="flex-1" disabled={ocupado} onClick={onEscolher}>
          <CheckCircle2 className="w-3.5 h-3.5" /> Escolher este produto
        </Button>
        <Button size="sm" variant="outline" disabled={ocupado} onClick={onDescartar} title="Descartar">
          <XCircle className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

const FORM_VAZIO = { nome: '', link: '', categoria: '', preco: '', imagem: '', comprei: false, usei: false }

export default function OportunidadesPage() {
  useGuardModulo('oportunidades')
  const [candidatos, setCandidatos] = useState<CandidatoNaTela[]>([])
  const [ultima, setUltima] = useState<UltimaColetaNaTela | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)

  async function chamar(url: string, init?: RequestInit) {
    const res = await fetch(url, init)
    let dados: Record<string, unknown> = {}
    try {
      dados = await res.json()
    } catch {
      // resposta sem JSON: trata como erro abaixo
    }
    if (!res.ok) throw new Error(typeof dados.error === 'string' ? dados.error : `Falha (${res.status}).`)
    return dados
  }

  async function carregar() {
    setCarregando(true)
    setErro(null)
    try {
      const d = await chamar('/api/oportunidades')
      setCandidatos((d.candidatos as CandidatoNaTela[]) ?? [])
      setUltima((d.ultimaColeta as UltimaColetaNaTela | null) ?? null)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  async function atualizar() {
    setOcupado(true)
    setErro(null)
    try {
      const d = await chamar('/api/oportunidades/coletar', { method: 'POST' })
      setCandidatos((d.candidatos as CandidatoNaTela[]) ?? [])
      const nova = (d.ultimaColeta as UltimaColetaNaTela | null) ?? null
      setUltima(nova)
      // Os números reais da coleta — inclusive quando são zero.
      toast({ title: 'Coleta concluída', description: nova ? textoDoResumo(nova) : undefined, variant: 'success' })
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  async function escolher(c: CandidatoNaTela) {
    if (!confirm(`Escolher "${c.nome}"? O produto será cadastrado (nada é gerado nem publicado).`)) return
    setOcupado(true)
    try {
      const d = await chamar(`/api/oportunidades/${c.id}/escolher`, { method: 'POST' })
      toast({
        title: d.produtoCriado ? 'Produto cadastrado' : 'Produto escolhido (já estava no catálogo)',
        variant: 'success',
      })
      await carregar()
    } catch (e) {
      toast({ title: 'Não foi possível escolher', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setOcupado(false)
    }
  }

  async function descartar(c: CandidatoNaTela) {
    if (!confirm(`Descartar "${c.nome}"? Ele fica fora das coletas por 30 dias.`)) return
    setOcupado(true)
    try {
      await chamar(`/api/oportunidades/${c.id}/descartar`, { method: 'POST' })
      await carregar()
    } catch (e) {
      toast({ title: 'Não foi possível descartar', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setOcupado(false)
    }
  }

  async function informar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim() || !form.link.trim()) {
      toast({ title: 'Nome e link são obrigatórios', variant: 'destructive' })
      return
    }
    const preco = form.preco.trim() ? Number(form.preco.replace(',', '.')) : null
    if (preco !== null && !(preco > 0)) {
      toast({ title: 'Preço inválido', variant: 'destructive' })
      return
    }
    setOcupado(true)
    try {
      const d = await chamar('/api/oportunidades/informar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome,
          link: form.link,
          categoria: form.categoria || null,
          preco,
          imagem: form.imagem || null,
          comprei: form.comprei,
          usei: form.usei,
        }),
      })
      setCandidatos((d.candidatos as CandidatoNaTela[]) ?? [])
      setUltima((d.ultimaColeta as UltimaColetaNaTela | null) ?? null)
      setForm(FORM_VAZIO)
      setMostrarForm(false)
      toast({ title: 'Produto informado e incluído no ranking', variant: 'success' })
    } catch (e) {
      toast({ title: 'Não foi possível informar', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setOcupado(false)
    }
  }

  const situacao = estadoDaCuradoria({ ultima, candidatosEmAberto: candidatos.length })

  const input =
    'w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent'

  return (
    <div className="space-y-4 w-full max-w-6xl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white">Oportunidades</h2>
          <p className="text-sm text-muted-foreground">
            Os 3 melhores candidatos do motor. Escolha 1 para cadastrar — nada é gerado nem publicado aqui.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setMostrarForm((v) => !v)} disabled={ocupado}>
            <Plus className="w-4 h-4" /> Informar produto
          </Button>
          <Button size="sm" onClick={atualizar} disabled={ocupado}>
            <RefreshCw className={`w-4 h-4 ${ocupado ? 'animate-spin' : ''}`} /> Atualizar candidatos
          </Button>
        </div>
      </div>

      {mostrarForm && (
        <form onSubmit={informar} className="card-stat grid grid-cols-1 sm:grid-cols-2 gap-3">
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Para um produto que ainda não está no catálogo. Só nome e link são obrigatórios; o que ficar em branco
            continua desconhecido.
          </p>
          <input className={input} placeholder="Nome *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input className={input} placeholder="Link * (https://…)" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
          <select className={input} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
            <option value="">Categoria (opcional — sem ela, "Outros")</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input className={input} placeholder="Preço (opcional)" inputMode="decimal" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} />
          <input className={`${input} sm:col-span-2`} placeholder="Link da imagem (opcional)" value={form.imagem} onChange={(e) => setForm({ ...form, imagem: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-white">
            <input type="checkbox" checked={form.comprei} onChange={(e) => setForm({ ...form, comprei: e.target.checked })} /> Comprei
          </label>
          <label className="flex items-center gap-2 text-sm text-white">
            <input type="checkbox" checked={form.usei} onChange={(e) => setForm({ ...form, usei: e.target.checked })} /> Usei
          </label>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" size="sm" disabled={ocupado}>Informar</Button>
          </div>
        </form>
      )}

      {erro && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          <p className="text-sm text-danger">{erro}</p>
        </div>
      )}

      {carregando ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card-stat animate-pulse h-96" />
          ))}
        </div>
      ) : candidatos.length === 0 ? (
        <div className="card-stat flex flex-col items-center justify-center py-16 text-center" data-estado={situacao.estado}>
          <Package className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm text-white font-medium">{situacao.titulo}</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">{situacao.detalhe}</p>
          {situacao.estado === 'CATALOGO_VAZIO' && (
            <p className="text-xs text-muted-foreground mt-3">
              Se quiser, você também pode usar “Informar produto” — é opcional.
            </p>
          )}
          {situacao.resumo && ultima && (
            <p className="text-[11px] text-muted-foreground mt-4">
              Última coleta: {situacao.resumo} · {new Date(ultima.em).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {situacao.resumo && ultima && (
            <p className="lg:col-span-3 text-[11px] text-muted-foreground">
              Última coleta: {situacao.resumo} · {new Date(ultima.em).toLocaleString('pt-BR')}
            </p>
          )}
          {candidatos.map((c) => (
            <CardDoCandidato key={c.id} c={c} ocupado={ocupado} onEscolher={() => escolher(c)} onDescartar={() => descartar(c)} />
          ))}
        </div>
      )}
    </div>
  )
}
