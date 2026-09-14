# Stack e Custo — Patrono Seller (MVP Afiliada)

**Última atualização:** 13/09/2026 — Rodada 2 do P0.

**Meta do projeto:** custo operacional inicial **R$ 0,00**, sempre que tecnicamente viável. Nenhuma dependência paga nova foi adicionada nesta rodada.

Regra: **não presumir** que um plano gratuito permite uso comercial. Onde não há confirmação verificada, o campo diz **A VERIFICAR** — não "sim" por suposição.

---

## Tabela de recursos

| Recurso | Tecnologia atual | Função | Custo atual | Limite gratuito | Uso comercial | Dependência externa | Alternativa |
|---|---|---|---|---|---|---|---|
| Framework | Next.js 15 (MIT) | App, rotas, API | R$ 0,00 | — (open source, sem limite de uso) | Sim (licença MIT permite) | Não | — |
| Linguagem | TypeScript (Apache 2.0) | Tipagem | R$ 0,00 | — | Sim | Não | — |
| ORM | Prisma 5 (Apache 2.0) | Acesso ao banco | R$ 0,00 | — | Sim | Não | — |
| Banco de dados | PostgreSQL via Supabase | Armazenar todos os dados | **A VERIFICAR** — depende do plano contratado no projeto Supabase real; free tier da Supabase tem limite de 500MB e pausa por inatividade | 500MB, pausa após inatividade (free tier) | **A VERIFICAR** (checar os termos do plano específico antes de assumir) | Sim (Supabase, hospedado) | Neon Free (Postgres serverless) |
| Storage de mídia | Supabase Storage | Upload de imagens/vídeos | **A VERIFICAR** (mesmo projeto Supabase acima) | 1GB no free tier (valor pode ter mudado) | **A VERIFICAR** | Sim | Cloudflare R2 Free (10GB) |
| Autenticação | NextAuth v4 (ISC license) + bcrypt | Login, sessão JWT | R$ 0,00 | — (roda no próprio servidor, sem serviço externo) | Sim | Não | — |
| Hospedagem | Vercel | Deploy do Next.js, Serverless Functions, Cron | **A VERIFICAR** — o plano Hobby da Vercel é explicitamente **para uso não comercial**; se este projeto gera receita, o plano correto é o Pro (pago) | Hobby: uso pessoal/não-comercial | **Não**, se em Hobby e o produto for comercial | Sim | Cloudflare Pages/Workers Free (permite uso comercial no free tier, conferir limites antes de migrar) |
| E-mail transacional | Resend | Envio do "esqueci a senha" | **A VERIFICAR** (checar o plano ativo da conta Resend usada) | Free tier historicamente ~3.000 e-mails/mês (conferir valor atual) | **A VERIFICAR** | Sim | Brevo Free (~300/dia) |
| IA de texto (roteiro/legenda) | Anthropic Claude API (`@anthropic-ai/sdk`) | Gerar roteiro, legendas, prompts | **Pago por uso** (API paga, não tem free tier permanente) | — | Sim, mas com custo por token | Sim | Reduzir geração / usar templates manuais quando o custo pesar |
| IA de vídeo | fal.ai (Kling, Veo 3, Luma Ray 2) | Gerar vídeo a partir de imagem/prompt | **Pago por uso** — ver seção "Dependências pagas" abaixo | — | Sim, mas com custo por geração | Sim | Roteiro + storyboard manual; upload de vídeo gravado/editado fora da plataforma (ex.: CapCut free) |
| CSV/planilha | (ainda não usado no app real) | — | R$ 0,00 | — | — | — | PapaParse (MIT), se/quando for implementado |
| Gráficos | Recharts (MIT) | Gráficos do Dashboard | R$ 0,00 | — | Sim | Não | — |
| UI | Tailwind CSS (MIT), Radix UI (MIT), lucide-react (ISC) | Componentes visuais | R$ 0,00 | — | Sim | Não | — |
| WhatsApp | Z-API (`lib/whatsapp.ts`, não-oficial) | Envio de mensagens em massa | **A VERIFICAR** — Z-API é um serviço pago por instância/mensagem; conferir o plano ativo da conta configurada | Não confirmado ter free tier real de produção | **A VERIFICAR** | Sim | Publicação/contato manual assistido (já é o padrão para quem não configurar Z-API) |

---

## Dependências pagas identificadas — DEPENDÊNCIA PAGA, JÁ EM USO

Estas já estavam em uso antes desta rodada (não foram adicionadas agora), mas precisam continuar registradas aqui porque representam custo real:

1. **Anthropic Claude API** (geração de roteiro/legenda) — cobrança por token. Sem free tier permanente.
2. **fal.ai** (Kling, Veo 3, Luma Ray 2 — geração de vídeo) — cobrança por geração, valores variam por modelo (Veo 3 é o mais caro dos três, por isso foi colocado como última opção na tela de seleção de motor). Nenhum limite gratuito conhecido.

Nenhuma integração nova paga foi contratada nesta rodada. Nenhum dos dois foi desligado — a decisão de mantê-los é anterior a este ciclo de trabalho (já estavam em produção).

## Rodada 7 — Digital Twin (nenhuma dependência paga)

Chatterbox TTS (Resemble AI) usado apenas na versão **self-hosted/open source**, nunca a API paga. MuseTalk (lip-sync) avaliado como candidato open source com uso comercial informado pelo projeto (ver `DIGITAL-TWIN-MODEL-LICENSES.md`). Wav2Lip e LivePortrait ficam `BLOCKED_BY_LICENSE` — nunca integrados. Nenhum modelo pesado foi baixado/instalado neste ambiente; nenhum HeyGen/Synthesia/ElevenLabs/D-ID/cloud GPU contratado.

## Nenhuma dependência paga NOVA nesta rodada

Tudo que foi adicionado agora (Workspace, AffiliateProgram, Sale, Commission, AuditLog, testes) usa **apenas** a stack já existente: mesmo Postgres (Prisma), mesmo framework (Next.js), zero bibliotecas novas. Os testes usam o test runner nativo do Node (`node --test`) — nenhuma dependência de teste foi adicionada ao `package.json`.

## Como verificar os itens marcados "A VERIFICAR"

- **Supabase (banco + storage):** entrar no painel do projeto → Settings → Billing, conferir o plano ativo e os limites reais consumidos.
- **Vercel:** Settings → Billing do projeto, conferir se está em Hobby ou Pro. Se em Hobby e o produto gerar receita, isso viola os termos da Vercel — **registrar como DEPENDÊNCIA PAGA — NECESSITA APROVAÇÃO** antes de continuar operando comercialmente nesse plano.
- **Resend:** painel de conta → Usage, conferir o plano e quantos e-mails já foram usados no mês.
- **WhatsApp:** conferir qual provedor está configurado em `Integracao` (`plataforma: 'whatsapp'`) e seus termos de uso e custo.

Nenhum desses itens foi assumido como "gratuito e liberado para uso comercial" neste documento — cada um está com sua real situação, verificada ou marcada para verificação.
