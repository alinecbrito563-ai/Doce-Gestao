/* =========================================================================
   DoceGestão — script.js
   Sistema completo de gestão de confeitaria. Sem bibliotecas externas.
   Tudo é persistido em localStorage. Organizado por módulos comentados.
   ========================================================================= */

(function () {
  'use strict';

  /* ======================================================================
     1. CONSTANTES, ÍCONES E BANCO DE DADOS
     ====================================================================== */

  const DB_KEY = 'doceGestaoDB_v1';
  const EPS = 1e-6; // tolerância para comparações de ponto flutuante em quantidades

  /* ======================================================================
     1.1 CONFIGURAÇÃO DO SUPABASE
     Preencha estes dois valores com os dados do seu projeto Supabase
     (Painel do projeto → Project Settings → API). Ambos são públicos —
     nunca coloque aqui a service_role key nem qualquer chave secreta.
     ====================================================================== */
  const SUPABASE_URL = 'https://rlcpkmslmdyzgpxhyivw.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_k1YSUxaN3uPzlJwPPLdZfg_M2p4-PL4';
  const SUPABASE_CONFIGURADO = /^https?:\/\//.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20;

  // Nomes das tabelas no Supabase — uma por array existente dentro de `db`,
  // todas isoladas por usuário via Row Level Security.
  const TABELAS = ['ingredients', 'purchases', 'recipes', 'productions', 'movements', 'calculations'];

  const sb = SUPABASE_CONFIGURADO
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  let currentUser = null;
  let cloudSyncTimer = null;
  let cloudSyncErrorShown = false;

  const UNIT_BASE_FACTOR = { g: 1, kg: 1000, ml: 1, L: 1000, unidade: 1 };
  const UNIT_FAMILY = { g: 'peso', kg: 'peso', ml: 'volume', L: 'volume', unidade: 'unidade' };
  const COMPATIBLE_UNITS = { peso: ['g', 'kg'], volume: ['ml', 'L'], unidade: ['unidade'] };
  const MOVEMENT_TYPES = ['Compra', 'Produção', 'Consumo pessoal', 'Degustação', 'Perda', 'Ajuste manual', 'Estorno'];

  const ICONS = {
    box: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>',
    book: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M8 9h7M8 13h7M8 17h4"/></svg>',
    warn: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5M12 17.5h.01"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
    factory: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V10l4-5 4 5v11"/><path d="M12 21V7l4-4 4 4v14"/><path d="M2 21h20"/></svg>',
    calc: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 11h1M11.5 11h1M15 11h1M8 15h1M11.5 15h1M15 15h1"/></svg>',
    edit: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    cart: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.5 3h2l2.6 12.4a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H6"/></svg>',
    move: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h13l-3-3M17 17H4l3 3"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0-1 14a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 6"/></svg>',
    star: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"/></svg>',
    starFilled: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="1"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    upload: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M6 10l6-6 6 6"/><path d="M4 20h16"/></svg>',
    download: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M6 10l6 6 6-6"/><path d="M4 20h16"/></svg>',
    box2: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  };

  function defaultDB() {
    return {
      ingredients: [],
      purchases: [],
      recipes: [],
      productions: [],
      movements: [],
      calculations: [],
      settings: { multiplicador: 3 },
    };
  }

  // `db` começa vazio e só é populado de fato depois do login, dentro de
  // bootApp() (ver seção de INICIALIZAÇÃO no final do arquivo). Isso evita
  // que qualquer tela tente renderizar dados antes de sabermos quem é o
  // usuário autenticado.
  let db = defaultDB();

  // ------------------------------------------------------------------------
  // Camada de dados (única, centralizada): tudo que lê ou grava dados passa
  // por aqui. O restante do sistema (regras de negócio, telas) continua
  // trabalhando exatamente como antes sobre o objeto `db` em memória — a
  // única mudança é ONDE esse objeto é carregado/persistido.
  //
  //   - loadDBFromSupabase(userId): fonte de verdade principal, usada no
  //     login e ao recarregar a página já autenticado.
  //   - loadDBFromLocalCache(): apenas uma rede de segurança (ex.: para não
  //     perder a tela em branco caso a internet caia bem no instante do
  //     carregamento); o Supabase continua sendo o armazenamento principal.
  //   - saveDB(): chamada pelas mesmas ~40 funções de regra de negócio que
  //     já existiam, sem nenhuma mudança nelas. Grava instantaneamente um
  //     cache local (para a interface continuar 100% síncrona) e agenda,
  //     de forma centralizada, o envio de tudo para o Supabase.
  // ------------------------------------------------------------------------

  function loadDBFromLocalCache() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) return defaultDB();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultDB(), parsed);
    } catch (e) {
      console.error('Erro ao carregar cache local, iniciando banco vazio.', e);
      return defaultDB();
    }
  }

  async function loadDBFromSupabase(userId) {
    const tabelaResults = await Promise.all(TABELAS.map((t) => sb.from(t).select('payload')));
    tabelaResults.forEach((r) => { if (r.error) throw r.error; });
    const settingsRes = await sb.from('user_settings').select('payload').eq('user_id', userId).maybeSingle();
    if (settingsRes.error) throw settingsRes.error;
    const loaded = { settings: (settingsRes.data && settingsRes.data.payload) ? settingsRes.data.payload : { multiplicador: 3 } };
    TABELAS.forEach((t, i) => { loaded[t] = (tabelaResults[i].data || []).map((r) => r.payload); });
    return Object.assign(defaultDB(), loaded);
  }

  // Substitui integralmente as linhas de uma tabela (para o usuário atual)
  // pelo conteúdo atual do array correspondente em `db`. Simples e sempre
  // consistente — sem precisar calcular diffs — o que é adequado ao volume
  // de dados de uma confeitaria.
  async function replaceTable(tableName, records, userId) {
    const { data: existing, error: selErr } = await sb.from(tableName).select('id').eq('user_id', userId);
    if (selErr) throw selErr;
    const existingIds = new Set((existing || []).map((r) => r.id));
    const currentIds = new Set(records.map((r) => r.id));
    const toDelete = [...existingIds].filter((id) => !currentIds.has(id));
    if (toDelete.length) {
      const { error: delErr } = await sb.from(tableName).delete().eq('user_id', userId).in('id', toDelete);
      if (delErr) throw delErr;
    }
    if (records.length) {
      const rows = records.map((r) => ({ id: r.id, user_id: userId, payload: r }));
      const { error: upErr } = await sb.from(tableName).upsert(rows, { onConflict: 'user_id,id' });
      if (upErr) throw upErr;
    }
  }

  async function syncAllToSupabase() {
    if (!currentUser || !sb) return;
    try {
      await Promise.all([
        ...TABELAS.map((t) => replaceTable(t, db[t], currentUser.id)),
        sb.from('user_settings').upsert({ user_id: currentUser.id, payload: db.settings }, { onConflict: 'user_id' }),
      ]);
      cloudSyncErrorShown = false;
    } catch (e) {
      console.error('Erro ao sincronizar com o Supabase:', e);
      if (!cloudSyncErrorShown) {
        cloudSyncErrorShown = true;
        toast('Não foi possível sincronizar com a nuvem agora. Os dados continuam salvos neste dispositivo.', 'warning');
      }
    }
  }

  function queueCloudSync() {
    if (!sb || !currentUser) return;
    if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(syncAllToSupabase, 500);
  }

  function saveDB() {
    localStorage.setItem(DB_KEY, JSON.stringify(db)); // cache local instantâneo, mantém a interface síncrona
    queueCloudSync(); // grava no Supabase (armazenamento principal), de forma centralizada e assíncrona
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ======================================================================
     2. UTILITÁRIOS: datas, números, unidades
     ====================================================================== */

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function daysBetween(isoDateA, isoDateB) {
    const a = new Date(isoDateA + 'T00:00:00');
    const b = new Date(isoDateB + 'T00:00:00');
    return Math.round((b - a) / 86400000);
  }

  // Verifica se uma data (YYYY-MM-DD) cai dentro do período selecionado no
  // resumo de vendas das Produções e no Financeiro (função única, reaproveitada
  // pelas duas telas para evitar lógica de período duplicada/divergente).
  function isDateInPeriod(dateISO, period, customFrom, customTo) {
    if (!dateISO) return false;
    if (period === 'hoje') return dateISO === todayISO();
    if (period === 'semana') {
      const now = new Date(todayISO() + 'T00:00:00');
      const dayOfWeek = now.getDay(); // 0 = domingo
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(now); monday.setDate(now.getDate() - diffToMonday);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      const d = new Date(dateISO + 'T00:00:00');
      return d >= monday && d <= sunday;
    }
    if (period === 'mes' || period === 'mesAnterior') {
      const now = new Date(todayISO() + 'T00:00:00');
      let year = now.getFullYear();
      let month = now.getMonth();
      if (period === 'mesAnterior') {
        month -= 1;
        if (month < 0) { month = 11; year -= 1; }
      }
      const d = new Date(dateISO + 'T00:00:00');
      return d.getFullYear() === year && d.getMonth() === month;
    }
    if (period === 'ano') {
      const now = new Date(todayISO() + 'T00:00:00');
      const d = new Date(dateISO + 'T00:00:00');
      return d.getFullYear() === now.getFullYear();
    }
    if (period === 'personalizado') {
      if (!customFrom || !customTo) return true; // sem intervalo definido ainda: não filtra
      return dateISO >= customFrom && dateISO <= customTo;
    }
    return true;
  }

  function formatDateBR(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function formatMoney(v) {
    v = Number(v) || 0;
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatNumber(v, decimals) {
    v = Number(v) || 0;
    return v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function familyOf(unit) { return UNIT_FAMILY[unit]; }
  function compatibleUnitsFor(unit) { return COMPATIBLE_UNITS[familyOf(unit)] || ['unidade']; }
  function toBase(qty, unit) { return (Number(qty) || 0) * (UNIT_BASE_FACTOR[unit] || 1); }
  function fromBase(qtyBase, unit) { return (Number(qtyBase) || 0) / (UNIT_BASE_FACTOR[unit] || 1); }

  // Unidades que uma receita pode usar para um determinado ingrediente. Quando o
  // ingrediente é medido por "unidade" e possui peso por unidade cadastrado
  // (ex.: 1 ovo = 50g), a receita também pode especificar o uso em gramas.
  function unitOptionsForIngredient(ingredient) {
    if (!ingredient) return ['g', 'kg', 'ml', 'L', 'unidade'];
    const base = compatibleUnitsFor(ingredient.unidade).slice();
    if (ingredient.unidade === 'unidade' && ingredient.pesoPorUnidade) base.push('g');
    return base;
  }

  // Converte a quantidade usada numa receita (que pode estar em uma unidade
  // "emprestada", como gramas para um ingrediente medido em unidades) para a
  // base do próprio ingrediente (a mesma base usada no controle de estoque).
  function usageToBaseForIngredient(ingredient, quantity, unit) {
    quantity = Number(quantity) || 0;
    if (!ingredient) return 0;
    if (ingredient.unidade === 'unidade' && unit === 'g' && ingredient.pesoPorUnidade) {
      return quantity / ingredient.pesoPorUnidade; // gramas -> nº de unidades
    }
    return toBase(quantity, unit);
  }

  // Escolhe a melhor unidade de exibição (ex.: 1500g -> "1,5 kg")
  function formatQuantityBase(qtyBase, ingredientUnit) {
    const fam = familyOf(ingredientUnit);
    qtyBase = Number(qtyBase) || 0;
    if (fam === 'peso') {
      if (Math.abs(qtyBase) >= 1000) return formatNumber(qtyBase / 1000, 2) + ' kg';
      return formatNumber(qtyBase, 0) + ' g';
    }
    if (fam === 'volume') {
      if (Math.abs(qtyBase) >= 1000) return formatNumber(qtyBase / 1000, 2) + ' L';
      return formatNumber(qtyBase, 0) + ' ml';
    }
    return formatNumber(qtyBase, qtyBase % 1 === 0 ? 0 : 1) + ' un';
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  /* ======================================================================
     3. TOASTS
     ====================================================================== */

  function toast(message, type) {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.innerHTML = (type === 'success' ? ICONS.check : type === 'warning' || type === 'danger' ? ICONS.warn : '') + '<span>' + escapeHtml(message) + '</span>';
    container.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .25s ease, transform .25s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateX(16px)';
      setTimeout(() => el.remove(), 260);
    }, 3200);
  }

  /* ======================================================================
     4. MODAL ENGINE
     ====================================================================== */

  const modalOverlay = () => document.getElementById('modalOverlay');
  const modalBox = () => document.getElementById('modalBox');

  function openModal({ title, bodyHTML, footerHTML, wide, onMount }) {
    const box = modalBox();
    box.className = 'modal-box' + (wide ? ' wide' : '');
    box.innerHTML = `
      <div class="modal-header">
        <h2>${escapeHtml(title)}</h2>
        <button class="modal-close" data-action="fechar-modal" type="button">${ICONS.x}</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
    `;
    modalOverlay().classList.remove('hidden');
    if (typeof onMount === 'function') onMount(box);
  }

  function closeModal() {
    modalOverlay().classList.add('hidden');
    modalBox().innerHTML = '';
  }

  function openConfirm({ title, message, confirmLabel, danger, onConfirm }) {
    openModal({
      title: title || 'Confirmar ação',
      bodyHTML: `<p class="confirm-text">${message}</p>`,
      footerHTML: `
        <button class="btn btn-ghost" data-action="fechar-modal">Cancelar</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirmActionBtn">${escapeHtml(confirmLabel || 'Confirmar')}</button>
      `,
      onMount: () => {
        document.getElementById('confirmActionBtn').addEventListener('click', () => {
          closeModal();
          onConfirm();
        });
      },
    });
  }

  /* ======================================================================
     5. INGREDIENTES
     ====================================================================== */

  function getIngredient(id) { return db.ingredients.find((i) => i.id === id); }

  function getPurchasesFor(ingredientId) {
    return db.purchases
      .filter((p) => p.ingredienteId === ingredientId)
      .sort((a, b) => (a.dataCompra < b.dataCompra ? -1 : a.dataCompra > b.dataCompra ? 1 : 0));
  }

  function getStockBase(ingredientId) {
    return getPurchasesFor(ingredientId).reduce((s, p) => s + p.quantidadeRestanteBase, 0);
  }

  function getAvgPricePerBase(ingredientId) {
    const ing = getIngredient(ingredientId);
    if (!ing) return 0;
    const factor = UNIT_BASE_FACTOR[ing.unidade] || 1;
    const withStock = getPurchasesFor(ingredientId).filter((p) => p.quantidadeRestanteBase > 0);
    const totalQty = withStock.reduce((s, p) => s + p.quantidadeRestanteBase, 0);
    if (totalQty > 0) {
      const totalValue = withStock.reduce((s, p) => s + p.quantidadeRestanteBase * (p.valorUnitario / factor), 0);
      return totalValue / totalQty;
    }
    const all = getPurchasesFor(ingredientId);
    if (!all.length) return 0;
    const last = all[all.length - 1];
    return last.valorUnitario / factor;
  }

  function getNextValidade(ingredientId) {
    const lots = getPurchasesFor(ingredientId).filter((p) => p.quantidadeRestanteBase > 0 && p.validade);
    if (!lots.length) return null;
    return lots.reduce((min, p) => (!min || p.validade < min ? p.validade : min), null);
  }

  function getStockStatus(ingredient) {
    const stockBase = getStockBase(ingredient.id);
    const minBase = toBase(ingredient.estoqueMinimo || 0, ingredient.unidade);
    if (stockBase <= 0) return { level: 'danger', label: 'Sem estoque' };
    if (minBase > 0 && stockBase <= minBase) return { level: 'warn', label: 'Estoque baixo' };
    return { level: 'ok', label: 'Estoque ok' };
  }

  function getValidadeStatus(validadeISO) {
    if (!validadeISO) return null;
    const today = todayISO();
    const diff = daysBetween(today, validadeISO);
    if (diff < 0) return { level: 'danger', label: 'Vencido' };
    if (diff === 0) return { level: 'danger', label: 'Vence hoje' };
    if (diff <= 7) return { level: 'warn', label: `Vence em ${diff}d` };
    return { level: 'ok', label: 'Dentro da validade' };
  }

  function addIngredient(data) {
    const ing = {
      id: uid(),
      nome: data.nome.trim(),
      unidade: data.unidade,
      pesoPorUnidade: data.pesoPorUnidade ? Number(data.pesoPorUnidade) : null,
      estoqueMinimo: Number(data.estoqueMinimo) || 0,
      observacao: data.observacao || '',
      criadoEm: Date.now(),
    };
    db.ingredients.push(ing);
    saveDB();
    return ing;
  }

  function updateIngredient(id, data) {
    const ing = getIngredient(id);
    if (!ing) return { ok: false, message: 'Ingrediente não encontrado.' };
    const hasPurchases = db.purchases.some((p) => p.ingredienteId === id);
    if (hasPurchases && data.unidade !== ing.unidade) {
      return { ok: false, message: 'Não é possível alterar a unidade de um ingrediente que já possui compras registradas, pois isso comprometeria o histórico de estoque.' };
    }
    ing.nome = data.nome.trim();
    ing.unidade = data.unidade;
    ing.pesoPorUnidade = data.pesoPorUnidade ? Number(data.pesoPorUnidade) : null;
    ing.estoqueMinimo = Number(data.estoqueMinimo) || 0;
    ing.observacao = data.observacao || '';
    saveDB();
    return { ok: true };
  }

  // Remove o ingrediente e tudo que depende diretamente dele (compras e
  // movimentações), além de removê-lo de qualquer receita que o utilize.
  // Produções que já consumiram este ingrediente mantêm o registro histórico,
  // mas não será mais possível estorná-las para a parte referente a ele
  // (tratado de forma segura em reverseProduction).
  function deleteIngredient(id) {
    db.purchases = db.purchases.filter((p) => p.ingredienteId !== id);
    db.movements = db.movements.filter((m) => m.ingredienteId !== id);
    db.recipes.forEach((r) => {
      r.ingredientes = r.ingredientes.filter((it) => it.ingredienteId !== id);
    });
    db.ingredients = db.ingredients.filter((i) => i.id !== id);
    saveDB();
  }

  /* ======================================================================
     6. COMPRAS (LOTES)
     ====================================================================== */

  function addPurchase(ingredienteId, data) {
    const ing = getIngredient(ingredienteId);
    if (!ing) return;
    const quantidade = Number(data.quantidade) || 0;
    const quantidadeBase = toBase(quantidade, ing.unidade);
    const valorTotal = Number(data.valorTotal) || 0;
    const valorUnitario = quantidade > 0 ? valorTotal / quantidade : 0;
    const purchase = {
      id: uid(),
      ingredienteId,
      marca: data.marca || '',
      quantidade,
      quantidadeBase,
      quantidadeRestanteBase: quantidadeBase,
      valorTotal,
      valorUnitario,
      validade: data.validade || '',
      dataCompra: data.dataCompra || todayISO(),
      criadoEm: Date.now(),
    };
    db.purchases.push(purchase);
    addMovement({
      tipo: 'Compra',
      ingredienteId,
      quantidadeBase,
      data: purchase.dataCompra,
      descricao: `Compra${purchase.marca ? ' — ' + purchase.marca : ''}`,
    });
    saveDB();
    return purchase;
  }

  function updatePurchase(id, data) {
    const p = db.purchases.find((x) => x.id === id);
    if (!p) return { ok: false, message: 'Compra não encontrada.' };
    const ing = getIngredient(p.ingredienteId);
    const consumedBase = p.quantidadeBase - p.quantidadeRestanteBase;
    const quantidade = Number(data.quantidade) || 0;
    const quantidadeBase = toBase(quantidade, ing.unidade);
    // Nunca permitir reduzir um lote para menos do que já foi consumido dele —
    // isso deixaria o histórico de consumo (FIFO) inconsistente com a realidade.
    if (quantidadeBase < consumedBase - EPS) {
      return {
        ok: false,
        message: `Não é possível reduzir esta compra para menos do que já foi consumido deste lote (${formatQuantityBase(consumedBase, ing.unidade)} já utilizados).`,
      };
    }
    const valorTotal = Number(data.valorTotal) || 0;
    p.marca = data.marca || '';
    p.quantidade = quantidade;
    p.quantidadeBase = quantidadeBase;
    p.quantidadeRestanteBase = quantidadeBase - consumedBase;
    p.valorTotal = valorTotal;
    p.valorUnitario = quantidade > 0 ? valorTotal / quantidade : 0;
    p.validade = data.validade || '';
    p.dataCompra = data.dataCompra || p.dataCompra;
    saveDB();
    return { ok: true };
  }

  // Uma compra só pode ser excluída se nenhuma quantidade dela já tiver sido
  // consumida (por produção, consumo pessoal, degustação, perda ou ajuste).
  function canDeletePurchase(id) {
    const p = db.purchases.find((x) => x.id === id);
    if (!p) return { ok: false, message: 'Compra não encontrada.' };
    const consumedBase = p.quantidadeBase - p.quantidadeRestanteBase;
    if (consumedBase > EPS) {
      const ing = getIngredient(p.ingredienteId);
      return {
        ok: false,
        message: `Não é possível excluir este lote: ${formatQuantityBase(consumedBase, ing ? ing.unidade : 'unidade')} já foram consumidos dele. Estorne a produção ou movimentação relacionada antes de excluir o lote.`,
      };
    }
    return { ok: true };
  }

  function deletePurchase(id) {
    const check = canDeletePurchase(id);
    if (!check.ok) return check;
    db.purchases = db.purchases.filter((p) => p.id !== id);
    saveDB();
    return { ok: true };
  }

  function duplicatePurchase(id) {
    const p = db.purchases.find((x) => x.id === id);
    if (!p) return;
    addPurchase(p.ingredienteId, {
      marca: p.marca, quantidade: p.quantidade, valorTotal: p.valorTotal,
      validade: p.validade, dataCompra: todayISO(),
    });
  }

  // ------------------------------------------------------------------------
  // Motor de consumo de estoque (FIFO), separado em três etapas puras:
  //   1. planConsumption   -> calcula QUAIS lotes seriam debitados, sem mutar nada.
  //   2. applyConsumptionPlan -> efetivamente debita os lotes de um plano já validado.
  //   3. reverseConsumptionPlan -> devolve exatamente as quantidades de um plano
  //      aos mesmos lotes de origem (usado no estorno de produções).
  // Isso garante que nunca haja debito parcial silencioso: ou o plano cobre
  // 100% da necessidade, ou a operação inteira é cancelada antes de qualquer
  // mutação no banco de dados.
  // ------------------------------------------------------------------------

  // Monta o plano de consumo FIFO (lote mais antigo primeiro) e já calcula o
  // custo EXATO de cada retirada, usando o preço real daquele lote específico
  // (nunca uma média ponderada). É esse custo por retirada que alimenta o
  // custo real e congelado de cada produção.
  function planConsumption(ingredienteId, neededBase) {
    const ing = getIngredient(ingredienteId);
    const factor = ing ? (UNIT_BASE_FACTOR[ing.unidade] || 1) : 1;
    const lots = getPurchasesFor(ingredienteId).filter((p) => p.quantidadeRestanteBase > EPS);
    let remaining = neededBase;
    const plan = [];
    for (const lot of lots) {
      if (remaining <= EPS) break;
      const take = Math.min(lot.quantidadeRestanteBase, remaining);
      if (take > EPS) {
        const pricePerBase = lot.valorUnitario / factor;
        plan.push({ purchaseId: lot.id, quantidadeBase: take, custo: take * pricePerBase });
      }
      remaining -= take;
    }
    return { ok: remaining <= EPS, faltanteBase: Math.max(0, remaining), plan };
  }

  // Igual a planConsumption, mas soma uma disponibilidade extra virtual por
  // lote (usado para validar a edição de uma produção considerando o estoque
  // que SERIA devolvido pela reversão da produção antiga, sem precisar
  // mutar nada até termos certeza de que a nova produção cabe).
  function planConsumptionWithExtra(ingredienteId, neededBase, extraByLotId) {
    const lots = getPurchasesFor(ingredienteId);
    let remaining = neededBase;
    for (const lot of lots) {
      if (remaining <= EPS) break;
      const extra = (extraByLotId && extraByLotId[lot.id]) || 0;
      const available = lot.quantidadeRestanteBase + extra;
      if (available <= EPS) continue;
      const take = Math.min(available, remaining);
      remaining -= take;
    }
    return { ok: remaining <= EPS, faltanteBase: Math.max(0, remaining) };
  }

  function applyConsumptionPlan(plan) {
    plan.forEach(({ purchaseId, quantidadeBase }) => {
      const lot = db.purchases.find((p) => p.id === purchaseId);
      if (lot) lot.quantidadeRestanteBase = Math.max(0, lot.quantidadeRestanteBase - quantidadeBase);
    });
  }

  // Devolve as quantidades do plano aos lotes de origem. Retorna false se
  // algum lote não existir mais (ex.: o ingrediente foi excluído depois),
  // caso em que aquela parcela simplesmente não pode ser restituída.
  function reverseConsumptionPlan(plan) {
    let restoredOk = true;
    (plan || []).forEach(({ purchaseId, quantidadeBase }) => {
      const lot = db.purchases.find((p) => p.id === purchaseId);
      if (lot) lot.quantidadeRestanteBase += quantidadeBase;
      else restoredOk = false;
    });
    return restoredOk;
  }

  // Consome estoque de um único ingrediente de forma segura: só debita se
  // houver saldo suficiente; caso contrário cancela e informa exatamente o
  // ingrediente e a quantidade que falta.
  function consumeStockOrFail(ingredienteId, neededBase, tipo, descricao, dataMov) {
    const result = planConsumption(ingredienteId, neededBase);
    if (!result.ok) {
      const ing = getIngredient(ingredienteId);
      return {
        ok: false,
        message: `Estoque insuficiente de ${ing ? ing.nome : 'ingrediente'}. Faltam ${formatQuantityBase(result.faltanteBase, ing ? ing.unidade : 'unidade')}.`,
      };
    }
    applyConsumptionPlan(result.plan);
    const mov = addMovement({ tipo, ingredienteId, quantidadeBase: -neededBase, data: dataMov || todayISO(), descricao });
    return { ok: true, movementId: mov.id, plan: result.plan };
  }

  function addAdjustment(ingredienteId, deltaBase, descricao) {
    const ing = getIngredient(ingredienteId);
    if (!ing) return { ok: false, message: 'Ingrediente não encontrado.' };
    if (deltaBase > 0) {
      // ajuste positivo cria um "lote" de ajuste com custo herdado da média atual
      const avgPrice = getAvgPricePerBase(ingredienteId);
      db.purchases.push({
        id: uid(), ingredienteId, marca: 'Ajuste manual',
        quantidade: fromBase(deltaBase, ing.unidade), quantidadeBase: deltaBase, quantidadeRestanteBase: deltaBase,
        valorTotal: avgPrice * deltaBase, valorUnitario: avgPrice * (UNIT_BASE_FACTOR[ing.unidade] || 1),
        validade: '', dataCompra: todayISO(), criadoEm: Date.now(),
      });
      addMovement({ tipo: 'Ajuste manual', ingredienteId, quantidadeBase: deltaBase, data: todayISO(), descricao });
    } else if (deltaBase < 0) {
      const result = consumeStockOrFail(ingredienteId, Math.abs(deltaBase), 'Ajuste manual', descricao, todayISO());
      if (!result.ok) return result;
    }
    saveDB();
    return { ok: true };
  }

  /* ======================================================================
     7. MOVIMENTAÇÕES
     ====================================================================== */

  function addMovement({ tipo, ingredienteId, quantidadeBase, data, descricao }) {
    const mov = {
      id: uid(), tipo, ingredienteId, quantidadeBase, data: data || todayISO(),
      descricao: descricao || '', criadoEm: Date.now(),
    };
    db.movements.push(mov);
    return mov;
  }

  /* ======================================================================
     8. RECEITAS
     ====================================================================== */

  function getRecipe(id) { return db.recipes.find((r) => r.id === id); }

  function computeRecipeCost(recipe) {
    let custoTotal = 0;
    (recipe.ingredientes || []).forEach((item) => {
      const ing = getIngredient(item.ingredienteId);
      if (!ing) return;
      const usageBase = usageToBaseForIngredient(ing, item.quantidade, item.unidade);
      const pricePerBase = getAvgPricePerBase(item.ingredienteId);
      custoTotal += usageBase * pricePerBase;
    });
    const rendimento = Number(recipe.rendimento) || 0;
    const custoUnitario = rendimento > 0 ? custoTotal / rendimento : 0;
    const mult = Number(db.settings.multiplicador) || 3;
    return {
      custoTotal,
      custoUnitario,
      valorVendaTotal: custoTotal * mult,
      valorVendaUnitario: custoUnitario * mult,
    };
  }

  function addRecipe(data) {
    const recipe = {
      id: uid(),
      nome: data.nome.trim(),
      ingredientes: data.ingredientes || [],
      rendimento: Number(data.rendimento) || 1,
      favorita: false,
      observacoes: data.observacoes || '',
      criadoEm: Date.now(),
    };
    db.recipes.push(recipe);
    saveDB();
    return recipe;
  }

  function updateRecipe(id, data) {
    const r = getRecipe(id);
    if (!r) return;
    r.nome = data.nome.trim();
    r.ingredientes = data.ingredientes || [];
    r.rendimento = Number(data.rendimento) || 1;
    r.observacoes = data.observacoes || '';
    saveDB();
  }

  function deleteRecipe(id) {
    db.recipes = db.recipes.filter((r) => r.id !== id);
    saveDB();
  }

  function toggleFavoriteRecipe(id) {
    const r = getRecipe(id);
    if (!r) return;
    r.favorita = !r.favorita;
    saveDB();
  }

  /* ======================================================================
     9. PRODUÇÕES
     ====================================================================== */

  // Migra produções salvas antes deste recurso existir. Regra de ouro: NUNCA
  // inventar um custo histórico usando preços atuais dos ingredientes.
  //   - Se a produção já tem os lotes consumidos registrados (consumos), o
  //     custo real é recuperado a partir do preço histórico de CADA compra
  //     (um fato já gravado e confiável, não uma estimativa) — sem usar
  //     média ponderada, apenas o preço do lote realmente retirado.
  //   - Se não houver dado confiável (produção antiga sem consumos, ou lote
  //     que não existe mais), a produção é marcada com custoNaoRegistrado:true
  //     e o custo é tratado como zero/"não registrado" em toda a interface —
  //     nunca um número inventado.
  function migrateProductions() {
    let changed = false;
    db.productions.forEach((p) => {
      if (typeof p.custoTotal !== 'number' || typeof p.custoNaoRegistrado === 'undefined') {
        if (Array.isArray(p.consumos) && p.consumos.length) {
          let total = 0;
          let algumaFalha = false;
          p.consumos.forEach((item) => {
            const ing = getIngredient(item.ingredienteId);
            const factor = ing ? (UNIT_BASE_FACTOR[ing.unidade] || 1) : 1;
            (item.lots || []).forEach((l) => {
              if (typeof l.custo === 'number') { total += l.custo; return; }
              const purchase = db.purchases.find((x) => x.id === l.purchaseId);
              if (purchase) {
                const custo = l.quantidadeBase * (purchase.valorUnitario / factor);
                l.custo = custo; // preenche para não precisar recalcular de novo
                total += custo;
              } else {
                algumaFalha = true;
              }
            });
          });
          p.custoTotal = algumaFalha ? 0 : total;
          p.custoNaoRegistrado = algumaFalha;
        } else {
          p.custoTotal = 0;
          p.custoNaoRegistrado = true;
        }
        changed = true;
      }
      if (typeof p.precoVendaUnitario !== 'number') {
        const qtd = Number(p.quantidadeVendida) || 0;
        p.precoVendaUnitario = qtd > 0 && p.valorVendido ? Number(p.valorVendido) / qtd : 0;
        changed = true;
      }
      if (typeof p.dataVenda === 'undefined') {
        p.dataVenda = (Number(p.quantidadeVendida) || 0) > 0 ? p.data : '';
        changed = true;
      }
    });
    if (changed) saveDB();
  }

  // Monta um mensagem legível listando cada ingrediente faltante e a quantidade.
  function buildFaltaMessage(faltas) {
    if (!faltas.length) return '';
    if (faltas.length === 1) {
      const f = faltas[0];
      return `Estoque insuficiente de ${f.nome}. Faltam ${formatQuantityBase(f.faltanteBase, f.unidade)}.`;
    }
    const partes = faltas.map((f) => `${f.nome} (faltam ${formatQuantityBase(f.faltanteBase, f.unidade)})`);
    return `Estoque insuficiente para: ${partes.join('; ')}.`;
  }

  // Calcula, para uma receita + quantidade produzida, o total necessário de
  // cada ingrediente (agregando linhas repetidas), já convertido para a base
  // de estoque do próprio ingrediente.
  function computeNeededByIngredient(recipe, quantidadeProduzida) {
    const rendimento = Number(recipe.rendimento) || 1;
    const fator = quantidadeProduzida / rendimento;
    const neededByIngredient = {};
    recipe.ingredientes.forEach((item) => {
      const ing = getIngredient(item.ingredienteId);
      if (!ing) return; // ingrediente pode ter sido removido da receita/estoque anteriormente
      const usageBase = usageToBaseForIngredient(ing, item.quantidade, item.unidade) * fator;
      neededByIngredient[item.ingredienteId] = (neededByIngredient[item.ingredienteId] || 0) + usageBase;
    });
    return neededByIngredient;
  }

  // Verifica se uma produção é viável SEM alterar nada no banco de dados.
  // extraByIngredient (opcional) simula estoque adicional que seria devolvido
  // pela reversão de uma produção antiga, usado ao editar uma produção.
  function validateProductionFeasibility(recipe, quantidadeProduzida, extraByIngredient) {
    const neededByIngredient = computeNeededByIngredient(recipe, quantidadeProduzida);
    const faltas = [];
    Object.keys(neededByIngredient).forEach((ingId) => {
      const extra = extraByIngredient ? extraByIngredient[ingId] : null;
      const check = extra
        ? planConsumptionWithExtra(ingId, neededByIngredient[ingId], extra)
        : planConsumption(ingId, neededByIngredient[ingId]);
      if (!check.ok) {
        const ing = getIngredient(ingId);
        faltas.push({ ingredienteId: ingId, nome: ing ? ing.nome : 'Ingrediente removido', faltanteBase: check.faltanteBase, unidade: ing ? ing.unidade : 'unidade' });
      }
    });
    return { ok: faltas.length === 0, faltas, neededByIngredient };
  }

  // Aplica de fato o consumo de uma produção já validada como viável: debita
  // os lotes (FIFO), cria as movimentações e retorna exatamente quais lotes
  // foram usados — cada um com sua quantidade e seu custo real de retirada —
  // para permitir estorno exato e custo real (não em média) depois.
  function applyProductionConsumption(recipe, neededByIngredient, dataMov) {
    const consumos = [];
    const movementIds = [];
    let custoTotalReal = 0;
    Object.keys(neededByIngredient).forEach((ingId) => {
      const result = planConsumption(ingId, neededByIngredient[ingId]);
      // Não deve falhar aqui: a viabilidade já foi validada antes de chamar esta função.
      applyConsumptionPlan(result.plan);
      const total = result.plan.reduce((s, x) => s + x.quantidadeBase, 0);
      const custoIngrediente = result.plan.reduce((s, x) => s + (x.custo || 0), 0);
      custoTotalReal += custoIngrediente;
      const mov = addMovement({ tipo: 'Produção', ingredienteId: ingId, quantidadeBase: -total, data: dataMov || todayISO(), descricao: `Produção: ${recipe.nome}` });
      consumos.push({ ingredienteId: ingId, lots: result.plan.map((x) => ({ purchaseId: x.purchaseId, quantidadeBase: x.quantidadeBase, custo: x.custo })) });
      movementIds.push(mov.id);
    });
    return { consumos, movementIds, custoTotalReal };
  }

  function registerProduction(data) {
    const recipe = getRecipe(data.receitaId);
    if (!recipe) { toast('Selecione uma receita válida.', 'danger'); return null; }
    const quantidadeProduzida = Number(data.quantidadeProduzida) || 0;
    if (quantidadeProduzida <= 0) { toast('Informe uma quantidade produzida maior que zero.', 'danger'); return null; }

    const feasibility = validateProductionFeasibility(recipe, quantidadeProduzida);
    if (!feasibility.ok) {
      // Nada foi alterado no estoque: a operação inteira é cancelada.
      toast(buildFaltaMessage(feasibility.faltas), 'danger');
      return null;
    }

    const applied = applyProductionConsumption(recipe, feasibility.neededByIngredient, data.data);
    const production = {
      id: uid(),
      receitaId: recipe.id,
      receitaNome: recipe.nome,
      quantidadeProduzida,
      data: data.data || todayISO(),
      observacoes: data.observacoes || '',
      quantidadeVendida: 0,
      precoVendaUnitario: 0,
      dataVenda: '',
      custoTotal: applied.custoTotalReal, // congelado: custo real FIFO, nunca recalculado depois
      custoNaoRegistrado: false,
      consumos: applied.consumos,
      movementIds: applied.movementIds,
      criadoEm: Date.now(),
    };
    db.productions.push(production);
    saveDB();
    toast('Produção registrada e estoque atualizado.', 'success');
    return production;
  }

  // Calcula, a partir dos dados congelados/registrados de uma produção, todas
  // as métricas de venda e lucro exibidas na tela. O custo total é o valor
  // CONGELADO no momento da criação/edição da produção (o custo real FIFO
  // dos lotes efetivamente consumidos) — nunca recalculado com preços atuais.
  // Se o custo não puder ser recuperado com confiança (produção muito antiga,
  // de antes deste recurso existir), custoRegistrado vem false e nenhum valor
  // derivado de custo é inventado.
  function computeProductionMetrics(production) {
    const quantidadeProduzida = Number(production.quantidadeProduzida) || 0;
    const quantidadeVendida = Number(production.quantidadeVendida) || 0;
    const precoVendaUnitario = Number(production.precoVendaUnitario) || 0;
    const custoRegistrado = typeof production.custoTotal === 'number' && !production.custoNaoRegistrado;
    const custoTotal = custoRegistrado ? production.custoTotal : 0;
    const custoUnitario = custoRegistrado && quantidadeProduzida > 0 ? custoTotal / quantidadeProduzida : 0;
    const custoVendido = custoUnitario * quantidadeVendida;
    const faturamento = precoVendaUnitario * quantidadeVendida;
    const lucro = custoRegistrado ? faturamento - custoVendido : 0;
    const margemLucro = custoRegistrado && faturamento > 0 ? (lucro / faturamento) * 100 : 0;
    const quantidadeRestante = Math.max(0, quantidadeProduzida - quantidadeVendida);
    return { custoTotal, custoUnitario, custoVendido, faturamento, lucro, margemLucro, quantidadeRestante, custoRegistrado };
  }

  // Atualiza os dados de venda de uma produção já registrada. Nunca permite
  // vender mais do que foi produzido.
  function updateProductionSales(id, { quantidadeVendida, precoVendaUnitario, dataVenda }) {
    const p = db.productions.find((x) => x.id === id);
    if (!p) return { ok: false, message: 'Produção não encontrada.' };
    const qtd = Number(quantidadeVendida) || 0;
    if (qtd < 0) return { ok: false, message: 'A quantidade vendida não pode ser negativa.' };
    if (qtd > (Number(p.quantidadeProduzida) || 0) + EPS) {
      return { ok: false, message: `A quantidade vendida não pode ser maior do que a quantidade produzida (${formatNumber(p.quantidadeProduzida, 0)} un.).` };
    }
    const preco = Number(precoVendaUnitario) || 0;
    if (preco < 0) return { ok: false, message: 'O preço de venda não pode ser negativo.' };
    p.quantidadeVendida = qtd;
    p.precoVendaUnitario = preco;
    p.dataVenda = dataVenda || (qtd > 0 ? (p.dataVenda || p.data || todayISO()) : '');
    saveDB();
    return { ok: true };
  }

  // Desfaz completamente uma produção: devolve as quantidades exatamente aos
  // mesmos lotes de onde saíram, remove as movimentações originais dela e
  // cria movimentações de estorno para manter o histórico completo.
  function reverseProduction(production, opts) {
    opts = opts || {};
    let algumaFalha = false;
    (production.consumos || []).forEach((item) => {
      const restoredOk = reverseConsumptionPlan(item.lots);
      if (!restoredOk) algumaFalha = true;
      const total = item.lots.reduce((s, x) => s + x.quantidadeBase, 0);
      if (total > EPS && getIngredient(item.ingredienteId)) {
        addMovement({ tipo: 'Estorno', ingredienteId: item.ingredienteId, quantidadeBase: total, data: todayISO(), descricao: `Estorno de produção: ${production.receitaNome}` });
      }
    });
    if (production.movementIds && production.movementIds.length) {
      db.movements = db.movements.filter((m) => production.movementIds.indexOf(m.id) === -1);
    }
    if (algumaFalha && !opts.silent) {
      toast('Parte do estoque não pôde ser restituída porque o ingrediente correspondente foi excluído.', 'warning');
    }
    saveDB();
  }

  function deleteProduction(id) {
    const production = db.productions.find((p) => p.id === id);
    if (!production) return;
    reverseProduction(production);
    db.productions = db.productions.filter((p) => p.id !== id);
    saveDB();
  }

  // Edita uma produção já registrada: primeiro valida se a NOVA receita/
  // quantidade cabe no estoque atual somado ao que a produção ANTIGA devolveria
  // se fosse estornada (sem mutar nada ainda). Só depois de confirmar que cabe
  // é que a produção antiga é de fato revertida e a nova é aplicada — assim,
  // se a nova produção não couber no estoque, nada é alterado.
  function updateProduction(id, data) {
    const production = db.productions.find((p) => p.id === id);
    if (!production) return { ok: false, message: 'Produção não encontrada.' };
    const newRecipe = getRecipe(data.receitaId);
    if (!newRecipe) return { ok: false, message: 'Selecione uma receita válida.' };
    const newQuantidade = Number(data.quantidadeProduzida) || 0;
    if (newQuantidade <= 0) return { ok: false, message: 'Informe uma quantidade produzida maior que zero.' };

    // Mapa do que seria devolvido, por ingrediente e por lote, se a produção
    // antiga fosse estornada agora.
    const extraByIngredient = {};
    (production.consumos || []).forEach((item) => {
      const map = extraByIngredient[item.ingredienteId] = extraByIngredient[item.ingredienteId] || {};
      item.lots.forEach((l) => { map[l.purchaseId] = (map[l.purchaseId] || 0) + l.quantidadeBase; });
    });

    const feasibility = validateProductionFeasibility(newRecipe, newQuantidade, extraByIngredient);
    if (!feasibility.ok) {
      // Nada foi alterado: a produção antiga continua exatamente como estava.
      return { ok: false, message: buildFaltaMessage(feasibility.faltas) };
    }

    // Só agora, com a certeza de que a nova produção cabe, mutamos de fato:
    reverseProduction(production, { silent: true });
    const applied = applyProductionConsumption(newRecipe, computeNeededByIngredient(newRecipe, newQuantidade), data.data);

    production.receitaId = newRecipe.id;
    production.receitaNome = newRecipe.nome;
    production.quantidadeProduzida = newQuantidade;
    production.data = data.data || production.data;
    production.observacoes = data.observacoes || '';
    production.consumos = applied.consumos;
    production.movementIds = applied.movementIds;
    // Recongela o custo com os lotes REALMENTE consumidos agora (FIFO exato),
    // já que a edição é, na prática, uma "nova criação" da produção.
    production.custoTotal = applied.custoTotalReal;
    production.custoNaoRegistrado = false;
    // Se a nova quantidade produzida for menor que a já vendida, ajusta a
    // quantidade vendida para não ficar inconsistente (não pode vender mais do
    // que foi produzido).
    if ((Number(production.quantidadeVendida) || 0) > newQuantidade) {
      production.quantidadeVendida = newQuantidade;
    }
    saveDB();
    return { ok: true };
  }

  /* ======================================================================
     10. CÁLCULOS
     ====================================================================== */

  function addCalculation(calc) {
    const record = Object.assign({
      id: uid(), favorita: false, data: todayISO(), criadoEm: Date.now(),
    }, calc);
    db.calculations.push(record);
    saveDB();
    return record;
  }

  function toggleFavoriteCalculation(id) {
    const c = db.calculations.find((x) => x.id === id);
    if (!c) return;
    c.favorita = !c.favorita;
    saveDB();
  }

  function duplicateCalculation(id) {
    const c = db.calculations.find((x) => x.id === id);
    if (!c) return;
    addCalculation({ tipo: c.tipo, titulo: c.titulo, detalhes: c.detalhes, custoTotal: c.custoTotal, valorVenda: c.valorVenda });
    toast('Cálculo duplicado.', 'success');
  }

  function deleteCalculation(id) {
    db.calculations = db.calculations.filter((c) => c.id !== id);
    saveDB();
  }

  /* ======================================================================
     11. NAVEGAÇÃO / RENDER GERAL
     ====================================================================== */

  const VIEW_TITLES = {
    dashboard: ['Dashboard', 'Visão geral da sua confeitaria hoje'],
    estoque: ['Estoque', 'Ingredientes, lotes e níveis de estoque'],
    receitas: ['Receitas', 'Fichas técnicas e custos automáticos'],
    calculos: ['Cálculos', 'Calcule o valor de venda em segundos'],
    producoes: ['Produções', 'Registre produções e baixa automática de estoque'],
    movimentacoes: ['Movimentações', 'Extrato completo do seu estoque'],
    financeiro: ['Financeiro', 'Quanto você gastou, vendeu e lucrou'],
    configuracoes: ['Configurações', 'Preferências e backup dos seus dados'],
  };

  let currentView = 'dashboard';
  let currentCalcTab = 'receita';
  let currentCaixaItems = [];
  let currentProducaoPeriodo = 'mes';
  let producaoPeriodoCustomFrom = '';
  let producaoPeriodoCustomTo = '';
  let currentFinanceiroPeriodo = 'mes';
  let financeiroPeriodoCustomFrom = '';
  let financeiroPeriodoCustomTo = '';

  function goToView(view) {
    currentView = view;
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    document.getElementById('view-' + view).classList.add('active');
    document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    document.getElementById('viewTitle').textContent = VIEW_TITLES[view][0];
    document.getElementById('viewSubtitle').textContent = VIEW_TITLES[view][1];
    renderView(view);
  }

  function renderView(view) {
    if (view === 'dashboard') renderDashboard();
    else if (view === 'estoque') renderEstoque();
    else if (view === 'receitas') renderReceitas();
    else if (view === 'calculos') renderCalculos();
    else if (view === 'producoes') renderProducoes();
    else if (view === 'movimentacoes') renderMovimentacoes();
    else if (view === 'financeiro') renderFinanceiro();
    else if (view === 'configuracoes') renderConfiguracoes();
  }

  // Atualiza TODAS as telas do sistema, não apenas a que está visível no
  // momento. Isso garante que, ao voltar para qualquer tela (Dashboard,
  // Estoque, Receitas, Produções, Movimentações, Cálculos, Configurações), os
  // dados — e todos os campos de seleção (selects) que dependem deles — já
  // estejam atualizados, sem nunca depender de recarregar a página (F5).
  //
  // Exceção deliberada: o FORMULÁRIO ativo de Cálculos (renderCalcForm) não é
  // reconstruído aqui, para não apagar um cálculo que o usuário esteja
  // digitando no momento em outra aba; o histórico de cálculos (que não tem
  // esse risco) é sempre atualizado normalmente.
  function renderAll() {
    renderDashboard();
    renderEstoque();
    renderReceitas();
    renderProducaoResumo();
    renderProducaoLista();
    renderMovimentacoes();
    renderCalcHistory();
    renderFinanceiro();
    renderConfiguracoes();
  }

  /* ======================================================================
     12. RENDER: DASHBOARD
     ====================================================================== */

  function renderDashboard() {
    const container = document.getElementById('dashboardContainer');
    const totalIngredientes = db.ingredients.length;
    const baixoEstoque = db.ingredients.filter((i) => getStockStatus(i).level !== 'ok');
    const vencendo = [];
    db.ingredients.forEach((i) => {
      const nextV = getNextValidade(i.id);
      if (nextV) {
        const st = getValidadeStatus(nextV);
        if (st.level !== 'ok') vencendo.push({ ing: i, validade: nextV, status: st });
      }
    });
    const totalReceitas = db.recipes.length;
    const ultimaProducao = [...db.productions].sort((a, b) => b.criadoEm - a.criadoEm)[0];
    const ultimoCalculo = [...db.calculations].sort((a, b) => b.criadoEm - a.criadoEm)[0];

    container.innerHTML = `
      <div class="dash-grid">
        <div class="stat-card tone-primary">
          <div class="stat-icon">${ICONS.box}</div>
          <div class="stat-value">${totalIngredientes}</div>
          <div class="stat-label">Ingredientes cadastrados</div>
        </div>
        <div class="stat-card tone-warn">
          <div class="stat-icon">${ICONS.warn}</div>
          <div class="stat-value">${baixoEstoque.length}</div>
          <div class="stat-label">Com estoque baixo</div>
        </div>
        <div class="stat-card tone-danger">
          <div class="stat-icon">${ICONS.clock}</div>
          <div class="stat-value">${vencendo.length}</div>
          <div class="stat-label">Vencendo ou vencidos</div>
        </div>
        <div class="stat-card tone-gold">
          <div class="stat-icon">${ICONS.book}</div>
          <div class="stat-value">${totalReceitas}</div>
          <div class="stat-label">Receitas cadastradas</div>
        </div>
      </div>

      <div class="dash-panels">
        <div class="panel">
          <h3>${ICONS.box} Resumo do estoque</h3>
          ${
            db.ingredients.length
              ? db.ingredients.slice(0, 8).map((i) => {
                  const stockBase = getStockBase(i.id);
                  return `<div class="mini-row"><span class="name">${escapeHtml(i.nome)}</span><span class="value">${formatQuantityBase(stockBase, i.unidade)}</span></div>`;
                }).join('')
              : `<p class="confirm-text">Nenhum ingrediente cadastrado ainda.</p>`
          }
        </div>

        <div class="panel">
          <h3>${ICONS.warn} Estoque baixo &amp; validade</h3>
          ${
            baixoEstoque.length === 0 && vencendo.length === 0
              ? `<p class="confirm-text">Tudo certo por aqui — nenhum alerta no momento.</p>`
              : `
                ${baixoEstoque.slice(0, 5).map((i) => `<div class="mini-row"><span class="name">${escapeHtml(i.nome)}</span><span class="tag-badge tag-warn">Estoque baixo</span></div>`).join('')}
                ${vencendo.slice(0, 5).map((v) => `<div class="mini-row"><span class="name">${escapeHtml(v.ing.nome)}</span><span class="tag-badge tag-${v.status.level}">${v.status.label}</span></div>`).join('')}
              `
          }
        </div>

        <div class="panel">
          <h3>${ICONS.factory} Última produção</h3>
          ${
            ultimaProducao
              ? `<div class="mini-row"><span class="name">${escapeHtml(ultimaProducao.receitaNome)}</span><span class="value">${formatNumber(ultimaProducao.quantidadeProduzida, 0)} un.</span></div>
                 <div class="mini-row"><span class="name">Data</span><span class="value">${formatDateBR(ultimaProducao.data)}</span></div>`
              : `<p class="confirm-text">Nenhuma produção registrada ainda.</p>`
          }
        </div>

        <div class="panel">
          <h3>${ICONS.calc} Último cálculo</h3>
          ${
            ultimoCalculo
              ? `<div class="mini-row"><span class="name">${escapeHtml(ultimoCalculo.titulo)}</span><span class="value">${formatMoney(ultimoCalculo.valorVenda)}</span></div>
                 <div class="mini-row"><span class="name">Custo</span><span class="value">${formatMoney(ultimoCalculo.custoTotal)}</span></div>`
              : `<p class="confirm-text">Nenhum cálculo realizado ainda.</p>`
          }
        </div>
      </div>
    `;
  }

  /* ======================================================================
     13. RENDER: ESTOQUE
     ====================================================================== */

  function renderEstoque() {
    const grid = document.getElementById('estoqueGrid');
    const term = (document.getElementById('estoqueSearch').value || '').toLowerCase().trim();
    const list = db.ingredients
      .filter((i) => i.nome.toLowerCase().includes(term))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    if (!list.length) {
      grid.innerHTML = `<div class="empty-state">${ICONS.box2}<strong>Nenhum ingrediente encontrado</strong>Cadastre seu primeiro ingrediente para começar a controlar o estoque.</div>`;
      return;
    }

    grid.innerHTML = list.map((ing) => {
      const stockBase = getStockBase(ing.id);
      const minBase = toBase(ing.estoqueMinimo || 0, ing.unidade);
      const status = getStockStatus(ing);
      const pct = minBase > 0 ? Math.min(100, Math.max(4, (stockBase / (minBase * 2)) * 100)) : (stockBase > 0 ? 100 : 0);
      const nextV = getNextValidade(ing.id);
      const vStatus = nextV ? getValidadeStatus(nextV) : null;
      return `
        <div class="ing-card" data-ingredient-id="${ing.id}">
          <div class="ing-card-top">
            <h3>${escapeHtml(ing.nome)}</h3>
            <span class="tag-badge tag-${status.level}">${status.label}</span>
          </div>
          <div class="ing-qty"><b>${formatQuantityBase(stockBase, ing.unidade)}</b> em estoque</div>
          <div class="bar-track"><div class="bar-fill ${status.level === 'danger' ? 'empty' : status.level === 'warn' ? 'low' : ''}" style="width:${pct}%"></div></div>
          <div class="ing-meta">
            <span>Mínimo: ${formatQuantityBase(minBase, ing.unidade)}</span>
            <span>${nextV ? `Validade: ${formatDateBR(nextV)}` : 'Sem lote com validade'}</span>
          </div>
          ${vStatus && vStatus.level !== 'ok' ? `<span class="tag-badge tag-${vStatus.level}">${vStatus.label}</span>` : ''}
          <div class="ing-actions">
            <button class="btn btn-sm" data-action="editar-ingrediente" data-id="${ing.id}">${ICONS.edit} Editar</button>
            <button class="btn btn-sm" data-action="comprar-ingrediente" data-id="${ing.id}">${ICONS.cart} Comprar</button>
            <button class="btn btn-sm" data-action="movimentar-ingrediente" data-id="${ing.id}">${ICONS.move} Movimentar</button>
            <button class="btn btn-sm btn-danger" data-action="excluir-ingrediente" data-id="${ing.id}">${ICONS.trash}</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function openIngredientModal(id) {
    const editing = id ? getIngredient(id) : null;
    const hasPurchases = editing ? db.purchases.some((p) => p.ingredienteId === editing.id) : false;
    openModal({
      title: editing ? 'Editar ingrediente' : 'Novo ingrediente',
      bodyHTML: `
        <div class="form-grid">
          <div class="field span-2">
            <label>Nome do ingrediente</label>
            <input type="text" id="fNome" value="${editing ? escapeHtml(editing.nome) : ''}" placeholder="Ex.: Chocolate em pó">
          </div>
          <div class="field">
            <label>Unidade</label>
            <select id="fUnidade" ${hasPurchases ? 'disabled' : ''}>
              <option value="g" ${editing && editing.unidade === 'g' ? 'selected' : ''}>Grama (g)</option>
              <option value="kg" ${editing && editing.unidade === 'kg' ? 'selected' : ''}>Quilo (kg)</option>
              <option value="ml" ${editing && editing.unidade === 'ml' ? 'selected' : ''}>Mililitro (ml)</option>
              <option value="L" ${editing && editing.unidade === 'L' ? 'selected' : ''}>Litro (L)</option>
              <option value="unidade" ${editing && editing.unidade === 'unidade' ? 'selected' : ''}>Unidade</option>
            </select>
            ${hasPurchases ? `<span class="hint">Não é possível alterar a unidade de um ingrediente que já possui compras.</span>` : ''}
          </div>
          <div class="field">
            <label>Estoque mínimo</label>
            <input type="number" min="0" step="any" id="fMinimo" value="${editing ? editing.estoqueMinimo : ''}" placeholder="0">
          </div>
          <div class="field span-2" id="pesoPorUnidadeField" style="display:${editing && editing.unidade === 'unidade' ? 'flex' : 'none'}">
            <label>Peso por unidade em g (opcional)</label>
            <input type="number" min="0" step="any" id="fPeso" value="${editing && editing.pesoPorUnidade ? editing.pesoPorUnidade : ''}" placeholder="Ex.: 50 (peso médio de 1 ovo)">
            <span class="hint">Usado para permitir uso em receitas por peso.</span>
          </div>
          <div class="field span-2">
            <label>Observação</label>
            <textarea id="fObs" placeholder="Opcional">${editing ? escapeHtml(editing.observacao || '') : ''}</textarea>
          </div>
        </div>
      `,
      footerHTML: `
        <button class="btn btn-ghost" data-action="fechar-modal">Cancelar</button>
        <button class="btn btn-primary" id="saveIngredientBtn">${editing ? 'Salvar alterações' : 'Cadastrar ingrediente'}</button>
      `,
      onMount: () => {
        document.getElementById('fUnidade').addEventListener('change', (e) => {
          document.getElementById('pesoPorUnidadeField').style.display = e.target.value === 'unidade' ? 'flex' : 'none';
        });
        document.getElementById('saveIngredientBtn').addEventListener('click', () => {
          const nome = document.getElementById('fNome').value.trim();
          if (!nome) { toast('Informe o nome do ingrediente.', 'danger'); return; }
          if (Number(document.getElementById('fMinimo').value) < 0) { toast('O estoque mínimo não pode ser negativo.', 'danger'); return; }
          const pesoField = document.getElementById('fPeso');
          if (pesoField && Number(pesoField.value) < 0) { toast('O peso por unidade não pode ser negativo.', 'danger'); return; }
          const data = {
            nome,
            unidade: document.getElementById('fUnidade').value,
            estoqueMinimo: document.getElementById('fMinimo').value,
            pesoPorUnidade: document.getElementById('fPeso') ? document.getElementById('fPeso').value : null,
            observacao: document.getElementById('fObs').value,
          };
          if (editing) {
            const result = updateIngredient(editing.id, data);
            if (!result.ok) { toast(result.message, 'danger'); return; }
          } else {
            addIngredient(data);
          }
          closeModal();
          renderAll();
          toast(editing ? 'Ingrediente atualizado.' : 'Ingrediente cadastrado.', 'success');
        });
      },
    });
  }

  function openDeleteIngredientConfirm(id) {
    const ing = getIngredient(id);
    if (!ing) return;
    const nCompras = db.purchases.filter((p) => p.ingredienteId === id).length;
    const nMov = db.movements.filter((m) => m.ingredienteId === id).length;
    const nReceitas = db.recipes.filter((r) => r.ingredientes.some((it) => it.ingredienteId === id)).length;
    const nProducoesAfetadas = db.productions.filter((p) => (p.consumos || []).some((c) => c.ingredienteId === id)).length;
    openConfirm({
      title: 'Excluir ingrediente',
      message: `Deseja realmente excluir <strong>${escapeHtml(ing.nome)}</strong>? Isso removerá ${nCompras} compra(s), ${nMov} movimentação(ões) e a referência dele em ${nReceitas} receita(s).${nProducoesAfetadas ? ` ${nProducoesAfetadas} produção(ões) já consumiram este ingrediente e não poderão mais tê-lo estornado caso sejam excluídas ou editadas.` : ''}`,
      confirmLabel: 'Excluir tudo',
      danger: true,
      onConfirm: () => { deleteIngredient(id); renderAll(); toast('Ingrediente excluído.', 'success'); },
    });
  }

  function openPurchaseModal(ingredienteId, purchaseId) {
    const ing = getIngredient(ingredienteId);
    const editing = purchaseId ? db.purchases.find((p) => p.id === purchaseId) : null;

    function renderList() {
      const items = getPurchasesFor(ingredienteId).slice().reverse();
      const listEl = document.getElementById('purchaseListArea');
      if (!listEl) return;
      if (!items.length) { listEl.innerHTML = `<p class="confirm-text">Nenhuma compra registrada ainda.</p>`; return; }
      listEl.innerHTML = items.map((p) => `
        <div class="mini-row">
          <span class="name">${escapeHtml(p.marca || 'Sem marca')} — ${formatNumber(p.quantidade, 2)} ${ing.unidade} (${formatMoney(p.valorUnitario)}/${ing.unidade}) · ${formatDateBR(p.dataCompra)}</span>
          <span style="display:flex; gap:6px;">
            <button class="btn btn-sm btn-icon" data-action="editar-compra" data-id="${p.id}" data-ing="${ingredienteId}" title="Editar">${ICONS.edit}</button>
            <button class="btn btn-sm btn-icon" data-action="duplicar-compra" data-id="${p.id}" data-ing="${ingredienteId}" title="Duplicar">${ICONS.plus}</button>
            <button class="btn btn-sm btn-icon btn-danger" data-action="excluir-compra" data-id="${p.id}" data-ing="${ingredienteId}" title="Excluir">${ICONS.trash}</button>
          </span>
        </div>
      `).join('');
    }

    openModal({
      title: `Compras — ${ing.nome}`,
      wide: true,
      bodyHTML: `
        <div class="form-grid cols-3">
          <div class="field">
            <label>Marca</label>
            <input type="text" id="pMarca" value="${editing ? escapeHtml(editing.marca) : ''}" placeholder="Ex.: Nestlé">
          </div>
          <div class="field">
            <label>Quantidade (${ing.unidade})</label>
            <input type="number" min="0" step="any" id="pQuantidade" value="${editing ? editing.quantidade : ''}" placeholder="0">
          </div>
          <div class="field">
            <label>Valor total pago (R$)</label>
            <input type="number" min="0" step="any" id="pValorTotal" value="${editing ? editing.valorTotal : ''}" placeholder="0,00">
          </div>
          <div class="field">
            <label>Validade</label>
            <input type="date" id="pValidade" value="${editing ? editing.validade : ''}">
          </div>
          <div class="field">
            <label>Data da compra</label>
            <input type="date" id="pData" value="${editing ? editing.dataCompra : todayISO()}">
          </div>
          <div class="field">
            <label>Valor unitário (automático)</label>
            <input type="text" id="pValorUnitario" value="" disabled>
          </div>
        </div>
        <div class="form-actions" style="margin-top:10px;">
          <button class="btn btn-primary" id="savePurchaseBtn">${editing ? 'Salvar alterações' : 'Adicionar compra'}</button>
        </div>
        <h2 class="section-title" style="margin-top:22px; font-size:15px;">Lotes já registrados</h2>
        <div class="modal-sub-list" id="purchaseListArea"></div>
      `,
      onMount: () => {
        const recalc = () => {
          const q = Number(document.getElementById('pQuantidade').value) || 0;
          const v = Number(document.getElementById('pValorTotal').value) || 0;
          document.getElementById('pValorUnitario').value = q > 0 ? formatMoney(v / q) : '—';
        };
        document.getElementById('pQuantidade').addEventListener('input', recalc);
        document.getElementById('pValorTotal').addEventListener('input', recalc);
        recalc();
        renderList();
        document.getElementById('savePurchaseBtn').addEventListener('click', () => {
          const data = {
            marca: document.getElementById('pMarca').value,
            quantidade: document.getElementById('pQuantidade').value,
            valorTotal: document.getElementById('pValorTotal').value,
            validade: document.getElementById('pValidade').value,
            dataCompra: document.getElementById('pData').value,
          };
          if (!data.quantidade || Number(data.quantidade) <= 0) { toast('Informe uma quantidade válida.', 'danger'); return; }
          if (Number(data.valorTotal) < 0) { toast('O valor total não pode ser negativo.', 'danger'); return; }
          if (editing) {
            const result = updatePurchase(editing.id, data);
            if (!result.ok) { toast(result.message, 'danger'); return; }
            toast('Compra atualizada.', 'success');
          } else {
            addPurchase(ingredienteId, data);
            toast('Compra registrada.', 'success');
          }
          renderAll();
          openPurchaseModal(ingredienteId); // reabre limpo para continuar cadastrando
        });
      },
    });
  }

  function openMovimentarModal(ingredienteId) {
    const ing = getIngredient(ingredienteId);
    const stockBase = getStockBase(ingredienteId);
    openModal({
      title: `Movimentar — ${ing.nome}`,
      bodyHTML: `
        <div class="form-grid">
          <div class="field span-2">
            <label>Tipo de movimentação</label>
            <select id="mTipo">
              <option value="Consumo pessoal">Consumo pessoal</option>
              <option value="Degustação">Degustação</option>
              <option value="Perda">Perda</option>
              <option value="Ajuste manual">Ajuste manual (informar estoque real)</option>
            </select>
          </div>
          <div class="field" id="qtyFieldWrap">
            <label id="qtyLabel">Quantidade (${ing.unidade})</label>
            <input type="number" min="0" step="any" id="mQuantidade" placeholder="0">
          </div>
          <div class="field">
            <label>Estoque atual</label>
            <input type="text" value="${formatQuantityBase(stockBase, ing.unidade)}" disabled>
          </div>
          <div class="field span-2">
            <label>Descrição (opcional)</label>
            <input type="text" id="mDesc" placeholder="Ex.: usado em teste de receita">
          </div>
        </div>
      `,
      footerHTML: `
        <button class="btn btn-ghost" data-action="fechar-modal">Cancelar</button>
        <button class="btn btn-primary" id="saveMovBtn">Registrar</button>
      `,
      onMount: () => {
        const tipoSel = document.getElementById('mTipo');
        const qtyLabel = document.getElementById('qtyLabel');
        tipoSel.addEventListener('change', () => {
          qtyLabel.textContent = tipoSel.value === 'Ajuste manual'
            ? `Estoque real agora (${ing.unidade})`
            : `Quantidade (${ing.unidade})`;
        });
        document.getElementById('saveMovBtn').addEventListener('click', () => {
          const tipo = tipoSel.value;
          const qtyInput = Number(document.getElementById('mQuantidade').value);
          const desc = document.getElementById('mDesc').value;
          if (isNaN(qtyInput) || qtyInput < 0) { toast('Informe um valor válido.', 'danger'); return; }
          if (tipo === 'Ajuste manual') {
            const realBase = toBase(qtyInput, ing.unidade);
            const delta = realBase - getStockBase(ingredienteId);
            if (Math.abs(delta) < EPS) { toast('Nenhuma diferença em relação ao estoque atual.', 'warning'); return; }
            const result = addAdjustment(ingredienteId, delta, desc || 'Ajuste manual de estoque');
            if (!result.ok) { toast(result.message, 'danger'); return; }
          } else {
            const qtyBase = toBase(qtyInput, ing.unidade);
            if (qtyBase <= 0) { toast('Informe uma quantidade maior que zero.', 'danger'); return; }
            const result = consumeStockOrFail(ingredienteId, qtyBase, tipo, desc || tipo, todayISO());
            if (!result.ok) { toast(result.message, 'danger'); return; }
            saveDB();
          }
          closeModal();
          renderAll();
          toast('Movimentação registrada.', 'success');
        });
      },
    });
  }

  /* ======================================================================
     14. RENDER: RECEITAS
     ====================================================================== */

  function renderReceitas() {
    const grid = document.getElementById('receitasGrid');
    const term = (document.getElementById('receitasSearch').value || '').toLowerCase().trim();
    const list = db.recipes
      .filter((r) => r.nome.toLowerCase().includes(term))
      .sort((a, b) => (b.favorita - a.favorita) || a.nome.localeCompare(b.nome, 'pt-BR'));

    if (!list.length) {
      grid.innerHTML = `<div class="empty-state">${ICONS.book}<strong>Nenhuma receita encontrada</strong>Cadastre sua primeira ficha técnica para calcular custos automaticamente.</div>`;
      return;
    }

    grid.innerHTML = list.map((r) => {
      const cost = computeRecipeCost(r);
      return `
        <div class="recipe-card" data-recipe-id="${r.id}">
          <div class="recipe-card-top">
            <h3><button class="star-btn" data-action="favoritar-receita" data-id="${r.id}" title="Favoritar">${r.favorita ? ICONS.starFilled : ICONS.star}</button> ${escapeHtml(r.nome)}</h3>
          </div>
          <div class="ing-meta"><span>${r.ingredientes.length} ingrediente(s)</span><span>Rende ${formatNumber(r.rendimento, 0)} un.</span></div>
          <div class="recipe-price-row"><span>Custo total</span><b>${formatMoney(cost.custoTotal)}</b></div>
          <div class="recipe-price-row"><span>Custo por unidade</span><b>${formatMoney(cost.custoUnitario)}</b></div>
          <div class="recipe-sell">${formatMoney(cost.valorVendaUnitario)} <span style="font-size:11px; color:var(--muted); font-family:var(--font-body);">venda/un.</span></div>
          <div class="recipe-actions">
            <button class="btn btn-sm" data-action="editar-receita" data-id="${r.id}">${ICONS.edit} Editar</button>
            <button class="btn btn-sm btn-danger" data-action="excluir-receita" data-id="${r.id}">${ICONS.trash} Excluir</button>
          </div>
        </div>
      `;
    }).join('');
  }

  let recipeIngredientRows = [];

  function openRecipeModal(id) {
    const editing = id ? getRecipe(id) : null;
    recipeIngredientRows = editing
      ? editing.ingredientes.map((it) => Object.assign({ rowId: uid() }, it))
      : [];

    function ingredientOptions(selectedId, unitFamily) {
      return db.ingredients
        .filter((i) => !unitFamily || familyOf(i.unidade) === unitFamily || !selectedId)
        .map((i) => `<option value="${i.id}" ${i.id === selectedId ? 'selected' : ''}>${escapeHtml(i.nome)}</option>`).join('');
    }

    function unitOptions(ingredienteId, selectedUnit) {
      const ing = getIngredient(ingredienteId);
      const units = unitOptionsForIngredient(ing);
      return units.map((u) => `<option value="${u}" ${u === selectedUnit ? 'selected' : ''}>${u}</option>`).join('');
    }

    function renderRows() {
      const wrap = document.getElementById('recipeIngredientRows');
      if (!wrap) return;
      if (!db.ingredients.length) {
        wrap.innerHTML = `<p class="confirm-text">Cadastre ingredientes no Estoque antes de montar receitas.</p>`;
      } else if (!recipeIngredientRows.length) {
        wrap.innerHTML = `<p class="confirm-text">Nenhum ingrediente adicionado ainda.</p>`;
      } else {
        wrap.innerHTML = recipeIngredientRows.map((row) => `
          <div class="ingredient-row" data-row-id="${row.rowId}">
            <div class="field">
              <label>Ingrediente</label>
              <select data-role="ing-select" data-row="${row.rowId}">${ingredientOptions(row.ingredienteId)}</select>
            </div>
            <div class="field">
              <label>Quantidade</label>
              <input type="number" min="0" step="any" data-role="ing-qty" data-row="${row.rowId}" value="${row.quantidade || ''}">
            </div>
            <div class="field">
              <label>Unid.</label>
              <select data-role="ing-unit" data-row="${row.rowId}">${unitOptions(row.ingredienteId, row.unidade)}</select>
            </div>
            <button class="btn btn-sm btn-icon btn-danger" data-action="remover-linha-receita" data-row="${row.rowId}" type="button">${ICONS.trash}</button>
          </div>
        `).join('');
        wrap.querySelectorAll('[data-role="ing-select"]').forEach((sel) => {
          sel.addEventListener('change', (e) => {
            const row = recipeIngredientRows.find((r) => r.rowId === e.target.dataset.row);
            row.ingredienteId = e.target.value;
            const ing = getIngredient(row.ingredienteId);
            row.unidade = ing ? unitOptionsForIngredient(ing)[0] : 'g';
            renderRows();
            updatePreview();
          });
        });
        wrap.querySelectorAll('[data-role="ing-qty"]').forEach((inp) => {
          inp.addEventListener('input', (e) => {
            const row = recipeIngredientRows.find((r) => r.rowId === e.target.dataset.row);
            row.quantidade = e.target.value;
            updatePreview();
          });
        });
        wrap.querySelectorAll('[data-role="ing-unit"]').forEach((sel) => {
          sel.addEventListener('change', (e) => {
            const row = recipeIngredientRows.find((r) => r.rowId === e.target.dataset.row);
            row.unidade = e.target.value;
            updatePreview();
          });
        });
      }
      updatePreview();
    }

    function collectValidRows() {
      return recipeIngredientRows
        .filter((r) => r.ingredienteId && Number(r.quantidade) > 0)
        .map((r) => ({ ingredienteId: r.ingredienteId, quantidade: Number(r.quantidade), unidade: r.unidade }));
    }

    function updatePreview() {
      const rendimento = Number(document.getElementById('rRendimento').value) || 0;
      const tempRecipe = { ingredientes: collectValidRows(), rendimento };
      const cost = computeRecipeCost(tempRecipe);
      const preview = document.getElementById('recipeCostPreview');
      if (preview) {
        preview.innerHTML = `
          <div class="item"><span>Custo total</span><b>${formatMoney(cost.custoTotal)}</b></div>
          <div class="item"><span>Custo por unidade</span><b>${formatMoney(cost.custoUnitario)}</b></div>
          <div class="item"><span>Venda sugerida (un.)</span><b>${formatMoney(cost.valorVendaUnitario)}</b></div>
        `;
      }
    }

    openModal({
      title: editing ? 'Editar receita' : 'Nova receita',
      wide: true,
      bodyHTML: `
        <div class="form-grid">
          <div class="field span-2">
            <label>Nome da receita</label>
            <input type="text" id="rNome" value="${editing ? escapeHtml(editing.nome) : ''}" placeholder="Ex.: Brigadeiro tradicional">
          </div>
          <div class="field">
            <label>Rendimento (unidades produzidas)</label>
            <input type="number" min="1" step="any" id="rRendimento" value="${editing ? editing.rendimento : ''}" placeholder="Ex.: 30">
          </div>
        </div>
        <h2 class="section-title" style="font-size:15px; margin:18px 0 6px;">Ingredientes da receita</h2>
        <div class="ingredient-row-list" id="recipeIngredientRows"></div>
        <button class="btn btn-sm" id="addIngredientRowBtn" type="button">${ICONS.plus} Adicionar ingrediente</button>
        <div class="recipe-cost-preview" id="recipeCostPreview"></div>
        <div class="field" style="margin-top:14px;">
          <label>Observações</label>
          <textarea id="rObs" placeholder="Opcional">${editing ? escapeHtml(editing.observacoes || '') : ''}</textarea>
        </div>
      `,
      footerHTML: `
        <button class="btn btn-ghost" data-action="fechar-modal">Cancelar</button>
        <button class="btn btn-primary" id="saveRecipeBtn">${editing ? 'Salvar alterações' : 'Cadastrar receita'}</button>
      `,
      onMount: () => {
        renderRows();
        document.getElementById('rRendimento').addEventListener('input', updatePreview);
        document.getElementById('addIngredientRowBtn').addEventListener('click', () => {
          if (!db.ingredients.length) { toast('Cadastre ao menos um ingrediente primeiro.', 'warning'); return; }
          const first = db.ingredients[0];
          recipeIngredientRows.push({ rowId: uid(), ingredienteId: first.id, quantidade: '', unidade: compatibleUnitsFor(first.unidade)[0] });
          renderRows();
        });
        // Remoção de linhas de ingrediente (delegação local, escopada ao próprio modal)
        document.getElementById('recipeIngredientRows').addEventListener('click', (e) => {
          const btn = e.target.closest('[data-action="remover-linha-receita"]');
          if (!btn) return;
          recipeIngredientRows = recipeIngredientRows.filter((r) => r.rowId !== btn.dataset.row);
          renderRows();
        });
        document.getElementById('saveRecipeBtn').addEventListener('click', () => {
          const nome = document.getElementById('rNome').value.trim();
          const rendimento = document.getElementById('rRendimento').value;
          if (!nome) { toast('Informe o nome da receita.', 'danger'); return; }
          if (!rendimento || Number(rendimento) <= 0) { toast('Informe um rendimento válido.', 'danger'); return; }
          const data = {
            nome, rendimento, ingredientes: collectValidRows(),
            observacoes: document.getElementById('rObs').value,
          };
          if (editing) updateRecipe(editing.id, data); else addRecipe(data);
          closeModal();
          renderAll();
          toast(editing ? 'Receita atualizada.' : 'Receita cadastrada.', 'success');
        });
      },
    });

    // delegação para remover linha (o listener de clique global cuida disso)
  }

  function openDeleteRecipeConfirm(id) {
    const r = getRecipe(id);
    if (!r) return;
    openConfirm({
      title: 'Excluir receita',
      message: `Deseja realmente excluir a receita <strong>${escapeHtml(r.nome)}</strong>? Produções e cálculos já registrados permanecerão no histórico.`,
      confirmLabel: 'Excluir',
      danger: true,
      onConfirm: () => { deleteRecipe(id); renderAll(); toast('Receita excluída.', 'success'); },
    });
  }

  /* ======================================================================
     15. RENDER: CÁLCULOS
     ====================================================================== */

  function renderCalculos() {
    document.querySelectorAll('.calc-tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tipo === currentCalcTab));
    renderCalcForm();
    renderCalcHistory();
  }

  function renderCalcForm() {
    const container = document.getElementById('calculoFormContainer');
    if (!db.recipes.length) {
      container.innerHTML = `<p class="confirm-text">Cadastre uma receita antes de fazer cálculos.</p>`;
      return;
    }
    const recipeOptions = db.recipes.map((r) => `<option value="${r.id}">${escapeHtml(r.nome)}</option>`).join('');

    if (currentCalcTab === 'receita') {
      container.innerHTML = `
        <div class="form-grid">
          <div class="field span-2"><label>Receita</label><select id="calcReceita">${recipeOptions}</select></div>
        </div>
        <div class="recipe-cost-preview" id="calcPreview"></div>
        <div class="form-actions"><button class="btn btn-primary" id="calcSalvarBtn">Salvar cálculo</button></div>
      `;
      const update = () => {
        const r = getRecipe(document.getElementById('calcReceita').value);
        const cost = computeRecipeCost(r);
        document.getElementById('calcPreview').innerHTML = previewHTML(cost.custoTotal, cost.valorVendaTotal);
      };
      document.getElementById('calcReceita').addEventListener('change', update);
      update();
      document.getElementById('calcSalvarBtn').addEventListener('click', () => {
        const r = getRecipe(document.getElementById('calcReceita').value);
        const cost = computeRecipeCost(r);
        addCalculation({ tipo: 'receita', titulo: `Receita inteira — ${r.nome}`, detalhes: { receitaId: r.id, receitaNome: r.nome }, custoTotal: cost.custoTotal, valorVenda: cost.valorVendaTotal });
        renderAll();
        toast('Cálculo salvo no histórico.', 'success');
      });
    }

    else if (currentCalcTab === 'quantidade') {
      container.innerHTML = `
        <div class="form-grid">
          <div class="field"><label>Receita</label><select id="calcReceita">${recipeOptions}</select></div>
          <div class="field"><label>Quantidade desejada (un.)</label><input type="number" min="1" step="any" id="calcQtd" value="1"></div>
        </div>
        <div class="recipe-cost-preview" id="calcPreview"></div>
        <div class="form-actions"><button class="btn btn-primary" id="calcSalvarBtn">Salvar cálculo</button></div>
      `;
      const update = () => {
        const r = getRecipe(document.getElementById('calcReceita').value);
        const qtd = Number(document.getElementById('calcQtd').value) || 0;
        const cost = computeRecipeCost(r);
        const custo = cost.custoUnitario * qtd;
        const venda = cost.valorVendaUnitario * qtd;
        document.getElementById('calcPreview').innerHTML = previewHTML(custo, venda);
      };
      document.getElementById('calcReceita').addEventListener('change', update);
      document.getElementById('calcQtd').addEventListener('input', update);
      update();
      document.getElementById('calcSalvarBtn').addEventListener('click', () => {
        const r = getRecipe(document.getElementById('calcReceita').value);
        const qtd = Number(document.getElementById('calcQtd').value) || 0;
        const cost = computeRecipeCost(r);
        const custo = cost.custoUnitario * qtd;
        const venda = cost.valorVendaUnitario * qtd;
        addCalculation({ tipo: 'quantidade', titulo: `${formatNumber(qtd, 0)}x ${r.nome}`, detalhes: { receitaId: r.id, receitaNome: r.nome, quantidade: qtd }, custoTotal: custo, valorVenda: venda });
        renderAll();
        toast('Cálculo salvo no histórico.', 'success');
      });
    }

    else if (currentCalcTab === 'cento') {
      container.innerHTML = `
        <div class="form-grid">
          <div class="field span-2"><label>Receita</label><select id="calcReceita">${recipeOptions}</select></div>
        </div>
        <div class="recipe-cost-preview" id="calcPreview"></div>
        <div class="form-actions"><button class="btn btn-primary" id="calcSalvarBtn">Salvar cálculo</button></div>
      `;
      const update = () => {
        const r = getRecipe(document.getElementById('calcReceita').value);
        const cost = computeRecipeCost(r);
        document.getElementById('calcPreview').innerHTML = previewHTML(cost.custoUnitario * 100, cost.valorVendaUnitario * 100);
      };
      document.getElementById('calcReceita').addEventListener('change', update);
      update();
      document.getElementById('calcSalvarBtn').addEventListener('click', () => {
        const r = getRecipe(document.getElementById('calcReceita').value);
        const cost = computeRecipeCost(r);
        addCalculation({ tipo: 'cento', titulo: `Cento — ${r.nome}`, detalhes: { receitaId: r.id, receitaNome: r.nome }, custoTotal: cost.custoUnitario * 100, valorVenda: cost.valorVendaUnitario * 100 });
        renderAll();
        toast('Cálculo salvo no histórico.', 'success');
      });
    }

    else if (currentCalcTab === 'caixa') {
      if (!currentCaixaItems.length) currentCaixaItems = [{ rowId: uid(), receitaId: db.recipes[0].id, quantidade: 1 }];
      const renderCaixaRows = () => {
        const wrap = document.getElementById('caixaRows');
        wrap.innerHTML = currentCaixaItems.map((item) => `
          <div class="caixa-item-row" data-row="${item.rowId}">
            <div class="field"><label>Receita/sabor</label><select data-role="caixa-receita" data-row="${item.rowId}">${db.recipes.map((r) => `<option value="${r.id}" ${r.id === item.receitaId ? 'selected' : ''}>${escapeHtml(r.nome)}</option>`).join('')}</select></div>
            <div class="field"><label>Quantidade</label><input type="number" min="1" step="any" data-role="caixa-qtd" data-row="${item.rowId}" value="${item.quantidade}"></div>
            <button class="btn btn-sm btn-icon btn-danger" data-action="remover-linha-caixa" data-row="${item.rowId}" type="button">${ICONS.trash}</button>
          </div>
        `).join('');
        wrap.querySelectorAll('[data-role="caixa-receita"]').forEach((sel) => sel.addEventListener('change', (e) => {
          currentCaixaItems.find((i) => i.rowId === e.target.dataset.row).receitaId = e.target.value;
          updateCaixaPreview();
        }));
        wrap.querySelectorAll('[data-role="caixa-qtd"]').forEach((inp) => inp.addEventListener('input', (e) => {
          currentCaixaItems.find((i) => i.rowId === e.target.dataset.row).quantidade = Number(e.target.value) || 0;
          updateCaixaPreview();
        }));
        updateCaixaPreview();
      };
      const updateCaixaPreview = () => {
        let custo = 0;
        currentCaixaItems.forEach((item) => {
          const r = getRecipe(item.receitaId);
          if (!r) return;
          const cost = computeRecipeCost(r);
          custo += cost.custoUnitario * (Number(item.quantidade) || 0);
        });
        const mult = Number(db.settings.multiplicador) || 3;
        document.getElementById('calcPreview').innerHTML = previewHTML(custo, custo * mult);
      };
      container.innerHTML = `
        <div id="caixaRows"></div>
        <button class="btn btn-sm" id="addCaixaRowBtn" type="button">${ICONS.plus} Adicionar sabor</button>
        <div class="recipe-cost-preview" id="calcPreview" style="margin-top:14px;"></div>
        <div class="form-actions"><button class="btn btn-primary" id="calcSalvarBtn">Salvar cálculo</button></div>
      `;
      renderCaixaRows();
      document.getElementById('addCaixaRowBtn').addEventListener('click', () => {
        currentCaixaItems.push({ rowId: uid(), receitaId: db.recipes[0].id, quantidade: 1 });
        renderCaixaRows();
      });
      document.getElementById('calcSalvarBtn').addEventListener('click', () => {
        let custo = 0;
        const detalheItens = [];
        currentCaixaItems.forEach((item) => {
          const r = getRecipe(item.receitaId);
          if (!r) return;
          const cost = computeRecipeCost(r);
          const itemCusto = cost.custoUnitario * (Number(item.quantidade) || 0);
          custo += itemCusto;
          detalheItens.push({ receitaNome: r.nome, quantidade: item.quantidade });
        });
        const mult = Number(db.settings.multiplicador) || 3;
        addCalculation({
          tipo: 'caixa',
          titulo: `Caixa mista (${detalheItens.map((i) => i.quantidade + 'x ' + i.receitaNome).join(', ')})`,
          detalhes: { itens: detalheItens },
          custoTotal: custo, valorVenda: custo * mult,
        });
        currentCaixaItems = [];
        renderCalcForm();
        renderAll();
        toast('Cálculo salvo no histórico.', 'success');
      });
    }
  }

  function previewHTML(custo, venda) {
    return `
      <div class="item"><span>Custo total</span><b>${formatMoney(custo)}</b></div>
      <div class="item"><span>Valor de venda sugerido</span><b>${formatMoney(venda)}</b></div>
    `;
  }

  function renderCalcHistory() {
    const box = document.getElementById('calculoHistorico');
    const list = [...db.calculations].sort((a, b) => (b.favorita - a.favorita) || b.criadoEm - a.criadoEm);
    if (!list.length) {
      box.innerHTML = `<p class="confirm-text">Nenhum cálculo salvo ainda.</p>`;
      return;
    }
    box.innerHTML = list.map((c) => `
      <div class="calc-history-item">
        <div class="info">
          <strong>${escapeHtml(c.titulo)}</strong>
          <div>${formatDateBR(c.data)}</div>
        </div>
        <div class="amounts">
          <div class="val"><span>Custo</span><b>${formatMoney(c.custoTotal)}</b></div>
          <div class="val"><span>Venda</span><b>${formatMoney(c.valorVenda)}</b></div>
          <button class="btn btn-sm btn-icon" data-action="favoritar-calculo" data-id="${c.id}" title="Favoritar">${c.favorita ? ICONS.starFilled : ICONS.star}</button>
          <button class="btn btn-sm btn-icon" data-action="duplicar-calculo" data-id="${c.id}" title="Duplicar">${ICONS.plus}</button>
          <button class="btn btn-sm btn-icon btn-danger" data-action="excluir-calculo" data-id="${c.id}" title="Excluir">${ICONS.trash}</button>
        </div>
      </div>
    `).join('');
  }

  /* ======================================================================
     16. RENDER: PRODUÇÕES
     ====================================================================== */

  const PERIODO_LABELS = { hoje: 'Hoje', mes: 'Este mês', mesAnterior: 'Mês anterior', personalizado: 'Personalizado' };

  function renderProducaoResumo() {
    const container = document.getElementById('producaoResumo');
    const productions = db.productions.filter((p) => isDateInPeriod(p.dataVenda, currentProducaoPeriodo, producaoPeriodoCustomFrom, producaoPeriodoCustomTo));

    let faturamentoTotal = 0, custoVendasTotal = 0, quantidadeVendidaTotal = 0;
    productions.forEach((p) => {
      const m = computeProductionMetrics(p);
      faturamentoTotal += m.faturamento;
      custoVendasTotal += m.custoVendido;
      quantidadeVendidaTotal += Number(p.quantidadeVendida) || 0;
    });
    const lucroTotal = faturamentoTotal - custoVendasTotal;
    const margemTotal = faturamentoTotal > 0 ? (lucroTotal / faturamentoTotal) * 100 : 0;

    container.innerHTML = `
      <div class="calc-tabs" id="producaoPeriodoTabs">
        <button class="calc-tab ${currentProducaoPeriodo === 'hoje' ? 'active' : ''}" data-action="producao-periodo" data-periodo="hoje">Hoje</button>
        <button class="calc-tab ${currentProducaoPeriodo === 'mes' ? 'active' : ''}" data-action="producao-periodo" data-periodo="mes">Este mês</button>
        <button class="calc-tab ${currentProducaoPeriodo === 'mesAnterior' ? 'active' : ''}" data-action="producao-periodo" data-periodo="mesAnterior">Mês anterior</button>
        <button class="calc-tab ${currentProducaoPeriodo === 'personalizado' ? 'active' : ''}" data-action="producao-periodo" data-periodo="personalizado">Personalizado</button>
      </div>
      ${currentProducaoPeriodo === 'personalizado' ? `
        <div class="form-grid cols-3" style="margin-bottom:16px;">
          <div class="field"><label>De</label><input type="date" id="producaoPeriodoDe" value="${producaoPeriodoCustomFrom}"></div>
          <div class="field"><label>Até</label><input type="date" id="producaoPeriodoAte" value="${producaoPeriodoCustomTo}"></div>
        </div>
      ` : ''}
      <div class="dash-grid" style="margin-bottom:26px;">
        <div class="stat-card tone-success">
          <div class="stat-icon">${ICONS.cart}</div>
          <div class="stat-value">${formatMoney(faturamentoTotal)}</div>
          <div class="stat-label">Faturamento total · ${PERIODO_LABELS[currentProducaoPeriodo]}</div>
        </div>
        <div class="stat-card tone-warn">
          <div class="stat-icon">${ICONS.box}</div>
          <div class="stat-value">${formatMoney(custoVendasTotal)}</div>
          <div class="stat-label">Custo das vendas</div>
        </div>
        <div class="stat-card tone-primary">
          <div class="stat-icon">${ICONS.calc}</div>
          <div class="stat-value">${formatMoney(lucroTotal)}</div>
          <div class="stat-label">Lucro estimado · margem ${formatNumber(margemTotal, 1)}%</div>
        </div>
        <div class="stat-card tone-gold">
          <div class="stat-icon">${ICONS.factory}</div>
          <div class="stat-value">${formatNumber(quantidadeVendidaTotal, 0)}</div>
          <div class="stat-label">Unidades vendidas</div>
        </div>
      </div>
    `;

    if (currentProducaoPeriodo === 'personalizado') {
      const applyRange = () => {
        producaoPeriodoCustomFrom = document.getElementById('producaoPeriodoDe').value;
        producaoPeriodoCustomTo = document.getElementById('producaoPeriodoAte').value;
        renderProducaoResumo();
      };
      document.getElementById('producaoPeriodoDe').addEventListener('change', applyRange);
      document.getElementById('producaoPeriodoAte').addEventListener('change', applyRange);
    }
  }

  function renderProducaoForm() {
    const formContainer = document.getElementById('producaoFormContainer');
    if (!db.recipes.length) {
      formContainer.innerHTML = `<p class="confirm-text">Cadastre uma receita antes de registrar produções.</p>`;
      return;
    }
    formContainer.innerHTML = `
      <h2 class="section-title" style="margin-top:0;">Registrar nova produção</h2>
      <div class="form-grid cols-3">
        <div class="field"><label>Receita</label><select id="pReceita">${db.recipes.map((r) => `<option value="${r.id}">${escapeHtml(r.nome)}</option>`).join('')}</select></div>
        <div class="field"><label>Quantidade produzida</label><input type="number" min="1" step="any" id="pQuantidade" value="1"></div>
        <div class="field"><label>Data</label><input type="date" id="pData" value="${todayISO()}"></div>
        <div class="field span-2"><label>Observações</label><input type="text" id="pObs" placeholder="Opcional"></div>
      </div>
      <div class="form-actions"><button class="btn btn-primary" id="registrarProducaoBtn">${ICONS.factory} Registrar produção</button></div>
    `;
    document.getElementById('registrarProducaoBtn').addEventListener('click', () => {
      const receitaId = document.getElementById('pReceita').value;
      const quantidadeProduzida = document.getElementById('pQuantidade').value;
      const data = document.getElementById('pData').value;
      const observacoes = document.getElementById('pObs').value;
      if (!quantidadeProduzida || Number(quantidadeProduzida) <= 0) { toast('Informe uma quantidade válida.', 'danger'); return; }
      registerProduction({ receitaId, quantidadeProduzida, data, observacoes });
      renderProducaoForm(); // reseta o formulário para a próxima produção
      renderAll();
    });
  }

  function renderProducaoLista() {
    const list = document.getElementById('producoesList');
    const productions = [...db.productions].sort((a, b) => b.criadoEm - a.criadoEm);
    if (!productions.length) {
      list.innerHTML = `<div class="empty-state">${ICONS.factory}<strong>Nenhuma produção registrada</strong>Registre sua primeira produção para acompanhar o histórico.</div>`;
      return;
    }
    list.innerHTML = productions.map((p) => {
      const m = computeProductionMetrics(p);
      return `
      <div class="producao-item" data-id="${p.id}">
        <div class="info">
          <strong>${escapeHtml(p.receitaNome)} · ${formatNumber(p.quantidadeProduzida, 0)} un.</strong>
          <div>${formatDateBR(p.data)}${p.observacoes ? ' — ' + escapeHtml(p.observacoes) : ''}</div>
        </div>
        <div class="form-grid cols-3" style="margin:10px 0;">
          <div class="field">
            <label>Qtd. vendida</label>
            <input type="number" min="0" step="any" data-role="qtdVendida" data-id="${p.id}" value="${p.quantidadeVendida || ''}">
          </div>
          <div class="field">
            <label>Preço de venda (un.)</label>
            <input type="number" min="0" step="any" data-role="precoVenda" data-id="${p.id}" value="${p.precoVendaUnitario || ''}">
          </div>
          <div class="field">
            <label>Data da venda</label>
            <input type="date" data-role="dataVenda" data-id="${p.id}" value="${p.dataVenda || p.data}">
          </div>
        </div>
        ${!m.custoRegistrado ? `
          <div class="recipe-price-row"><span>Custo</span><b>Custo não registrado</b></div>
        ` : `
          <div class="recipe-price-row"><span>Custo total da produção</span><b>${formatMoney(m.custoTotal)}</b></div>
          <div class="recipe-price-row"><span>Custo das unidades vendidas</span><b>${formatMoney(m.custoVendido)}</b></div>
        `}
        <div class="recipe-price-row"><span>Faturamento total</span><b>${formatMoney(m.faturamento)}</b></div>
        <div class="recipe-price-row"><span>Lucro estimado (${formatNumber(m.margemLucro, 1)}%)</span><b>${formatMoney(m.lucro)}</b></div>
        <div class="recipe-price-row"><span>Quantidade restante</span><b>${formatNumber(m.quantidadeRestante, 0)} un.</b></div>
        <div class="venda-fields" style="margin-top:10px;">
          <button class="btn btn-sm btn-icon" data-action="editar-producao" data-id="${p.id}" title="Editar">${ICONS.edit}</button>
          <button class="btn btn-sm btn-icon btn-danger" data-action="excluir-producao" data-id="${p.id}" title="Excluir">${ICONS.trash}</button>
        </div>
      </div>
    `;
    }).join('');

    list.querySelectorAll('[data-role="qtdVendida"], [data-role="precoVenda"], [data-role="dataVenda"]').forEach((inp) => {
      inp.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const row = list.querySelector(`.producao-item[data-id="${id}"]`);
        const qtd = row.querySelector('[data-role="qtdVendida"]').value;
        const preco = row.querySelector('[data-role="precoVenda"]').value;
        const dataVenda = row.querySelector('[data-role="dataVenda"]').value;
        const result = updateProductionSales(id, { quantidadeVendida: qtd, precoVendaUnitario: preco, dataVenda });
        if (!result.ok) { toast(result.message, 'danger'); renderAll(); return; }
        renderAll();
        toast('Venda atualizada.', 'success');
      });
    });
  }

  // Usado ao navegar até a tela de Produções: renderiza tudo, incluindo o
  // formulário de nova produção (seguro reconstruir aqui, pois o usuário está
  // acabando de chegar na tela).
  function renderProducoes() {
    renderProducaoResumo();
    renderProducaoForm();
    renderProducaoLista();
  }

  function openEditProductionModal(id) {
    const production = db.productions.find((p) => p.id === id);
    if (!production) return;
    if (!db.recipes.length) { toast('Não há receitas cadastradas para editar esta produção.', 'danger'); return; }
    const recipeStillExists = !!getRecipe(production.receitaId);
    openModal({
      title: 'Editar produção',
      bodyHTML: `
        <div class="form-grid cols-3">
          <div class="field"><label>Receita</label><select id="epReceita">${db.recipes.map((r) => `<option value="${r.id}" ${r.id === production.receitaId ? 'selected' : ''}>${escapeHtml(r.nome)}</option>`).join('')}</select></div>
          <div class="field"><label>Quantidade produzida</label><input type="number" min="1" step="any" id="epQuantidade" value="${production.quantidadeProduzida}"></div>
          <div class="field"><label>Data</label><input type="date" id="epData" value="${production.data}"></div>
          <div class="field span-2"><label>Observações</label><input type="text" id="epObs" value="${escapeHtml(production.observacoes || '')}"></div>
        </div>
        ${!recipeStillExists ? `<p class="confirm-text" style="margin-top:10px;">A receita original desta produção não existe mais. Selecione uma receita atual para continuar.</p>` : ''}
        <p class="confirm-text" style="margin-top:10px;">Ao salvar, a produção antiga é estornada e a nova é aplicada — nada é alterado se o novo estoque necessário não estiver disponível.</p>
      `,
      footerHTML: `
        <button class="btn btn-ghost" data-action="fechar-modal">Cancelar</button>
        <button class="btn btn-primary" id="saveEditProductionBtn">Salvar alterações</button>
      `,
      onMount: () => {
        document.getElementById('saveEditProductionBtn').addEventListener('click', () => {
          const data = {
            receitaId: document.getElementById('epReceita').value,
            quantidadeProduzida: document.getElementById('epQuantidade').value,
            data: document.getElementById('epData').value,
            observacoes: document.getElementById('epObs').value,
          };
          const result = updateProduction(id, data);
          if (!result.ok) { toast(result.message, 'danger'); return; }
          closeModal();
          renderAll();
          toast('Produção atualizada e estoque ajustado.', 'success');
        });
      },
    });
  }

  /* ======================================================================
     17. RENDER: MOVIMENTAÇÕES (extrato)
     ====================================================================== */

  function renderMovimentacoes() {
    const box = document.getElementById('movimentacoesList');
    const term = (document.getElementById('movSearch').value || '').toLowerCase().trim();
    const tipoFiltro = document.getElementById('movTipoFiltro').value;

    let list = [...db.movements].sort((a, b) => (b.data < a.data ? -1 : b.data > a.data ? 1 : b.criadoEm - a.criadoEm));
    if (tipoFiltro) list = list.filter((m) => m.tipo === tipoFiltro);
    if (term) {
      list = list.filter((m) => {
        const ing = getIngredient(m.ingredienteId);
        return (ing && ing.nome.toLowerCase().includes(term)) || (m.descricao || '').toLowerCase().includes(term);
      });
    }

    if (!list.length) {
      box.innerHTML = `<div class="empty-state">${ICONS.factory}<strong>Nenhuma movimentação encontrada</strong>As movimentações aparecem automaticamente conforme você usa o sistema.</div>`;
      return;
    }

    const groups = {};
    list.forEach((m) => { (groups[m.data] = groups[m.data] || []).push(m); });

    box.innerHTML = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1)).map((date) => {
      const label = date === todayISO() ? 'Hoje' : formatDateBR(date);
      return `
        <div class="statement-day">
          <div class="statement-day-label">${label}</div>
          ${groups[date].map((m) => {
            const ing = getIngredient(m.ingredienteId);
            const positive = m.quantidadeBase > 0;
            const iconClass = m.tipo === 'Compra' || m.tipo === 'Estorno' ? 'in' : (m.tipo === 'Ajuste manual' ? 'neutral' : 'out');
            const iconSvg = m.tipo === 'Compra' ? ICONS.cart : m.tipo === 'Produção' ? ICONS.factory : m.tipo === 'Estorno' ? ICONS.check : m.tipo === 'Ajuste manual' ? ICONS.edit : ICONS.move;
            return `
              <div class="statement-row">
                <div class="statement-left">
                  <div class="statement-icon ${iconClass}">${iconSvg}</div>
                  <div class="statement-text">
                    <strong>${escapeHtml(m.tipo)}${ing ? ' · ' + escapeHtml(ing.nome) : ''}</strong>
                    <span>${escapeHtml(m.descricao || '')}</span>
                  </div>
                </div>
                <div class="statement-amount ${positive ? 'pos' : 'neg'}">${positive ? '+' : ''}${formatQuantityBase(m.quantidadeBase, ing ? ing.unidade : 'unidade')}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }).join('');
  }

  /* ======================================================================
     18. FINANCEIRO
     ====================================================================== */

  const FINANCEIRO_PERIODO_LABELS = { hoje: 'Hoje', semana: 'Esta semana', mes: 'Este mês', mesAnterior: 'Mês anterior', ano: 'Este ano', personalizado: 'Personalizado' };

  function getProductionStatus(production) {
    const produced = Number(production.quantidadeProduzida) || 0;
    const sold = Number(production.quantidadeVendida) || 0;
    if (sold <= 0) return { label: 'Sem venda', level: 'muted' };
    if (sold < produced - EPS) return { label: 'Venda parcial', level: 'warn' };
    return { label: 'Vendida', level: 'ok' };
  }

  // Agrega todos os dados do Financeiro para o período selecionado. Compras
  // usam a data da COMPRA; faturamento/custo das vendas/lucro/ticket médio
  // usam a data da VENDA (só entram produções que já têm venda); quantidade
  // produzida e número de produções usam a data da PRODUÇÃO (entram todas,
  // vendidas ou não).
  function getFinanceiroData(period, customFrom, customTo) {
    const comprasNoPeriodo = db.purchases.filter((p) => isDateInPeriod(p.dataCompra, period, customFrom, customTo));
    const totalGastoCompras = comprasNoPeriodo.reduce((s, p) => s + (Number(p.valorTotal) || 0), 0);

    const producoesPorData = db.productions.filter((p) => isDateInPeriod(p.data, period, customFrom, customTo));
    const quantidadeProduzidaTotal = producoesPorData.reduce((s, p) => s + (Number(p.quantidadeProduzida) || 0), 0);
    const numeroProducoes = producoesPorData.length;

    const producoesComVenda = db.productions.filter((p) => (Number(p.quantidadeVendida) || 0) > 0 && isDateInPeriod(p.dataVenda, period, customFrom, customTo));
    let faturamentoTotal = 0, custoVendasTotal = 0, quantidadeVendidaTotal = 0;
    producoesComVenda.forEach((p) => {
      const m = computeProductionMetrics(p);
      faturamentoTotal += m.faturamento;
      custoVendasTotal += m.custoVendido;
      quantidadeVendidaTotal += Number(p.quantidadeVendida) || 0;
    });
    const lucroTotal = faturamentoTotal - custoVendasTotal;
    const ticketMedio = producoesComVenda.length > 0 ? faturamentoTotal / producoesComVenda.length : 0;

    const porReceita = {};
    producoesPorData.forEach((p) => { porReceita[p.receitaNome] = (porReceita[p.receitaNome] || 0) + (Number(p.quantidadeProduzida) || 0); });
    let receitaMaisProduzida = null, maxQtdReceita = 0;
    Object.keys(porReceita).forEach((nome) => { if (porReceita[nome] > maxQtdReceita) { maxQtdReceita = porReceita[nome]; receitaMaisProduzida = nome; } });

    const gastoPorIngrediente = {};
    comprasNoPeriodo.forEach((p) => { gastoPorIngrediente[p.ingredienteId] = (gastoPorIngrediente[p.ingredienteId] || 0) + (Number(p.valorTotal) || 0); });
    let ingredienteMaisGasto = null, maxGasto = 0;
    Object.keys(gastoPorIngrediente).forEach((id) => {
      if (gastoPorIngrediente[id] > maxGasto) { maxGasto = gastoPorIngrediente[id]; const ing = getIngredient(id); ingredienteMaisGasto = ing ? ing.nome : null; }
    });

    return {
      totalGastoCompras, faturamentoTotal, custoVendasTotal, lucroTotal, quantidadeVendidaTotal,
      quantidadeProduzidaTotal, numeroProducoes, ticketMedio, receitaMaisProduzida, ingredienteMaisGasto,
      temDados: numeroProducoes > 0 || comprasNoPeriodo.length > 0,
      producoesListadas: [...producoesPorData].sort((a, b) => b.criadoEm - a.criadoEm),
    };
  }

  function renderFinanceiro() {
    const container = document.getElementById('financeiroContainer');
    const data = getFinanceiroData(currentFinanceiroPeriodo, financeiroPeriodoCustomFrom, financeiroPeriodoCustomTo);

    container.innerHTML = `
      <div class="calc-tabs" id="financeiroPeriodoTabs">
        <button class="calc-tab ${currentFinanceiroPeriodo === 'hoje' ? 'active' : ''}" data-action="financeiro-periodo" data-periodo="hoje">Hoje</button>
        <button class="calc-tab ${currentFinanceiroPeriodo === 'semana' ? 'active' : ''}" data-action="financeiro-periodo" data-periodo="semana">Esta semana</button>
        <button class="calc-tab ${currentFinanceiroPeriodo === 'mes' ? 'active' : ''}" data-action="financeiro-periodo" data-periodo="mes">Este mês</button>
        <button class="calc-tab ${currentFinanceiroPeriodo === 'mesAnterior' ? 'active' : ''}" data-action="financeiro-periodo" data-periodo="mesAnterior">Mês anterior</button>
        <button class="calc-tab ${currentFinanceiroPeriodo === 'ano' ? 'active' : ''}" data-action="financeiro-periodo" data-periodo="ano">Este ano</button>
        <button class="calc-tab ${currentFinanceiroPeriodo === 'personalizado' ? 'active' : ''}" data-action="financeiro-periodo" data-periodo="personalizado">Personalizado</button>
      </div>
      ${currentFinanceiroPeriodo === 'personalizado' ? `
        <div class="form-grid cols-3" style="margin-bottom:16px;">
          <div class="field"><label>De</label><input type="date" id="financeiroPeriodoDe" value="${financeiroPeriodoCustomFrom}"></div>
          <div class="field"><label>Até</label><input type="date" id="financeiroPeriodoAte" value="${financeiroPeriodoCustomTo}"></div>
        </div>
      ` : ''}

      <div class="dash-grid" style="margin-bottom:22px;">
        <div class="stat-card tone-warn">
          <div class="stat-icon">${ICONS.cart}</div>
          <div class="stat-value">${formatMoney(data.totalGastoCompras)}</div>
          <div class="stat-label">Total gasto em compras</div>
        </div>
        <div class="stat-card tone-success">
          <div class="stat-icon">${ICONS.box}</div>
          <div class="stat-value">${formatMoney(data.faturamentoTotal)}</div>
          <div class="stat-label">Faturamento total</div>
        </div>
        <div class="stat-card tone-gold">
          <div class="stat-icon">${ICONS.calc}</div>
          <div class="stat-value">${formatMoney(data.custoVendasTotal)}</div>
          <div class="stat-label">Custo das vendas</div>
        </div>
        <div class="stat-card tone-primary">
          <div class="stat-icon">${ICONS.starFilled}</div>
          <div class="stat-value">${formatMoney(data.lucroTotal)}</div>
          <div class="stat-label">Lucro estimado</div>
        </div>
        <div class="stat-card tone-success">
          <div class="stat-icon">${ICONS.factory}</div>
          <div class="stat-value">${formatNumber(data.quantidadeVendidaTotal, 0)}</div>
          <div class="stat-label">Quantidade vendida</div>
        </div>
        <div class="stat-card tone-gold">
          <div class="stat-icon">${ICONS.factory}</div>
          <div class="stat-value">${formatNumber(data.quantidadeProduzidaTotal, 0)}</div>
          <div class="stat-label">Quantidade produzida</div>
        </div>
        <div class="stat-card tone-primary">
          <div class="stat-icon">${ICONS.book}</div>
          <div class="stat-value">${formatNumber(data.numeroProducoes, 0)}</div>
          <div class="stat-label">Número de produções</div>
        </div>
        <div class="stat-card tone-warn">
          <div class="stat-icon">${ICONS.cart}</div>
          <div class="stat-value">${formatMoney(data.ticketMedio)}</div>
          <div class="stat-label">Ticket médio</div>
        </div>
      </div>

      <div class="panel" style="margin-bottom:26px;">
        <h3>${ICONS.calc} Resumo · ${FINANCEIRO_PERIODO_LABELS[currentFinanceiroPeriodo]}</h3>
        ${!data.temDados ? `<p class="confirm-text">Sem dados no período.</p>` : `
          <div class="mini-row"><span class="name">Total gasto em compras</span><span class="value">${formatMoney(data.totalGastoCompras)}</span></div>
          <div class="mini-row"><span class="name">Total faturado</span><span class="value">${formatMoney(data.faturamentoTotal)}</span></div>
          <div class="mini-row"><span class="name">Custo das vendas</span><span class="value">${formatMoney(data.custoVendasTotal)}</span></div>
          <div class="mini-row"><span class="name">Lucro estimado</span><span class="value">${formatMoney(data.lucroTotal)}</span></div>
          <div class="mini-row"><span class="name">Quantidade produzida</span><span class="value">${formatNumber(data.quantidadeProduzidaTotal, 0)} un.</span></div>
          <div class="mini-row"><span class="name">Quantidade vendida</span><span class="value">${formatNumber(data.quantidadeVendidaTotal, 0)} un.</span></div>
          <div class="mini-row"><span class="name">Número de produções</span><span class="value">${formatNumber(data.numeroProducoes, 0)}</span></div>
          <div class="mini-row"><span class="name">Receita mais produzida</span><span class="value">${data.receitaMaisProduzida ? escapeHtml(data.receitaMaisProduzida) : '—'}</span></div>
          <div class="mini-row"><span class="name">Ingrediente com maior gasto</span><span class="value">${data.ingredienteMaisGasto ? escapeHtml(data.ingredienteMaisGasto) : '—'}</span></div>
        `}
      </div>

      <h2 class="section-title" style="margin-top:0;">Produções no período</h2>
      <div class="producoes-list" id="financeiroProducoesList"></div>
    `;

    if (currentFinanceiroPeriodo === 'personalizado') {
      const applyRange = () => {
        financeiroPeriodoCustomFrom = document.getElementById('financeiroPeriodoDe').value;
        financeiroPeriodoCustomTo = document.getElementById('financeiroPeriodoAte').value;
        renderFinanceiro();
      };
      document.getElementById('financeiroPeriodoDe').addEventListener('change', applyRange);
      document.getElementById('financeiroPeriodoAte').addEventListener('change', applyRange);
    }

    const list = document.getElementById('financeiroProducoesList');
    if (!data.producoesListadas.length) {
      list.innerHTML = `<div class="empty-state">${ICONS.factory}<strong>Nenhuma produção no período</strong>Ajuste o filtro acima ou registre produções na tela de Produções.</div>`;
      return;
    }
    list.innerHTML = data.producoesListadas.map((p) => {
      const m = computeProductionMetrics(p);
      const status = getProductionStatus(p);
      return `
      <div class="producao-item">
        <div class="info">
          <strong>${escapeHtml(p.receitaNome)} <span class="tag-badge tag-${status.level}">${status.label}</span></strong>
          <div>${formatDateBR(p.data)} · ${formatNumber(p.quantidadeProduzida, 0)} produzidas · ${formatNumber(p.quantidadeVendida || 0, 0)} vendidas · ${formatNumber(m.quantidadeRestante, 0)} restantes</div>
        </div>
        <div style="flex:1; min-width:220px;">
          ${!m.custoRegistrado ? `<div class="recipe-price-row"><span>Custo</span><b>Custo não registrado</b></div>` : `
            <div class="recipe-price-row"><span>Custo total</span><b>${formatMoney(m.custoTotal)}</b></div>
            <div class="recipe-price-row"><span>Custo das vendidas</span><b>${formatMoney(m.custoVendido)}</b></div>
          `}
          <div class="recipe-price-row"><span>Preço de venda (un.)</span><b>${formatMoney(p.precoVendaUnitario)}</b></div>
          <div class="recipe-price-row"><span>Faturamento</span><b>${formatMoney(m.faturamento)}</b></div>
          <div class="recipe-price-row"><span>Lucro (${formatNumber(m.margemLucro, 1)}%)</span><b>${formatMoney(m.lucro)}</b></div>
        </div>
      </div>
    `;
    }).join('');
  }

  /* ======================================================================
     19. RENDER: CONFIGURAÇÕES
     ====================================================================== */

  function renderConfiguracoes() {
    const container = document.getElementById('configContainer');
    container.innerHTML = `
      <div class="config-grid">
        <div class="config-card">
          <h3>Conta</h3>
          <p>Conectado como <strong>${escapeHtml(currentUser ? currentUser.email : '—')}</strong>. Seus dados ficam salvos na sua conta e sincronizados na nuvem.</p>
          <button class="btn" id="logoutBtn">Sair da conta</button>
        </div>

        <div class="config-card">
          <h3>Multiplicador de venda</h3>
          <p>O valor final de venda é sempre <strong>Custo × multiplicador</strong>. Padrão: 3x.</p>
          <div class="multiplier-input">
            <input type="number" min="0.1" step="0.1" id="multiplicadorInput" value="${db.settings.multiplicador}">
            <span>x</span>
            <button class="btn btn-primary btn-sm" id="salvarMultiplicadorBtn">Salvar</button>
          </div>
        </div>

        <div class="config-card">
          <h3>Backup dos dados</h3>
          <p>Exporte todos os seus dados em um arquivo JSON, ou restaure a partir de um backup.</p>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-gold" id="exportarBtn">${ICONS.download} Exportar</button>
            <button class="btn" id="importarBtn">${ICONS.upload} Importar</button>
          </div>
        </div>

        <div class="config-card danger-zone">
          <h3>Zona de risco</h3>
          <p>Apaga permanentemente todos os dados do sistema neste navegador.</p>
          <button class="btn btn-danger" id="limparTudoBtn">${ICONS.trash} Apagar todos os dados</button>
        </div>
      </div>
    `;

    document.getElementById('logoutBtn').addEventListener('click', () => {
      openConfirm({
        title: 'Sair da conta',
        message: 'Deseja realmente sair? Você poderá entrar novamente com seu e-mail e senha.',
        confirmLabel: 'Sair',
        danger: true,
        onConfirm: async () => { if (sb) await sb.auth.signOut(); },
      });
    });

    document.getElementById('salvarMultiplicadorBtn').addEventListener('click', () => {
      const v = Number(document.getElementById('multiplicadorInput').value);
      if (!v || v <= 0) { toast('Informe um multiplicador válido.', 'danger'); return; }
      db.settings.multiplicador = v;
      saveDB();
      renderAll(); // recalcula na hora o valor de venda em Receitas e Cálculos
      toast('Multiplicador atualizado.', 'success');
    });

    document.getElementById('exportarBtn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `docegestao-backup-${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Backup exportado.', 'success');
    });

    document.getElementById('importarBtn').addEventListener('click', () => {
      document.getElementById('importFileInput').click();
    });

    document.getElementById('limparTudoBtn').addEventListener('click', () => {
      openConfirm({
        title: 'Apagar todos os dados',
        message: 'Esta ação é <strong>irreversível</strong>. Todos os ingredientes, compras, receitas, produções, cálculos e movimentações serão apagados. Deseja continuar?',
        confirmLabel: 'Apagar tudo',
        danger: true,
        onConfirm: () => {
          db = defaultDB();
          saveDB();
          renderAll();
          toast('Todos os dados foram apagados.', 'success');
        },
      });
    });
  }

  document.getElementById('importFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        openConfirm({
          title: 'Importar backup',
          message: 'Isso substituirá <strong>todos os dados atuais</strong> pelos dados do arquivo importado. Deseja continuar?',
          confirmLabel: 'Importar e substituir',
          danger: true,
          onConfirm: () => {
            db = Object.assign(defaultDB(), parsed);
            saveDB();
            renderAll();
            toast('Backup importado com sucesso.', 'success');
          },
        });
      } catch (err) {
        toast('Arquivo inválido. Verifique se é um backup do DoceGestão.', 'danger');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  /* ======================================================================
     19. DELEGAÇÃO GLOBAL DE EVENTOS
     ====================================================================== */

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const id = el.dataset.id;

    switch (action) {
      case 'ir-para-view':
        goToView(el.dataset.view);
        break;
      case 'fechar-modal':
        closeModal();
        break;
      case 'novo-ingrediente':
        openIngredientModal(null);
        break;
      case 'editar-ingrediente':
        openIngredientModal(id);
        break;
      case 'excluir-ingrediente':
        openDeleteIngredientConfirm(id);
        break;
      case 'comprar-ingrediente':
        openPurchaseModal(id, null);
        break;
      case 'movimentar-ingrediente':
        openMovimentarModal(id);
        break;
      case 'editar-compra':
        openPurchaseModal(el.dataset.ing, id);
        break;
      case 'duplicar-compra':
        duplicatePurchase(id);
        renderAll();
        openPurchaseModal(el.dataset.ing);
        toast('Compra duplicada.', 'success');
        break;
      case 'excluir-compra': {
        const check = canDeletePurchase(id);
        if (!check.ok) { toast(check.message, 'danger'); break; }
        openConfirm({
          title: 'Excluir compra',
          message: 'Deseja realmente excluir este lote de compra? Essa ação não pode ser desfeita.',
          confirmLabel: 'Excluir',
          danger: true,
          onConfirm: () => { deletePurchase(id); renderAll(); openPurchaseModal(el.dataset.ing); toast('Compra excluída.', 'success'); },
        });
        break;
      }
      case 'nova-receita':
        openRecipeModal(null);
        break;
      case 'editar-receita':
        openRecipeModal(id);
        break;
      case 'excluir-receita':
        openDeleteRecipeConfirm(id);
        break;
      case 'favoritar-receita':
        toggleFavoriteRecipe(id);
        renderAll();
        break;
      case 'remover-linha-caixa': {
        const rowId = el.dataset.row;
        currentCaixaItems = currentCaixaItems.filter((i) => i.rowId !== rowId);
        renderCalcForm();
        break;
      }
      case 'calc-tab':
        currentCalcTab = el.dataset.tipo;
        currentCaixaItems = [];
        renderCalculos();
        break;
      case 'favoritar-calculo':
        toggleFavoriteCalculation(id);
        renderAll();
        break;
      case 'duplicar-calculo':
        duplicateCalculation(id);
        renderAll();
        break;
      case 'excluir-calculo':
        openConfirm({
          title: 'Excluir cálculo',
          message: 'Deseja realmente excluir este cálculo do histórico?',
          confirmLabel: 'Excluir',
          danger: true,
          onConfirm: () => { deleteCalculation(id); renderAll(); toast('Cálculo excluído.', 'success'); },
        });
        break;
      case 'producao-periodo':
        currentProducaoPeriodo = el.dataset.periodo;
        if (currentProducaoPeriodo !== 'personalizado') { producaoPeriodoCustomFrom = ''; producaoPeriodoCustomTo = ''; }
        renderProducaoResumo();
        break;
      case 'financeiro-periodo':
        currentFinanceiroPeriodo = el.dataset.periodo;
        if (currentFinanceiroPeriodo !== 'personalizado') { financeiroPeriodoCustomFrom = ''; financeiroPeriodoCustomTo = ''; }
        renderFinanceiro();
        break;
      case 'editar-producao':
        openEditProductionModal(id);
        break;
      case 'excluir-producao':
        openConfirm({
          title: 'Excluir produção',
          message: 'Deseja realmente excluir este registro de produção? O estoque consumido será devolvido automaticamente aos mesmos lotes de origem.',
          confirmLabel: 'Excluir',
          danger: true,
          onConfirm: () => { deleteProduction(id); renderAll(); toast('Produção excluída e estoque estornado.', 'success'); },
        });
        break;
      default:
        break;
    }
  });

  // Buscas com "input" (delegação simples direta nos elementos, pois são fixos no DOM)
  document.getElementById('estoqueSearch').addEventListener('input', renderEstoque);
  document.getElementById('receitasSearch').addEventListener('input', renderReceitas);
  document.getElementById('movSearch').addEventListener('input', renderMovimentacoes);
  document.getElementById('movTipoFiltro').addEventListener('change', renderMovimentacoes);

  /* ======================================================================
     20. AUTENTICAÇÃO (Supabase Auth — e-mail e senha) e INICIALIZAÇÃO
     ====================================================================== */

  function setAuthMessage(msg) {
    const el = document.getElementById('authMessage');
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
  }

  function showAuthGate() {
    document.getElementById('authOverlay').classList.remove('hidden');
    document.getElementById('app').style.display = 'none';
  }

  function hideAuthGate() {
    document.getElementById('authOverlay').classList.add('hidden');
    document.getElementById('app').style.display = '';
  }

  // Carrega os dados do usuário autenticado e só então exibe o sistema.
  // Se o Supabase não puder ser alcançado nesse instante, usa o último
  // cache local como rede de segurança (o Supabase continua sendo a fonte
  // de verdade: na próxima sincronização bem-sucedida ele volta a mandar).
  async function bootApp(user) {
    currentUser = user;
    try {
      db = await loadDBFromSupabase(user.id);
    } catch (e) {
      console.error('Erro ao carregar dados do Supabase:', e);
      toast('Não foi possível carregar seus dados da nuvem agora. Mostrando o último dado salvo neste dispositivo.', 'warning');
      db = loadDBFromLocalCache();
    }
    migrateProductions();
    hideAuthGate();
    goToView('dashboard');
  }

  if (!SUPABASE_CONFIGURADO) {
    setAuthMessage('O Supabase ainda não foi configurado neste arquivo (preencha SUPABASE_URL e SUPABASE_ANON_KEY no início do script.js).');
  } else {
    document.getElementById('authSignInBtn').addEventListener('click', async () => {
      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;
      if (!email || !password) { setAuthMessage('Informe e-mail e senha.'); return; }
      setAuthMessage('Entrando...');
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) setAuthMessage(error.message);
    });

    document.getElementById('authSignUpBtn').addEventListener('click', async () => {
      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;
      if (!email || !password) { setAuthMessage('Informe e-mail e senha.'); return; }
      if (password.length < 6) { setAuthMessage('A senha deve ter ao menos 6 caracteres.'); return; }
      setAuthMessage('Criando conta...');
      const { error } = await sb.auth.signUp({ email, password });
      if (error) { setAuthMessage(error.message); return; }
      setAuthMessage('Conta criada. Se a confirmação por e-mail estiver ativa no projeto, confirme antes de entrar.');
    });

    sb.auth.onAuthStateChange((_event, session) => {
      if (session && session.user) bootApp(session.user);
      else { currentUser = null; showAuthGate(); }
    });

    sb.auth.getSession().then(({ data }) => {
      if (data && data.session && data.session.user) bootApp(data.session.user);
      else showAuthGate();
    });
  }
})();
