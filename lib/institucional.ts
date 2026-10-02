/**
 * Dados institucionais públicos — a empresa por trás do Patrono Seller.
 *
 * Exibidos nas páginas públicas (/sobre, /privacidade, /termos), que
 * existem para que parceiros e plataformas (o TikTok Shop Partner Center,
 * por exemplo) identifiquem a razão social responsável pelo produto.
 *
 * ── O CNPJ ──────────────────────────────────────────────────────────────
 * Dado cadastral público da empresa, informado pela titular em 02/10/2026.
 * `PATRONO_EMPRESA_CNPJ` pode sobrepô-lo sem mudar código, e só vale se
 * passar nos dígitos verificadores. Qualquer valor inválido NÃO é exibido —
 * mostrar um CNPJ errado numa página de validação é pior do que não mostrar.
 *
 * Nada aqui é secret, e nada aqui lê secret.
 */

export const RAZAO_SOCIAL = 'PATRONO INOVA SIMPLES (I.S.)'
export const NOME_DO_PRODUTO = 'Patrono Seller'
export const CONTATO_EMAIL = 'aneccr@hotmail.com'
/** CNPJ da PATRONO INOVA SIMPLES (I.S.). */
export const CNPJ_DA_EMPRESA = '69.438.337/0001-81'

/** Só os dígitos. */
function digitos(valor: string): string {
  return (valor ?? '').replace(/\D/g, '')
}

/** Valida os dois dígitos verificadores do CNPJ. */
export function cnpjValido(valor: string | null | undefined): boolean {
  const d = digitos(valor ?? '')
  if (d.length !== 14) return false
  if (/^(\d)\1{13}$/.test(d)) return false

  const calcular = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((s, c, i) => s + Number(c) * pesos[i], 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const dv1 = calcular(d.slice(0, 12), p1)
  const dv2 = calcular(d.slice(0, 12) + dv1, p2)
  return d.endsWith(`${dv1}${dv2}`)
}

/** `12345678000195` → `12.345.678/0001-95`. `null` quando inválido. */
export function formatarCnpj(valor: string | null | undefined): string | null {
  if (!cnpjValido(valor)) return null
  const d = digitos(valor!)
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export interface DadosInstitucionais {
  razaoSocial: string
  produto: string
  /** Formatado; `null` quando a configuração está ausente ou inválida. */
  cnpj: string | null
  contato: string
}

export function dadosInstitucionais(
  env: Record<string, string | undefined> = process.env
): DadosInstitucionais {
  return {
    razaoSocial: RAZAO_SOCIAL,
    produto: NOME_DO_PRODUTO,
    // A configuração sobrepõe só quando é válida; inválida cai no cadastro.
    cnpj: formatarCnpj(env.PATRONO_EMPRESA_CNPJ) ?? formatarCnpj(CNPJ_DA_EMPRESA),
    contato: CONTATO_EMAIL,
  }
}

/** Data da versão vigente dos textos institucionais. */
export const VERSAO_DOS_TEXTOS = '02/10/2026'
