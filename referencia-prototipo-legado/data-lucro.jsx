/* ============ Painel de Lucro e Escala — dados ============ */
DATA.lucro = {
  // Resumo financeiro geral (mês atual)
  resumo: {
    receitaBruta: 18240,   // valor total dos produtos vendidos
    comissao: 2840,        // comissão recebida
    custos: 980,           // custos totais atribuídos
    lucroLiquido: 1860,    // comissão - custos
    margem: 65.5,          // lucro / comissão * 100
    ticketMedio: 25.40,
    vendas: 139,
    cliques: 4408,
    conversao: 3.2,        // vendas / cliques * 100
    receitaPorVideo: 18.10,
    lucroPorVideo: 11.85,
    previsao30d: 2420,     // receita estimada próximos 30 dias
  },

  // Lucro por plataforma
  plataformas: [
    { nome:'Shopee',        cor:'amber', produtos:18, videos:62, cliques:1820, vendas:58, comissao:1240, custos:420, lucro:820, conversao:3.2, maisVendido:'Cabide Mágico', maisLucrativo:'Talheres Expansível', maiorEscala:'Cabide Mágico', categoria:'Cozinha' },
    { nome:'Mercado Livre', cor:'gold',  produtos:11, videos:38, cliques:940,  vendas:31, comissao:820,  custos:240, lucro:580, conversao:3.3, maisVendido:'Potes Geladeira', maisLucrativo:'Potes Geladeira', maiorEscala:'Potes Geladeira', categoria:'Geladeira' },
    { nome:'Amazon',        cor:'blue',  produtos:9,  videos:28, cliques:620,  vendas:15, comissao:410,  custos:180, lucro:230, conversao:2.4, maisVendido:'Nicho de Canto', maisLucrativo:'Organizador Suspenso', maiorEscala:'Nicho de Canto', categoria:'Banheiro' },
    { nome:'TikTok Shop',   cor:'pink',  produtos:6,  videos:22, cliques:880,  vendas:28, comissao:300,  custos:100, lucro:200, conversao:3.2, maisVendido:'Divisória de Gaveta', maisLucrativo:'Divisória de Gaveta', maiorEscala:'Divisória de Gaveta', categoria:'Gavetas' },
    { nome:'Renner',        cor:'violet',produtos:3,  videos:8,  cliques:148,  vendas:7,  comissao:70,   custos:40,  lucro:30,  conversao:4.7, maisVendido:'Organizador Suspenso', maisLucrativo:'Organizador Suspenso', maiorEscala:'—', categoria:'Guarda-roupa' },
  ],

  // Banco de vendas (amostra)
  vendas: [
    { data:'11/06', plat:'Shopee', produto:'Cabide Mágico Antideslizante', valor:34.90, pct:20, comissao:6.98, status:'aprovada', video:'cabide_demo_v2', campanha:'Guarda-roupa inteligente' },
    { data:'11/06', plat:'TikTok Shop', produto:'Divisória de Gaveta Ajustável', valor:24.90, pct:22, comissao:5.48, status:'paga', video:'gaveta_asmr', campanha:'Bobos que resolvem' },
    { data:'10/06', plat:'Mercado Livre', produto:'Potes Herméticos Geladeira', valor:79.90, pct:12, comissao:9.59, status:'aprovada', video:'geladeira_tour', campanha:'Antes e depois' },
    { data:'10/06', plat:'Shopee', produto:'Organizador de Talheres', valor:29.90, pct:18, comissao:5.38, status:'pendente', video:'talheres_pov_v1', campanha:'Achadinhos de cozinha' },
    { data:'09/06', plat:'Amazon', produto:'Nicho de Canto Adesivo Inox', valor:45.00, pct:9, comissao:4.05, status:'aprovada', video:'banheiro_antesdepois', campanha:'Banheiro pequeno' },
    { data:'09/06', plat:'Shopee', produto:'Cabide Mágico Antideslizante', valor:34.90, pct:20, comissao:6.98, status:'cancelada', video:'cabide_demo_v1', campanha:'Guarda-roupa inteligente' },
  ],

  // Custos cadastrados
  custos: [
    { tipo:'UGC contratado', valor:380, vinculo:'Produto · Cabide Mágico', plat:'Shopee' },
    { tipo:'Edição de vídeo', valor:240, vinculo:'Geral da operação', plat:'—' },
    { tipo:'Ferramentas de IA', valor:180, vinculo:'Geral da operação', plat:'—' },
    { tipo:'Banco de vídeos', valor:120, vinculo:'Plataforma · Amazon', plat:'Amazon' },
    { tipo:'Freela (legendas)', valor:60, vinculo:'Campanha · Antes e depois', plat:'Mercado Livre' },
  ],

  // Produtos com score de escala
  produtos: [
    { nome:'Cabide Mágico Antideslizante', plat:'Shopee', cat:'Guarda-roupa', preco:34.90, pct:20, videos:12, cliques:1240, vendas:41, comissao:286, custos:380, lucro:520, margem:64, conversao:3.3, score:92, nota:4.9, cresc7d:18,
      rec:'Vendeu muito bem e tem alta margem. Criar mais 5 vídeos e escalar agora.', recTipo:'escalar' },
    { nome:'Organizador de Talheres', plat:'Shopee', cat:'Cozinha', preco:29.90, pct:18, videos:9, cliques:980, vendas:32, comissao:172, custos:90, lucro:298, margem:78, conversao:3.3, score:88, nota:4.8, cresc7d:12,
      rec:'Alta margem e conversão estável. Produto campeão — manter ritmo e testar novo gancho.', recTipo:'escalar' },
    { nome:'Potes Herméticos Geladeira', plat:'Mercado Livre', cat:'Geladeira', preco:79.90, pct:12, videos:8, cliques:620, vendas:18, comissao:172, custos:60, lucro:285, margem:62, conversao:2.9, score:74, nota:4.7, cresc7d:6,
      rec:'Ticket alto e bom lucro. Produto promissor — aumentar volume de vídeos.', recTipo:'testar' },
    { nome:'Divisória de Gaveta', plat:'TikTok Shop', cat:'Gavetas', preco:24.90, pct:22, videos:7, cliques:520, vendas:24, comissao:131, custos:100, lucro:165, margem:56, conversao:4.6, score:81, nota:4.7, cresc7d:22,
      rec:'Maior crescimento da semana (+22%). Produto campeão — escalar imediatamente.', recTipo:'escalar' },
    { nome:'Nicho de Canto Adesivo', plat:'Amazon', cat:'Banheiro', preco:45.00, pct:9, videos:6, cliques:740, vendas:9, comissao:36, custos:120, lucro:-30, margem:-22, conversao:1.2, score:42, nota:4.6, cresc7d:-4,
      rec:'Muitos cliques, poucas vendas e lucro negativo. Trocar gancho ou revisar preço.', recTipo:'testar' },
    { nome:'Varal Retrátil de Parede', plat:'TikTok Shop', cat:'Lavanderia', preco:59.90, pct:15, videos:4, cliques:88, vendas:1, comissao:9, custos:40, lucro:-31, margem:-78, conversao:1.1, score:24, nota:4.5, cresc7d:-12,
      rec:'Baixa conversão e prejuízo. Pausar por 7 dias e arquivar aprendizado.', recTipo:'pausar' },
  ],

  // Recomendações estratégicas da IA (pedem aprovação)
  recomendacoes: [
    { txt:'Divisória de Gaveta cresceu +22% e é campeã. Escalar imediatamente com 5 novos vídeos.', tipo:'escalar', alvo:'Produto', risco:'verde' },
    { txt:'Shopee gera mais lucro líquido (R$ 820) que as demais. Priorizar campanhas nela.', tipo:'priorizar', alvo:'Plataforma', risco:'verde' },
    { txt:'Nicho de Canto teve muitos cliques mas lucro negativo. Trocar gancho ou pausar.', tipo:'revisar', alvo:'Produto', risco:'amarelo' },
    { txt:'Campanha "Lavanderia funcional" está com lucro negativo (-R$ 31). Pausar?', tipo:'pausar', alvo:'Campanha', risco:'vermelho' },
    { txt:'Investir em UGC para Cabide Mágico (campeão) pode dobrar a saída. Aprovar verba?', tipo:'investir', alvo:'UGC', risco:'amarelo' },
  ],

  // Alertas automáticos
  alertas: [
    { txt:'Produto campeão detectado: Divisória de Gaveta', tipo:'campeao', cls:'gold', icon:'star' },
    { txt:'Plataforma mais lucrativa da semana: Shopee', tipo:'plataforma', cls:'green', icon:'trend' },
    { txt:'Alto clique e baixa venda: Nicho de Canto', tipo:'alerta', cls:'amber', icon:'alert' },
    { txt:'Campanha com lucro negativo: Lavanderia funcional', tipo:'prejuizo', cls:'red', icon:'arrow' },
    { txt:'Produto pronto para escala: Cabide Mágico', tipo:'escala', cls:'violet', icon:'rocket' },
  ],
};

// Score de escala → faixa
window.scoreFaixa = (s) => {
  if (s <= 30) return { label:'Não escalar', cls:'red', range:'0–30' };
  if (s <= 60) return { label:'Testar mais', cls:'amber', range:'31–60' };
  if (s <= 80) return { label:'Promissor', cls:'blue', range:'61–80' };
  return { label:'Campeão · escalar', cls:'gold', range:'81–100' };
};
window.recTipoMap = {
  escalar:   { cls:'green', icon:'rocket', label:'Escalar' },
  testar:    { cls:'amber', icon:'flask', label:'Testar' },
  pausar:    { cls:'red', icon:'pause', label:'Pausar' },
  priorizar: { cls:'gold', icon:'star', label:'Priorizar' },
  revisar:   { cls:'amber', icon:'refresh', label:'Revisar' },
  investir:  { cls:'violet', icon:'dollar', label:'Investir' },
};
window.vendaStatusMap = {
  pendente:  { cls:'amber', label:'Pendente' },
  aprovada:  { cls:'blue', label:'Aprovada' },
  cancelada: { cls:'red', label:'Cancelada' },
  paga:      { cls:'green', label:'Paga' },
};
