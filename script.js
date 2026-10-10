/* ══════════════════════════════════════════════════════════════
   OmniLicit · LicitaTR — Módulo Termo de Referência (Lei 14.133/2021)
   ══════════════════════════════════════════════════════════════ */

/* ─────────── MÓDULO 0 · UTILITÁRIOS ─────────── */
const Utils = (() => {
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const uid = (p = 'id') =>
    `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

  const getPath = (obj, path) =>
    String(path).split('.').reduce((a, k) => (a == null ? undefined : a[k]), obj);

  const setPath = (obj, path, value) => {
    const keys = String(path).split('.');
    const last = keys.pop();
    const t = keys.reduce((a, k) => (a[k] = a[k] || {}), obj);
    t[last] = value;
  };

  const debounce = (fn, ms = 260) => {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  const esc = (s = '') => String(s).replace(/[&<>"']/g,
    c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const num = (v) => {
    if (typeof v === 'number') return v;
    const n = Number(String(v ?? '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };

  const brl = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const fmtNum = (v) => num(v).toLocaleString('pt-BR',
    { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const sha256 = async (str) => {
    try {
      if (window.crypto?.subtle) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (_) {}
    // Fallback determinístico para file:// sem secure context
    let h1 = 0x811c9dc5, h2 = 0x1000193;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = (h1 ^ c) * 16777619 >>> 0;
      h2 = (h2 + c * (i + 1)) >>> 0;
    }
    return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(4).slice(0, 64);
  };

  const canon = (v) => {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object')
      return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  };

  const download = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const fileToDataUrl = (file) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });

  const srcToDataUrl = async (src) => {
    if (!src) return null;
    if (src.startsWith('data:')) return src;
    try {
      const r = await fetch(src, { cache: 'force-cache' });
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
        sha256, canon, download, fileToDataUrl, srcToDataUrl } = Utils;


/* ─────────── MÓDULO 1 · TIPOS DE PROCESSO ─────────── */
const TIPOS = {
  bens_comuns: {
    label: 'Aquisição de Bens Comuns',
    icone: '📦',
    fundamento: 'Lei nº 14.133/2021, arts. 6º, XIII; 40 e 41 — bens de prateleira, especificação usual de mercado.',
    campos: [
      { path: 'processo.prazoEntrega',       label: 'Prazo de Entrega',        ph: 'Ex.: 30 (trinta) dias corridos' },
      { path: 'processo.localEntrega',       label: 'Local de Entrega',        ph: 'Ex.: Almoxarifado Central' },
      { path: 'processo.garantiaBens',       label: 'Garantia dos Bens',       ph: 'Ex.: 12 meses contra vícios de fabricação' },
      { path: 'processo.amostra',            label: 'Amostra / Prova de Conceito', tipo: 'select',
        opcoes: ['Não exigida', 'Exigida do licitante provisoriamente classificado (art. 41, II)'] },
      { path: 'processo.assistenciaTecnica', label: 'Assistência Técnica',     ph: 'Ex.: 12 meses de suporte on-site' },
      { path: 'processo.frete',              label: 'Frete / Logística',       ph: 'Ex.: CIF — entrega franqueada, sem ônus ao órgão' }
    ]
  },
  servicos_dedicacao: {
    label: 'Serviços Continuados com Dedicação Exclusiva',
    icone: '👷',
    fundamento: 'Lei nº 14.133/2021, arts. 6º, XV; 57, II; 121 e ss. — regime de dedicação exclusiva de mão de obra.',
    campos: [
      { path: 'processo.regimeExecucao',      label: 'Regime de Execução',        ph: 'Ex.: Empreitada por preço unitário' },
      { path: 'processo.convencaoColetiva',   label: 'Convenção Coletiva Aplicável', ph: 'Ex.: CCT SINDLIMP 2025' },
      { path: 'processo.produtividade',       label: 'Produtividade / Postos',    ph: 'Ex.: 4 postos de 44h semanais' },
      { path: 'processo.planilhaCustos',      label: 'Planilha de Custos',        ph: 'Ex.: Anexo I — planilha referencial com BDI e encargos' },
      { path: 'processo.reajuste',            label: 'Reajuste / Repactuação',    ph: 'Ex.: Repactuação anual vinculada ao ACT (art. 135)' },
      { path: 'processo.transicaoContratual', label: 'Transição Contratual',      ph: 'Ex.: 30 dias de transição sem interrupção' }
    ]
  },
  obras_engenharia: {
    label: 'Obras e Serviços de Engenharia',
    icone: '🏗️',
    fundamento: 'Lei nº 14.133/2021, arts. 6º, XXI; 45 a 49 — regime de execução e matriz de riscos obrigatória.',
    campos: [
      { path: 'processo.art',              label: 'ART / RRT',                    ph: 'Ex.: ART CREA nº 0000000' },
      { path: 'processo.bdi',              label: 'BDI Adotado',                  ph: 'Ex.: 22,45% (Acórdão TCU 2622/2013)' },
      { path: 'processo.cronogramaFisico', label: 'Cronograma Físico-Financeiro', ph: 'Ex.: Anexo II — 4 etapas em 180 dias' },
      { path: 'processo.matrizRiscos',     label: 'Matriz de Riscos',             ph: 'Ex.: Anexo III — alocação de riscos art. 22, §3º' },
      { path: 'processo.medicoes',         label: 'Medições / Boletim',           ph: 'Ex.: Medição mensal conforme art. 140' },
      { path: 'processo.crea',             label: 'Registro no CREA/CAU',         ph: 'Ex.: Matrícula CEI nº ...' }
    ]
  },
  dispensa_inexig: {
    label: 'Dispensa / Inexigibilidade de Licitação',
    icone: '⚖️',
    fundamento: 'Lei nº 14.133/2021, arts. 74 e 75 — contratação direta com instrução processual obrigatória.',
    campos: [
      { path: 'processo.fundamentoLegal',  label: 'Fundamento Legal',              tipo: 'select',
        opcoes: [
          'Art. 75, I — baixo valor (obras e engenharia)',
          'Art. 75, II — baixo valor (outros bens e serviços)',
          'Art. 75, III — emergência ou calamidade',
          'Art. 75, IV — licitação deserta/fracassada',
          'Art. 74, I — fornecedor exclusivo',
          'Art. 74, II — notória especialização',
          'Art. 74, III — profissional do setor artístico',
          'Outro fundamento legal'
        ] },
      { path: 'processo.razaoEscolha',     label: 'Razão da Escolha do Fornecedor', ph: 'Justificativa objetiva da escolha' },
      { path: 'processo.pesquisaPrecos',   label: 'Pesquisa de Preços',            ph: 'Ex.: 3 orçamentos + Painel de Preços + IN 65/2021' },
      { path: 'processo.ratificacao',      label: 'Ratificação',                   ph: 'Ex.: Ratificado pela autoridade competente' },
      { path: 'processo.contratacaoDireta', label: 'Observância do art. 72',       ph: 'Ex.: Instrução com ETP, estimativa, parecer jurídico' }
    ]
  }
};


/* ─────────── MÓDULO 2 · ESTADO ─────────── */
const state = {
  meta: { versao: '1.0.0', criadoEm: new Date().toISOString() },
  orgao: { nome: '', cnpj: '', unidade: '', responsavel: '', cargo: '', logoDataUrl: null },
  regras: [],
  processo: {
    numero: '', tipo: 'bens_comuns', modalidade: 'Pregão Eletrônico', regime: '',
    objeto: '', justificativa: '', especificacoes: '', dotacao: '',
    vigencia: '', prazoExecucao: '', cronograma: '',
    modeloGestao: '', modeloExecucao: '', pagamento: '', garantia: '',
    sancoes: '', sustentabilidade: '', lgpd: '', observacoes: ''
  },
  equipe: { gestor: '', fiscalTecnico: '', fiscalAdministrativo: '' },
  itens: []
};


/* ─────────── MÓDULO 3 · TEMA ─────────── */
const Theme = (() => {
  const KEY = 'omnilicit.theme';
  const html = document.documentElement;

  const apply = (mode) => {
    html.setAttribute('data-theme', mode);
    try { localStorage.setItem(KEY, mode); } catch (_) {}
  };

  const current = () => html.getAttribute('data-theme') || 'dark';

  const toggle = () => apply(current() === 'dark' ? 'light' : 'dark');

  const init = () => {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (_) {}
    apply(saved === 'light' ? 'light' : 'dark');
    $('#btnTheme')?.addEventListener('click', toggle);
  };

  return { init, apply, toggle, current };
})();


/* ─────────── MÓDULO 4 · LOGO ─────────── */
const LogoManager = (() => {
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
        e.target.value = '';
        return;
      }
      state.orgao.logoDataUrl = await fileToDataUrl(f);
      apply();
      Audit.schedule();
    });

    $('#btnLogoReset')?.addEventListener('click', () => {
      state.orgao.logoDataUrl = null;
      const i = $('#logoInput');
      if (i) i.value = '';
      apply();
    });
  };

  return { apply, bind, FALLBACK };
})();


/* ─────────── MÓDULO 5 · AUDITORIA ─────────── */
const Audit = (() => {
  const CAMPOS_TEXTO = [
    'objeto', 'justificativa', 'especificacoes', 'modeloExecucao', 'modeloGestao',
    'pagamento', 'garantia', 'sancoes', 'sustentabilidade', 'lgpd',
    'observacoes', 'cronograma', 'frete', 'reajuste', 'transicaoContratual',
    'matrizRiscos', 'pesquisaPrecos', 'razaoEscolha', 'contratacaoDireta'
  ];

  const collectFullText = () => {
    const p = state.processo;
    const partes = CAMPOS_TEXTO.map(k => p[k]).filter(Boolean);
    state.itens.forEach(i => { if (i.descricao) partes.push(i.descricao); });
    return partes.join('\n');
  };

  const NATIVAS = [
    { id: 'n-objeto',
      test: () => !state.processo.objeto.trim() || state.processo.objeto.trim().length < 20,
      issue: { severidade: 'critico', titulo: 'Objeto da contratação não definido',
        mensagem: 'O objeto deve ser descrito de forma precisa, suficiente e clara (art. 6º, XXIII e art. 40, I).',
        fundamento: 'Lei nº 14.133/2021, art. 40, I', alvo: 'processo.objeto' } },
    { id: 'n-justificativa',
      test: () => state.processo.justificativa.trim().length < 80,
      issue: { severidade: 'alerta', titulo: 'Justificativa insuficiente',
        mensagem: 'A motivação deve demonstrar o problema público e o nexo causal com a contratação (art. 18, §1º, I).',
        fundamento: 'Lei nº 14.133/2021, art. 18, §1º, I', alvo: 'processo.justificativa' } },
    { id: 'n-dotacao',
      test: () => !state.processo.dotacao.trim(),
      issue: { severidade: 'critico', titulo: 'Dotação orçamentária não informada',
        mensagem: 'É obrigatória a indicação da dotação orçamentária e do recurso financeiro (art. 18, §1º, VI).',
        fundamento: 'Lei nº 14.133/2021, art. 18, §1º, VI', alvo: 'processo.dotacao' } },
    { id: 'n-itens',
      test: () => state.itens.length === 0,
      issue: { severidade: 'critico', titulo: 'Nenhum item/quantitativo especificado',
        mensagem: 'O TR deve conter a quantidade e a estimativa do valor de cada item (art. 40, IV e VI).',
        fundamento: 'Lei nº 14.133/2021, art. 40, IV', alvo: 'itens' } },
    { id: 'n-itens-sem-valor',
      test: () => state.itens.length > 0 && state.itens.some(i => num(i.valorUnit) <= 0),
      issue: { severidade: 'alerta', titulo: 'Itens sem valor unitário estimado',
        mensagem: 'A estimativa de preços deve ser apurada previamente (art. 23) e registrada por item.',
        fundamento: 'Lei nº 14.133/2021, art. 23', alvo: 'itens' } },
    { id: 'n-prazo',
      test: () => !state.processo.vigencia.trim(),
      issue: { severidade: 'alerta', titulo: 'Prazo de vigência não definido',
        mensagem: 'Informar o prazo de vigência contratual e, se for o caso, sua prorrogação (art. 105 e ss.).',
        fundamento: 'Lei nº 14.133/2021, art. 105', alvo: 'processo.vigencia' } },
    { id: 'n-fiscalizacao',
      test: () => !state.equipe.gestor.trim() && !state.equipe.fiscalTecnico.trim(),
      issue: { severidade: 'alerta', titulo: 'Equipe de fiscalização não designada',
        mensagem: 'O TR deve indicar o gestor e os fiscais do contrato (art. 40, §1º e art. 117).',
        fundamento: 'Lei nº 14.133/2021, art. 117', alvo: 'equipe.gestor' } },
    { id: 'n-pagamento',
      test: () => !state.processo.pagamento.trim(),
      issue: { severidade: 'alerta', titulo: 'Condições de pagamento ausentes',
        mensagem: 'Definir prazo, forma e critérios de pagamento, respeitada a ordem cronológica (art. 92, V e art. 141).',
        fundamento: 'Lei nº 14.133/2021, art. 92, V', alvo: 'processo.pagamento' } },
    { id: 'n-sancoes',
      test: () => !state.processo.sancoes.trim(),
      issue: { severidade: 'info', titulo: 'Sanções administrativas não detalhadas',
        mensagem: 'Recomenda-se detalhar as infrações e sanções (arts. 155 a 163).',
        fundamento: 'Lei nº 14.133/2021, arts. 155-163', alvo: 'processo.sancoes' } },
    { id: 'n-sustentabilidade',
      test: () => !state.processo.sustentabilidade.trim(),
      issue: { severidade: 'info', titulo: 'Critérios de sustentabilidade não previstos',
        mensagem: 'A contratação deve observar critérios de sustentabilidade ambiental (art. 5º e art. 40, X).',
        fundamento: 'Lei nº 14.133/2021, art. 5º', alvo: 'processo.sustentabilidade' } },
    { id: 'n-lgpd',
      test: () => !state.processo.lgpd.trim(),
      issue: { severidade: 'info', titulo: 'Cláusula de proteção de dados (LGPD) ausente',
        mensagem: 'Recomenda-se prever o tratamento de dados pessoais conforme a Lei nº 13.709/2018.',
        fundamento: 'Lei nº 13.709/2018 (LGPD)', alvo: 'processo.lgpd' } },
    { id: 'n-obras-matriz',
      test: () => state.processo.tipo === 'obras_engenharia' && !String(state.processo.matrizRiscos || '').trim(),
      issue: { severidade: 'critico', titulo: 'Matriz de riscos ausente (obras e engenharia)',
        mensagem: 'Nas contratações de obras e serviços de engenharia é obrigatória a matriz de alocação de riscos.',
        fundamento: 'Lei nº 14.133/2021, art. 22, §3º e art. 103', alvo: 'processo.matrizRiscos' } },
    { id: 'n-dedicacao-cct',
      test: () => state.processo.tipo === 'servicos_dedicacao' && !String(state.processo.convencaoColetiva || '').trim(),
      issue: { severidade: 'alerta', titulo: 'Convenção coletiva não indicada (dedicação exclusiva)',
        mensagem: 'Indicar a CCT aplicável e os custos de mão de obra com repactuação vinculada ao ACT.',
        fundamento: 'Lei nº 14.133/2021, art. 121 e ss.', alvo: 'processo.convencaoColetiva' } },
    { id: 'n-dispensa-fundamento',
      test: () => state.processo.tipo === 'dispensa_inexig' && !String(state.processo.fundamentoLegal || '').trim(),
      issue: { severidade: 'critico', titulo: 'Fundamento legal da contratação direta ausente',
        mensagem: 'A contratação direta exige enquadramento expresso em hipótese legal (arts. 74 e 75).',
        fundamento: 'Lei nº 14.133/2021, arts. 74 e 75', alvo: 'processo.fundamentoLegal' } },
    { id: 'n-dispensa-precos',
      test: () => state.processo.tipo === 'dispensa_inexig' && !String(state.processo.pesquisaPrecos || '').trim(),
      issue: { severidade: 'alerta', titulo: 'Pesquisa de preços não informada',
        mensagem: 'A instrução do processo de contratação direta exige estimativa de preços (art. 72, II).',
        fundamento: 'Lei nº 14.133/2021, art. 72, II', alvo: 'processo.pesquisaPrecos' } }
  ];

  const run = () => {
    const issues = [];
    const full = collectFullText();
    const lowerFull = full.toLowerCase();

    /* Regras institucionais */
    state.regras.filter(r => r.ativa).forEach(r => {
      const raw = r.alvo === 'full' ? full : String(getPath(state, r.alvo) ?? '');
      const hay = raw.toLowerCase();
      const needle = String(r.valor || '').toLowerCase();
      let bad = false, detail = '';

      switch (r.tipo) {
        case 'contem':
          bad = !!needle && !hay.includes(needle);
          detail = bad ? `Cláusula exigida ausente: "${r.valor}"` : '';
          break;
        case 'nao_contem':
          bad = !!needle && hay.includes(needle);
          detail = bad ? `Termo vedado encontrado: "${r.valor}"` : '';
          break;
        case 'regex':
          try { bad = !!r.valor && new RegExp(r.valor, 'i').test(raw); } catch (_) {}
          detail = bad ? `Padrão vedado identificado: /${r.valor}/i` : '';
          break;
        case 'campo_vazio':
          bad = !raw.trim();
          detail = bad ? 'Campo obrigatório pela norma interna não preenchido' : '';
          break;
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
      try { if (n.test()) issues.push({ origem: 'Lei nº 14.133/2021', ...n.issue }); }
      catch (_) {}
    });

    const peso = { critico: 0, alerta: 1, info: 2 };
    issues.sort((a, b) => (peso[a.severidade] ?? 3) - (peso[b.severidade] ?? 3));
    return issues;
  };

  const SEV_BADGE = { critico: 'badge--crit', alerta: 'badge--alert', info: 'badge--info' };
  const SEV_LABEL = { critico: 'Crítico', alerta: 'Alerta', info: 'Info' };

  const render = () => {
    const issues = run();
    const c = { critico: 0, alerta: 0, info: 0 };
    issues.forEach(i => { c[i.severidade] = (c[i.severidade] || 0) + 1; });

    $('#cntCritico').textContent = c.critico;
    $('#cntAlerta').textContent  = c.alerta;
    $('#cntInfo').textContent    = c.info;
    $('#auditTotal').textContent = issues.length;

    const score = Math.max(0, 100 - c.critico * 12 - c.alerta * 6 - c.info * 2);
    const scoreEl = $('#auditScore');
    const bar = $('#auditBar');
    scoreEl.textContent = score + '%';
    scoreEl.className = 'badge ' + (score >= 85 ? 'badge--ok' : score >= 60 ? 'badge--alert' : 'badge--crit');
    bar.style.width = score + '%';
    bar.className = 'progress__bar ' + (score >= 85 ? 'progress__bar--ok' : score >= 60 ? 'progress__bar--warn' : 'progress__bar--crit');

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
          <span class="badge ${SEV_BADGE[i.severidade] || 'badge--info'}">${SEV_LABEL[i.severidade] || 'Info'}</span>
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

  const bindNavigation = () => {
    $('#auditList')?.addEventListener('click', (e) => {
      const card = e.target.closest('[data-goto]');
      if (!card) return;
      const alvo = card.dataset.goto;
      if (!alvo || alvo === 'itens') {
        $('#itensBody')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const input = document.querySelector(`[data-bind="${alvo}"]`);
      if (input) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus({ preventScroll: true });
        input.style.boxShadow = '0 0 0 3px var(--primary)';
        setTimeout(() => { input.style.boxShadow = ''; }, 1400);
      }
    });
  };

  const schedule = debounce(() => { render(); Trace.schedule(); }, 240);
  return { run, render, schedule, bindNavigation, collectFullText };
})();


/* ─────────── MÓDULO 6 · RASTREABILIDADE ─────────── */
const Trace = (() => {
  let current = { hash: '', tag: '', ano: '', selo: 'OMNILICIT::TR::—::—', timestamp: new Date().toISOString() };

  const snapshot = () => ({
    orgao: { nome: state.orgao.nome, cnpj: state.orgao.cnpj, unidade: state.orgao.unidade },
    processo: state.processo,
    equipe: state.equipe,
    itens: state.itens,
    regras: state.regras.filter(r => r.ativa).map(r => ({
      titulo: r.titulo, tipo: r.tipo, alvo: r.alvo, valor: r.valor, severidade: r.severidade
    })),
    meta: { versao: state.meta.versao }
  });

  const compute = async () => {
    const h = await sha256(canon(snapshot()));
    const ano = new Date().getFullYear();
    const tag = `TR-${ano}-${h.slice(0, 8).toUpperCase()}`;
    current = { hash: h, tag, ano, selo: `OMNILICIT::TR::${tag}::${ano}`, timestamp: new Date().toISOString() };
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

  const renderTipoSelector = () => {
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
        renderTipoSelector();
        renderCamposDinamicos();
        Audit.schedule();
      });
    });
  };

  const renderCamposDinamicos = () => {
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
          <td><input class="input--sm" data-item="${i}" data-field="descricao" value="${esc(it.descricao || '')}" placeholder="Descrição do item" /></td>
          <td><input class="input--sm" data-item="${i}" data-field="unidade" value="${esc(it.unidade || '')}" placeholder="UN" style="text-align:center" /></td>
          <td><input class="input--sm" data-item="${i}" data-field="quantidade" value="${esc(it.quantidade || '')}" inputmode="decimal" placeholder="0" style="text-align:right" /></td>
          <td><input class="input--sm" data-item="${i}" data-field="valorUnit" value="${esc(it.valorUnit || '')}" inputmode="decimal" placeholder="0,00" style="text-align:right" /></td>
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

  const SEV_BADGE = { critico: 'badge--crit', alerta: 'badge--alert', info: 'badge--info' };

  const renderRegras = () => {
    $('#regrasCount').textContent = state.regras.length;
    const box = $('#regrasList');

    if (!state.regras.length) {
      box.innerHTML = `<p class="hint" style="padding:.75rem;text-align:center">
        Nenhuma regra institucional cadastrada. Adicione regras específicas do seu órgão abaixo.
      </p>`;
      return;
    }

    box.innerHTML = state.regras.map((r, i) => `
      <div class="regra-item ${r.ativa ? '' : 'is-off'}">
        <input type="checkbox" class="regra-item__check" data-regra-ativa="${i}" ${r.ativa ? 'checked' : ''} />
        <div class="regra-item__body">
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
            <span class="badge ${SEV_BADGE[r.severidade] || 'badge--info'}">${r.severidade}</span>
            <p class="regra-item__title">${esc(r.titulo)}</p>
          </div>
          <p class="regra-item__desc">${esc(r.mensagem || '')}</p>
          <code class="regra-item__meta">${esc(r.tipo)} · ${esc(r.alvo)} · ${esc(r.valor || '—')}${r.fundamento ? ' · ' + esc(r.fundamento) : ''}</code>
        </div>
        <button class="regra-item__del" data-regra-del="${i}" title="Remover">✕</button>
      </div>
    `).join('');
  };

  const bindGlobalInputs = () => {
    const handler = (e) => {
      const t = e.target;
      const bind = t.dataset?.bind;
      if (bind) {
        const v = t.type === 'checkbox' ? t.checked : t.value;
        setPath(state, bind, v);
        if (bind === 'orgao.nome') $('#hdrOrgao').textContent = v || 'Órgão não informado';
        Audit.schedule();
        return;
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
      state.itens.push({ id: uid('item'), descricao: '', unidade: 'UN', quantidade: '', valorUnit: '' });
      renderItens();
      Audit.schedule();
    });

    $('#btnClearItens')?.addEventListener('click', () => {
      if (!state.itens.length) return;
      if (!confirm('Remover todos os itens?')) return;
      state.itens = [];
      renderItens();
      Audit.schedule();
    });

    $('#itensBody')?.addEventListener('click', (e) => {
      const del = e.target.closest('[data-item-del]');
      if (!del) return;
      state.itens.splice(Number(del.dataset.itemDel), 1);
      renderItens();
      Audit.schedule();
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
        mensagem: `Regra institucional ativa — verificação do tipo "${fd.get('tipo')}" sobre "${fd.get('alvo')}".`,
        ativa: true
      });
      e.target.reset();
      renderRegras();
      Audit.schedule();
    });

    $('#btnRegrasLimpar')?.addEventListener('click', () => {
      if (!state.regras.length) return;
      if (!confirm('Remover todas as regras institucionais?')) return;
      state.regras = [];
      renderRegras();
      Audit.schedule();
    });

    $('#regrasList')?.addEventListener('change', (e) => {
      const i = e.target.dataset?.regraAtiva;
      if (i === undefined) return;
      state.regras[Number(i)].ativa = e.target.checked;
      renderRegras();
      Audit.schedule();
    });

    $('#regrasList')?.addEventListener('click', (e) => {
      const del = e.target.closest('[data-regra-del]');
      if (!del) return;
      state.regras.splice(Number(del.dataset.regraDel), 1);
      renderRegras();
      Audit.schedule();
    });
  };

  const syncBindingsFromState = () => {
    $$('[data-bind]').forEach(inp => {
      const v = getPath(state, inp.dataset.bind);
      if (inp.type === 'checkbox') inp.checked = !!v;
      else if (document.activeElement !== inp) inp.value = v ?? '';
    });
    $('#hdrOrgao').textContent = state.orgao.nome || 'Órgão não informado';
  };

  return { renderTipoSelector, renderCamposDinamicos, renderItens, updateTotais,
           renderRegras, bindGlobalInputs, bindEvents, syncBindingsFromState };
})();


/* ─────────── MÓDULO 8 · IMPORTADOR ─────────── */
const Importador = (() => {
  const log = (msg, tipo = 'ok') => {
    const box = $('#importLog');
    box.classList.remove('hidden');
    box.className = 'import-log is-' + tipo;
    box.textContent = msg;
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

  const applyPayload = (data) => {
    const aplicados = [];
    const raiz = data.dfd || data.etp || data.documento || data;

    const mapa = [
      { path: 'processo.objeto',        keys: ['objeto', 'objetoContratacao', 'descricaoObjeto', 'demanda', 'objeto.descricao'] },
      { path: 'processo.justificativa', keys: ['justificativa', 'motivacao', 'justificativaNecessidade', 'necessidade'] },
      { path: 'processo.especificacoes',keys: ['especificacoes', 'especificacoesTecnicas', 'solucao', 'descricaoSolucao', 'requisitos'] },
      { path: 'processo.dotacao',       keys: ['dotacao', 'dotacaoOrcamentaria', 'classificacaoOrcamentaria', 'fonteRecurso', 'programaTrabalho'] },
      { path: 'processo.vigencia',      keys: ['vigencia', 'prazoVigencia', 'duracaoContrato'] },
      { path: 'processo.prazoExecucao', keys: ['prazoExecucao', 'prazoEntrega', 'prazoExecucaoDias', 'prazo'] },
      { path: 'processo.cronograma',    keys: ['cronograma', 'cronogramaExecucao', 'etapas'] },
      { path: 'equipe.gestor',          keys: ['equipe.gestor', 'gestor', 'gestorContrato'] },
      { path: 'equipe.fiscalTecnico',   keys: ['equipe.fiscalTecnico', 'fiscalTecnico', 'fiscal'] },
      { path: 'equipe.fiscalAdministrativo', keys: ['equipe.fiscalAdministrativo', 'fiscalAdministrativo'] },
      { path: 'orgao.nome',             keys: ['orgao.nome', 'orgao', 'unidadeAdministrativa', 'entidade'] },
      { path: 'processo.numero',        keys: ['processo.numero', 'numeroProcesso', 'protocolo', 'id'] },
      { path: 'processo.modalidade',    keys: ['modalidade', 'processo.modalidade'] }
    ];

    mapa.forEach(m => {
      const v = pick(raiz, m.keys);
      if (v !== undefined) {
        setPath(state, m.path, typeof v === 'object' ? JSON.stringify(v) : String(v));
        aplicados.push(m.path);
      }
    });

    const itensRaw = pick(raiz, ['itens', 'quantidades', 'itensDemandados', 'produtos', 'lotes', 'objeto.itens']);
    if (Array.isArray(itensRaw) && itensRaw.length) {
      state.itens = itensRaw.map(i => ({
        id: uid('item'),
        descricao: String(pick(i, ['descricao', 'item', 'nome', 'especificacao', 'objeto']) ?? ''),
        unidade: String(pick(i, ['unidade', 'un', 'unidadeMedida']) ?? 'UN'),
        quantidade: String(pick(i, ['quantidade', 'qtd', 'qtde']) ?? ''),
        valorUnit: String(pick(i, ['valorUnit', 'valorUnitario', 'precoUnitario', 'valor']) ?? '')
      }));
      aplicados.push(`itens (${state.itens.length})`);
    }

    const tipoHint = String(pick(raiz, ['tipo', 'tipoContratacao', 'natureza']) ?? '').toLowerCase();
    if (tipoHint) {
      if (/obra|engenharia/.test(tipoHint))              state.processo.tipo = 'obras_engenharia';
      else if (/dedica|mao de obra|mão de obra|continuad/.test(tipoHint)) state.processo.tipo = 'servicos_dedicacao';
      else if (/dispensa|inexig/.test(tipoHint))         state.processo.tipo = 'dispensa_inexig';
      else if (/bem|aquisic|compr/.test(tipoHint))       state.processo.tipo = 'bens_comuns';
      aplicados.push('processo.tipo');
    }

    return aplicados;
  };

  const extrairTextoPdf = async (file) => {
    if (!window.pdfjsLib) throw new Error('pdf.js não disponível neste ambiente.');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let txt = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const c = await page.getTextContent();
      txt += c.items.map(it => it.str).join(' ') + '\n';
    }
    return txt;
  };

  const heuristicaPdf = (txt) => {
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

  const finalize = (aplicados, nome) => {
    UI.syncBindingsFromState();
    UI.renderTipoSelector();
    UI.renderCamposDinamicos();
    UI.renderItens();
    Audit.schedule();

    if (!aplicados.length) {
      log(`⚠ "${nome}" lido, mas nenhum campo reconhecido foi localizado.\nVerifique se o JSON segue o schema do LicitaReq / LicitaETP.`, 'warn');
      return;
    }
    log(`✅ Importação concluída a partir de "${nome}"\nCampos populados:\n  • ${aplicados.join('\n  • ')}`, 'ok');
  };

  const processFile = async (file) => {
    const nome = file.name.toLowerCase();
    try {
      if (nome.endsWith('.json')) {
        const data = JSON.parse(await file.text());
        finalize(applyPayload(data), file.name);
        return;
      }
      if (nome.endsWith('.pdf')) {
        log(`⏳ Lendo "${file.name}" com pdf.js…`, 'warn');
        const txt = await extrairTextoPdf(file);
        finalize(applyPayload(heuristicaPdf(txt)), file.name);
        return;
      }
      log(`⚠ Arquivo "${file.name}" ignorado. Formatos aceitos: .json e .pdf`, 'warn');
    } catch (err) {
      log(`❌ Falha ao processar "${file.name}":\n${err.message}`, 'err');
    }
  };

  const bind = () => {
    const dz = $('#dropzone');
    const input = $('#fileImport');

    dz?.addEventListener('click', () => input.click());
    dz?.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') input.click(); });

    input?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      for (const f of files) await processFile(f);
      input.value = '';
    });

    ['dragenter', 'dragover'].forEach(ev =>
      dz?.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('is-hot'); }));
    ['dragleave', 'drop'].forEach(ev =>
      dz?.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('is-hot'); }));

    dz?.addEventListener('drop', async (e) => {
      const files = Array.from(e.dataTransfer?.files || []);
      for (const f of files) await processFile(f);
    });

    $('#btnImportDemo')?.addEventListener('click', () => {
      const demo = {
        origem: 'LicitaReq',
        tipo: 'bens_comuns',
        orgao: '',
        numeroProcesso: '',
        modalidade: 'Pregão Eletrônico',
        objeto: 'Aquisição de bens permanentes para atender às unidades administrativas, conforme quantitativos e especificações detalhadas no Anexo I.',
        justificativa: 'A demanda decorre da necessidade de reposição de itens inservíveis e do atendimento às requisições das unidades finalísticas, sendo a solução mais adequada para assegurar a continuidade administrativa.',
        dotacao: '02.001.04.122.0002.2003.33903000 — Fonte 01 — Exercício corrente',
        prazoExecucao: '30 (trinta) dias corridos',
        vigencia: '12 (doze) meses',
        itens: [
          { descricao: 'Item de exemplo — descrever conforme catálogo', unidade: 'UN', quantidade: 10, valorUnit: 250.00 }
        ]
      };
      finalize(applyPayload(demo), 'exemplo-licitareq.json');
    });
  };

  return { bind };
})();


/* ─────────── MÓDULO 9 · GERADOR PDF ─────────── */
const PdfBuilder = (() => {
  const COR_PRIMARIA = '#155D78';
  const COR_TEXTO = '#1e293b';
  const COR_MUTED = '#64748b';

  const LAYOUT = {
    hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0.9 : 0.4,
    vLineWidth: () => 0,
    hLineColor: (i, node) => (i === 0 || i === node.table.body.length) ? COR_PRIMARIA : '#cbd5e1',
    paddingLeft: () => 7, paddingRight: () => 7,
    paddingTop: () => 6, paddingBottom: () => 6
  };

  const STYLES = {
    tituloDoc: { fontSize: 16, bold: true, color: COR_PRIMARIA, alignment: 'center', margin: [0, 4, 0, 2] },
    subtitulo: { fontSize: 9, color: COR_MUTED, alignment: 'center', margin: [0, 0, 0, 14] },
    body: { fontSize: 9.5, color: COR_TEXTO, alignment: 'justify', lineHeight: 1.35, margin: [0, 4, 0, 8] },
    rotulo: { fontSize: 9, bold: true, color: COR_PRIMARIA },
    valor: { fontSize: 9.5, color: COR_TEXTO },
    th: { fontSize: 8.5, bold: true, color: '#ffffff', fillColor: COR_PRIMARIA },
    td: { fontSize: 8.5, color: COR_TEXTO },
    pequeno: { fontSize: 7.5, color: COR_MUTED, italics: true }
  };

  const secao = (n, t) => ({
    table: { widths: ['*'], body: [[{ text: `${n}. ${t.toUpperCase()}`, fontSize: 10.5, bold: true, color: '#fff', margin: [8, 5, 8, 5] }]] },
    layout: 'noBorders',
    fillColor: COR_PRIMARIA,
    margin: [0, 12, 0, 6],
    unbreakable: true
  });

  const par = (txt) => ({
    text: (txt && String(txt).trim()) ? String(txt).trim() : 'Não informado.',
    style: 'body'
  });

  const kv = (pares) => ({
    table: {
      widths: ['32%', '*'],
      body: pares.map(([k, v]) => ([
        { text: k, style: 'rotulo', fillColor: '#f1f5f9' },
        { text: (v && String(v).trim()) ? String(v).trim() : '—', style: 'valor' }
      ]))
    },
    layout: LAYOUT,
    margin: [0, 0, 0, 8]
  });

  const build = async (issues, trace) => {
    const p = state.processo;
    const tipo = TIPOS[p.tipo];
    const dataEmissao = new Date().toLocaleString('pt-BR');

    const logoDataUrl = state.orgao.logoDataUrl || await srcToDataUrl(LogoManager.FALLBACK);

    const content = [];

    /* Capa */
    content.push({
      columns: [
        logoDataUrl ? { image: logoDataUrl, width: 52, margin: [0, 0, 12, 0] } : { text: '', width: 0 },
        {
          stack: [
            { text: state.orgao.nome || 'ÓRGÃO OU ENTIDADE PÚBLICA', fontSize: 12, bold: true, color: COR_TEXTO },
            { text: `CNPJ: ${state.orgao.cnpj || '—'}`, fontSize: 8.5, color: COR_MUTED },
            { text: `Unidade: ${state.orgao.unidade || '—'}`, fontSize: 8.5, color: COR_MUTED }
          ], width: '*'
        }
      ], margin: [0, 0, 0, 16]
    });

    content.push({ text: 'TERMO DE REFERÊNCIA', style: 'tituloDoc' });
    content.push({ text: `Elaborado nos termos da Lei nº 14.133, de 1º de abril de 2021 — ${tipo.label}`, style: 'subtitulo' });

    content.push(secao(1, 'Identificação do Processo'));
    content.push(kv([
      ['Nº do Processo', p.numero],
      ['Tipo de Contratação', tipo.label],
      ['Modalidade', p.modalidade],
      ['Regime / Julgamento', p.regime],
      ['Fundamentação', tipo.fundamento],
      ['Data de Emissão', dataEmissao],
      ['Autoridade Responsável', [state.orgao.responsavel, state.orgao.cargo].filter(Boolean).join(' — ')]
    ]));

    content.push(secao(2, 'Do Objeto'));
    content.push(par(p.objeto));

    content.push(secao(3, 'Da Justificativa e Motivação'));
    content.push(par(p.justificativa));

    content.push(secao(4, 'Da Descrição da Solução e Especificações Técnicas'));
    content.push(par(p.especificacoes));

    const camposTipo = tipo.campos.map(c => [c.label, getPath(state, c.path)]).filter(([, v]) => v && String(v).trim());
    if (camposTipo.length) {
      content.push({ text: 'Requisitos específicos aplicáveis ao tipo de contratação:', style: 'pequeno', margin: [0, 2, 0, 4] });
      content.push(kv(camposTipo));
    }

    content.push(secao(5, 'Dos Itens, Quantidades e Estimativa de Valor'));
    if (state.itens.length) {
      let total = 0;
      const body = [[
        { text: 'Item', style: 'th', alignment: 'center' },
        { text: 'Descrição', style: 'th' },
        { text: 'Un.', style: 'th', alignment: 'center' },
        { text: 'Qtd.', style: 'th', alignment: 'right' },
        { text: 'Vl. Unitário', style: 'th', alignment: 'right' },
        { text: 'Vl. Total', style: 'th', alignment: 'right' }
      ]];
      state.itens.forEach((it, i) => {
        const t = num(it.quantidade) * num(it.valorUnit);
        total += t;
        body.push([
          { text: String(i + 1), style: 'td', alignment: 'center', noWrap: true },
          { text: it.descricao || '—', style: 'td' },
          { text: it.unidade || 'UN', style: 'td', alignment: 'center', noWrap: true },
          { text: fmtNum(it.quantidade), style: 'td', alignment: 'right', noWrap: true },
          { text: brl(it.valorUnit), style: 'td', alignment: 'right', noWrap: true },
          { text: brl(t), style: 'td', alignment: 'right', noWrap: true }
        ]);
      });
      body.push([
        { text: 'VALOR GLOBAL ESTIMADO', colSpan: 5, style: 'td', bold: true, alignment: 'right', fillColor: '#eff9fb', fontSize: 9 },
        {}, {}, {}, {},
        { text: brl(total), style: 'td', bold: true, alignment: 'right', fillColor: '#eff9fb', fontSize: 9, noWrap: true }
      ]);
      content.push({
        table: { headerRows: 1, widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'], body, dontBreakRows: true },
        layout: LAYOUT, margin: [0, 0, 0, 10]
      });
    } else {
      content.push(par('Nenhum item especificado.'));
    }

    content.push(secao(6, 'Da Dotação Orçamentária'));
    content.push(par(p.dotacao));

    content.push(secao(7, 'Dos Prazos, Vigência e Cronograma'));
    content.push(kv([['Prazo de Vigência', p.vigencia], ['Prazo de Execução / Entrega', p.prazoExecucao]]));
    if (p.cronograma) {
      content.push({ text: 'Cronograma / Marcos de Execução', style: 'rotulo', margin: [0, 4, 0, 2] });
      content.push(par(p.cronograma));
    }

    content.push(secao(8, 'Do Modelo de Execução e Obrigações'));
    content.push(par(p.modeloExecucao));

    content.push(secao(9, 'Do Modelo de Gestão e Fiscalização'));
    content.push(kv([
      ['Gestor do Contrato', state.equipe.gestor],
      ['Fiscal Técnico', state.equipe.fiscalTecnico],
      ['Fiscal Administrativo', state.equipe.fiscalAdministrativo]
    ]));
    if (p.modeloGestao) content.push(par(p.modeloGestao));

    content.push(secao(10, 'Das Condições de Pagamento'));
    content.push(par(p.pagamento));

    content.push(secao(11, 'Da Garantia Contratual'));
    content.push(par(p.garantia));

    content.push(secao(12, 'Das Sanções Administrativas'));
    content.push(par(p.sancoes));

    content.push(secao(13, 'Da Sustentabilidade e Proteção de Dados'));
    content.push({ text: 'Sustentabilidade Ambiental', style: 'rotulo', margin: [0, 2, 0, 2] });
    content.push(par(p.sustentabilidade));
    content.push({ text: 'Proteção de Dados Pessoais (LGPD)', style: 'rotulo', margin: [0, 2, 0, 2] });
    content.push(par(p.lgpd));

    content.push(secao(14, 'Das Disposições Gerais'));
    content.push(par(p.observacoes));

    const regrasAtivas = state.regras.filter(r => r.ativa);
    content.push(secao(15, 'Do Compliance Institucional Aplicado'));
    if (regrasAtivas.length) {
      content.push({
        table: {
          headerRows: 1,
          widths: ['*', '18%', '20%'],
          body: [
            [{ text: 'Regra Institucional', style: 'th' }, { text: 'Verificação', style: 'th' }, { text: 'Fundamento', style: 'th' }],
            ...regrasAtivas.map(r => ([
              { text: r.titulo, style: 'td' },
              { text: `${r.tipo} · ${r.alvo}`, style: 'td' },
              { text: r.fundamento || '—', style: 'td' }
            ]))
          ], dontBreakRows: true
        },
        layout: LAYOUT, margin: [0, 0, 0, 8]
      });
    } else {
      content.push(par('Nenhuma regra institucional específica cadastrada para este órgão.'));
    }

    /* Anexo rastreabilidade */
    content.push({ ...secao(16, 'Anexo — Matriz de Rastreabilidade e Auditoria'), pageBreak: 'before' });
    content.push(kv([
      ['Selo Digital OmniLicit', trace.selo],
      ['TAG Única', trace.tag],
      ['Hash SHA-256 do Conteúdo', trace.hash],
      ['Timestamp de Geração', new Date(trace.timestamp).toLocaleString('pt-BR')],
      ['Módulo Emissor', 'LicitaTR v' + state.meta.versao],
      ['Auditoria Cruzada', 'LicitaAudit — verificação de integridade e conformidade']
    ]));

    content.push({ text: 'Verificações automáticas executadas nesta emissão:', style: 'rotulo', margin: [0, 6, 0, 4] });

    const checks = [[
      { text: 'Severidade', style: 'th' },
      { text: 'Origem', style: 'th' },
      { text: 'Apontamento', style: 'th' },
      { text: 'Fundamento', style: 'th' }
    ]];
    if (issues.length) {
      issues.forEach(i => checks.push([
        { text: (i.severidade || 'info').toUpperCase(), style: 'td', noWrap: true },
        { text: i.origem || '—', style: 'td', noWrap: true },
        { text: i.titulo || '—', style: 'td' },
        { text: i.fundamento || '—', style: 'td' }
      ]));
    } else {
      checks.push([
        { text: '—', style: 'td' }, { text: '—', style: 'td' },
        { text: 'Nenhuma inconformidade detectada.', style: 'td' },
        { text: '—', style: 'td' }
      ]);
    }
    content.push({
      table: { headerRows: 1, widths: ['12%', '16%', '*', '28%'], body: checks, dontBreakRows: true },
      layout: LAYOUT, margin: [0, 0, 0, 14]
    });

    /* Assinaturas */
    content.push({
      unbreakable: true,
      margin: [0, 26, 0, 0],
      columns: [
        {
          width: '*',
          stack: [
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 210, y2: 0, lineWidth: 0.7, lineColor: '#334155' }] },
            { text: state.orgao.responsavel || '_________________________', fontSize: 9, bold: true, margin: [0, 4, 0, 0] },
            { text: state.orgao.cargo || 'Autoridade Competente', fontSize: 8, color: COR_MUTED },
            { text: state.orgao.nome || '', fontSize: 8, color: COR_MUTED }
          ]
        },
        {
          width: '*',
          stack: [
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 210, y2: 0, lineWidth: 0.7, lineColor: '#334155' }] },
            { text: state.equipe.gestor || '_________________________', fontSize: 9, bold: true, margin: [0, 4, 0, 0] },
            { text: 'Gestor do Contrato', fontSize: 8, color: COR_MUTED },
            { text: 'Designado nos termos do art. 117 da Lei nº 14.133/2021', fontSize: 7.5, color: COR_MUTED }
          ]
        }
      ]
    });

    return {
      pageSize: 'A4',
      pageMargins: [40, 62, 40, 58],
      info: {
        title: `Termo de Referência ${p.numero || ''}`.trim(),
        author: state.orgao.nome || 'OmniLicit',
        subject: p.objeto ? String(p.objeto).slice(0, 200) : 'Termo de Referência',
        keywords: `OmniLicit, LicitaTR, Lei 14.133/2021, ${trace.tag}`,
        creator: 'OmniLicit · LicitaTR'
      },
      styles: STYLES,
      defaultStyle: { fontSize: 9.5, color: COR_TEXTO },

      header: () => ({
        margin: [40, 18, 40, 0],
        columns: [
          logoDataUrl ? { image: logoDataUrl, width: 24, margin: [0, 0, 8, 0] } : { text: '', width: 0 },
          {
            stack: [
              { text: state.orgao.nome || 'OmniLicit', fontSize: 8, bold: true, color: COR_PRIMARIA },
              { text: `TR nº ${p.numero || '—'} · ${tipo.label}`, fontSize: 7, color: COR_MUTED }
            ], width: '*'
          },
          { text: 'LicitaTR · OmniLicit', fontSize: 7, color: '#94a3b8', alignment: 'right', width: 'auto' }
        ]
      }),

      footer: (cur, total) => ({
        margin: [40, 8, 40, 0],
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.6, lineColor: '#cbd5e1' }] },
          {
            columns: [
              { text: trace.selo, fontSize: 6.5, bold: true, color: COR_PRIMARIA, width: 'auto' },
              { text: `SHA-256: ${trace.hash}`, fontSize: 5.8, color: '#475569', width: '*', alignment: 'center' }
            ], margin: [0, 5, 0, 2]
          },
          {
            columns: [
              { text: `Auditoria cruzada LicitaAudit · Emitido em ${new Date(trace.timestamp).toLocaleString('pt-BR')} · ${state.orgao.nome || 'OmniLicit'}`, fontSize: 5.8, color: COR_MUTED, width: '*' },
              { text: `Página ${cur} de ${total}`, fontSize: 5.8, color: COR_MUTED, alignment: 'right', width: 'auto' }
            ]
          }
        ]
      }),

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
        const ok = confirm('⚠ Existem apontamentos CRÍTICOS na auditoria.\n\nDeseja gerar o PDF mesmo assim? (o documento registrará as pendências no Anexo de Rastreabilidade)');
        if (!ok) return;
      }

      const doc = await PdfBuilder.build(issues, trace);
      const nome = `TR_${(state.processo.numero || 'sem-numero').replace(/[^\w-]/g, '')}_${trace.tag}.pdf`;
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
      modulo: 'LicitaTR', versao: state.meta.versao, ecossistema: 'OmniLicit',
      destinatario: 'LicitaAudit',
      selo: trace.selo, tag: trace.tag, hash: trace.hash, timestamp: trace.timestamp,
      orgao: { nome: state.orgao.nome, cnpj: state.orgao.cnpj, unidade: state.orgao.unidade },
      processo: { numero: state.processo.numero, tipo: state.processo.tipo, modalidade: state.processo.modalidade, objeto: state.processo.objeto },
      regrasAtivas: state.regras.filter(r => r.ativa),
      apontamentos: issues,
      resumo: {
        total: issues.length,
        criticos: issues.filter(i => i.severidade === 'critico').length,
        alertas: issues.filter(i => i.severidade === 'alerta').length,
        informativos: issues.filter(i => i.severidade === 'info').length
      }
    };
    download(new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' }), `LicitaAudit_${trace.tag}.json`);
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
  LogoManager.bind();
  LogoManager.apply();

  if (!state.itens.length) {
    state.itens = [{ id: uid('item'), descricao: '', unidade: 'UN', quantidade: '', valorUnit: '' }];
  }

  const restaurado = Actions.carregar();

  UI.renderTipoSelector();
  UI.renderCamposDinamicos();
  UI.renderItens();
  UI.renderRegras();
  UI.syncBindingsFromState();

  if (restaurado) LogoManager.apply();

  UI.bindGlobalInputs();
  UI.bindEvents();
  Audit.bindNavigation();
  Importador.bind();
  Actions.bind();

  Audit.render();
  Trace.refresh();

  setInterval(() => Trace.schedule(), 30000);

  console.info('%cOmniLicit · LicitaTR v1.0.0', 'color:#14B8A6;font-weight:bold',
    '— módulo de Termo de Referência inicializado.');
})();
