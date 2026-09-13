# AUDITORIA — Patrono Seller (MVP Afiliada)

**Data:** 13/09/2026
**Branch auditada:** `origin/main` (commit `6acdd7b`)
**Escopo:** auditoria integral solicitada antes de iniciar o P0. Nenhum código de produto foi alterado.

---

## ⚠️ TRÊS BLOQUEIOS ANTES DO P0

### BLOQUEIO 1 — O handoff de design citado não existe no repositório

A instrução manda ler integralmente `design_handoff/HANDOFF-DESIGN-PATRONO-SELLER.md`.
**Esse arquivo não existe.** Não há sequer a pasta `design_handoff/`.

O que existe de material de design:

| Arquivo | O que é |
|---|---|
| `design_handoff_integracoes/README.md` | Handoff de **integrações** (não de design do MVP Afiliada) |
| `design_handoff_integracoes/patrono-app.jsx` | Protótipo React de 4.983 linhas |
| `design_handoff_integracoes/styles.css` | Tokens visuais |
| `Patrono Seller IA - Handoff Tecnico.html` | Spec técnica antiga |
| `Patrono Seller IA - Plano Claude Code.html` | Prompts 1–9 + schemas Prisma |
| `STATUS.md` | Mapa de telas do protótipo |

**Por que isso trava:** a regra nº 1 é "não redesenhar" e o design aprovado é a referência. Sem o documento aprovado, eu não tenho como verificar fidelidade, nem garantir que não estou inventando produto. **Não vou adivinhar o design.**

### BLOQUEIO 2 — O material de design existente descreve um produto DIFERENTE do MVP Afiliada

O material no repositório descreve: Loja modular por assinatura, papéis Admin/Operador, Fornecedores, Creators/UGC, Compliance Jurídico, Radar, Motor de Decisão, Séries.

A instrução nova descreve: **Programa → Produto → Meu link → Conteúdo → Aprovar → Distribuir → Publicação manual → Resultados → Comissão.**

São produtos diferentes. O handoff antigo **não serve** como referência para o MVP Afiliada.

### BLOQUEIO 3 — A auditoria pedida pressupõe um estado que o projeto já superou

A instrução pede para procurar: `window.DATA`, localStorage como banco, autenticação fictícia, dados hardcoded.

**No aplicativo real, nada disso existe.** Esses problemas pertencem ao *protótipo* (`patrono-app.jsx`), que está no repositório mas **não é importado por nenhum arquivo do app**. O app real já tem Postgres, Prisma e NextAuth funcionando em produção.

Isso muda a natureza do trabalho: não é "transformar protótipo em app real" — o app real já existe. É decidir **o que fazer com ele** diante das novas regras (ver seção P).

---

## A. AUDITORIA DO PROJETO RECEBIDO

Existem **dois projetos** no mesmo repositório:

**1. Aplicação real (em produção)** — Next.js 15 + TypeScript
- 24 telas, 32 rotas de API, 7 modelos Prisma, ~11.842 linhas
- Autenticação real, banco Postgres, integrações ativas
- Publicada na Vercel, em uso

**2. Protótipo legado (morto)** — 22 arquivos `.jsx` + 6 `.html` na raiz, 692 KB
- `patrono-app.jsx` (4.983 linhas), `data.jsx`, `screens-*.jsx`
- Usa `window.DATA` e `localStorage`
- **Zero imports** a partir do app real — código morto ocupando o repositório

## B. ARQUITETURA ATUAL

```
app/
  (auth)/      login · register · esqueci-senha · redefinir-senha
  (dashboard)/ dashboard · produtos · conteudos · videos · aprovacao
               calendario · relatorios · links · monetizacao
               integracoes · whatsapp · video-seller · conta · admin/*
  api/         32 rotas REST
lib/           auth · prisma · claude · falai · instagram · whatsapp
               supabase · email · reset-token · modulos · upload-midia
```

**Fluxo implementado hoje:** Produto → Gerar conteúdo (IA) → Aprovação → Gerar vídeo (IA) → Publicar (Instagram API) → Links → Registrar venda → Dashboard.

## C. PROBLEMAS TÉCNICOS

| # | Problema | Gravidade |
|---|---|---|
| 1 | **Middleware não protege 7 áreas**: `/links`, `/monetizacao`, `/integracoes`, `/whatsapp`, `/admin`, `/conta`, `/videos` | 🔴 Alta |
| 2 | **Seed cria 2 produtos fictícios** (`produto-exemplo-1/2`) com `id` fixo | 🔴 Alta |
| 3 | **Zero testes** — nenhum framework, script ou arquivo de teste | 🔴 Alta |
| 4 | Vendas/comissões são só contadores agregados no link | 🟡 Média |
| 5 | `conteudos/page.tsx` com 887 linhas (múltiplas responsabilidades) | 🟡 Média |
| 6 | 692 KB de protótipo morto no repositório | 🟢 Baixa |

**Sobre o nº 1:** as páginas usam verificação client-side e as APIs exigem sessão — então não há vazamento de dados. Mas é defesa em profundidade ausente justamente em `/admin` e `/integracoes` (onde ficam tokens).

