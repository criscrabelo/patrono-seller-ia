/* ============ Relatórios ============ */
const Bars = ({ data, color = 'var(--gold)' }) => {
  const max = Math.max(...data);
  return (
    <div className="row" style={{ gap: 6, alignItems: 'flex-end', height: 90 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, height: (v / max * 100) + '%', minHeight: 4, borderRadius: '5px 5px 0 0', background: i === data.length - 1 ? color : 'oklch(1 0 0 / 0.12)' }} />
      ))}
    </div>
  );
};

const Relatorios = () => (
  <div className="content-inner fade-in">
    <div className="grid g4">
      <StatCard icon="eye" color="violet" value="935k" label="Views (7 dias)" trend="+24%" trendDir="up" />
      <StatCard icon="link" color="blue" value="996" label="Cliques no link" trend="+12%" trendDir="up" />
      <StatCard icon="dollar" color="green" value="R$ 423" label="Receita (7 dias)" trend="+31%" trendDir="up" />
      <StatCard icon="users" color="gold" value="+620" label="Seguidores ganhos" trend="meta: +287" trendDir="up" />
    </div>

    <div className="grid g2" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <div className="card">
        <div className="card-head"><div className="card-title" style={{ fontSize: 14 }}>Views por dia</div></div>
        <Bars data={[62,74,81,90,98,110,124]} color="var(--violet)" />
        <div className="row" style={{ gap: 6, marginTop: 8 }}>{['S','T','Q','Q','S','S','D'].map((d,i) => <span key={i} className="dim" style={{ flex: 1, textAlign: 'center', fontSize: 10.5 }}>{d}</span>)}</div>
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title" style={{ fontSize: 14 }}>Receita por dia</div></div>
        <Bars data={[28,35,41,38,52,68,82]} color="var(--green)" />
        <div className="row" style={{ gap: 6, marginTop: 8 }}>{['S','T','Q','Q','S','S','D'].map((d,i) => <span key={i} className="dim" style={{ flex: 1, textAlign: 'center', fontSize: 10.5 }}>{d}</span>)}</div>
      </div>
    </div>

    <div className="card flush">
      <div className="row spread" style={{ padding: '14px 20px' }}><div className="card-title">Desempenho por conteúdo</div><button className="btn btn-ghost btn-sm"><Icon name="download" size={14} />Exportar</button></div>
      <table className="tbl">
        <thead><tr><th>Produto</th><th>Série</th><th>Rede</th><th className="right">Views</th><th className="right">Likes</th><th className="right">Cliques</th><th className="right">Vendas</th><th className="right">Receita</th><th className="right">Veredito</th></tr></thead>
        <tbody>
          {DATA.relatorios.map((r, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 600 }}>{r.produto}</td>
              <td className="muted">{r.serie}</td>
              <td className="muted">{r.rede}</td>
              <td className="right mono">{r.views}</td>
              <td className="right mono">{r.likes}</td>
              <td className="right mono">{r.cliques}</td>
              <td className="right mono">{r.vendas}</td>
              <td className="right mono" style={{ color: 'var(--green)' }}>{r.receita}</td>
              <td className="right"><Badge status={r.veredito} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/* ============ Motor de Decisão (NOVO) ============ */
const Decisao = () => {
  const lanes = [
    { key:'campeao', title:'Campeões', desc:'Performou muito bem', color:'gold', icon:'star',
      acoes:['Criar 5 variações','Repetir produto','Testar novo gancho','Priorizar produto'],
      items:[{p:'Cabide Mágico', m:'412k views · 28 vendas'},{p:'Talheres Expansível', m:'287k views · 19 vendas'}] },
    { key:'medio', title:'Medianos', desc:'Resultado intermediário', color:'amber', icon:'trend',
      acoes:['Alterar legenda','Testar novo CTA','Mudar horário'],
      items:[{p:'Potes Geladeira', m:'156k views · 11 vendas'},{p:'Nicho de Canto', m:'62k views · 3 vendas'}] },
    { key:'fraco', title:'Fracos', desc:'Performou mal', color:'red', icon:'pause',
      acoes:['Pausar formato','Não repetir agora','Arquivar aprendizado'],
      items:[{p:'Varal Retrátil', m:'18k views · 1 venda'}] },
  ];
  return (
    <div className="content-inner fade-in">
      <div className="card" style={{ background: 'radial-gradient(600px 200px at 50% 0%, var(--violet-soft), transparent 60%), var(--surface)' }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="ico" style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--violet-soft)', color: 'var(--violet)' }}><Icon name="brain" size={22} /></div>
          <div><h2 style={{ fontSize: 18 }}>Motor de Decisão</h2><p className="muted" style={{ fontSize: 13 }}>A IA classifica cada vídeo e decide o próximo passo automaticamente</p></div>
        </div>
      </div>
      <div className="grid g3" style={{ alignItems: 'start' }}>
        {lanes.map(l => (
          <div key={l.key} className="card" style={{ borderTop: `3px solid var(--${l.color})` }}>
            <div className="row spread">
              <div className="row" style={{ gap: 9 }}>
                <div className="ico" style={{ width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', background: `var(--${l.color}-soft)`, color: `var(--${l.color})` }}><Icon name={l.icon} size={16} /></div>
                <div><div style={{ fontWeight: 600 }}>{l.title}</div><div className="dim" style={{ fontSize: 11.5 }}>{l.desc}</div></div>
              </div>
              <span className={`badge ${l.color}`} style={{ padding: '2px 8px' }}>{l.items.length}</span>
            </div>
            <div className="col" style={{ gap: 8, margin: '14px 0' }}>
              {l.items.map((it, i) => (
                <div key={i} style={{ padding: '9px 11px', borderRadius: 10, background: 'oklch(0 0 0 / 0.2)', border: '1px solid var(--border-soft)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{it.p}</div>
                  <div className="dim mono" style={{ fontSize: 11 }}>{it.m}</div>
                </div>
              ))}
            </div>
            <div className="divider" />
            <div className="dim" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '10px 0 7px' }}>Ações automáticas</div>
            <div className="col" style={{ gap: 6 }}>
              {l.acoes.map(a => <div key={a} className="row" style={{ gap: 7 }}><Icon name="arrow" size={12} style={{ color: `var(--${l.color})` }} /><span style={{ fontSize: 12.5 }}>{a}</span></div>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ============ Telas de conexão (resumidas) ============ */
const intCards = [
  { n:'TikTok Content API', d:'Publicação automática', st:'aguardando', icon:'video', co:'pink', tag:'Requer aprovação' },
  { n:'TikTok Shop', d:'Catálogo + checkout', st:'novo', icon:'bag', co:'pink' },
  { n:'Shopee Afiliados', d:'Links e comissões', st:'aprovado', icon:'tag', co:'amber' },
  { n:'Mercado Livre', d:'Afiliados', st:'aprovado', icon:'tag', co:'gold' },
  { n:'Amazon Associados', d:'Afiliados', st:'aprovado', icon:'tag', co:'blue' },
  { n:'Renner Afiliados', d:'Se disponível', st:'novo', icon:'tag', co:'violet' },
];
const Integracoes = () => (
  <div className="content-inner fade-in">
    <div><h2 style={{ fontSize: 18 }}>Integrações</h2><p className="muted" style={{ fontSize: 13 }}>Conexões de publicação e plataformas de afiliados</p></div>
    <div className="grid g3">
      {intCards.map(c => (
        <div key={c.n} className="card">
          <div className="row spread">
            <div className="ico" style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', background: `var(--${c.co}-soft)`, color: `var(--${c.co})` }}><Icon name={c.icon} size={20} /></div>
            <Badge status={c.st} />
          </div>
          <div style={{ fontWeight: 600, fontSize: 15, marginTop: 12 }}>{c.n}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>{c.d}</div>
          {c.tag && <div className="row" style={{ gap: 6, marginTop: 8 }}><Icon name="bell" size={12} style={{ color: 'var(--amber)' }} /><span style={{ fontSize: 11.5, color: 'var(--amber)' }}>{c.tag}</span></div>}
          <button className={`btn ${c.st === 'aprovado' ? 'btn-ghost' : 'btn-primary'} btn-sm`} style={{ width: '100%', marginTop: 14 }}>{c.st === 'aprovado' ? 'Conectado' : 'Conectar'}</button>
        </div>
      ))}
    </div>
  </div>
);

const Simple = ({ icon, color, title, desc, children }) => (
  <div className="content-inner fade-in">
    <div className="card" style={{ background: `radial-gradient(600px 200px at 0% 0%, var(--${color}-soft), transparent 60%), var(--surface)` }}>
      <div className="row" style={{ gap: 12 }}>
        <div className="ico" style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: `var(--${color}-soft)`, color: `var(--${color})` }}><Icon name={icon} size={22} /></div>
        <div><h2 style={{ fontSize: 18 }}>{title}</h2><p className="muted" style={{ fontSize: 13 }}>{desc}</p></div>
      </div>
    </div>
    {children}
  </div>
);

const Monetizacao = () => (
  <Simple icon="dollar" color="green" title="Monetização" desc="Receita por plataforma, produto e série">
    <div className="grid g4">
      <StatCard icon="dollar" color="green" value="R$ 2.840" label="Receita do mês" trend="+31%" trendDir="up" />
      <StatCard icon="bag" color="gold" value="112" label="Vendas" trend="+18%" trendDir="up" />
      <StatCard icon="link" color="blue" value="2,9%" label="Conversão clique→venda" trend="+0,4pp" trendDir="up" />
      <StatCard icon="star" color="violet" value="R$ 25,40" label="Ticket médio" />
    </div>
    <div className="card flush">
      <table className="tbl">
        <thead><tr><th>Plataforma</th><th className="right">Cliques</th><th className="right">Vendas</th><th className="right">Comissão média</th><th className="right">Receita</th></tr></thead>
        <tbody>
          {[['Shopee',1820,58,'18%','R$ 1.240','amber'],['Mercado Livre',940,31,'12%','R$ 820','gold'],['Amazon',620,15,'9%','R$ 410','blue'],['TikTok Shop',440,8,'15%','R$ 370','pink']].map((r,i) => (
            <tr key={i}><td><span className={`badge ${r[5]}`} style={{ padding: '2px 8px' }}>{r[0]}</span></td><td className="right mono">{r[1]}</td><td className="right mono">{r[2]}</td><td className="right mono">{r[3]}</td><td className="right mono" style={{ color: 'var(--green)' }}>{r[4]}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  </Simple>
);

const WhatsApp = () => (
  <Simple icon="message" color="green" title="WhatsApp em Massa" desc="Disparo de achadinhos para listas e grupos">
    <div className="grid g2" style={{ gridTemplateColumns: '1fr 320px', alignItems: 'start' }}>
      <div className="card">
        <label className="label">Mensagem</label>
        <div className="textarea" style={{ minHeight: 120, lineHeight: 1.6 }}>🔥 Achadinho do dia: Organizador de Talheres Expansível por R$ 29,90!{'\n\n'}Cabe em qualquer gaveta e acaba com a bagunça 😍{'\n\n'}👉 Link: patrono.link/talheres</div>
        <div className="row" style={{ gap: 10, marginTop: 14 }}>
          <button className="btn btn-ghost btn-sm"><Icon name="sparkles" size={14} />Gerar com IA</button>
          <button className="btn btn-ghost btn-sm"><Icon name="image" size={14} />Anexar mídia</button>
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}><Icon name="message" size={14} />Disparar para 3 listas</button>
        </div>
      </div>
      <div className="card">
        <div className="card-title" style={{ fontSize: 14, marginBottom: 12 }}>Listas</div>
        {[['Clientes VIP',342,'green'],['Grupo Organiza Casa',198,'gold'],['Leads novos',1240,'violet']].map((l,i) => (
          <div key={i} className="row spread" style={{ padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--border-soft)' : 'none' }}>
            <div className="row" style={{ gap: 9 }}><span className="dot badge" style={{ width: 8, height: 8, padding: 0, background: `var(--${l[2]})` }} /><span style={{ fontSize: 13, fontWeight: 500 }}>{l[0]}</span></div>
            <span className="dim mono" style={{ fontSize: 12 }}>{l[1]}</span>
          </div>
        ))}
      </div>
    </div>
  </Simple>
);

Object.assign(window, { Relatorios, Decisao, Integracoes, Monetizacao, WhatsApp });
