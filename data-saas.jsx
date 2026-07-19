/* ============ SaaS Modular — dados ============ */
DATA.saas = {
  planoBase: { nome:'Base Seller', preco:29, recursos:['Cadastro de usuário e marca','Dashboard simples','Cadastro básico de produtos','Geração limitada de legendas','Calendário simples','Relatórios básicos'] },

  // Módulos vendáveis (ativo = contratado pela conta atual)
  modulos: [
    { id:'m1', nome:'Conteúdo IA', icon:'sparkles', cor:'violet', mensal:47, desc:'Ideias, roteiros, ganchos, legendas, CTAs e hashtags com IA.', selo:'Mais vendido', ativo:true, uso:78, creditos:{ usado:340, total:500, label:'gerações IA' }, tela:'gerar',
      recursos:['Geração de ideias e roteiros','Legendas + CTAs + hashtags','Variações A/B','Análise de tendência','Transformar tendência em conteúdo próprio'] },
    { id:'m2', nome:'Calendário Editorial', icon:'calendar', cor:'blue', mensal:29, desc:'Organize 6 a 10 posts por dia com fila de aprovação.', ativo:true, uso:64, tela:'calendario',
      recursos:['Calendário por dia e horário','Status de postagem','Fila de aprovação','Visão semanal e mensal','Sugestão de frequência'] },
    { id:'m3', nome:'Produtos Afiliados', icon:'bag', cor:'gold', mensal:47, desc:'Produtos, links e plataformas de afiliados num só lugar.', selo:'Recomendado', ativo:true, uso:71, tela:'produtos',
      recursos:['Cadastro de produtos e links','Shopee, ML, Amazon, TikTok Shop, Renner','Status: campeão / teste / pausado','Organização por categoria'] },
    { id:'m4', nome:'Imagens e Criativos', icon:'image', cor:'pink', mensal:67, desc:'Capas, carrosséis, banners e thumbnails — com controle de autorização.', ativo:false, creditos:{ label:'imagens/mês' }, tela:'imagens',
      recursos:['Biblioteca de imagens','Capas, carrosséis e banners','Imagens geradas por IA','Controle de autorização','Vínculo com produto e campanha'] },
    { id:'m5', nome:'Vídeos Autorizados e UGC', icon:'video', cor:'blue', mensal:97, desc:'Vídeos próprios, UGC e fornecedores com status jurídico.', ativo:true, uso:52, tela:'biblioteca',
      recursos:['Biblioteca de vídeos','Cadastro de UGC e creators','Autorização de uso + status jurídico','Controle de edição','Vínculo com produto/campanha'] },
    { id:'m6', nome:'Lucro e Escala', icon:'dollar', cor:'green', mensal:97, desc:'Quanto você lucra e quais produtos escalar, com Score de Escala.', selo:'Recomendado', ativo:true, uso:88, tela:'lucro',
      recursos:['Lucro por plataforma/produto/vídeo','Custos, comissão e margem','Ranking de produtos','Score de Escala (0–100)','Recomendação automática da IA'] },
    { id:'m7', nome:'Compliance Jurídico', icon:'shield', cor:'amber', mensal:147, desc:'Reduz risco jurídico: autorizações, termos, logs e bloqueios.', ativo:false, tela:'compliance',
      recursos:['Checklist jurídico','Autorização de imagem e vídeo','Termos e políticas','Logs de aprovação','Bloqueio de conteúdo sem autorização'] },
    { id:'m8', nome:'Automação e Publicação', icon:'bolt', cor:'violet', mensal:197, desc:'Fila de publicação e integração com APIs (aprovação especial).', selo:'Premium', ativo:false, tela:'publicacao',
      recursos:['Fila de publicação','Pacote manual','TikTok Content Posting API','Histórico de publicação','Autorização inicial obrigatória'] },
    { id:'m9', nome:'Agência', icon:'users', cor:'gold', mensal:297, desc:'Gerencie múltiplas marcas e clientes com relatórios por cliente.', selo:'Premium', ativo:false, tela:'metas',
      recursos:['Múltiplas marcas e usuários','Permissões por equipe','Relatórios por cliente','Dashboard por cliente','White label futuro'] },
    { id:'m10', nome:'White Label', icon:'star', cor:'violet', mensal:null, precoLabel:'Sob consulta', desc:'Sua própria marca, cores e domínio na plataforma.', selo:'Premium', ativo:false, tela:null,
      recursos:['Logo e cores próprias','Domínio próprio','Relatórios com sua marca','Ocultar marca original','Painel personalizado'] },
  ],

  combos: [
    { id:'c1', nome:'Afiliado Iniciante', preco:97, economia:26, mods:['Conteúdo IA','Produtos Afiliados','Calendário Editorial'], cor:'blue' },
    { id:'c2', nome:'Afiliado Pro', preco:197, economia:90, selo:'Mais vendido', mods:['Conteúdo IA','Produtos Afiliados','Calendário Editorial','Imagens e Criativos','Lucro e Escala'], cor:'gold' },
    { id:'c3', nome:'Social Media', preco:247, economia:93, mods:['Conteúdo IA','Calendário Editorial','Imagens e Criativos','Agência'], cor:'violet' },
    { id:'c4', nome:'Lojista', preco:297, economia:111, mods:['Produtos Afiliados','Imagens e Criativos','Vídeos Autorizados e UGC','Lucro e Escala'], cor:'pink' },
    { id:'c5', nome:'Completo', preco:497, economia:231, selo:'Melhor valor', mods:['Todos os 8 módulos operacionais'], cor:'green' },
  ],

  // Painel da dona — métricas por módulo
  adminMetrics: {
    receitaTotal: 18470, assinantes: 142, churn: 4.2, trial: 23,
    porModulo: [
      { nome:'Lucro e Escala', assinantes:78, receita:7566, churn:2.1, uso:88 },
      { nome:'Conteúdo IA', assinantes:96, receita:4512, churn:3.4, uso:78 },
      { nome:'Produtos Afiliados', assinantes:71, receita:3337, churn:3.0, uso:71 },
      { nome:'Vídeos e UGC', assinantes:34, receita:3298, churn:5.1, uso:52 },
      { nome:'Imagens e Criativos', assinantes:28, receita:1876, churn:6.2, uso:44 },
      { nome:'Compliance Jurídico', assinantes:12, receita:1764, churn:1.8, uso:38 },
    ],
  },
};

window.seloMap = {
  'Mais vendido': 'gold', 'Recomendado': 'green', 'Premium': 'violet', 'Melhor valor': 'green',
};
