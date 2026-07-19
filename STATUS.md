# STATUS — Patrono Seller IA

Mapa único para o desenvolvedor (Claude Code). Atualize as caixas conforme avança.

---

## ✅ Pronto no design (protótipo de referência)

- **Identidade visual** completa: tokens oklch, Space Grotesk + DM Sans, semântica **ouro = marca / violeta = IA / verde·âmbar·vermelho = status**.
- **20 telas** navegáveis em alta fidelidade no protótipo (`Patrono Seller IA - Redesign.html` / `Patrono Seller IA - Prototipo (standalone).html`).
- **Papéis Admin / Operador** na UI: sidebar filtrada, Compliance somente-leitura para operador, Fornecedores admin-only.
- **Loja modular**: módulos avulsos + combos, ciclo mensal/anual, prévia/paywall por módulo não contratado e "Ativar".
- **4 telas finais** (este pacote): Imagens e Criativos, Fornecedores, Creators/UGC, Compliance Jurídico — com modais, master-detail, pipeline UGC e navegação cruzada.
- **Especificação técnica**: `Patrono Seller IA - Handoff Tecnico.html`, `... Integracao TikTok.html`, `... Plano Claude Code.html` (prompts 1–9 + schemas Prisma).

## → Falta implementar (Claude Code)

- [ ] **Auth + papéis no servidor**: `User.role = 'admin' | 'operador'`, proteção de rotas via `middleware.ts`, aprovação de cadastro.
- [ ] **IA conectada**: Transformador (tendência → ganchos/roteiros/legendas A/B/CTAs), legendas, análise de tendência e performance. Chave em env, com limite de custo.
- [ ] **Banco + migrations** dos módulos novos: Radar, Biblioteca autorizada, Séries, Motor de Decisão **+ Imagem, Fornecedor, Creator, EntregaUGC, TermoJuridico, LogCompliance** (schemas no prompt 9).
- [ ] **TikTok**: Pacote Manual (.zip) → Login Kit (OAuth, tokens cifrados) → Content Posting API. 1ª publicação automática sempre passa por "Aprovar Agora".
- [ ] **Gate `podePostar`**: só libera conteúdo com `autorizado=true` E fornecedor/creator com termo de cessão vigente.
- [ ] **Estados** de loading/erro/vazio, responsivo no celular, notificações de aprovação.
- [ ] **Deploy Vercel** + `.env.example` documentado.

## 🔑 Variáveis de ambiente (configurar)

```
DATABASE_URL=
AUTH_SECRET=
AI_API_KEY=                # IA de roteiros/legendas (manter no servidor)
AI_MONTHLY_BUDGET=         # teto de custo
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=
TOKENS_ENCRYPTION_KEY=     # cifra tokens das integrações
```

## 📋 Ordem recomendada

1 → 2 → 3 → 4 → 5 → **9 (acervo + compliance)** → 6 → 7 → 8.
Faça commit antes de cada prompt e teste no navegador a cada etapa. Detalhes em `Patrono Seller IA - Plano Claude Code.html`.

## 🧭 Regras de negócio que não podem se perder

- **Anti-cópia**: tendência vira conteúdo 100% próprio (nunca repostar vídeo/áudio de terceiros).
- **Gate de publicação**: nada vai à fila sem autorização + produto + link válido.
- **Compliance de legenda**: bloquear promessas absolutas ("garantido", "prometo"); marcação de #publi automática.
- **Operador**: vê Compliance em leitura; não acessa Fornecedores nem Usuários/Integrações.
- **Cross-nav**: cada bloqueio no Compliance leva à arte (Imagens) ou ao Fornecedor responsável.

---
_Grupo Patrono · 2026 — quando todos os itens "→" estiverem feitos, a plataforma está pronta para uso no modo manual; o automático entra com a aprovação do app TikTok._
