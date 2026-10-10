/* ══════════════════════════════════════════════════════════════
   OmniLicit · LicitaTR — Módulo Termo de Referência (Lei 14.133/2021)
   Arquitetura PDF: Capa → Corpo → Assinaturas → Autenticação
   ══════════════════════════════════════════════════════════════ */

/* ─────────── MÓDULO 0 · UTILITÁRIOS ─────────── */
const U = (() => {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const uid = (p = 'id') =>
    `${p}_${Math.random().toString(36).slice(2,9)}${Date.now().toString(36).slice(-4)}`;

  const getPath = (o, p) => String(p).split('.').reduce((a,k) => a == null ? undefined : a[k], o);
  const setPath = (o, p, v) => {
    const ks = String(p).split('.'); const last = ks.pop();
    const t = ks.reduce((a,k) => (a[k] = a[k] || {}), o); t[last] = v;
  };

  const debounce = (fn, ms = 260) => {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  const esc = (s='') => String(s).replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const num = (v) => {
    if (typeof v === 'number') return v;
    const n = Number(String(v ?? '').replace(/[^\d,.-]/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.'));
    return Number.isFinite(n) ? n : 0;
  };
  const brl = (v) => num(v).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  const fmtNum = (v) => num(v).toLocaleString('pt-BR', { minimumFractionDigits:0, maximumFractionDigits:2 });

  const sha256 = async (str) => {
    try {
      if (window.crypto?.subtle) {
        const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join('');
      }
    } catch (_) {}
    /* Fallback determinístico para file:// sem secure context */
    let h1 = 0x811c9dc5, h2 = 0x1000193;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = (h1 ^ c) * 16777619 >>> 0;
      h2 = (h2 + c * (i+1)) >>> 0;
    }
    return (h1.toString(16).padStart(8,'0') + h2.toString(16).padStart(8,'0')).repeat(4).slice(0,64);
  };

  const canon = (v) => {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object')
      return '{' + Object.keys(v).sort().map(k => JSON.stringify(k)+':'+canon(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  };

  const download = (blob, fn) => {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href:url, download:fn });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const fileToDataUrl = (f) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(f);
  });

  const srcToDataUrl = async (src) => {
    if (!src) return null;
    if (src.startsWith('data:')) return src;
    try {
      const r = await fetch(src, { cache:'force-cache' });
      const b = await r.blob();
      return await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = rej;
        fr.readAsDataURL(b);
      });
    } catch (_) { return null; }
  };

  return { $, $$, uid, getPath, setPath, debounce, esc, num, brl, fmtNum,
           sha256, canon, download, fileToDataUrl, srcToDataUrl };
})();

const { $, $$, uid, getPath, setPath, debounce, esc, num, brl, fmtNum,
        sha256, canon, download, fileToDataUrl, srcToDataUrl } = U;


/* ─────────── MÓDULO 1 · TEMA (Dark padrão · Light alternativo) ─────────── */
const Theme = (() => {
  const KEY = 'omnilicit.tr.theme';
  const html = document.documentElement;

  const apply = (mode) => {
    if (mode === 'light') html.classList.remove('dark');
    else html.classList.add('dark');
    try { localStorage.setItem(KEY, mode); } catch (_) {}
  };

  const init = () => {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (_) {}
    apply(saved === 'light' ? 'light' : 'dark');
    $('#themeToggle')?.addEventListener('click', () => {
      apply(html.classList.contains('dark') ? 'light' : 'dark');
    });
  };

  return { init, apply };
})();


/* ─────────── MÓDULO 2 · TIPOS DE PROCESSO ─────────── */
const TIPOS = {
  bens_comuns: {
    label: 'Aquisição de Bens Comuns',
    icone: '📦',
    fundamento: 'Lei nº 14.133/2021, arts. 6º, XIII; 40 e 41 — bens de prateleira, especificação usual de mercado.',
    campos: [
      { path:'processo.prazoEntrega',  label:'Prazo de Entrega',   ph:'Ex.: 30 (trinta) dias corridos' },
      { path:'processo.localEntrega',  label:'Local de Entrega',   ph:'Ex.: Almoxarifado Central' },
      { path:'processo.garantiaBens',  label:'Garantia dos Bens',  ph:'Ex.: 12 meses contra vícios de fabricação' },
      { path:'processo.amostra',       label:'Amostra / Prova de Conceito', tipo:'select',
        opcoes:['Não exigida','Exigida do licitante provisoriamente classificado (art. 41, II)'] },
      { path:'processo.assistencia',   label:'Assistência Técnica', ph:'Ex.: 12 meses de suporte on-site' },
      { path:'processo.frete',         label:'Frete / Logística',   ph:'Ex.: CIF — entrega franqueada, sem ônus ao órgão' }
    ]
  },
  servicos_dedicacao: {
    label: 'Serviços Continuados com Dedicação Exclusiva',
    icone: '👷',
    fundamento: 'Lei nº 14.133/2021, arts. 6º, XV; 57, II; 121 e ss. — regime de dedicação exclusiva de mão de obra.',
    campos: [
      { path:'processo.regimeExecucao',    label:'Regime de Execução',        ph:'Ex.: Empreitada por preço unitário' },
      { path:'processo.convencaoColetiva', label:'Convenção Coletiva Aplicável', ph:'Ex.: CCT SINDLIMP 2025' },
      { path:'processo.produtividade',     label:'Produtividade / Postos',    ph:'Ex.: 4 postos de 44h semanais' },
      { path:'processo.planilhaCustos',    label:'Planilha de Custos',        ph:'Ex.: Anexo I — planilha referencial com BDI' },
      { path:'processo.reajuste',          label:'Reajuste / Repactuação',    ph:'Ex.: Repactuação anual vinculada ao ACT (art. 135)' },
      { path:'processo.transicao',         label:'Transição Contratual',      ph:'Ex.: 30 dias sem interrupção dos serviços' }
    ]
  },
  obras_engenharia: {
    label: 'Obras e Serviços de Engenharia',
    icone: '🏗️',
    fundamento: 'Lei nº 14.133/2021, arts. 6º, XXI; 45 a 49 — regime de execução e matriz de riscos obrigatória.',
    campos: [
      { path:'processo.art',              label:'ART / RRT',                 ph:'Ex.: ART CREA nº 0000000' },
      { path:'processo.bdi',              label:'BDI Adotado',               ph:'Ex.: 22,45% (Acórdão TCU 2622/2013)' },
      { path:'processo.cronogramaFisico', label:'Cronograma Físico-Financeiro', ph:'Ex.: Anexo II — 4 etapas em 180 dias' },
      { path:'processo.matrizRiscos',     label:'Matriz de Riscos',          ph:'Ex.: Anexo III — art. 22, §3º' },
      { path:'processo.medicoes',         label:'Medições / Boletim',        ph:'Ex.: Medição mensal conforme art. 140' },
      { path:'processo.crea',             label:'Registro no CREA/CAU',      ph:'Ex.: Matrícula CEI nº ...' }
    ]
  },
  dispensa_inexig: {
    label: 'Dispensa / Inexigibilidade de Licitação',
    icone: '⚖️',
    fundamento: 'Lei nº 14.133/2021, arts. 74 e 75 — contratação direta com instrução processual obrigatória.',
    campos: [
      { path:'processo.fundamentoLegal', label:'Fundamento Legal', tipo:'select', opcoes:[
        'Art. 75, I — baixo valor (obras e engenharia)',
        'Art. 75, II — baixo valor (outros bens e serviços)',
        'Art. 75, III — emergência ou calamidade',
        'Art. 75, IV — licitação deserta/fracassada',
        'Art. 74, I — fornecedor exclusivo',
        'Art. 74, II — notória especialização',
        'Art. 74, III — profissional do setor artístico',
        'Outro fundamento legal'
      ] },
      { path:'processo.razaoEscolha',     label:'Razão da Escolha do Fornecedor', ph:'Justificativa objetiva da escolha' },
      { path:'processo.pesquisaPrecos',   label:'Pesquisa de Preços',   ph:'Ex.: 3 orçamentos + Painel de Preços + IN 65/2021' },
      { path:'processo.ratificacao',      label:'Ratificação',          ph:'Ex.: Ratificado pela autoridade competente' },
      { path:'processo.instrucao72',      label:'Observância do art. 72', ph:'Ex.: ETP, estimativa, parecer jurídico e autorização' }
    ]
  }
};


/* ─────────── MÓDULO 3 · ESTADO ─────────── */
const state = {
  meta: { versao: '1.0.0', criadoEm: new Date().toISOString() },
  orgao: { nome:'', cnpj:'', unidade:'', responsavel:'', cargo:'', logoDataUrl:null },
  regras: [],
  processo: {
    numero:'', tipo:'bens_comuns', modalidade:'Pregão Eletrônico', regime:'',
    objeto:'', justificativa:'', especificacoes:'', dotacao:'',
    vigencia:'', prazoExecucao:'', cronograma:'',
    modeloGestao:'', modeloExecucao:'', pagamento:'', garantia:'',
    sancoes:'', sustentabilidade:'', lgpd:'', observacoes:''
  },
  equipe: {
    gestor: '',
    fiscalTecnico: '',
    fiscalSubstituto: '',
    fiscalAdministrativo: ''
  },
  itens: []
};