**Sobre o nº 2:** viola diretamente a regra "ZERO SIGNIFICA ZERO". Hoje o seed é manual (não roda no build), mas o risco existe.

## D. RISCOS

1. **Conflito de rumo** — as novas regras (custo zero, sem integrações, sem IA paga) contradizem o que já está em produção e pago.
2. **Perda de trabalho** — desativar Instagram/IA descarta meses de trabalho funcional.
3. **Uso comercial na Vercel Hobby** — o plano gratuito da Vercel é para uso pessoal, não comercial. Se o Patrono gera comissão, convém confirmar os termos.
4. **Ausência de testes** — não há rede de proteção para a regra de zero-state.
5. **Migração de dados** — já existem dados reais em produção.

## E. O QUE PODE SER REAPROVEITADO

Praticamente tudo o que o MVP Afiliada precisa **já existe**:

| Necessidade (instrução) | Estado |
|---|---|
| Autenticação real, sessão, proteção de rotas | ✅ NextAuth + bcrypt + middleware |
| Recuperação de acesso | ✅ Implementado (Resend) |
| Persistência real | ✅ Postgres + Prisma |
| Produto com campos completos | ✅ Modelo `Produto` |
| Link de afiliada | ✅ Modelo `LinkDinamico` |
| **Rastreamento `/go/:slug`** | ✅ **Já existe** como `/api/l/[slug]` (registra clique e redireciona) |
| Registrar clique | ✅ `EventoLink` |
| Criar conteúdo + aprovar | ✅ Fluxo completo |
| Publicação manual (copiar tudo) | ✅ "Copiar tudo para postar" |
| Loading/erros/validação | ✅ Padrão consistente + Zod |
| Permissões | ✅ `ModuloPermissao` por papel |

## F. O QUE PRECISA SER REFATORADO

1. **Middleware** — incluir as 7 áreas desprotegidas.
2. **Seed** — separar dados de teste de dados de produção.
3. **Vendas e Comissões** — hoje inexistentes como entidades; a instrução exige separação com estados próprios.
4. **Programa / Operação / Integração** — hoje fundidos em `Integracao`.
5. **Workspace** — não existe; tudo é por `userId`.
6. **Protótipo morto** — remover ou arquivar.
7. **Abstração `ContentGenerator`** — hoje acoplado à Anthropic.

## G. DEPENDÊNCIAS ATUAIS

31 dependências. Nenhuma abandonada. Destaques: `next@15.5`, `next-auth@4.24`, `@prisma/client@5.22`, `@anthropic-ai/sdk`, `@supabase/supabase-js`, `resend`, `zod`, `bcryptjs`, `react-hook-form`, `recharts`, `ffmpeg-static`.

## H. SERVIÇOS EXTERNOS ATUAIS

| Serviço | Uso | Variável |
|---|---|---|
| Supabase | Banco + storage | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Anthropic | Geração de conteúdo | `ANTHROPIC_API_KEY` |
| fal.ai | Geração de vídeo | `FAL_KEY` |
| Resend | Email de recuperação | `RESEND_API_KEY` |
| Meta/Instagram | Publicação | token no banco |
| Z-API | WhatsApp | credenciais no banco |
| Vercel | Hospedagem + cron | — |

## I. POSSÍVEIS CUSTOS

| Serviço | Free tier | Uso comercial | Situação |
|---|---|---|---|
| Supabase | 500 MB / 1 GB storage | ✅ | 🟢 Cabe no gratuito |
| Resend | 3.000/mês, 100/dia | ✅ | 🟢 Cabe no gratuito |
| Vercel | Hobby | ⚠️ Hobby é não-comercial | 🟡 Verificar |
| **Anthropic** | ❌ Não há | ✅ | 🔴 **Pago por uso** |
| **fal.ai** | ❌ Só créditos iniciais | ✅ | 🔴 **Pago por vídeo** |
| **Z-API** | ❌ | ✅ | 🔴 **Mensalidade** |

**Custo atual ≠ R$ 0,00.** Anthropic, fal.ai e Z-API cobram por uso.

## J. ALTERNATIVAS GRATUITAS

| Função | Hoje (pago) | Alternativa R$ 0 | Limitação |
|---|---|---|---|
| Texto do conteúdo | Anthropic | **Modo manual** (já suportado): usuária escreve/cola | Sem automação |
| Texto (semi-auto) | Anthropic | Google Gemini free tier | Cota diária; termos podem mudar |
| Vídeo | fal.ai | **Upload do próprio vídeo** (já existe) | Sem geração automática |
| WhatsApp | Z-API | **Link `wa.me`** manual | Sem envio em massa |
| Publicação IG | API Meta | **Publicação manual assistida** (já existe) | Usuária posta manualmente |

**Conclusão:** o MVP Afiliada **pode operar a R$ 0,00** usando os caminhos manuais que o app já tem. O que custa é a automação — que é opcional.

## K. MODELO DE DADOS PROPOSTO

