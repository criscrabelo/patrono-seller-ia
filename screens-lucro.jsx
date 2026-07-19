/* ============ Painel de Lucro e Escala — tela ============ */
const PERIODOS = ['Hoje','7 dias','15 dias','30 dias','Mês atual','Mês anterior','Personalizado'];

const Lucro = () => {
  const L = DATA.lucro;
  const R = L.resumo;
  const [periodo, setPeriodo] = useState('Mês atual');
  const [sel, setSel] = useState(null);
  const maxLucro = Math.max(...L.plataformas.map(p => p.lucro));

  const big = (label, val, sub, color, icon) => (
    <div className="stat-card">
      <div className="row spread">
        <div className="ico" style={{ background: `var(--${color}-soft)`, color: `var(--${color})`, marginBottom: 0 }}><Icon name={icon} /></div>
      </div>
      <div className="stat-value" style={{ marginTop: 14, color: color === 'green' ? 'var(--green)' : undefined }}>{val}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="dim" style={{ fontSize: 11.5, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <div className="content-inner fade-in">
      {sel && <ProdutoDetalhe p={sel} onClose={() => setSel(null)} />}

      {/* Filtro de período */}
      <div className="row spread wrap" style={{ gap: 12 }}>
        <div className="chips">{PERIODOS.map(p => <div key={p} className={`chip ${periodo === p ? 'active' : ''}`} onClick={() => setPeriodo(p)}>{p}</div>)}</div>
        <button className="btn btn-ghost btn-sm"><Icon name="download" size={14} />Exportar CSV</button>
      </div>

      {/* Respostas rápidas — 4 cards de impacto */}
      <div className="grid g4">
        <div className="goal-card" style={{ padding: 20, borderRadius: 16 }}>
          <div className="row" style={{ gap: 7 }}><Icon name="dollar" size={15} style={{ color: 'var(--gold)' }} /><span className="dim" style={{ fontSize: 11.5, letterSpacing: '0.04em' }}>LUCRO LÍQUIDO · {periodo.toUpperCase()}</span></div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, letterSpacing: '-0.02em', marginTop: 10, color: 'var(--green)' }}>{brl(R.lucroLiquido)}</div>
          <div className="row" style={{ gap: 8, marginTop: 8 }}><span className="badge green" style={{ padding: '2px 8px' }}><Icon name="trend" size={11} />margem {R.margem}%</span><span className="dim" style={{ fontSize: 11.5 }}>de {brl(R.comissao)} em comissão</span></div>
        </div>
        {big('Plataforma mais lucrativa', 'Shopee', brl(820) + ' de lucro', 'amber', 'star')}
        {big('Produto mais escalável', 'Cabide Mágico', 'score 92 · campeão', 'violet', 'rocket')}
        {big('Previsão próx. 30 dias', brl(R.previsao30d), 'no ritmo atual', 'blue', 'chart')}
      </div>

      {/* Resumo financeiro completo */}
      <div className="card">
        <div className="card-head"><Icon name="dollar" size={16} style={{ color: 'var(--gold)' }} /><div className="card-title">Resumo financeiro · {periodo}</div></div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: 'var(--border-soft)', borderRadius: 12, overflow: 'hidden' }}>
          {[
            ['Receita bruta', brl(R.receitaBruta), 'text'],
            ['Comissão', brl(R.comissao), 'blue'],
            ['Custos', brl(R.custos), 'amber'],
            ['Lucro líquido', brl(R.lucroLiquido), 'green'],
            ['Margem', R.margem + '%', 'green'],
            ['Ticket médio', brl(R.ticketMedio), 'text'],
            ['Vendas', R.vendas, 'text'],
            ['Cliques', R.cliques.toLocaleString('pt-BR'), 'text'],
            ['Conversão', R.conversao + '%', 'text'],
            ['Receita / vídeo', brl(R.receitaPorVideo), 'text'],
            ['Lucro / vídeo', brl(R.lucroPorVideo), 'green'],
            ['Prev. 30 dias', brl(R.previsao30d), 'blue'],
          ].map(([l, v, c]) => (
            <div key={l} style={{ background: 'var(--surface)', padding: '14px 13px' }}>
              <div className="dim" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{l}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, marginTop: 5, color: c === 'text' ? 'var(--text)' : `var(--${c})` }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Lucro por plataforma */}
      <div className="card flush">
        <div className="row spread" style={{ padding: '16px 20px' }}>
          <div className="card-title">Lucro por plataforma</div>
          <span className="dim" style={{ fontSize: 12 }}>clique para ver detalhe</span>
        </div>
        <table className="tbl">
          <thead><tr><th>Plataforma</th><th className="right">Prod.</th><th className="right">Vídeos</th><th className="right">Cliques</th><th className="right">Vendas</th><th className="right">Comissão</th><th className="right">Custos</th><th className="right">Lucro</th><th className="right">Conv.</th><th>Lucro</th></tr></thead>
          <tbody>
            {L.plataformas.map(p => (
              <tr key={p.nome} style={{ cursor: 'pointer' }}>
                <td><span className={`badge ${p.cor}`} style={{ padding: '2px 9px' }}>{p.nome}</span></td>
                <td className="right mono">{p.produtos}</td>
                <td className="right mono">{p.videos}</td>
                <td className="right mono">{p.cliques.toLocaleString('pt-BR')}</td>
                <td className="right mono">{p.vendas}</td>
                <td className="right mono" style={{ color: 'var(--blue)' }}>{brl(p.comissao)}</td>
                <td className="right mono" style={{ color: 'var(--amber)' }}>{brl(p.custos)}</td>
                <td className="right mono" style={{ color: 'var(--green)', fontWeight: 600 }}>{brl(p.lucro)}</td>
                <td className="right mono">{p.conversao}%</td>
                <td style={{ minWidth: 90 }}><div className="bar green" style={{ height: 7 }}><i style={{ width: (p.lucro/maxLucro*100) + '%' }} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ranking + Score de escala */}
      <div className="grid g2" style={{ gridTemplateColumns: '1.4fr 1fr', alignItems: 'start' }}>
        <div className="card flush">
          <div className="row spread" style={{ padding: '16px 20px' }}>
            <div className="card-title">Ranking por Score de Escala</div>
            <span className="badge gray"><Icon name="brain" size={11} />0–100</span>
          </div>
          <div className="col" style={{ padding: '0 20px 16px', gap: 10 }}>
            {[...L.produtos].sort((a,b) => b.score - a.score).map((p, i) => {
              const f = window.scoreFaixa(p.score);
              return (
                <div key={p.nome} className="row" style={{ gap: 13, padding: '11px 13px', borderRadius: 12, background: 'oklch(0 0 0 / 0.18)', border: '1px solid var(--border-soft)', cursor: 'pointer' }} onClick={() => setSel(p)}>
                  <span className="dim mono" style={{ fontSize: 13, width: 14 }}>{i+1}</span>
                  <ScoreRing score={p.score} size={46} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</div>
                    <div className="row" style={{ gap: 6, marginTop: 4 }}>
                      <span className={`badge ${f.cls}`} style={{ padding: '1px 7px', fontSize: 10.5 }}>{f.label}</span>
                      <span className="dim" style={{ fontSize: 11.5 }}>{brl(p.lucro)} lucro · {p.conversao}%</span>
                    </div>
                  </div>
                  <Icon name="chevR" size={15} style={{ color: 'var(--text-dim)' }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Faixas do score + custos */}
        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-title" style={{ fontSize: 14, marginBottom: 12 }}>Faixas do Score de Escala</div>
            <div className="col" style={{ gap: 9 }}>
              {[['81–100','Campeão · escalar já','gold'],['61–80','Promissor','blue'],['31–60','Testar mais','amber'],['0–30','Não escalar','red']].map(([r,l,c]) => (
                <div key={r} className="row spread" style={{ padding: '8px 11px', borderRadius: 10, background: `var(--${c}-soft)`, border: `1px solid oklch(0.7 0.12 285 / 0.15)` }}>
                  <div className="row" style={{ gap: 8 }}><span className="dot badge" style={{ width: 8, height: 8, padding: 0, background: `var(--${c})` }} /><span style={{ fontSize: 12.5, fontWeight: 600 }}>{l}</span></div>
                  <span className="mono dim" style={{ fontSize: 11.5 }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card flush">
            <div className="row spread" style={{ padding: '14px 18px' }}><div className="card-title" style={{ fontSize: 14 }}>Custos do período</div><button className="btn btn-ghost btn-sm" style={{ padding: '4px 9px' }}><Icon name="plus" size={13} /></button></div>
            <table className="tbl"><tbody>
              {L.custos.map((c, i) => (
                <tr key={i}><td style={{ fontSize: 12.5, fontWeight: 500 }}>{c.tipo}<div className="dim" style={{ fontSize: 11 }}>{c.vinculo}</div></td><td className="right mono" style={{ color: 'var(--amber)' }}>{brl(c.valor)}</td></tr>
              ))}
              <tr><td style={{ fontWeight: 700 }}>Total</td><td className="right mono" style={{ fontWeight: 700, color: 'var(--amber)' }}>{brl(L.custos.reduce((s,c)=>s+c.valor,0))}</td></tr>
            </tbody></table>
          </div>
        </div>
      </div>

      {/* Recomendações da IA */}
      <div className="card" style={{ background: 'radial-gradient(600px 200px at 100% 0%, var(--violet-soft), transparent 60%), var(--surface)' }}>
        <div className="card-head"><Icon name="brain" size={16} style={{ color: 'var(--violet)' }} /><div className="card-title">Recomendações da IA</div><span className="badge violet" style={{ marginLeft: 'auto' }}>{L.recomendacoes.length} · pedem sua aprovação</span></div>
        <div className="col" style={{ gap: 10 }}>
          {L.recomendacoes.map((r, i) => {
            const m = window.recTipoMap[r.tipo]; const rk = window.riscoMap[r.risco];
            return (
              <div key={i} className="row spread wrap" style={{ gap: 12, padding: '12px 14px', borderRadius: 12, background: 'oklch(0 0 0 / 0.2)', border: `1px solid ${r.risco==='vermelho'?'oklch(0.70 0.19 22 / 0.3)':'var(--border-soft)'}` }}>
                <div className="row" style={{ gap: 11, minWidth: 0, flex: 1 }}>
                  <div className="ico" style={{ width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', flexShrink: 0, background: `var(--${m.cls}-soft)`, color: `var(--${m.cls})` }}><Icon name={m.icon} size={15} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 6, marginBottom: 3 }}><span className={`badge ${m.cls}`} style={{ padding: '1px 7px', fontSize: 10 }}>{m.label}</span><span className="dim" style={{ fontSize: 11 }}>{r.alvo}</span></div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{r.txt}</div>
                  </div>
                </div>
                <div className="row" style={{ gap: 7, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" style={{ padding: '5px 9px' }}><Icon name="x" size={13} /></button>
                  <button className="btn btn-primary btn-sm"><Icon name="check" size={13} />Aprovar</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Alertas + Banco de vendas */}
      <div className="grid g2" style={{ gridTemplateColumns: '0.85fr 1.15fr', alignItems: 'start' }}>
        <div className="card">
          <div className="card-head"><Icon name="bell" size={16} style={{ color: 'var(--amber)' }} /><div className="card-title" style={{ fontSize: 14 }}>Alertas automáticos</div></div>
          <div className="col" style={{ gap: 8 }}>
            {L.alertas.map((a, i) => (
              <div key={i} className="row" style={{ gap: 10, padding: '9px 11px', borderRadius: 10, background: `var(--${a.cls}-soft)` }}>
                <Icon name={a.icon} size={15} style={{ color: `var(--${a.cls})`, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>{a.txt}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card flush">
          <div className="row spread" style={{ padding: '14px 18px' }}><div className="card-title" style={{ fontSize: 14 }}>Banco de vendas</div><button className="btn btn-ghost btn-sm"><Icon name="plus" size={13} />Registrar venda</button></div>
          <table className="tbl">
            <thead><tr><th>Data</th><th>Produto</th><th>Plat.</th><th className="right">Comissão</th><th className="right">Status</th></tr></thead>
            <tbody>
              {L.vendas.map((v, i) => {
                const st = window.vendaStatusMap[v.status];
                return (
                  <tr key={i}>
                    <td className="mono" style={{ fontSize: 12 }}>{v.data}</td>
                    <td style={{ fontSize: 12.5, fontWeight: 500, maxWidth: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.produto}</td>
                    <td><span className={`badge ${platColor[v.plat]||'gray'}`} style={{ padding: '1px 7px', fontSize: 10.5 }}>{v.plat}</span></td>
                    <td className="right mono" style={{ color: 'var(--blue)' }}>{brl(v.comissao)}</td>
                    <td className="right"><span className={`badge ${st.cls}`} style={{ padding: '1px 8px' }}>{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

window.Lucro = Lucro;
