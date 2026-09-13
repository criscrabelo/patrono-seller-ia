/* ============ Dashboard de Metas ============ */
const Sparkline = ({ data, w = 220, h = 48, color = 'var(--gold)' }) => {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / (max - min || 1)) * (h - 6) - 3]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${d} L${w} ${h} L0 ${h} Z`;
  return (
    <svg width={w} height={h} style={{ display: 'block', width: '100%' }} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs><linearGradient id="spk" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={color} stopOpacity="0.28" /><stop offset="1" stopColor={color} stopOpacity="0" />
      </linearGradient></defs>
      <path d={area} fill="url(#spk)" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.slice(-1).map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill={color} />)}
    </svg>
  );
};

const Dashboard = ({ go }) => {
  const m = DATA.metas;
  const pct1 = Math.min(100, (m.seguidores / m.meta1) * 100);
  const pct2 = Math.min(100, (m.seguidores / m.meta2) * 100);
  return (
    <div className="content-inner fade-in">
      {/* Goal hero */}
      <div className="grid g2" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
        <div className="goal-card">
          <div className="row spread" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="row" style={{ gap: 8 }}>
                <Icon name="target" size={16} style={{ color: 'var(--gold)' }} />
                <span className="dim mono" style={{ fontSize: 12, letterSpacing: '0.05em' }}>META PRINCIPAL · {m.meta1Data}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 10, lineHeight: 1 }}>
                {m.seguidores.toLocaleString('pt-BR')} <span className="dim" style={{ fontSize: 22, fontWeight: 500 }}>/ {m.meta1.toLocaleString('pt-BR')}</span>
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>seguidores · faltam {(m.meta1 - m.seguidores).toLocaleString('pt-BR')}</div>
            </div>
            <span className="badge gold"><Icon name="fire" size={12} />{pct1.toFixed(0)}%</span>
          </div>
          <div className="bar" style={{ marginTop: 18 }}><i style={{ width: pct1 + '%' }} /></div>
          <div className="row spread" style={{ marginTop: 14 }}>
            <div className="col">
              <span className="dim" style={{ fontSize: 11 }}>Meta 2 · 100k até {m.meta2Data}</span>
              <div className="bar violet" style={{ marginTop: 6, width: 200 }}><i style={{ width: pct2 + '%' }} /></div>
            </div>
            <button className="btn btn-violet btn-sm" onClick={() => go('radar')}><Icon name="rocket" size={14} />Acelerar</button>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-head" style={{ marginBottom: 8 }}>
            <Icon name="trend" size={16} style={{ color: 'var(--green)' }} />
            <div className="card-title" style={{ fontSize: 14 }}>Crescimento · 7 dias</div>
          </div>
          <Sparkline data={DATA.serie7d} color="var(--gold)" />
          <div className="row spread" style={{ marginTop: 'auto', paddingTop: 12 }}>
            <div className="col"><span className="stat-value" style={{ fontSize: 22 }}>+{m.crescimentoDiario}</span><span className="dim" style={{ fontSize: 11 }}>seguidores/dia</span></div>
            <div className="col" style={{ alignItems: 'flex-end' }}><span style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--amber)' }}>{m.crescimentoNecessario}</span><span className="dim" style={{ fontSize: 11 }}>meta/dia p/ 100k</span></div>
          </div>
        </div>
      </div>

      {/* Sua contribuição para a meta */}
      {(() => {
        const total = DATA.contribuintes.reduce((s, c) => s + c.seguidores, 0);
        const eu = DATA.contribuintes.find(c => c.voce) || DATA.contribuintes[0];
        const meuPct = Math.round((eu.seguidores / total) * 100);
        const ranked = [...DATA.contribuintes].sort((a, b) => b.seguidores - a.seguidores);
        const maxc = ranked[0].seguidores;
        return (
          <div className="grid g2" style={{ gridTemplateColumns: '1fr 1.25fr', alignItems: 'stretch' }}>
            <div className="card" style={{ background: 'radial-gradient(420px 240px at 0% 0%, var(--violet-soft), transparent 60%), var(--surface)' }}>
              <div className="row" style={{ gap: 10, marginBottom: 6 }}>
                <div className="avatar" style={{ width: 30, height: 30, fontSize: 12, background: 'linear-gradient(140deg, var(--gold), var(--gold-2))', color: 'oklch(0.2 0.02 70)' }}>{eu.nome[0]}</div>
                <div><div style={{ fontSize: 13.5, fontWeight: 600 }}>Olá, {eu.nome.split(' ')[0]} 👋</div><div className="dim" style={{ fontSize: 11.5 }}>Sua contribuição para a meta</div></div>
              </div>
              <div className="row" style={{ alignItems: 'flex-end', gap: 8, marginTop: 12 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 38, lineHeight: 1, color: 'var(--gold)' }}>{eu.seguidores}</span>
                <span className="muted" style={{ fontSize: 13, marginBottom: 4 }}>seguidores trazidos</span>
              </div>
              <div className="bar" style={{ marginTop: 12 }}><i style={{ width: meuPct + '%' }} /></div>
              <div className="dim" style={{ fontSize: 12, marginTop: 7 }}>{meuPct}% de todo o crescimento da meta veio de você</div>
              <div className="row" style={{ gap: 18, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>
                <div className="col"><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>{eu.videos}</span><span className="dim" style={{ fontSize: 11 }}>vídeos seus</span></div>
                <div className="col"><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--green)' }}>{eu.vendas}</span><span className="dim" style={{ fontSize: 11 }}>vendas suas</span></div>
                <div className="col"><span className="badge gold" style={{ marginBottom: 2 }}><Icon name="star" size={11} />2º lugar</span><span className="dim" style={{ fontSize: 11 }}>no ranking</span></div>
              </div>
            </div>

            <div className="card">
              <div className="row spread" style={{ marginBottom: 4 }}>
                <div className="card-title" style={{ fontSize: 14 }}>Ranking de contribuição</div>
                <span className="dim" style={{ fontSize: 11.5 }}>seguidores · {total.toLocaleString('pt-BR')} no total</span>
              </div>
              <div className="col" style={{ gap: 11, marginTop: 12 }}>
                {ranked.map((c, i) => {
                  const pm = window.papelMap[c.papel];
                  return (
                    <div key={c.nome} className="row" style={{ gap: 11 }}>
                      <span className="dim mono" style={{ fontSize: 12, width: 16 }}>{i + 1}</span>
                      <div className="avatar" style={{ width: 26, height: 26, fontSize: 11, background: c.papel === 'admin' ? 'linear-gradient(140deg, var(--gold), var(--gold-2))' : 'linear-gradient(140deg, var(--violet), var(--violet-2))', color: c.papel === 'admin' ? 'oklch(0.2 0.02 70)' : 'white' }}>{c.nome[0]}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="row spread" style={{ marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: c.voce ? 700 : 500 }}>{c.nome.split(' ')[0]} {c.voce && <span className="badge gray" style={{ padding: '0 6px', fontSize: 9.5 }}>você</span>}</span>
                          <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.seguidores}</span>
                        </div>
                        <div className="bar" style={{ height: 6 }}><i style={{ width: (c.seguidores / maxc * 100) + '%', background: c.papel === 'admin' ? 'linear-gradient(90deg, var(--gold-2), var(--gold))' : 'linear-gradient(90deg, var(--violet-2), var(--violet))' }} /></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Stats */}
      <div className="grid g4">
        <StatCard icon="video" color="violet" value={`${m.videosPostados}/${m.videosPlanejados}`} label="Vídeos postados hoje" trend="6–10 por dia" trendDir="up" />
        <StatCard icon="bag" color="gold" value={m.produtos} label="Produtos cadastrados" trend={`${m.produtosCampeoes} campeões`} trendDir="up" />
        <StatCard icon="link" color="blue" value={m.cliques.toLocaleString('pt-BR')} label="Cliques no link" trend="+12% sem." trendDir="up" />
        <StatCard icon="dollar" color="green" value={`R$ ${m.receita.toLocaleString('pt-BR')}`} label="Receita estimada" trend={`${m.vendas} vendas`} trendDir="up" />
      </div>

      {/* Aprovar agora + fluxo diário */}
      <div className="grid g2" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card" style={{ border: '1px solid oklch(0.80 0.15 70 / 0.3)', background: 'linear-gradient(180deg, oklch(0.22 0.04 70 / 0.4), var(--surface))' }}>
          <div className="row spread">
            <div className="row" style={{ gap: 10 }}>
              <div className="ico" style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--amber-soft)', color: 'var(--amber)' }}><Icon name="bell" size={18} /></div>
              <div>
                <div className="card-title" style={{ fontSize: 15 }}>Aprovar agora</div>
                <div className="dim" style={{ fontSize: 12.5 }}>{m.aguardando} itens precisam de você</div>
              </div>
            </div>
            <span className="nav-badge" style={{ position: 'static', background: 'var(--amber)', color: 'var(--bg)' }}>{m.aguardando}</span>
          </div>
          <div className="col" style={{ gap: 8, marginTop: 14 }}>
            {DATA.aprovacoes.slice(0, 3).map((a) => (
              <div key={a.id} className="row spread" style={{ padding: '9px 11px', borderRadius: 10, background: 'oklch(0 0 0 / 0.2)', border: '1px solid var(--border-soft)' }}>
                <div className="row" style={{ gap: 9, minWidth: 0 }}>
                  <span className={`badge ${window.riscoMap[a.risco].cls}`} style={{ padding: '2px 6px' }}><span className="dot" /></span>
                  <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.produto}</span>
                </div>
                <span className="dim" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{a.motivo}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 12 }} onClick={() => go('aprovacao')}>Revisar fila de aprovação<Icon name="arrow" size={14} /></button>
        </div>

        <div className="card">
          <div className="card-head"><Icon name="clock" size={16} style={{ color: 'var(--violet)' }} /><div className="card-title" style={{ fontSize: 15 }}>Fluxo automático do dia</div></div>
          <div className="col" style={{ gap: 2 }}>
            {[
              { t: 'Manhã', d: 'IA busca tendências e gera ideias', icon: 'radar', done: true },
              { t: 'Meio-dia', d: 'Transforma tendências em roteiros próprios', icon: 'sparkles', done: true },
              { t: 'Tarde', d: 'Combina vídeo autorizado + produto + legenda', icon: 'layers', done: false },
              { t: 'Noite', d: 'Monta a fila do dia seguinte', icon: 'calendar', done: false },
            ].map((s, i) => (
              <div key={i} className="row" style={{ gap: 12, padding: '10px 0', borderBottom: i < 3 ? '1px solid var(--border-soft)' : 'none' }}>
                <div className="ico" style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0, background: s.done ? 'var(--green-soft)' : 'oklch(1 0 0 / 0.04)', color: s.done ? 'var(--green)' : 'var(--text-dim)' }}>
                  <Icon name={s.done ? 'check' : s.icon} size={15} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.t}</div>
                  <div className="dim" style={{ fontSize: 12 }}>{s.d}</div>
                </div>
                {s.done && <span className="badge green" style={{ padding: '2px 8px' }}>ok</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top conteúdos */}
      <div className="card flush">
        <div className="row spread" style={{ padding: '16px 20px' }}>
          <div className="card-title">Conteúdos campeões da semana</div>
          <button className="btn btn-ghost btn-sm" onClick={() => go('relatorios')}>Ver relatórios<Icon name="arrow" size={14} /></button>
        </div>
        <table className="tbl">
          <thead><tr><th>Produto</th><th>Série</th><th>Rede</th><th className="right">Views</th><th className="right">Vendas</th><th className="right">Status</th></tr></thead>
          <tbody>
            {DATA.relatorios.slice(0, 4).map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{r.produto}</td>
                <td className="muted">{r.serie}</td>
                <td className="muted">{r.rede}</td>
                <td className="right mono">{r.views}</td>
                <td className="right mono">{r.vendas}</td>
                <td className="right"><Badge status={r.veredito} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

window.Dashboard = Dashboard;
