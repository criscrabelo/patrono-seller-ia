# Autopilot & Compliance — Patrono Seller

**Criado:** 15/09/2026 — Rodada 5 (Primeiro Autopilot Real).

Este documento explica, em texto corrido, como o primeiro ciclo real de automação (`runAutopilot`, `lib/autopilot.ts`) funciona e quais regras de conformidade ele nunca pode ignorar. Complementa `DOCUMENTACAO-PATRONO-SELLER.md` (seção 22) e `REGRAS-PROVIDERS-E-CANAIS.md`.

**Ajuste de prioridade estratégica:** TikTok/TikTok Shop é o canal e provider prioritário nº 1 do MVP Automation First. Ordem: TikTok → Instagram → Amazon → Mercado Livre → Shopee → Renner → demais.

## 1. Pergunta que o Patrono responde agora

Não é "qual produto vende mais?" — é **"qual o melhor produto que eu consigo vender automaticamente, com segurança e dentro das regras?"**. Isso é o `AutomationFeasibilityScore` (`lib/automation-feasibility.ts`): combina potencial de venda (55%) com automatizabilidade (45% — link automático, mídia autorizada, capacidade de gerar conteúdo, capacidade de publicar automaticamente, ausência de exigência de consentimento, ausência de restrição de plataforma, confiança das regras, custo da automação). Entre dois produtos parecidos, o Patrono pode priorizar o que exige menos ação manual, mesmo com potencial um pouco menor — o objetivo é a proprietária nunca virar operadora da plataforma.

## 2. Amazon Creators API

- Marketplace `www.amazon.com.br` · Locale `pt_BR` · Currency `BRL`.
- Credenciais **só no servidor**: `AMAZON_CREATORS_CREDENTIAL_ID`, `AMAZON_CREATORS_CREDENTIAL_SECRET`, `AMAZON_CREATORS_PARTNER_TAG` — nunca `NEXT_PUBLIC_`, nunca no frontend, nunca em log ou `AuditLog`.
- Token OAuth 2.0 client-credentials é obtido e **cacheado** (`lib/oauth-token-cache.ts`) enquanto válido — nunca uma chamada por requisição.
- Sem credencial: `healthCheck()` devolve `"AGUARDANDO CONFIGURAÇÃO"` — nunca simula conexão; o resto do Patrono continua funcionando.
- `SearchItems` pede só os `resources` estritamente necessários (título, imagem primária, preço, SalesRank).
- **SalesRank oficial ≠ score interno do Patrono.** `AmazonSalesRank` (`browse_node_sales_rank`/`website_sales_rank`) é sempre um campo separado de `AutomationFeasibilityScore` — nunca a mesma coisa, nunca inventamos "mais vendido" sem essa fonte.
- `detailPageUrl` é usada **exatamente** como a API devolve (com `partnerTag`) — nunca reconstruída, nunca com parâmetro removido/alterado.
- Toda imagem começa com `usagePolicy: 'UNKNOWN'` — nunca assumimos que pode ser reusada em rede social, transformada ou armazenada permanentemente até os termos oficiais confirmarem o contrário.

## 3. Mercado Livre

- `/highlights`/`/trends` oficiais alimentam a descoberta de produto (`productDiscovery = AUTOMATIC`).
- **Geração de link de afiliado é `ASSISTED`, nunca `AUTOMATIC`** — as regras atuais do programa exigem a ferramenta oficial da própria usuária. O Patrono aponta o produto; a usuária gera o link.
- Ranking/categoria/busca **nunca** vira link diretamente — sempre resolve para o produto individual primeiro.
- **Afiliado por venda ≠ Campanha de Criador** (remunerada por visualização). Campanha de Criador que exige produto físico real na gravação bloqueia automaticamente vídeo gerado por IA fingindo ser a gravação real (`PHYSICAL_PRODUCT_REQUIRED`, `podeSubmeterAutomaticamente()`).

## 4. Media Rights Gate