/* ─────────── MÓDULO 4 · LOGO DINÂMICO ─────────── */
const Logo = (() => {
  const FALLBACK = 'logo-omnlicit.png';

  const apply = () => {
    const src = state.orgao.logoDataUrl || FALLBACK;
    $$('[data-logo]').forEach(img => {
      img.onerror = function () { this.onerror = null; this.src = FALLBACK; };
      img.src = src;
    });
    const prev = $('#logoPreview');
    if (prev) {
      prev.onerror = function () { this.onerror = null; this.src = FALLBACK; };
      prev.src = src;
    }
    const fav = $('#favicon');
    if (fav) fav.href = src;
  };

  const bind = () => {
    $('#logoInput')?.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 2 MB.');
        e.target.value = ''; return;
      }
      state.orgao.logoDataUrl = await fileToDataUrl(f);
      apply(); Audit.schedule();
    });

    $('#btnLogoReset')?.addEventListener('click', () => {
      state.orgao.logoDataUrl = null;
      const i = $('#logoInput'); if (i) i.value = '';
      apply();
    });
  };

  return { apply, bind, FALLBACK };
})();


/* ─────────── MÓDULO 5 · AUDITORIA ─────────── */
const Audit = (() => {
  const CAMPOS_TEXTO = [
    'objeto','justificativa','especificacoes','modeloExecucao','modeloGestao',
    'pagamento','garantia','sancoes','sustentabilidade','lgpd',
    'observacoes','cronograma','frete','reajuste','transicao',
    'matrizRiscos','pesquisaPrecos','razaoEscolha','instrucao72'
  ];

  const fullText = () => {
    const p = state.processo;
    const partes = CAMPOS_TEXTO.map(k => p[k]).filter(Boolean);
    state.itens.forEach(i => { if (i.descricao) partes.push(i.descricao); });
    return partes.join('\n');
  };

  const NATIVAS = [
    { id:'n-objeto', test:() => !state.processo.objeto.trim() || state.processo.objeto.trim().length < 20,
      issue:{ severidade:'critico', titulo:'Objeto da contratação não definido',
        mensagem:'O objeto deve ser descrito de forma precisa, suficiente e clara (art. 6º, XXIII e art. 40, I).',
        fundamento:'Lei nº 14.133/2021, art. 40, I', alvo:'processo.objeto' } },
    { id:'n-just', test:() => state.processo.justificativa.trim().length < 80,
      issue:{ severidade:'alerta', titulo:'Justificativa insuficiente',
        mensagem:'A motivação deve demonstrar o problema público e o nexo causal com a contratação (art. 18, §1º, I).',
        fundamento:'Lei nº 14.133/2021, art. 18, §1º, I', alvo:'processo.justificativa' } },
    { id:'n-dot', test:() => !state.processo.dotacao.trim(),
      issue:{ severidade:'critico', titulo:'Dotação orçamentária não informada',
        mensagem:'É obrigatória a indicação da dotação orçamentária e do recurso financeiro (art. 18, §1º, VI).',
        fundamento:'Lei nº 14.133/2021, art. 18, §1º, VI', alvo:'processo.dotacao' } },
    { id:'n-itens', test:() => state.itens.length === 0,
      issue:{ severidade:'critico', titulo:'Nenhum item/quantitativo especificado',
        mensagem:'O TR deve conter a quantidade e a estimativa do valor de cada item (art. 40, IV e VI).',
        fundamento:'Lei nº 14.133/2021, art. 40, IV', alvo:'itens' } },
    { id:'n-val', test:() => state.itens.length > 0 && state.itens.some(i => num(i.valorUnit) <= 0),
      issue:{ severidade:'alerta', titulo:'Itens sem valor unitário estimado',
        mensagem:'A estimativa de preços deve ser apurada previamente (art. 23) e registrada por item.',
        fundamento:'Lei nº 14.133/2021, art. 23', alvo:'itens' } },
    { id:'n-vig', test:() => !state.processo.vigencia.trim(),
      issue:{ severidade:'alerta', titulo:'Prazo de vigência não definido',
        mensagem:'Informar o prazo de vigência contratual e, se for o caso, sua prorrogação (art. 105 e ss.).',
        fundamento:'Lei nº 14.133/2021, art. 105', alvo:'processo.vigencia' } },
    { id:'n-fisc', test:() => !state.equipe.gestor.trim() && !state.equipe.fiscalTecnico.trim(),
      issue:{ severidade:'alerta', titulo:'Equipe de fiscalização não designada',
        mensagem:'O TR deve indicar o gestor e os fiscais do contrato (art. 40, §1º e art. 117).',
        fundamento:'Lei nº 14.133/2021, art. 117', alvo:'equipe.gestor' } },
    { id:'n-pgto', test:() => !state.processo.pagamento.trim(),
      issue:{ severidade:'alerta', titulo:'Condições de pagamento ausentes',
        mensagem:'Definir prazo, forma e critérios de pagamento, respeitada a ordem cronológica (art. 92, V e art. 141).',
        fundamento:'Lei nº 14.133/2021, art. 92, V', alvo:'processo.pagamento' } },
    { id:'n-sanc', test:() => !state.processo.sancoes.trim(),
      issue:{ severidade:'info', titulo:'Sanções administrativas não detalhadas',
        mensagem:'Recomenda-se detalhar as infrações e sanções (arts. 155 a 163).',
        fundamento:'Lei nº 14.133/2021, arts. 155-163', alvo:'processo.sancoes' } },
    { id:'n-sust', test:() => !state.processo.sustentabilidade.trim(),
      issue:{ severidade:'info', titulo:'Critérios de sustentabilidade não previstos',
        mensagem:'A contratação deve observar critérios de sustentabilidade ambiental (art. 5º e art. 40, X).',
        fundamento:'Lei nº 14.133/2021, art. 5º', alvo:'processo.sustentabilidade' } },
    { id:'n-lgpd', test:() => !state.processo.lgpd.trim(),
      issue:{ severidade:'info', titulo:'Cláusula de proteção de dados (LGPD) ausente',
        mensagem:'Recomenda-se prever o tratamento de dados pessoais conforme a Lei nº 13.709/2018.',
        fundamento:'Lei nº 13.709/2018 (LGPD)', alvo:'processo.lgpd' } },
    { id:'n-obras-matriz',
      test:() => state.processo.tipo === 'obras_engenharia' && !String(state.processo.matrizRiscos || '').trim(),
      issue:{ severidade:'critico', titulo:'Matriz de riscos ausente (obras e engenharia)',
        mensagem:'Nas contratações de obras e serviços de engenharia é obrigatória a matriz de alocação de riscos.',
        fundamento:'Lei nº 14.133/2021, art. 22, §3º e art. 103', alvo:'processo.matrizRiscos' } },
    { id:'n-dedic-cct',
      test:() => state.processo.tipo === 'servicos_dedicacao' && !String(state.processo.convencaoColetiva || '').trim(),
      issue:{ severidade:'alerta', titulo:'Convenção coletiva não indicada (dedicação exclusiva)',
        mensagem:'Indicar a CCT aplicável e os custos de mão de obra com repactuação vinculada ao ACT.',
        fundamento:'Lei nº 14.133/2021, art. 121 e ss.', alvo:'processo.convencaoColetiva' } },
    { id:'n-disp-fund',
      test:() => state.processo.tipo === 'dispensa_inexig' && !String(state.processo.fundamentoLegal || '').trim(),
      issue:{ severidade:'critico', titulo:'Fundamento legal da contratação direta ausente',
        mensagem:'A contratação direta exige enquadramento expresso em hipótese legal (arts. 74 e 75).',
        fundamento:'Lei nº 14.133/2021, arts. 74 e 75', alvo:'processo.fundamentoLegal' } },
    { id:'n-disp-precos',
      test:() => state.processo.tipo === 'dispensa_inexig' && !String(state.processo.pesquisaPrecos || '').trim(),
      issue:{ severidade:'alerta', titulo:'Pesquisa de preços não informada',
        mensagem:'A instrução do processo de contratação direta exige estimativa de preços (art. 72, II).',
        fundamento:'Lei nº 14.133/2021, art. 72, II', alvo:'processo.pesquisaPrecos' } }
  ];

  const run = () => {
    const issues = [];
    const full = fullText();

    /* Regras institucionais */
    state.regras.filter(r => r.ativa).forEach(r => {
      const raw = r.alvo === 'full' ? full : String(getPath(state, r.alvo) ?? '');
      const hay = raw.toLowerCase();
      const needle = String(r.valor || '').toLowerCase();
      let bad = false, detail = '';

      switch (r.tipo) {
        case 'contem':
          bad = !!needle && !hay.includes(needle);
          detail = bad ? `Cláusula exigida ausente: "${r.valor}"` : ''; break;
        case 'nao_contem':
          bad = !!needle && hay.includes(needle);
          detail = bad ? `Termo vedado encontrado: "${r.valor}"` : ''; break;
        case 'regex':
          try { bad = !!r.valor && new RegExp(r.valor, 'i').test(raw); } catch (_) {}
          detail = bad ? `Padrão vedado identificado: /${r.valor}/i` : ''; break;
        case 'campo_vazio':
          bad = !raw.trim();
          detail = bad ? 'Campo obrigatório pela norma interna não preenchido' : ''; break;
      }

      if (bad) issues.push({
        origem: 'Institucional',
        severidade: r.severidade,
        titulo: r.titulo,
        mensagem: r.mensagem || detail,
        detalhe: detail,
        fundamento: r.fundamento || 'Norma interna do órgão',
        alvo: r.alvo
      });
    });

    /* Regras nativas */
    NATIVAS.forEach(n => {
      try { if (n.test()) issues.push({ origem:'Lei nº 14.133/2021', ...n.issue }); } catch (_) {}
    });

    const peso = { critico:0, alerta:1, info:2 };
    issues.sort((a,b) => (peso[a.severidade] ?? 3) - (peso[b.severidade] ?? 3));
    return issues;
  };

  const SEV = { critico:'badge--crit', alerta:'badge--alert', info:'badge--info' };
  const LBL = { critico:'Crítico', alerta:'Alerta', info:'Info' };

  const render = () => {
    const issues = run();
    const c = { critico:0, alerta:0, info:0 };
    issues.forEach(i => { c[i.severidade] = (c[i.severidade] || 0) + 1; });

    $('#cntCritico').textContent = c.critico;
    $('#cntAlerta').textContent  = c.alerta;
    $('#cntInfo').textContent    = c.info;
    $('#auditTotal').textContent = issues.length;

    const score = Math.max(0, 100 - c.critico * 12 - c.alerta * 6 - c.info * 2);
    const scoreEl = $('#auditScore');
    const barEl = $('#auditBar');
    scoreEl.textContent = score + '%';
    scoreEl.className = 'badge ' + (score >= 85 ? 'badge--ok' : score >= 60 ? 'badge--alert' : 'badge--crit');
    barEl.style.width = score + '%';
    barEl.className = 'progress__bar ' +
      (score >= 85 ? 'progress__bar--ok' : score >= 60 ? 'progress__bar--warn' : 'progress__bar--crit');

    const list = $('#auditList');
    if (!issues.length) {
      list.innerHTML = `
        <div class="audit-empty">
          <p class="audit-empty__icon">✅</p>
          <p class="audit-empty__title">Nenhuma inconformidade detectada</p>
          <p class="audit-empty__desc">O TR está aderente às regras institucionais e à Lei nº 14.133/2021.</p>
        </div>`;
      return issues;
    }

    list.innerHTML = issues.map(i => `
      <div class="audit-item" data-goto="${esc(i.alvo || '')}">
        <div class="audit-item__head">
          <span class="badge ${SEV[i.severidade] || 'badge--info'}">${LBL[i.severidade] || 'Info'}</span>
          <div style="min-width:0;flex:1">
            <p class="audit-item__title">${esc(i.titulo)}</p>
            <p class="audit-item__msg">${esc(i.mensagem || '')}</p>
            <p class="audit-item__src">${esc(i.fundamento || '')}</p>
          </div>
        </div>
      </div>
    `).join('');

    return issues;
  };

  const bindNav = () => {
    $('#auditList')?.addEventListener('click', (e) => {
      const card = e.target.closest('[data-goto]');
      if (!card) return;
      const alvo = card.dataset.goto;
      if (!alvo || alvo === 'itens') {
        $('#itensBody')?.scrollIntoView({ behavior:'smooth', block:'center' });
        return;
      }
      const inp = document.querySelector(`[data-bind="${alvo}"]`);
      if (inp) {
        inp.scrollIntoView({ behavior:'smooth', block:'center' });
        inp.focus({ preventScroll:true });
        inp.style.boxShadow = '0 0 0 3px var(--petrol)';
        setTimeout(() => { inp.style.boxShadow = ''; }, 1400);
      }
    });
  };

  const schedule = debounce(() => { render(); Trace.schedule(); }, 240);
  return { run, render, schedule, bindNav, fullText };
})();


