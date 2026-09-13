/* ============ Painel da Dona — Módulos & Receita (SaaS admin) ============ */
const AdminSaas = () => {
  const S = DATA.saas;
  const A = S.adminMetrics;
  const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR');
  const maxRec = Math.max(...A.porModulo.map(m => m.receita));

  return (
    <div className="content-inner fade-in">
      <div className="card" style={{ background: 'radial-gradient(600px 200px at 0% 0%, var(--green-soft), transparent 60%), var(--surface)' }}>
        <div className="row spread wrap" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 12 }}>
            <div className="ico" style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--green-soft)', color: 'var(--green)' }}><Icon name="dollar" size={22} /></div>
            <div><h2 style={{ fontSize: 18 }}>Módulos e Receita</h2><p className="muted" style={{ fontSize: 13 }}>Painel da dona da plataforma · venda modular e acompanhe o desempenho</p></div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-ghost btn-sm"><Icon name="tag" size={14} />Criar cupom</button>
            <button className="btn btn-primary btn-sm"><Icon name="plus" size={14} />Novo módulo</button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid g4">
        <StatCard icon="dollar" color="green" value={fmt(A.receitaTotal)} label="MRR (receita recorrente)" trend="+12% mês" trendDir="up" />
        <StatCard icon="users" color="violet" value={A.assinantes} label="Assinantes ativos" trend="+18 este mês" trendDir="up" />
        <StatCard icon="flask" color="amber" value={A.trial} label="Em trial agora" />
        <StatCard icon="arrow" color="red" value={A.churn + '%'} label="Churn mensal" trend="-0,6pp" trendDir="up" />
      </div>

      {/* Receita por módulo */}
      <div className="card flush">
        <div className="row spread" style={{ padding: '16px 20px' }}>
          <div className="card-title">Desempenho por módulo</div>
          <button className="btn btn-ghost btn-sm"><Icon name="download" size={14} />Exportar</button>
        </div>
        <table className="tbl">
          <thead><tr><th>Módulo</th><th className="right">Assinantes</th><th className="right">Receita/mês</th><th className="right">Churn</th><th className="right">Uso médio</th><th>Receita</th></tr></thead>
          <tbody>
            {[...A.porModulo].sort((a,b)=>b.receita-a.receita).map((m, i) => (
              <tr key={m.nome}>
                <td><div className="row" style={{ gap: 8 }}>{i === 0 && <Icon name="star" size={13} style={{ color: 'var(--gold)' }} />}<span style={{ fontWeight: 600 }}>{m.nome}</span></div></td>
                <td className="right mono">{m.assinantes}</td>
                <td className="right mono" style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(m.receita)}</td>
                <td className="right mono" style={{ color: m.churn > 5 ? 'var(--red)' : 'var(--text-muted)' }}>{m.churn}%</td>
                <td className="right mono">{m.uso}%</td>
                <td style={{ minWidth: 110 }}><div className="bar green" style={{ height: 7 }}><i style={{ width: (m.receita/maxRec*100) + '%' }} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Gestão de módulos */}
      <div className="card flush">
        <div className="row spread" style={{ padding: '16px 20px' }}>
          <div className="card-title">Catálogo de módulos</div>
          <span className="dim" style={{ fontSize: 12 }}>ative, desative e ajuste preços</span>
        </div>
        <table className="tbl">
          <thead><tr><th>Módulo</th><th className="right">Preço/mês</th><th>Selo</th><th className="right">Status</th><th className="right">Ação</th></tr></thead>
          <tbody>
            {S.modulos.map(m => (
              <tr key={m.id}>
                <td><div className="row" style={{ gap: 9 }}><div className="ico" style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', background: `var(--${m.cor}-soft)`, color: `var(--${m.cor})` }}><Icon name={m.icon} size={14} /></div><span style={{ fontWeight: 500, fontSize: 13 }}>{m.nome}</span></div></td>
                <td className="right mono">{m.precoLabel || ('R$ ' + m.mensal)}</td>
                <td>{m.selo ? <span className={`badge ${window.seloMap[m.selo]}`} style={{ padding: '1px 7px' }}>{m.selo}</span> : <span className="dim">—</span>}</td>
                <td className="right"><span className="badge green" style={{ padding: '1px 8px' }}><span className="dot" />Ativo</span></td>
                <td className="right"><div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}><button className="btn btn-ghost btn-sm" style={{ padding: '5px 8px' }}><Icon name="pencil" size={13} /></button><button className="btn btn-ghost btn-sm" style={{ padding: '5px 8px' }}><Icon name="pause" size={13} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Combos */}
      <div className="card">
        <div className="card-head"><Icon name="layers" size={16} style={{ color: 'var(--gold)' }} /><div className="card-title" style={{ fontSize: 14 }}>Combos publicados</div><button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}><Icon name="plus" size={13} />Novo combo</button></div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {S.combos.map(c => (
            <div key={c.id} className="col" style={{ gap: 4, padding: '12px 14px', borderRadius: 11, background: 'oklch(0 0 0 / 0.2)', border: '1px solid var(--border-soft)' }}>
              <div className="row spread"><span style={{ fontSize: 13, fontWeight: 600 }}>{c.nome}</span>{c.selo && <span className={`badge ${window.seloMap[c.selo]}`} style={{ padding: '0 6px', fontSize: 9.5 }}>{c.selo}</span>}</div>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>R$ {c.preco}<span className="dim" style={{ fontSize: 11, fontWeight: 500 }}>/mês</span></span>
              <span className="dim" style={{ fontSize: 11 }}>{c.mods.length} {c.mods.length === 1 ? 'item' : 'itens'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

window.AdminSaas = AdminSaas;
