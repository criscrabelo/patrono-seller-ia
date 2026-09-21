import { Resend } from 'resend'
import { guardarChamadaPaga } from './cost-safety-gate'

// Envia email via Resend. Se RESEND_API_KEY não estiver configurada (ex.:
// ambiente local), apenas registra o link no console e não falha — assim o
// fluxo continua testável sem serviço de email.
export async function enviarEmailReset(para: string, link: string): Promise<{ enviado: boolean }> {
  // CUSTO ZERO POR PADRÃO (Rodada 14): Resend cobra acima do free tier.
  // Sem alternativa gratuita no projeto, o envio fica PENDENTE por política —
  // devolve `enviado: false` em vez de lançar, para não derrubar o fluxo que
  // chamou (recuperação de senha continua funcionando pela tela).
  const guarda = await guardarChamadaPaga({
    provider: 'resend',
    operacao: 'enviar-email',
    workspaceId: null,
    custoEstimado: null,
  })
  if (!guarda.permitido) {
    console.warn(`[email] envio bloqueado por política de custo: ${guarda.decisao.explicacao}`)
    return { enviado: false }
  }

  const key = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM || 'Patrono Seller <onboarding@resend.dev>'

  if (!key) {
    console.log('[email] RESEND_API_KEY ausente — link de redefinição (dev):', link)
    return { enviado: false }
  }

  const resend = new Resend(key)
  await resend.emails.send({
    from,
    to: para,
    subject: 'Redefinição de senha — Patrono Seller',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
        <h2 style="color:#111">Redefinição de senha</h2>
        <p>Você pediu para redefinir sua senha no <strong>Patrono Seller</strong>.</p>
        <p>Clique no botão abaixo para criar uma nova senha. O link vale por 1 hora.</p>
        <p style="margin:28px 0">
          <a href="${link}" style="background:#f5b400;color:#111;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;display:inline-block">
            Criar nova senha
          </a>
        </p>
        <p style="font-size:12px;color:#666">Se você não pediu isso, pode ignorar este email — sua senha continua a mesma.</p>
        <p style="font-size:12px;color:#666;word-break:break-all">Ou copie este link: ${link}</p>
      </div>
    `,
  })
  return { enviado: true }
}