/* ─────────── MÓDULO 6 · RASTREABILIDADE ─────────── */
const Trace = (() => {
  let current = { hash:'', tag:'', ano:'', selo:'OMNILICIT::TR::—::—', timestamp:new Date().toISOString() };

  const snap = () => ({
    orgao:{ nome:state.orgao.nome, cnpj:state.orgao.cnpj, unidade:state.orgao.unidade },
    processo: state.processo,
    equipe: state.equipe,
    itens: state.itens,
    regras: state.regras.filter(r => r.ativa).map(r => ({
      titulo:r.titulo, tipo:r.tipo, alvo:r.alvo, valor:r.valor, severidade:r.severidade
    })),
    meta:{ versao:state.meta.versao }
  });

  const compute = async () => {
    const h = await sha256(canon(snap()));
    const ano = new Date().getFullYear();
    const tag = `TR-${ano}-${h.slice(0,8).toUpperCase()}`;
    current = { hash:h, tag, ano, selo:`OMNILICIT::TR::${tag}::${ano}`, timestamp:new Date().toISOString() };
    return current;
  };

  const render = () => {
    $('#traceSelo').textContent = current.selo;
    $('#traceHash').textContent = current.hash || 'aguardando conteúdo…';
    $('#traceTs').textContent = new Date(current.timestamp).toLocaleString('pt-BR');
    $('#seloPreview').textContent = current.selo;
  };

  const refresh = async () => { await compute(); render(); return current; };
  const schedule = debounce(() => refresh(), 600);
  const get = () => current;

  return { compute, refresh, render, schedule, get };
})();


/* ─────────── MÓDULO 7 · UI ─────────── */
const UI = (() => {

  const renderTipos = () => {
    const box = $('#tipoSelector');
    box.innerHTML = Object.entries(TIPOS).map(([k, t]) => `
      <button type="button" data-tipo="${k}"
        class="tipo-btn ${state.processo.tipo === k ? 'is-active' : ''}">
        <span class="tipo-btn__icon">${t.icone}</span>
        <p class="tipo-btn__label">${esc(t.label)}</p>
      </button>
    `).join('');

    box.querySelectorAll('[data-tipo]').forEach(b => {
      b.addEventListener('click', () => {
        state.processo.tipo = b.dataset.tipo;
        renderTipos(); renderCampos(); Audit.schedule();
      });
    });
  };

  const renderCampos = () => {
    const t = TIPOS[state.processo.tipo];
    $('#tipoFundamento').textContent = t.fundamento;

    $('#camposDinamicos').innerHTML = t.campos.map(c => {
      const v = getPath(state, c.path) ?? '';
      if (c.tipo === 'select') {
        return `
          <label class="field">
            <span class="label">${esc(c.label)}</span>
            <select class="input" data-bind="${c.path}">
              <option value="">— selecione —</option>
              ${c.opcoes.map(o => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}
            </select>
          </label>`;
      }
      return `
        <label class="field">
          <span class="label">${esc(c.label)}</span>
          <input class="input" data-bind="${c.path}" value="${esc(v)}" placeholder="${esc(c.ph || '')}" />
        </label>`;
    }).join('');
  };

  const renderItens = () => {
    const tb = $('#itensBody');
    $('#itensBadge').textContent = `${state.itens.length} ${state.itens.length === 1 ? 'item' : 'itens'}`;

    if (!state.itens.length) {
      tb.innerHTML = `<tr><td colspan="7" class="empty-row">
        Nenhum item cadastrado. Clique em “Adicionar item” ou importe do LicitaReq / LicitaETP.
      </td></tr>`;
      updateTotais();
      return;
    }

    tb.innerHTML = state.itens.map((it, i) => {
      const total = num(it.quantidade) * num(it.valorUnit);
      return `
        <tr>
          <td class="col-num">${i + 1}</td>
          <td><input class="input--sm" data-item="${i}" data-field="descricao"
                     value="${esc(it.descricao || '')}" placeholder="Descrição do item" /></td>
          <td><input class="input--sm" data-item="${i}" data-field="unidade"
                     value="${esc(it.unidade || '')}" placeholder="UN" style="text-align:center" /></td>
          <td><input class="input--sm" data-item="${i}" data-field="quantidade" inputmode="decimal"
                     value="${esc(it.quantidade || '')}" placeholder="0" style="text-align:right" /></td>
          <td><input class="input--sm" data-item="${i}" data-field="valorUnit" inputmode="decimal"
                     value="${esc(it.valorUnit || '')}" placeholder="0,00" style="text-align:right" /></td>
          <td class="col-tot" data-total-row="${i}">${brl(total)}</td>
          <td class="col-del"><button class="item-del" data-item-del="${i}" title="Remover">✕</button></td>
        </tr>`;
    }).join('');

    updateTotais();
  };

  const updateTotais = () => {
    let g = 0;
    state.itens.forEach((it, i) => {
      const t = num(it.quantidade) * num(it.valorUnit);
      g += t;
      const cell = document.querySelector(`[data-total-row="${i}"]`);
      if (cell) cell.textContent = brl(t);
    });
    $('#valorGlobal').textContent = brl(g);
  };

  const SEV = { critico:'badge--crit', alerta:'badge--alert', info:'badge--info' };

  const renderRegras = () => {
    $('#regrasCount').textContent = state.regras.length;
    const box = $('#regrasList');

    if (!state.regras.length) {
      box.innerHTML = `<p class="hint" style="padding:.75rem;text-align:center">
        Nenhuma regra institucional cadastrada. Adicione normas específicas do seu órgão abaixo.
      </p>`;
      return;
    }

    box.innerHTML = state.regras.map((r, i) => `
      <div class="regra-item ${r.ativa ? '' : 'is-off'}">
        <input type="checkbox" class="regra-item__check" data-regra-ativa="${i}" ${r.ativa ? 'checked' : ''} />
        <div class="regra-item__body">
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
            <span class="badge ${SEV[r.severidade] || 'badge--info'}">${r.severidade}</span>
            <p class="regra-item__title">${esc(r.titulo)}</p>
          </div>
          <p class="regra-item__desc">${esc(r.mensagem || '')}</p>
          <code class="regra-item__meta">${esc(r.tipo)} · ${esc(r.alvo)} · ${esc(r.valor || '—')}${r.fundamento ? ' · ' + esc(r.fundamento) : ''}</code>
        </div>
        <button class="regra-item__del" data-regra-del="${i}" title="Remover">✕</button>
      </div>
    `).join('');
  };

  const bindGlobal = () => {
    const handler = (e) => {
      const t = e.target;
      const bind = t.dataset?.bind;
      if (bind) {
        const v = t.type === 'checkbox' ? t.checked : t.value;
        setPath(state, bind, v);
        if (bind === 'orgao.nome') $('#hdrOrgao').textContent = v || 'Órgão não informado';
        Audit.schedule(); return;
      }
      const idx = t.dataset?.item;
      if (idx !== undefined && t.dataset.field) {
        state.itens[Number(idx)][t.dataset.field] = t.value;
        if (t.dataset.field === 'quantidade' || t.dataset.field === 'valorUnit') updateTotais();
        Audit.schedule();
      }
    };
    document.addEventListener('input', handler);
    document.addEventListener('change', handler);
  };

  const bindEvents = () => {
    $('#btnAddItem')?.addEventListener('click', () => {
      state.itens.push({ id:uid('item'), descricao:'', unidade:'UN', quantidade:'', valorUnit:'' });
      renderItens(); Audit.schedule();
    });

    $('#btnClearItens')?.addEventListener('click', () => {
      if (!state.itens.length) return;
      if (!confirm('Remover todos os itens?')) return;
      state.itens = []; renderItens(); Audit.schedule();
    });

    $('#itensBody')?.addEventListener('click', (e) => {
      const del = e.target.closest('[data-item-del]');
      if (!del) return;
      state.itens.splice(Number(del.dataset.itemDel), 1);
      renderItens(); Audit.schedule();
    });

    $('#formRegra')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      state.regras.push({
        id: uid('regra'),
        titulo: String(fd.get('titulo') || '').trim(),
        tipo: fd.get('tipo'),
        alvo: fd.get('alvo'),
        valor: String(fd.get('valor') || '').trim(),
        severidade: fd.get('severidade'),
        fundamento: String(fd.get('fundamento') || '').trim(),
        mensagem: `Regra institucional ativa — verificação "${fd.get('tipo')}" sobre "${fd.get('alvo')}".`,
        ativa: true
      });
      e.target.reset();
      renderRegras(); Audit.schedule();
    });

    $('#btnRegrasLimpar')?.addEventListener('click', () => {
      if (!state.regras.length) return;
      if (!confirm('Remover todas as regras institucionais?')) return;
      state.regras = []; renderRegras(); Audit.schedule();
    });

    $('#regrasList')?.addEventListener('change', (e) => {
      const i = e.target.dataset?.regraAtiva;
      if (i === undefined) return;
      state.regras[Number(i)].ativa = e.target.checked;
      renderRegras(); Audit.schedule();
    });

    $('#regrasList')?.addEventListener('click', (e) => {
      const del = e.target.closest('[data-regra-del]');
      if (!del) return;
      state.regras.splice(Number(del.dataset.regraDel), 1);
      renderRegras(); Audit.schedule();
    });
  };

  const syncBindings = () => {
    $$('[data-bind]').forEach(inp => {
      const v = getPath(state, inp.dataset.bind);
      if (inp.type === 'checkbox') inp.checked = !!v;
      else if (document.activeElement !== inp) inp.value = v ?? '';
    });
    $('#hdrOrgao').textContent = state.orgao.nome || 'Órgão não informado';
  };

  return { renderTipos, renderCampos, renderItens, updateTotais, renderRegras,
           bindGlobal, bindEvents, syncBindings };
})();