Evolução do atual (não recriação):

```
users                    ← existe
workspaces               ← NOVO (isolamento)

affiliate_programs       ← NOVO (Shopee, Amazon…) — o PROGRAMA
affiliate_accounts       ← NOVO — a OPERAÇÃO (manual/integrada)
integrations             ← existe (renomear p/ separar do Programa)
provider_capabilities    ← NOVO

products                 ← existe (+ workspace, programa, comissão %)
affiliate_links          ← existe como LinkDinamico

contents                 ← existe como Conteudo
content_versions         ← NOVO
approvals                ← NOVO (hoje é só um campo status)

publications             ← NOVO (hoje é campo no Conteudo)

clicks                   ← existe como EventoLink

sales                    ← NOVO (pending | confirmed | cancelled)
commissions              ← NOVO (expected | confirmed | received)

audit_logs               ← NOVO
```

**Ponto central:** hoje `LinkDinamico.conversoes` e `receitaTotal` misturam venda e comissão num contador só. A instrução exige entidades separadas com estados próprios — essa é a mudança estrutural mais importante.

## L. ESTRATÉGIA DE AUTENTICAÇÃO GRATUITA

**Manter o que existe.** NextAuth + Credentials + bcrypt + JWT + Prisma é gratuito, open source, sem lock-in e já funciona. Único custo é o Resend (dentro do free tier). Ação: corrigir o matcher do middleware.

## M. ESTRATÉGIA DE PERSISTÊNCIA GRATUITA

**Manter Supabase Postgres.** Free tier suficiente para o MVP, uso comercial permitido, e é Postgres puro — se precisar sair, o Prisma aponta para qualquer Postgres (Neon, Railway, VPS). Sem lock-in real.

## N. PLANO P0 / P1 / P2 / P3

### P0 — Fundação e conformidade com as novas regras
- P0.1 Corrigir middleware (7 áreas)
- P0.2 Isolar seed de produção — garantir zero-state
- P0.3 Teste de regressão: conta nova = tudo zero
- P0.4 Introduzir `workspace`
- P0.5 Separar `sales` de `commissions` com estados
- P0.6 Separar Programa / Operação / Integração
- P0.7 `audit_logs` mínimo
- P0.8 Remover/arquivar protótipo morto
- P0.9 Abstração `ContentGenerator` (desacoplar Anthropic)
- P0.10 Homologação visual 375/390/414 px
- P0.11 `STACK-CUSTO-ZERO.md` + `DOCUMENTACAO-PATRONO-SELLER.md`

### P1 — Fluxo da afiliada ponta a ponta, 100% manual
Programa → Produto → Link → Conteúdo → Aprovar → Distribuir → Publicação manual assistida → Marcar publicado → Resultados → Venda → Comissão → **primeira comissão**.

### P2 — Automação opcional (só com autorização de custo)
Reativar IA de texto/vídeo e publicação automática como **opt-in**, nunca requisito.

### P3 — Módulos avançados
Video Seller, OKRs, Creators etc. — preservados, não desenvolvidos.

## O. TESTES NECESSÁRIOS

1. 🔴 **Zero-state** — conta nova nunca cria produto/link/clique/venda/comissão fictícios
2. 🔴 **Isolamento** — usuária A nunca acessa dado de usuária B (listagem e ID direto)
3. 🔴 **Comissões** — cálculo e transições de estado
4. 🟡 Venda ≠ comissão (entidades separadas)
5. 🟡 Proteção de rotas (logado/deslogado/papel)
6. 🟡 Validação de formulários
7. 🟢 Rastreamento `/l/:slug` (clique + redirecionamento)

Stack sugerida: **Vitest** (unit) + **Playwright** (e2e) — ambos gratuitos e open source.

## P. PLANO DA PRIMEIRA IMPLEMENTAÇÃO

**Não posso começar sem uma decisão de produto.** Existem dois caminhos incompatíveis:

### Caminho A — ADAPTAR (recomendado)
Manter o app atual e reorganizá-lo em torno do fluxo de afiliada. Automação vira opt-in desligado por padrão (custo R$ 0 se não usar).
- ✅ Preserva o que funciona; primeira comissão mais rápida
- ⚠️ Interface maior que a do MVP enxuto

### Caminho B — PIVOTAR
Reduzir ao MVP Afiliada enxuto, desativando IA paga, Instagram automático e WhatsApp.
- ✅ Produto focado, R$ 0,00 garantido
- ⚠️ Descarta trabalho funcional já pago

**Em ambos os casos, o P0.1–P0.3 (middleware, zero-state, teste de regressão) deve ser feito primeiro** — são correções de segurança e conformidade válidas nos dois caminhos.

---

## O QUE PRECISO DE VOCÊ

1. **O arquivo `HANDOFF-DESIGN-PATRONO-SELLER.md`** (ou confirmação de que devo usar o material existente)
2. **Decisão: Caminho A ou B**
3. **Confirmação sobre IA paga** — a Anthropic já está em produção e funcionando; desligo, mantenho como opt-in, ou mantenho como está?