Antes de qualquer geração de criativo, todo asset passa por `direitosDaPolicy()` + `mediaRightsGate()` (`lib/media-rights.ts`). `MediaUsagePolicy`: `DISPLAY_ONLY | TEMPORARY_REFERENCE | SOCIAL_REUSE_ALLOWED | DERIVATIVE_ALLOWED | UNKNOWN | PROHIBITED`.

- `UNKNOWN` só libera **exibir** — nunca reusar em rede social, transformar, derivar ou armazenar por padrão.
- Quando os termos oficiais não confirmam uso social, o Autopilot **nunca pergunta primeiro** — tenta, na ordem: (1) outro asset autorizado, (2) outra mídia oficial, (3) asset próprio permitido, (4) outro produto, (5) outro provider. Só cria `HumanActionRequired` quando não há alternativa automática.
- Nenhum conteúdo (foto/descrição/texto do programa) é enviado a um modelo generativo sem essa checagem passar antes — vale até para modelo local/gratuito.

## 5. Automation Feasibility Score

`lib/automation-feasibility.ts`: `calcularFeasibility()` = 55% `notaPotencial()` (ranking de vendas, tendência, comissão) + 45% `notaAutomatizabilidade()` (6 capacidades binárias × confiança das regras × custo da automação). `AutomationFeasibilityScorer implements OpportunityScorer` — usado pelo Autopilot para ranquear candidatos antes de selecionar.

## 6. Creative Renderer (POC gratuito)

`lib/renderer-ffmpeg.ts` — primeira implementação real de `RendererProvider`, usando `ffmpeg-static` (grátis, já dependência do projeto). Formatos: Reel vertical 9:16 (zoom leve + overlays), Post 1:1, Carrossel (mínimo 3 cards: Hook / Produto-benefício / CTA, método `renderCarrossel()`). **Nunca inventa texto** — todo overlay vem de quem chama, e o Autopilot só usa dados presentes na oportunidade (nome do produto, preço com timestamp — nunca preço sem fonte, nunca benefício/desconto/certificação inventados). Upload via Supabase Storage (`uploadBuffer`, `lib/supabase.ts`) — já configurado no projeto, sem custo adicional.

## 7. TikTok (canal, prioridade nº 1) e TikTok Shop (provider, separado)

- `lib/tiktok-preflight.ts`: `TikTokPreflightValidator` consulta a própria conta (nunca hardcoda duração/formato). Estados: `NOT_VERIFIED` (sem credencial) → `TECHNICALLY_VALID`/`REQUIRES_USER_CONSENT`/`BLOCKED_BY_POLICY`.
- `TikTokPublicationStatus`: `PREVALIDATED_FOR_TIKTOK` (nossa pré-validação) → `PUBLISHING` → `ACCEPTED_BY_TIKTOK`/`REJECTED_BY_TIKTOK`/`FAILED`. **Nunca dizemos "validado pelo TikTok" antes de uma resposta real da API.**
- `TikTokHumanConsentGate` (`tiktokHumanConsentGate()`): quando a plataforma exige consentimento explícito, o Patrono faz todo o resto sozinho e só mostra: **"Conteúdo pronto. Autorizar publicação no TikTok."** — nunca vira um fluxo manual maior.
- `lib/tiktok-channel.ts`: `TikTokPublisher` (init por URL + status), `TikTokCommercialDisclosure` (`brand_content_toggle` quando há afiliado), `TikTokAnalyticsAdapter` (métricas reais, campo ausente vira `null`, nunca inventado).
- `lib/tiktok-shop-provider.ts`: `TikTokShopAffiliateProvider`, **deliberadamente separado** do canal — cuida de produto/link/comissão do TikTok Shop, quando/se uma API oficial de afiliados for confirmada (ainda não nesta rodada).

## 8. Instagram Preflight (canal, prioridade nº 2)

`lib/instagram-preflight.ts`: `InstagramPreflightValidator` valida contra as regras já conhecidas de `lib/channel-registry.ts` (aspect ratio, codec, tamanho) e contra o estado da mídia (autorizada, conta elegível, URL acessível). Campo técnico desconhecido nunca é tratado como "ok" — vira `NOT_VERIFIED`.