/* ─────────── MÓDULO 8 · IMPORTADOR DFD/ETP ─────────── */
const Importador = (() => {
  const log = (msg, tipo = 'ok') => {
    const b = $('#importLog');
    b.classList.remove('hidden');
    b.className = 'import-log is-' + tipo;
    b.textContent = msg;
  };

  const pick = (obj, keys) => {
    for (const k of keys) {
      const partes = k.split('.');
      let cur = obj;
      for (const p of partes) {
        if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
        else { cur = undefined; break; }
      }
      if (cur !== undefined && cur !== null && String(cur).trim() !== '') return cur;
    }
    return undefined;
  };

  const apply = (data) => {
    const ap = [];
    const raiz = data.dfd || data.etp || data.documento || data;

    const mapa = [
      { path:'processo.objeto',        keys:['objeto','objetoContratacao','descricaoObjeto','demanda','objeto.descricao'] },
      { path:'processo.justificativa', keys:['justificativa','motivacao','justificativaNecessidade','necessidade'] },
      { path:'processo.especificacoes',keys:['especificacoes','especificacoesTecnicas','solucao','descricaoSolucao','requisitos'] },
      { path:'processo.dotacao',       keys:['dotacao','dotacaoOrcamentaria','classificacaoOrcamentaria','fonteRecurso','programaTrabalho'] },
      { path:'processo.vigencia',      keys:['vigencia','prazoVigencia','duracaoContrato'] },
      { path:'processo.prazoExecucao', keys:['prazoExecucao','prazoEntrega','prazoExecucaoDias','prazo'] },
      { path:'processo.cronograma',    keys:['cronograma','cronogramaExecucao','etapas'] },
      { path:'equipe.gestor',          keys:['equipe.gestor','gestor','gestorContrato'] },
      { path:'equipe.fiscalTecnico',   keys:['equipe.fiscalTecnico','fiscalTecnico','fiscal'] },
      { path:'equipe.fiscalSubstituto',keys:['equipe.fiscalSubstituto','fiscalSubstituto','substituto'] },
      { path:'equipe.fiscalAdministrativo', keys:['equipe.fiscalAdministrativo','fiscalAdministrativo'] },
      { path:'orgao.nome',             keys:['orgao.nome','orgao','unidadeAdministrativa','entidade'] },
      { path:'processo.numero',        keys:['processo.numero','numeroProcesso','protocolo','id'] },
      { path:'processo.modalidade',    keys:['modalidade','processo.modalidade'] }
    ];

    mapa.forEach(m => {
      const v = pick(raiz, m.keys);
      if (v !== undefined) {
        setPath(state, m.path, typeof v === 'object' ? JSON.stringify(v) : String(v));
        ap.push(m.path);
      }
    });

    const itens = pick(raiz, ['itens','quantidades','itensDemandados','produtos','lotes','objeto.itens']);
    if (Array.isArray(itens) && itens.length) {
      state.itens = itens.map(i => ({
        id: uid('item'),
        descricao: String(pick(i, ['descricao','item','nome','especificacao','objeto']) ?? ''),
        unidade:   String(pick(i, ['unidade','un','unidadeMedida']) ?? 'UN'),
        quantidade:String(pick(i, ['quantidade','qtd','qtde']) ?? ''),
        valorUnit: String(pick(i, ['valorUnit','valorUnitario','precoUnitario','valor']) ?? '')
      }));
      ap.push(`itens (${state.itens.length})`);
    }

    const hint = String(pick(raiz, ['tipo','tipoContratacao','natureza']) ?? '').toLowerCase();
    if (hint) {
      if (/obra|engenharia/.test(hint))            state.processo.tipo = 'obras_engenharia';
      else if (/dedica|m[ãa]o de obra|continuad/.test(hint)) state.processo.tipo = 'servicos_dedicacao';
      else if (/dispensa|inexig/.test(hint))       state.processo.tipo = 'dispensa_inexig';
      else if (/bem|aquisic|compr/.test(hint))     state.processo.tipo = 'bens_comuns';
      ap.push('processo.tipo');
    }

    return ap;
  };

  const extractPdf = async (file) => {
    if (!window.pdfjsLib) throw new Error('pdf.js indisponível.');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let txt = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const pg = await pdf.getPage(p);
      const c = await pg.getTextContent();
      txt += c.items.map(it => it.str).join(' ') + '\n';
    }
    return txt;
  };

  const heur = (txt) => {
    const g = (re) => { const m = txt.match(re); return m ? m[1].trim() : undefined; };
    return {
      objeto: g(/objeto[:\s]+([^\n]{15,600})/i),
      justificativa: g(/justificativa[:\s]+([^\n]{15,800})/i),
      dotacao: g(/(?:dota[çc][ãa]o|classifica[çc][ãa]o or[çc]ament[áa]ria)[:\s]+([^\n]{6,200})/i),
      prazoExecucao: g(/prazo(?:\s+de\s+(?:execu[çc][ãa]o|entrega))?[:\s]+([^\n]{3,120})/i),
      vigencia: g(/vig[êe]ncia[:\s]+([^\n]{3,120})/i),
      modalidade: g(/modalidade[:\s]+([^\n]{3,60})/i),
      processoNumero: g(/(?:processo|protocolo)\s*(?:n[º°o.]*)?\s*[:\s]?\s*([\d./-]{4,30})/i)
    };
  };

  const finalize = (ap, nome) => {
    UI.syncBindings();
    UI.renderTipos();
    UI.renderCampos();
    UI.renderItens();
    Audit.schedule();

    if (!ap.length) {
      log(`⚠ "${nome}" lido, mas nenhum campo reconhecido foi localizado.\nVerifique se o JSON segue o schema do LicitaReq / LicitaETP.`, 'warn');
      return;
    }
    log(`✅ Importação concluída a partir de "${nome}"\nCampos populados:\n  • ${ap.join('\n  • ')}`, 'ok');
  };

  const process = async (file) => {
    const n = file.name.toLowerCase();
    try {
      if (n.endsWith('.json')) {
        finalize(apply(JSON.parse(await file.text())), file.name); return;
      }
      if (n.endsWith('.pdf')) {
        log(`⏳ Lendo "${file.name}" com pdf.js…`, 'warn');
        finalize(apply(heur(await extractPdf(file))), file.name); return;
      }
      log(`⚠ Arquivo "${file.name}" ignorado. Formatos aceitos: .json e .pdf`, 'warn');
    } catch (err) {
      log(`❌ Falha ao processar "${file.name}":\n${err.message}`, 'err');
    }
  };

  const bind = () => {
    const dz = $('#dropzone');
    const inp = $('#fileImport');

    dz?.addEventListener('click', () => inp.click());
    dz?.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') inp.click(); });

    inp?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      for (const f of files) await process(f);
      inp.value = '';
    });

    ['dragenter','dragover'].forEach(ev => dz?.addEventListener(ev, (e) => {
      e.preventDefault(); dz.classList.add('is-hot');
    }));
    ['dragleave','drop'].forEach(ev => dz?.addEventListener(ev, (e) => {
      e.preventDefault(); dz.classList.remove('is-hot');
    }));

    dz?.addEventListener('drop', async (e) => {
      const files = Array.from(e.dataTransfer?.files || []);
      for (const f of files) await process(f);
    });

    $('#btnImportDemo')?.addEventListener('click', () => {
      const demo = {
        origem:'LicitaReq',
        tipo:'bens_comuns',
        numeroProcesso:'2025/000000',
        modalidade:'Pregão Eletrônico',
        objeto:'Aquisição de bens permanentes para atender às unidades administrativas, conforme quantitativos e especificações detalhadas no Anexo I.',
        justificativa:'A demanda decorre da necessidade de reposição de itens inservíveis e do atendimento às requisições das unidades finalísticas, sendo a solução mais adequada para assegurar a continuidade administrativa.',
        dotacao:'02.001.04.122.0002.2003.33903000 — Fonte 01 — Exercício corrente',
        prazoExecucao:'30 (trinta) dias corridos',
        vigencia:'12 (doze) meses',
        itens:[{ descricao:'Item de exemplo — descrever conforme catálogo', unidade:'UN', quantidade:10, valorUnit:250 }]
      };
      finalize(apply(demo), 'exemplo-licitareq.json');
    });
  };

  return { bind };
})();


