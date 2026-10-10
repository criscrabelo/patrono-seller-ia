/**
 * P2.14.8 — Trava de banco para os scripts do cofre.
 *
 * Padrão: só o banco de TESTE. PRODUÇÃO exige as duas coisas ao mesmo tempo:
 *   --producao  e  --confirmo=<ref de produção>
 * e a ref digitada tem de aparecer nas URLs do banco. Qualquer outra
 * combinação aborta antes de abrir conexão.
 */
export const REF_TESTE = 'xntkypjmmdovrfbblbqb'
export const REF_PRODUCAO = 'aftqchhuknsqijsengoo'

export function argumento(nome: string, argv: string[] = process.argv): string | undefined {
  const a = argv.find((x) => x.startsWith(`--${nome}=`))
  return a ? a.slice(nome.length + 3) : undefined
}

export function exigirBancoAutorizado(env: Record<string, string | undefined> = process.env, argv: string[] = process.argv): 'TESTE' | 'PRODUCAO' {
  const urls = ['DATABASE_URL', 'DIRECT_URL'].map((v) => env[v] ?? '').filter(Boolean)
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL ausente.')
  const ehProducao = urls.some((u) => u.includes(REF_PRODUCAO))
  const ehTeste = urls.length > 0 && urls.every((u) => u.includes(REF_TESTE))
  if (!ehProducao) {
    if (!ehTeste) throw new Error('Banco não reconhecido (nem teste, nem produção). Abortado.')
    if (argv.includes('--producao')) throw new Error('--producao informado, mas o banco é o de TESTE. Abortado.')
    return 'TESTE'
  }
  if (!argv.includes('--producao')) throw new Error('Banco de PRODUÇÃO sem --producao. Abortado.')
  if (argumento('confirmo', argv) !== REF_PRODUCAO) throw new Error('Confirmação ausente ou errada (--confirmo=<ref>). Abortado.')
  if (!urls.every((u) => u.includes(REF_PRODUCAO))) throw new Error('URLs do banco misturam projetos. Abortado.')
  return 'PRODUCAO'
}
