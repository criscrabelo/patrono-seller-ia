/* ============ Patrono Video Seller (geração de vídeo por IA) ============ */
const VideoSeller = () => {
  const fila = [
    { nome:'talheres_pov_v1.mp4', prod:'Talheres Expansível', st:'pronto', prog:100, dur:'18s' },
    { nome:'geladeira_transform.mp4', prod:'Potes Geladeira', st:'renderizando', prog:64, dur:'25s' },
    { nome:'cabide_demo.mp4', prod:'Cabide Mágico', st:'fila', prog:0, dur:'15s' },
  ];
  return (
    <div className="content-inner fade-in">
      <div className="card" style={{ background: 'radial-gradient(600px 220px at 80% 0%, var(--violet-soft), transparent 60%), var(--surface)' }}>
        <div className="row spread wrap" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 12 }}>
            <div className="ico" style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--violet-soft)', color: 'var(--violet)' }}><Icon name="video" size={22} /></div>
            <div><h2 style={{ fontSize: 18 }}>Patrono Video Seller</h2><p className="muted" style={{ fontSize: 13 }}>A IA monta o vídeo a partir do roteiro + criativo autorizado</p></div>
          </div>
          <span className="badge violet"><Icon name="sparkles" size={12} />Geração por IA</span>
        </div>
      </div>

      <div className="grid g2" style={{ gridTemplateColumns: '1fr 280px', alignItems: 'start' }}>
        <div className="card">
          <div className="card-title" style={{ fontSize: 14, marginBottom: 16 }}>Briefing do vídeo</div>
          <div className="grid g2" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><label className="label">Produto</label><div className="select row spread">Talheres Expansível <Icon name="chevD" size={15} /></div></div>
            <div><label className="label">Criativo base (autorizado)</label><div className="select row spread">ugc_talheres_v3.mp4 <Icon name="chevD" size={15} /></div></div>
          </div>
          <label className="label" style={{ marginTop: 14 }}>Roteiro</label>
          <div className="textarea" style={{ minHeight: 84, lineHeight: 1.6, fontSize: 13.5 }}>Gancho: "Você ainda guarda talher amontoado?"{'\n'}Solução: organizador expansível · Texto na tela: CABE EM QUALQUER GAVETA ✨ · CTA: link na bio</div>
          <div className="grid g3" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 14 }}>
            <div><label className="label">Voz (narração)</label><div className="select row spread" style={{ fontSize: 13 }}>Feminina BR <Icon name="chevD" size={14} /></div></div>
            <div><label className="label">Trilha</label><div className="select row spread" style={{ fontSize: 13 }}>Trend leve <Icon name="chevD" size={14} /></div></div>
            <div><label className="label">Formato</label><div className="select row spread" style={{ fontSize: 13 }}>9:16 · 18s <Icon name="chevD" size={14} /></div></div>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 18 }}>
            <button className="btn btn-violet"><Icon name="bolt" size={15} />Renderizar vídeo</button>
            <button className="btn btn-ghost"><Icon name="eye" size={15} />Pré-visualizar</button>
            <span className="badge gray" style={{ marginLeft: 'auto' }}><Icon name="clock" size={11} />~2 min</span>
          </div>
        </div>

        <PhonePreview w="100%" label={`prévia do vídeo\ngerado por IA`} badge={<span className="badge violet" style={{ padding: '2px 7px', background: 'rgba(0,0,0,.5)' }}><Icon name="play" size={10} />18s</span>}>
          <div style={{ position: 'absolute', left: 10, bottom: 12, right: 44 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'white', textShadow: '0 1px 4px black' }}>CABE EM QUALQUER GAVETA ✨</div>
          </div>
        </PhonePreview>
      </div>

      <div className="card flush">
        <div className="row spread" style={{ padding: '14px 20px' }}><div className="card-title">Fila de renderização</div><span className="badge violet">{fila.length} na fila</span></div>
        <table className="tbl">
          <thead><tr><th>Arquivo</th><th>Produto</th><th>Duração</th><th>Progresso</th><th className="right">Status</th></tr></thead>
          <tbody>
            {fila.map((f, i) => (
              <tr key={i}>
                <td className="mono" style={{ fontSize: 12.5 }}>{f.nome}</td>
                <td style={{ fontWeight: 500 }}>{f.prod}</td>
                <td className="muted">{f.dur}</td>
                <td style={{ minWidth: 160 }}><div className="bar violet" style={{ height: 7 }}><i style={{ width: f.prog + '%' }} /></div></td>
                <td className="right">{f.st === 'pronto' ? <Badge status="aprovado" /> : f.st === 'renderizando' ? <span className="badge violet"><Icon name="refresh" size={11} />Renderizando</span> : <span className="badge gray"><Icon name="clock" size={11} />Na fila</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ============ Links Dinâmicos ============ */
const Links = () => {
  const links = [
    { slug:'patrono.link/talheres', prod:'Talheres Expansível', plat:'Shopee', cliques:1820, vendas:58, ativo:true },
    { slug:'patrono.link/cabide', prod:'Cabide Mágico', plat:'Shopee', cliques:1240, vendas:41, ativo:true },
    { slug:'patrono.link/potes', prod:'Potes Geladeira', plat:'Mercado Livre', cliques:940, vendas:31, ativo:true },
    { slug:'patrono.link/nicho', prod:'Nicho de Canto', plat:'Amazon', cliques:320, vendas:8, ativo:true },
    { slug:'patrono.link/varal', prod:'Varal Retrátil', plat:'TikTok Shop', cliques:88, vendas:1, ativo:false },
  ];
  return (
    <div className="content-inner fade-in">
      <div className="row spread wrap" style={{ gap: 12 }}>
        <div><h2 style={{ fontSize: 18 }}>Links Dinâmicos</h2><p className="muted" style={{ fontSize: 13 }}>Um link curto por produto, com rastreamento de cliques e vendas</p></div>
        <button className="btn btn-primary btn-sm"><Icon name="plus" size={14} />Novo link</button>
      </div>
      <div className="grid g4">
        <StatCard icon="link" color="blue" value="4.408" label="Cliques totais" trend="+14%" trendDir="up" />
        <StatCard icon="bag" color="gold" value="139" label="Vendas atribuídas" trend="+9%" trendDir="up" />
        <StatCard icon="trend" color="green" value="3,2%" label="Conversão média" trend="+0,3pp" trendDir="up" />
        <StatCard icon="tag" color="violet" value="5" label="Links ativos" />
      </div>
      <div className="card flush">
        <table className="tbl">
          <thead><tr><th>Link curto</th><th>Produto</th><th>Plataforma</th><th className="right">Cliques</th><th className="right">Vendas</th><th className="right">Conversão</th><th className="right">Status</th></tr></thead>
          <tbody>
            {links.map((l, i) => (
              <tr key={i}>
                <td><span className="row" style={{ gap: 7 }}><Icon name="link" size={13} style={{ color: 'var(--blue)' }} /><span className="mono" style={{ fontSize: 12.5, color: 'var(--blue)' }}>{l.slug}</span><Icon name="copy" size={12} style={{ color: 'var(--text-dim)', cursor: 'pointer' }} /></span></td>
                <td style={{ fontWeight: 500 }}>{l.prod}</td>
                <td><span className={`badge ${platColor[l.plat]||'gray'}`} style={{ padding: '2px 8px' }}>{l.plat}</span></td>
                <td className="right mono">{l.cliques.toLocaleString('pt-BR')}</td>
                <td className="right mono">{l.vendas}</td>
                <td className="right mono">{((l.vendas/l.cliques)*100).toFixed(1)}%</td>
                <td className="right">{l.ativo ? <span className="badge green" style={{ padding: '2px 8px' }}><span className="dot" />Ativo</span> : <span className="badge gray" style={{ padding: '2px 8px' }}>Pausado</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

window.VideoSeller = VideoSeller;
window.Links = Links;