/* ═══════════════════════════════════════════════════════════════
   MÓDULO 9 · PDF (pdfMake)
   Arquitetura em 4 blocos:
     ① CAPA EXECUTIVA (página 1) — pageBreak: 'after'
     ② CORPO (seções 1 a 15) — fluxo contínuo
     ③ FOLHA DE APROVAÇÃO E VALIDAÇÃO — pageBreak: 'before'
     ④ AUTENTICAÇÃO E RASTREABILIDADE — pageBreak: 'before' (última página)
   ═══════════════════════════════════════════════════════════════ */
const PdfBuilder = (() => {
  const CP = '#0D9488';   /* turquesa */
  const CE = '#05668D';   /* azul executivo */
  const CT = '#1e293b';
  const CM = '#64748b';
  const CINZA_FUNDO = '#f1f5f9';
  const CINZA_LINHA = '#cbd5e1';

  const LAYOUT_TABELA = {
    hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0.9 : 0.4,
    vLineWidth: () => 0,
    hLineColor: (i, node) => (i === 0 || i === node.table.body.length) ? CE : CINZA_LINHA,
    paddingLeft: () => 7, paddingRight: () => 7,
    paddingTop: () => 6, paddingBottom: () => 6
  };

  const STYLES = {
    tituloCapa:   { fontSize: 22, bold: true, color: CE, alignment:'center', margin:[0,0,0,4] },
    subtituloCapa:{ fontSize: 10, color: CM, alignment:'center', margin:[0,0,0,22] },
    tituloDoc:    { fontSize: 16, bold: true, color: CE, alignment:'center', margin:[0,4,0,2] },
    subtitulo:    { fontSize: 9, color: CM, alignment:'center', margin:[0,0,0,14] },
    body:         { fontSize: 9.5, color: CT, alignment:'justify', lineHeight: 1.35, margin:[0,4,0,8] },
    rotulo:       { fontSize: 9, bold: true, color: CE },
    valor:        { fontSize: 9.5, color: CT },
    th:           { fontSize: 8.5, bold: true, color:'#ffffff', fillColor: CE },
    td:           { fontSize: 8.5, color: CT },
    pequeno:      { fontSize: 7.5, color: CM, italics: true },
    capaLabel:    { fontSize: 8, bold: true, color: CM, characterSpacing: 0.5 },
    capaValor:    { fontSize: 10, color: CT, margin:[0,2,0,0] },
    assinaturaNome:{ fontSize: 9.5, bold: true, color: CT, alignment:'center', margin:[0,4,0,0] },
    assinaturaCargo:{ fontSize: 8, color: CM, alignment:'center' },
    metaLabel:    { fontSize: 7.5, bold: true, color: CM, characterSpacing: 0.4 },
    metaValor:    { fontSize: 8.5, color: CT },
    rodape:       { fontSize: 6.5, color: CM, alignment:'center' }
  };

  /* ─── Helpers de composição ─── */
  const secao = (n, t) => ({
    table:{
      widths:['*'],
      body:[[{
        text:`${n}. ${t.toUpperCase()}`,
        fontSize:10.5, bold:true, color:'#fff', margin:[8,5,8,5]
      }]]
    },
    layout:'noBorders',
    fillColor: CE,
    margin:[0,12,0,6],
    unbreakable:true
  });

  const par = (txt) => ({
    text: (txt && String(txt).trim()) ? String(txt).trim() : 'Não informado.',
    style:'body'
  });

  const kv = (pares) => ({
    table:{
      widths:['32%','*'],
      body: pares.map(([k,v]) => ([
        { text:k, style:'rotulo', fillColor:CINZA_FUNDO },
        { text:(v && String(v).trim()) ? String(v).trim() : '—', style:'valor' }
      ]))
    },
    layout: LAYOUT_TABELA,
    margin:[0,0,0,8]
  });

  /* ─── BLOCO ① · CAPA EXECUTIVA ─── */
  const buildCapa = (logo, tipo, dataEmissao, trace) => {
    const p = state.processo;
    const itens = state.itens;
    const valorTotal = itens.reduce((acc, it) =>
      acc + (num(it.quantidade) * num(it.valorUnit)), 0);

    const metadados = [
      ['Nº do Termo de Referência', p.numero || '—'],
      ['Órgão / Entidade',           state.orgao.nome || '—'],
      ['Unidade Requisitante',       state.orgao.unidade || '—'],
      ['Tipo de Contratação',        tipo.label],
      ['Modalidade',                 p.modalidade || '—'],
      ['Objeto (resumo)',            p.objeto ? String(p.objeto).slice(0, 260) : '—'],
      ['Valor Total Estimado',       brl(valorTotal)],
      ['Responsável Técnico',        [state.orgao.responsavel, state.orgao.cargo].filter(Boolean).join(' — ') || '—'],
      ['Data de Emissão',            dataEmissao]
    ];

    return [
      /* Faixa superior decorativa */
      {
        canvas: [
          { type:'rect', x:0, y:0, w:515, h:5, color: CE },
          { type:'rect', x:0, y:0, w:180, h:5, color: CP }
        ],
        margin:[0, 0, 0, 26]
      },

      /* Logotipo centralizado */
      logo
        ? { image: logo, width: 92, alignment:'center', margin:[0, 0, 0, 18] }
        : { text:'', margin:[0, 0, 0, 18] },

      /* Título institucional */
      { text:'TERMO DE REFERÊNCIA', style:'tituloCapa' },
      {
        canvas:[
          { type:'line', x1:180, y1:0, x2:335, y2:0, lineWidth:0.8, lineColor: CP }
        ],
        margin:[0, 4, 0, 10]
      },
      {
        text:'Elaborado nos termos da Lei nº 14.133, de 1º de abril de 2021',
        style:'subtituloCapa'
      },

      /* Nome do órgão em destaque */
      {
        text: (state.orgao.nome || 'ÓRGÃO OU ENTIDADE PÚBLICA').toUpperCase(),
        fontSize: 12, bold: true, color: CE, alignment:'center',
        margin:[0, 0, 0, 4]
      },
      {
        text: state.orgao.cnpj ? `CNPJ ${state.orgao.cnpj}` : ' ',
        fontSize: 8.5, color: CM, alignment:'center',
        margin:[0, 0, 0, 28]
      },

      /* Bloco de metadados principais */
      {
        table:{
          widths:['*'],
          body:[[{
            stack:[
              { text:'IDENTIFICAÇÃO DO DOCUMENTO', style:'capaLabel', margin:[0,0,0,10] },
              {
                table:{
                  widths:['38%','*'],
                  body: metadados.map(([k,v], idx) => ([
                    {
                      text:k,
                      style:'metaLabel',
                      fillColor: idx % 2 === 0 ? CINZA_FUNDO : '#ffffff',
                      margin:[8, 6, 6, 6]
                    },
                    {
                      text:String(v || '—'),
                      style:'metaValor',
                      fillColor: idx % 2 === 0 ? CINZA_FUNDO : '#ffffff',
                      margin:[6, 6, 8, 6]
                    }
                  ]))
                },
                layout:{
                  hLineWidth: () => 0.4,
                  vLineWidth: () => 0,
                  hLineColor: () => CINZA_LINHA,
                  paddingLeft: () => 0, paddingRight: () => 0,
                  paddingTop: () => 0, paddingBottom: () => 0
                }
              }
            ],
            margin:[16, 16, 16, 16],
            fillColor:'#ffffff'
          }]]
        },
        layout:{
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => CE,
          vLineColor: () => CE,
          paddingLeft: () => 0, paddingRight: () => 0,
          paddingTop: () => 0, paddingBottom: () => 0
        },
        margin:[0, 0, 0, 30]
      },

      /* Selo de autenticidade resumido */
      {
        table:{
          widths:['*'],
          body:[[{
            columns:[
              {
                width:'*',
                stack:[
                  { text:'SELO DIGITAL OMNILICIT', style:'capaLabel', margin:[0,0,0,4] },
                  { text: trace.selo, fontSize:8, bold:true, color:CE, font:'Roboto' }
                ]
              },
              {
                width:'auto',
                stack:[
                  { text:'EMITIDO EM', style:'capaLabel', alignment:'right', margin:[0,0,0,4] },
                  { text: new Date(trace.timestamp).toLocaleString('pt-BR'),
                    fontSize:8, color:CM, alignment:'right' }
                ]
              }
            ],
            margin:[12, 10, 12, 10]
          }]]
        },
        layout:{
          hLineWidth: () => 0.6,
          vLineWidth: () => 0.6,
          hLineColor: () => CINZA_LINHA,
          vLineColor: () => CINZA_LINHA,
          paddingLeft: () => 0, paddingRight: () => 0,
          paddingTop: () => 0, paddingBottom: () => 0
        },
        margin:[0, 0, 0, 0]
      },

      /* Quebra de página obrigatória ao final da capa */
      { text:'', pageBreak:'after' }
    ];
  };

  /* ─── BLOCO ② · CORPO (seções 1 a 15) ─── */
  const buildCorpo = (tipo) => {
    const p = state.processo;
    const body = [];

    /* 1. Identificação */
    body.push(secao(1,'Identificação do Processo'));
    body.push(kv([
      ['Nº do Processo', p.numero],
      ['Tipo de Contratação', tipo.label],
      ['Modalidade', p.modalidade],
      ['Regime / Julgamento', p.regime],
      ['Fundamentação', tipo.fundamento],
      ['Autoridade Responsável',
        [state.orgao.responsavel, state.orgao.cargo].filter(Boolean).join(' — ')]
    ]));

    /* 2. Objeto */
    body.push(secao(2,'Do Objeto'));
    body.push(par(p.objeto));

    /* 3. Justificativa */
    body.push(secao(3,'Da Justificativa e Motivação'));
    body.push(par(p.justificativa));

    /* 4. Solução e especificações */
    body.push(secao(4,'Da Descrição da Solução e Especificações Técnicas'));
    body.push(par(p.especificacoes));

    const cf = tipo.campos
      .map(c => [c.label, getPath(state, c.path)])
      .filter(([,v]) => v && String(v).trim());
    if (cf.length) {
      body.push({
        text:'Requisitos específicos aplicáveis ao tipo de contratação:',
        style:'pequeno', margin:[0,2,0,4]
      });
      body.push(kv(cf));
    }

    /* 5. Itens */
    body.push(secao(5,'Dos Itens, Quantidades e Estimativa de Valor'));
    if (state.itens.length) {
      let tot = 0;
      const tbody = [[
        { text:'Item', style:'th', alignment:'center' },
        { text:'Descrição', style:'th' },
        { text:'Un.', style:'th', alignment:'center' },
        { text:'Qtd.', style:'th', alignment:'right' },
        { text:'Vl. Unitário', style:'th', alignment:'right' },
        { text:'Vl. Total', style:'th', alignment:'right' }
      ]];

      state.itens.forEach((it, i) => {
        const t = num(it.quantidade) * num(it.valorUnit);
        tot += t;
        tbody.push([
          { text:String(i+1), style:'td', alignment:'center', noWrap:true },
          { text:it.descricao || '—', style:'td' },
          { text:it.unidade || 'UN', style:'td', alignment:'center', noWrap:true },
          { text:fmtNum(it.quantidade), style:'td', alignment:'right', noWrap:true },
          { text:brl(it.valorUnit), style:'td', alignment:'right', noWrap:true },
          { text:brl(t), style:'td', alignment:'right', noWrap:true }
        ]);
      });

      tbody.push([
        { text:'VALOR GLOBAL ESTIMADO', colSpan:5, style:'td', bold:true,
          alignment:'right', fillColor:'#eff9fb', fontSize:9 },
        {}, {}, {}, {},
        { text:brl(tot), style:'td', bold:true, alignment:'right',
          fillColor:'#eff9fb', fontSize:9, noWrap:true }
      ]);

      body.push({
        table:{ headerRows:1, widths:['auto','*','auto','auto','auto','auto'],
                body:tbody, dontBreakRows:true },
        layout: LAYOUT_TABELA,
        margin:[0,0,0,10]
      });
    } else {
      body.push(par('Nenhum item especificado.'));
    }

    /* 6. Dotação */
    body.push(secao(6,'Da Dotação Orçamentária'));
    body.push(par(p.dotacao));

    /* 7. Prazos */
    body.push(secao(7,'Dos Prazos, Vigência e Cronograma'));
    body.push(kv([
      ['Prazo de Vigência', p.vigencia],
      ['Prazo de Execução / Entrega', p.prazoExecucao]
    ]));
    if (p.cronograma) {
      body.push({ text:'Cronograma / Marcos de Execução', style:'rotulo', margin:[0,4,0,2] });
      body.push(par(p.cronograma));
    }

    /* 8. Execução */
    body.push(secao(8,'Do Modelo de Execução e Obrigações'));
    body.push(par(p.modeloExecucao));

    /* 9. Gestão */
    body.push(secao(9,'Do Modelo de Gestão e Fiscalização'));
    body.push(kv([
      ['Gestor do Contrato', state.equipe.gestor],
      ['Fiscal Técnico', state.equipe.fiscalTecnico],
      ['Fiscal Substituto', state.equipe.fiscalSubstituto],
      ['Fiscal Administrativo', state.equipe.fiscalAdministrativo]
    ]));
    if (p.modeloGestao) body.push(par(p.modeloGestao));

    /* 10. Pagamento */
    body.push(secao(10,'Das Condições de Pagamento'));
    body.push(par(p.pagamento));

    /* 11. Garantia */
    body.push(secao(11,'Da Garantia Contratual'));
    body.push(par(p.garantia));

    /* 12. Sanções */
    body.push(secao(12,'Das Sanções Administrativas'));
    body.push(par(p.sancoes));

    /* 13. Sustentabilidade e LGPD */
    body.push(secao(13,'Da Sustentabilidade e Proteção de Dados'));
    body.push({ text:'Sustentabilidade Ambiental', style:'rotulo', margin:[0,2,0,2] });
    body.push(par(p.sustentabilidade));
    body.push({ text:'Proteção de Dados Pessoais (LGPD)', style:'rotulo', margin:[0,2,0,2] });
    body.push(par(p.lgpd));

    /* 14. Disposições gerais */
    body.push(secao(14,'Das Disposições Gerais'));
    body.push(par(p.observacoes));

    /* 15. Compliance institucional */
    const regrasAtivas = state.regras.filter(r => r.ativa);
    body.push(secao(15,'Do Compliance Institucional Aplicado'));
    if (regrasAtivas.length) {
      body.push({
        table:{
          headerRows:1,
          widths:['*','18%','20%'],
          body:[
            [{ text:'Regra Institucional', style:'th' },
             { text:'Verificação', style:'th' },
             { text:'Fundamento', style:'th' }],
            ...regrasAtivas.map(r => ([
              { text:r.titulo, style:'td' },
              { text:`${r.tipo} · ${r.alvo}`, style:'td' },
              { text:r.fundamento || '—', style:'td' }
            ]))
          ],
          dontBreakRows:true
        },
        layout: LAYOUT_TABELA,
        margin:[0,0,0,8]
      });
    } else {
      body.push(par('Nenhuma regra institucional específica cadastrada para este órgão.'));
    }

    return body;
  };

  /* ─── BLOCO ③ · FOLHA DE APROVAÇÃO E VALIDAÇÃO ─── */
  const buildAssinaturas = () => {
    const dataHoje = new Date().toLocaleDateString('pt-BR');

    const blocoAssinatura = (titulo, nome, cargo, artRef) => ({
      table:{
        widths:['*'],
        body:[[{
          stack:[
            { text:titulo, fontSize:8, bold:true, color:CE, characterSpacing:0.5,
              margin:[0,0,0,22] },
            { text:' ' },
            {
              canvas:[{ type:'line', x1:0, y1:0, x2:220, y2:0, lineWidth:0.7, lineColor:'#334155' }],
              margin:[0, 26, 0, 0]
            },
            { text: nome || '_________________________', style:'assinaturaNome' },
            { text: cargo || '—', style:'assinaturaCargo' },
            { text: artRef || '', fontSize:7, color:CM, alignment:'center', margin:[0,2,0,0] },
            { text:' ', margin:[0, 8, 0, 0] },
            { text:`Data: ____/____/______`, fontSize:7.5, color:CM, alignment:'center' },
            { text:`Carimbo:`, fontSize:7.5, color:CM, alignment:'center', margin:[0,2,0,0] },
            { text:' ', margin:[0, 18, 0, 0] },
            {
              canvas:[{ type:'dashed', x1:0, y1:0, x2:220, y2:0, lineWidth:0.4, dash:{ length:2, space:2 }, lineColor:CINZA_LINHA }]
            }
          ],
          margin:[14, 14, 14, 14]
        }]]
      },
      layout:{
        hLineWidth: () => 0.6,
        vLineWidth: () => 0.6,
        hLineColor: () => CINZA_LINHA,
        vLineColor: () => CINZA_LINHA,
        paddingLeft: () => 0, paddingRight: () => 0,
        paddingTop: () => 0, paddingBottom: () => 0
      },
      margin:[0, 0, 0, 14]
    });

    return [
      /* Quebra de página — inicia nova folha dedicada */
      { text:'', pageBreak:'before' },

      /* Cabeçalho da folha */
      {
        table:{
          widths:['*'],
          body:[[{
            text:'FOLHA DE APROVAÇÃO E VALIDAÇÃO',
            fontSize:14, bold:true, color:'#fff',
            margin:[10, 8, 10, 8]
          }]]
        },
        layout:'noBorders',
        fillColor: CE,
        margin:[0, 0, 0, 6]
      },
      {
        text:'Termo de Referência — assinaturas das autoridades e agentes responsáveis, conforme Lei nº 14.133/2021.',
        fontSize:8.5, color:CM, alignment:'center', margin:[0, 0, 0, 22]
      },

      /* Identificação resumida do processo */
      {
        table:{
          widths:['32%','*'],
          body:[
            ['Processo', state.processo.numero || '—'],
            ['Objeto (resumo)',
              state.processo.objeto ? String(state.processo.objeto).slice(0, 180) : '—'],
            ['Órgão', state.orgao.nome || '—'],
            ['Data de Referência', dataHoje]
          ].map(([k,v]) => ([
            { text:k, style:'rotulo', fillColor:CINZA_FUNDO },
            { text:String(v), style:'valor' }
          ]))
        },
        layout: LAYOUT_TABELA,
        margin:[0, 0, 0, 24]
      },

      /* Blocos de assinatura */
      blocoAssinatura(
        'FISCAL TÉCNICO TITULAR',
        state.equipe.fiscalTecnico,
        'Fiscal do Contrato — Titular',
        'Designado nos termos do art. 117 da Lei nº 14.133/2021'
      ),
      blocoAssinatura(
        'FISCAL SUBSTITUTO',
        state.equipe.fiscalSubstituto,
        'Fiscal do Contrato — Substituto',
        'Designado nos termos do art. 117 da Lei nº 14.133/2021'
      ),
      blocoAssinatura(
        'GESTOR DO CONTRATO',
        state.equipe.gestor,
        'Gestor designado pela autoridade competente',
        'Designado nos termos do art. 117 da Lei nº 14.133/2021'
      ),
      blocoAssinatura(
        'AUTORIDADE COMPETENTE',
        state.orgao.responsavel,
        state.orgao.cargo || 'Autoridade Competente',
        'Aprova e ratifica o presente Termo de Referência'
      ),

      /* Rodapé explicativo da folha */
      {
        text:'A ausência de assinatura em qualquer dos campos acima implica pendência de instrução processual ' +
             'e impede o prosseguimento da contratação, nos termos do art. 72 da Lei nº 14.133/2021.',
        fontSize:7, color:CM, italics:true, alignment:'center', margin:[0, 14, 0, 0]
      }
    ];
  };

  /* ─── BLOCO ④ · AUTENTICAÇÃO E RASTREABILIDADE (última página) ─── */
  const buildAutenticacao = (issues, trace) => {
    const dataHora = new Date(trace.timestamp).toLocaleString('pt-BR');

    const checksBody = [[
      { text:'Severidade', style:'th' },
      { text:'Origem', style:'th' },
      { text:'Apontamento', style:'th' },
      { text:'Fundamento', style:'th' }
    ]];

    if (issues.length) {
      issues.forEach(i => checksBody.push([
        { text:(i.severidade || 'info').toUpperCase(), style:'td', noWrap:true },
        { text:i.origem || '—', style:'td', noWrap:true },
        { text:i.titulo || '—', style:'td' },
        { text:i.fundamento || '—', style:'td' }
      ]));
    } else {
      checksBody.push([
        { text:'—', style:'td' },
        { text:'—', style:'td' },
        { text:'Nenhuma inconformidade detectada.', style:'td' },
        { text:'—', style:'td' }
      ]);
    }

    return [
      /* Quebra de página — inicia nova folha dedicada */
      { text:'', pageBreak:'before' },

      /* Cabeçalho */
      {
        table:{
          widths:['*'],
          body:[[{
            text:'AUTENTICAÇÃO E RASTREABILIDADE',
            fontSize:14, bold:true, color:'#fff',
            margin:[10, 8, 10, 8]
          }]]
        },
        layout:'noBorders',
        fillColor: CE,
        margin:[0, 0, 0, 6]
      },
      {
        text:'Selo Digital OmniLicit, hash de integridade SHA-256 e matriz de auditoria cruzada com o LicitaAudit.',
        fontSize:8.5, color:CM, alignment:'center', margin:[0, 0, 0, 20]
      },

      /* Selo Digital em destaque */
      {
        table:{
          widths:['*'],
          body:[[{
            stack:[
              { text:'SELO DIGITAL OFICIAL', fontSize:8, bold:true,
                color:'#fff', characterSpacing:0.5, margin:[0, 0, 0, 8] },
              { text: trace.selo, fontSize:16, bold:true, color:'#5EEAD4',
                alignment:'center', margin:[0, 0, 0, 8] },
              { text:'Ecossistema OmniLicit · Módulo LicitaTR',
                fontSize:8, color:'#cbd5e1', alignment:'center' }
            ],
            fillColor:'#0b1220',
            margin:[16, 16, 16, 16]
          }]]
        },
        layout:'noBorders',
        margin:[0, 0, 0, 18]
      },

      /* Metadados de rastreabilidade */
      {
        table:{
          widths:['*'],
          body:[[{
            stack:[
              { text:'METADADOS DE AUDITORIA', style:'capaLabel', margin:[0,0,0,10] },
              {
                table:{
                  widths:['34%','*'],
                  body:[
                    ['TAG Única', trace.tag],
                    ['Ano de Referência', String(trace.ano)],
                    ['Hash SHA-256 (integridade)', trace.hash],
                    ['Timestamp de Geração', dataHora],
                    ['Módulo Emissor', 'LicitaTR v' + state.meta.versao],
                    ['Órgão Emissor', state.orgao.nome || '—'],
                    ['Auditoria Cruzada', 'LicitaAudit — verificação de integridade e conformidade'],
                    ['Versão do Documento', 'TR-1.0']
                  ].map(([k,v], idx) => ([
                    { text:k, style:'metaLabel',
                      fillColor: idx % 2 === 0 ? CINZA_FUNDO : '#ffffff',
                      margin:[8, 6, 6, 6] },
                    { text:String(v || '—'), style:'metaValor',
                      fillColor: idx % 2 === 0 ? CINZA_FUNDO : '#ffffff',
                      margin:[6, 6, 8, 6] }
                  ]))
                },
                layout:{
                  hLineWidth: () => 0.4,
                  vLineWidth: () => 0,
                  hLineColor: () => CINZA_LINHA,
                  paddingLeft: () => 0, paddingRight: () => 0,
                  paddingTop: () => 0, paddingBottom: () => 0
                }
              }
            ],
            margin:[14, 14, 14, 14]
          }]]
        },
        layout:{
          hLineWidth: () => 0.8,
          vLineWidth: () => 0.8,
          hLineColor: () => CINZA_LINHA,
          vLineColor: () => CINZA_LINHA,
          paddingLeft: () => 0, paddingRight: () => 0,
          paddingTop: () => 0, paddingBottom: () => 0
        },
        margin:[0, 0, 0, 18]
      },

      /* Matriz de conformidade / auditoria cruzada */
      {
        text:'MATRIZ DE CONFORMIDADE E AUDITORIA CRUZADA',
        fontSize:9, bold:true, color:CE, characterSpacing:0.5,
        margin:[0, 0, 0, 6]
      },
      {
        table:{
          headerRows:1,
          widths:['12%','16%','*','28%'],
          body: checksBody,
          dontBreakRows:true
        },
        layout: LAYOUT_TABELA,
        margin:[0, 0, 0, 18]
      },

      /* Aviso legal */
      {
        table:{
          widths:['*'],
          body:[[{
            stack:[
              { text:'AVISO LEGAL DE VALIDADE JURÍDICA', fontSize:8,
                bold:true, color:CE, characterSpacing:0.5, margin:[0, 0, 0, 6] },
              { text:
                'O presente Termo de Referência foi gerado eletronicamente pelo módulo LicitaTR do ecossistema OmniLicit ' +
                'e está autenticado pelo Selo Digital acima identificado, com hash SHA-256 de integridade calculado sobre ' +
                'o conteúdo canônico do documento. A validação da autenticidade pode ser realizada a qualquer tempo junto ' +
                'ao módulo LicitaAudit, mediante conferência do Selo Digital, do hash e do timestamp de emissão. ' +
                'A eventual divergência entre o hash registrado e o conteúdo apurado implica invalidação do documento, ' +
                'nos termos das boas práticas de governança e integridade documental.',
                fontSize:8, color:CT, alignment:'justify', lineHeight:1.5 },
              { text:
                'Documento emitido nos termos da Lei nº 14.133, de 1º de abril de 2021 — Nova Lei de Licitações e Contratos Administrativos.',
                fontSize:7, color:CM, italics:true, margin:[0, 8, 0, 0] }
            ],
            fillColor:CINZA_FUNDO,
            margin:[14, 14, 14, 14]
          }]]
        },
        layout:{
          hLineWidth: () => 0.6,
          vLineWidth: () => 0.6,
          hLineColor: () => CINZA_LINHA,
          vLineColor: () => CINZA_LINHA,
          paddingLeft: () => 0, paddingRight: () => 0,
          paddingTop: () => 0, paddingBottom: () => 0
        },
        margin:[0, 0, 0, 0]
      }
    ];
  };

  /* ─── MONTAGEM FINAL ─── */
  const build = async (issues, trace) => {
    const p = state.processo;
    const tipo = TIPOS[p.tipo];
    const dataEmissao = new Date().toLocaleString('pt-BR');
    const logo = state.orgao.logoDataUrl || await srcToDataUrl(Logo.FALLBACK);

    /* Composição dos 4 blocos com suas respectivas quebras */
    const capa         = buildCapa(logo, tipo, dataEmissao, trace);
    const corpo        = buildCorpo(tipo);
    const assinaturas  = buildAssinaturas();
    const autenticacao = buildAutenticacao(issues, trace);

    const content = [
      ...capa,
      ...corpo,
      ...assinaturas,
      ...autenticacao
    ];

    return {
      pageSize:'A4',
      pageMargins:[40, 62, 40, 58],
      info:{
        title: `Termo de Referência ${p.numero || ''}`.trim(),
        author: state.orgao.nome || 'OmniLicit',
        subject: p.objeto ? String(p.objeto).slice(0, 200) : 'Termo de Referência',
        keywords: `OmniLicit, LicitaTR, Lei 14.133/2021, ${trace.tag}`,
        creator: 'OmniLicit · LicitaTR'
      },
      styles: STYLES,
      defaultStyle:{ fontSize:9.5, color:CT },

      /* Cabeçalho fixo (todas as páginas, exceto quando sobrescrito) */
      header: (currentPage) => {
        if (currentPage === 1) return null; /* Capa sem cabeçalho */
        return {
          margin:[40, 18, 40, 0],
          columns:[
            logo ? { image:logo, width:22, margin:[0,0,8,0] } : { text:'', width:0 },
            {
              stack:[
                { text:state.orgao.nome || 'OmniLicit', fontSize:8, bold:true, color:CE },
                { text:`TR nº ${p.numero || '—'} · ${tipo.label}`, fontSize:7, color:CM }
              ],
              width:'*'
            },
            {
              text:'LicitaTR · OmniLicit',
              fontSize:7, color:'#94a3b8', alignment:'right', width:'auto'
            }
          ]
        };
      },

      /* Rodapé fixo com rastreabilidade */
      footer: (currentPage, total) => {
        if (currentPage === 1) return null; /* Capa sem rodapé */
        return {
          margin:[40, 8, 40, 0],
          stack:[
            { canvas:[{ type:'line', x1:0, y1:0, x2:515, y2:0,
                        lineWidth:0.6, lineColor:CINZA_LINHA }] },
            {
              columns:[
                { text:trace.selo, fontSize:6.5, bold:true, color:CE, width:'auto' },
                { text:`SHA-256: ${trace.hash}`, fontSize:5.8, color:'#475569',
                  width:'*', alignment:'center' }
              ],
              margin:[0, 5, 0, 2]
            },
            {
              columns:[
                {
                  text:`Auditoria cruzada LicitaAudit · Emitido em ${new Date(trace.timestamp).toLocaleString('pt-BR')} · ${state.orgao.nome || 'OmniLicit'}`,
                  fontSize:5.8, color:CM, width:'*'
                },
                {
                  text:`Página ${currentPage} de ${total}`,
                  fontSize:5.8, color:CM, alignment:'right', width:'auto'
                }
              ]
            }
          ]
        };
      },

      content
    };
  };

  return { build };
})();