## 9. Autopilot — ciclo de 14 etapas

`runAutopilot(workspaceId, deps, { dryRun })`:

1. Kill switch checado.
2. Encontrar oportunidades elegíveis (todas as `OpportunitySource` configuradas).
3. Pontuar via `AutomationFeasibilityScorer`.
4. Excluir candidatos `BLOCKED_BY_POLICY` (Media Rights Gate) automaticamente, sem perguntar primeiro.
5. Selecionar o melhor candidato restante.
6. Obter link autorizado (produtos que exigem consentimento — ex.: Mercado Livre — param aqui com `REQUIRES_USER_CONSENT`).
7. Confirmar mídia autorizada.
8. Gerar conteúdo (`RendererFFmpeg`, texto só com dados factuais da oportunidade).
9. Validar (TikTok primeiro, Instagram como alternativa).
10. Preparar publicação (`ComplianceEngine` decide disclosure).
11. Publicar quando permitido.
12. Registrar publicação (`AuditLog`, via `AutopilotStore`).
13. Acompanhar status.
14. Registrar métricas (consulta seguinte, `TikTokAnalyticsAdapter` — fora do ciclo síncrono).

## 10. Dry Run

`dryRun` (parâmetro ou `AUTOPILOT_DRY_RUN`, **default `true`**): executa até `READY_TO_PUBLISH`/`DRY_RUN_COMPLETE` e registra exatamente o que teria sido publicado — **nunca chama publicação real**.

## 11. Publicação real (produção)

Só publica de verdade quando **todas** as condições valem: `dryRun = false` **e** `Workspace.automationMode === 'AUTOMATIC'` **e** canal validado (TikTok/Instagram) **e** mídia autorizada **e** link autorizado **e** disclosure decidido **e** dentro dos limites/anti-spam **e** kill switch ainda desligado (checado de novo, imediatamente antes da chamada externa).

## 12. Kill Switch

`Workspace.automationPaused` (migração `20260915000000_workspace_automation_controls`, default `true` — automação nasce pausada). Quando ligado: nenhum job novo publica; um job em andamento é interrompido antes da etapa externa.

## 13. Limites e anti-spam

`LIMITES_PADRAO` (`lib/autopilot.ts`): `maxPublicacoesPorDia`, `cooldownMinutos` — limites internos de segurança, **nunca** descritos como "limite de shadowban" ou atribuídos à plataforma. Anti-spam: nunca republica o mesmo produto no mesmo dia (`produtosPublicadosHoje`).

## 14. Auditoria

Toda etapa relevante do Autopilot é registrada via `AutopilotStore.registrarAuditoria()` (implementação real: `lib/autopilot-store-prisma.ts`, usando `AuditLog`) — oportunidade encontrada, score, motivo da seleção, direitos de mídia, validações, conteúdo criado, publicação, erro, resultado. **Nunca registra segredo/token/credencial.**

## 15. Status Home (dado, sem redesenho)

`lib/autopilot-status.ts`, `calcularStatusAutopilotHome()`: `ATIVO | PAUSADO | PRECISA_DE_CONFIGURACAO | PRECISA_DE_VOCE | BLOQUEADO_POR_REGRA` — pronto para um futuro widget pequeno na Home, sem mudança visual nesta rodada.

## 16. O que ainda não existe

Nenhuma credencial real (Amazon, Mercado Livre, TikTok) foi configurada ou inventada nesta rodada — tudo funciona em modo "aguardando configuração" até a usuária conectar. `runAutopilot` ainda não cria `Produto`/`Conteudo`/`Sale` reais no banco por padrão — usa um `AutopilotStore` injetável (testável sem banco), com uma implementação Prisma pronta para ligar quando o fluxo completo de persistência for desenhado. `TikTokShopAffiliateProvider` aguarda confirmação de API oficial de afiliados.