/* ─────────── MÓDULO 10 · AÇÕES ─────────── */
const Actions = (() => {
  const KEY = 'omnilicit.tr.rascunho.v1';

  const gerarPdf = async () => {
    const btns = [$('#btnPdf'), $('#btnPdf2')].filter(Boolean);
    btns.forEach(b => b.disabled = true);
    try {
      const issues = Audit.run();
      const trace = await Trace.refresh();

      if (issues.some(i => i.severidade === 'critico')) {
        const ok = confirm(
          '⚠ Existem apontamentos CRÍTICOS na auditoria.\n\n' +
          'Deseja gerar o PDF mesmo assim? (o documento registrará as pendências no Anexo de Rastreabilidade)'
        );
        if (!ok) return;
      }

      const doc = await PdfBuilder.build(issues, trace);
      const nome = `TR_${(state.processo.numero || 'sem-numero').replace(/[^\w-]/g,'')}_${trace.tag}.pdf`;
      pdfMake.createPdf(doc).download(nome);
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar o PDF:\n' + err.message);
    } finally {
      btns.forEach(b => b.disabled = false);
    }
  };

  const exportarPacote = async () => {
    const issues = Audit.run();
    const trace = await Trace.refresh();

    const pacote = {
      modulo: 'LicitaTR',
      versao: state.meta.versao,
      ecossistema: 'OmniLicit',
      destinatario: 'LicitaAudit',
      selo: trace.selo, tag: trace.tag, hash: trace.hash, timestamp: trace.timestamp,
      orgao: { nome:state.orgao.nome, cnpj:state.orgao.cnpj, unidade:state.orgao.unidade },
      processo: {
        numero: state.processo.numero,
        tipo: state.processo.tipo,
        modalidade: state.processo.modalidade,
        objeto: state.processo.objeto
      },
      equipe: state.equipe,
      regrasAtivas: state.regras.filter(r => r.ativa),
      apontamentos: issues,
      resumo: {
        total: issues.length,
        criticos: issues.filter(i => i.severidade === 'critico').length,
        alertas: issues.filter(i => i.severidade === 'alerta').length,
        informativos: issues.filter(i => i.severidade === 'info').length
      }
    };

    download(
      new Blob([JSON.stringify(pacote, null, 2)], { type:'application/json' }),
      `LicitaAudit_${trace.tag}.json`
    );
  };

  const salvar = async () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      const t = await Trace.refresh();
      alert('✅ Rascunho salvo com sucesso.\n\nSelo: ' + t.selo);
    } catch (err) {
      alert('Não foi possível salvar: ' + err.message);
    }
  };

  const carregar = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      Object.assign(state, JSON.parse(raw));
      /* Garante a presença do campo fiscalSubstituto em rascunhos antigos */
      if (!state.equipe.fiscalSubstituto) state.equipe.fiscalSubstituto = '';
      return true;
    } catch (_) { return false; }
  };

  const bind = () => {
    $('#btnPdf')?.addEventListener('click', gerarPdf);
    $('#btnPdf2')?.addEventListener('click', gerarPdf);
    $('#btnAuditoria')?.addEventListener('click', exportarPacote);
    $('#btnSalvar')?.addEventListener('click', salvar);

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); salvar(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); gerarPdf(); }
    });
  };

  return { bind, gerarPdf, exportarPacote, carregar };
})();


/* ─────────── BOOTSTRAP ─────────── */
(function init() {
  Theme.init();
  Logo.bind();
  Logo.apply();

  if (!state.itens.length) {
    state.itens = [{ id:uid('item'), descricao:'', unidade:'UN', quantidade:'', valorUnit:'' }];
  }

  const restaurado = Actions.carregar();

  UI.renderTipos();
  UI.renderCampos();
  UI.renderItens();
  UI.renderRegras();
  UI.syncBindings();

  if (restaurado) Logo.apply();

  UI.bindGlobal();
  UI.bindEvents();
  Audit.bindNav();
  Importador.bind();
  Actions.bind();

  Audit.render();
  Trace.refresh();

  setInterval(() => Trace.schedule(), 30000);

  console.info('%cOmniLicit · LicitaTR v1.0.0',
    'color:#0D9488;font-weight:bold',
    '— módulo de Termo de Referência inicializado com arquitetura PDF em 4 blocos.');
})();
