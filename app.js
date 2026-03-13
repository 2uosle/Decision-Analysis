// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────
const state = {
    mode: 'payoff',
    payoff: {
        title: '',
        description: '',
        alternatives: [],   // [{id, name}]
        states: [],         // [{id, name, probability: string}]
        payoffs: {},        // {altId: {stateId: number}}
        alpha: 0.5
    },
    dtree: {
        title: '',
        description: '',
        root: null,
        zoom: 1
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupTabs('ptTabs');
    setupTabs('dtTabs');
    setupPaneResizers();

    document.getElementById('ptTitle').addEventListener('input', e => state.payoff.title = e.target.value);
    document.getElementById('ptDesc').addEventListener('input', e => state.payoff.description = e.target.value);
    document.getElementById('dtTitle').addEventListener('input', e => state.dtree.title = e.target.value);
    document.getElementById('dtDesc').addEventListener('input', e => state.dtree.description = e.target.value);
    document.getElementById('exportBtn').addEventListener('click', exportCSV);

    document.getElementById('sampleBtn').addEventListener('click', () => {
        document.getElementById('sampleMenu').classList.toggle('hidden');
    });
    document.addEventListener('click', e => {
        if (!e.target.closest('#sampleBtn') && !e.target.closest('#sampleMenu')) {
            document.getElementById('sampleMenu')?.classList.add('hidden');
        }
    });

    state.dtree.root = makeNode('decision', 'Initial Decision');
    renderDTreeBuilder();
});

function setupPaneResizers() {
    const splitters = document.querySelectorAll('.splitter');
    splitters.forEach(splitter => {
        const layout = splitter.closest('.layout');
        if (!layout) return;

        splitter.addEventListener('mousedown', (e) => {
            if (window.innerWidth <= 1120) return;

            const rect = layout.getBoundingClientRect();
            const min = 290;
            const max = Math.max(min + 20, rect.width - 260);
            const startX = e.clientX;
            const computed = getComputedStyle(layout).getPropertyValue('--left-pane-width').trim();
            const fallback = layout.querySelector('.left')?.getBoundingClientRect().width || 390;
            const startWidth = parseFloat(computed) || fallback;

            layout.classList.add('resizing');
            document.body.style.userSelect = 'none';

            const onMove = (moveEvt) => {
                const dx = moveEvt.clientX - startX;
                let next = startWidth + dx;
                if (next < min) next = min;
                if (next > max) next = max;
                layout.style.setProperty('--left-pane-width', `${next}px`);
            };

            const onUp = () => {
                layout.classList.remove('resizing');
                document.body.style.userSelect = '';
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
            };

            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        });

        splitter.addEventListener('dblclick', () => {
            if (window.innerWidth <= 1120) return;

            const rect = layout.getBoundingClientRect();
            const current = parseFloat(getComputedStyle(layout).getPropertyValue('--left-pane-width')) || 390;
            const isMax = current > rect.width * 0.7;
            const target = isMax ? 390 : Math.max(520, Math.floor(rect.width * 0.8));
            layout.style.setProperty('--left-pane-width', `${target}px`);
        });
    });
}

function setMode(m) {
    state.mode = m;
    document.getElementById('payoffMode').classList.toggle('hidden', m !== 'payoff');
    document.getElementById('dtreeMode').classList.toggle('hidden', m !== 'dtree');
    document.getElementById('modePayoff').classList.toggle('active', m === 'payoff');
    document.getElementById('modeDtree').classList.toggle('active', m === 'dtree');
}

function runAnalysis() {
    if (state.mode === 'payoff') analyzePayoff();
    else computeTree();
}

function setupTabs(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const tabId = e.currentTarget.dataset.tab;
            container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const right = container.closest('.right');
            (right || document).querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            document.getElementById(tabId)?.classList.add('active');
        });
    });
}

function switchTab(tabsId, tabId) {
    const container = document.getElementById(tabsId);
    container?.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tabId);
    });
    const right = container?.closest('.right');
    (right || document).querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.getElementById(tabId)?.classList.add('active');
}

function addAlternative() {
    const id = 'a' + Date.now();
    state.payoff.alternatives.push({ id, name: '' });
    renderAlternatives();
    renderMatrixEditor();
}

function removeAlternative(id) {
    state.payoff.alternatives = state.payoff.alternatives.filter(a => a.id !== id);
    delete state.payoff.payoffs[id];
    renderAlternatives();
    renderMatrixEditor();
}

function updateAltName(id, val) {
    const a = state.payoff.alternatives.find(x => x.id === id);
    if (a) { a.name = val; renderMatrixEditor(); }
}

function renderAlternatives() {
    document.getElementById('altContainer').innerHTML =
        state.payoff.alternatives.map((a, i) => `
            <div class="item-card">
                <div class="item-num">${i + 1}</div>
                <div class="item-body">
                    <input type="text" class="item-input"
                        placeholder="e.g., Build Small Plant"
                        value="${esc(a.name)}"
                        oninput="updateAltName('${a.id}', this.value)">
                </div>
                <button class="del-btn" onclick="removeAlternative('${a.id}')">✕</button>
            </div>`).join('');
}

function addState() {
    const id = 's' + Date.now();
    state.payoff.states.push({ id, name: '', probability: '' });
    renderStates();
    renderMatrixEditor();
}

function removeState(id) {
    state.payoff.states = state.payoff.states.filter(s => s.id !== id);
    Object.values(state.payoff.payoffs).forEach(row => delete row[id]);
    renderStates();
    renderMatrixEditor();
}

function updateStateProp(id, field, val) {
    const s = state.payoff.states.find(x => x.id === id);
    if (s) { s[field] = val; if (field === 'name') renderMatrixEditor(); }
}

function renderStates() {
    document.getElementById('stateContainer').innerHTML =
        state.payoff.states.map((s, i) => `
            <div class="item-card">
                <div class="item-num">${i + 1}</div>
                <div class="item-body">
                    <input type="text" class="item-input"
                        placeholder="e.g., High Demand"
                        value="${esc(s.name)}"
                        oninput="updateStateProp('${s.id}', 'name', this.value)">
                    <div class="prob-row">
                        <label class="prob-label">P(state):</label>
                        <input type="number" class="item-input prob-inp"
                            placeholder="e.g. 0.40"
                            min="0" max="1" step="0.01"
                            value="${s.probability}"
                            oninput="updateStateProp('${s.id}', 'probability', this.value)">
                        <span class="opt-tag">optional</span>
                    </div>
                </div>
                <button class="del-btn" onclick="removeState('${s.id}')">✕</button>
            </div>`).join('');
}

function renderMatrixEditor() {
    const wrap = document.getElementById('matrixEditorWrap');
    const alts = state.payoff.alternatives;
    const sts = state.payoff.states;

    if (alts.length === 0 || sts.length === 0) {
        wrap.innerHTML = `<div class="no-data"><div class="nd-icon">📋</div><p>Add alternatives and states of nature to build the payoff matrix.</p></div>`;
        return;
    }

    alts.forEach(a => {
        if (!state.payoff.payoffs[a.id]) state.payoff.payoffs[a.id] = {};
        sts.forEach(s => {
            if (state.payoff.payoffs[a.id][s.id] === undefined) state.payoff.payoffs[a.id][s.id] = 0;
        });
    });

    wrap.innerHTML = `
        <div class="matrix-header-row">
            <div class="matrix-title">Payoff Matrix</div>
            <div class="matrix-hint">Enter payoffs (profit, cost, or utility) for each combination</div>
        </div>
        <div class="matrix-scroll">
            <table class="matrix-table">
                <thead>
                    <tr>
                        <th class="alt-col">Alternative \ State of Nature</th>
                        ${sts.map(s => `<th>${esc(s.name || 'State')}<br>${s.probability ? `<span class="prob-badge">P = ${s.probability}</span>` : ''}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${alts.map(a => `
                        <tr>
                            <td class="alt-name-cell">${esc(a.name || 'Alternative')}</td>
                            ${sts.map(s => `
                                <td>
                                    <input type="number" class="score-input"
                                        value="${state.payoff.payoffs[a.id][s.id]}"
                                        onchange="updatePayoff('${a.id}', '${s.id}', this.value)">
                                </td>`).join('')}
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
}

function updatePayoff(aId, sId, val) {
    if (!state.payoff.payoffs[aId]) state.payoff.payoffs[aId] = {};
    state.payoff.payoffs[aId][sId] = parseFloat(val) || 0;
}

function updateAlpha(val) {
    state.payoff.alpha = parseFloat(val);
    document.getElementById('alphaVal').textContent = parseFloat(val).toFixed(2);
}

function analyzePayoff() {
    const alts = state.payoff.alternatives;
    const sts = state.payoff.states;

    if (alts.length < 2) { showToast('Add at least 2 alternatives', false); return; }
    if (sts.length < 2)  { showToast('Add at least 2 states of nature', false); return; }
    if (alts.some(a => !a.name.trim())) { showToast('Name all alternatives', false); return; }
    if (sts.some(s => !s.name.trim()))  { showToast('Name all states of nature', false); return; }

    const P = state.payoff.payoffs;

    renderMaximax(alts, sts, P);
    renderMaximin(alts, sts, P);
    renderRegret(alts, sts, P);
    renderHurwicz(alts, sts, P, state.payoff.alpha);
    renderLaplace(alts, sts, P);
    renderEV(alts, sts, P);
    renderSummary(alts, sts, P, state.payoff.alpha);

    switchTab('ptTabs', 'pt-summary');
    showToast('Analysis complete!', true);
}

function fmt(v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function payRow(aId, sts, P) {
    return sts.map(s => P[aId]?.[s.id] ?? 0);
}

function criterionBlock(title, badge, badgeClass, desc, body, note) {
    return `
    <div class="crit-block">
        <div class="crit-hdr">
            <div class="crit-title">${title}</div>
            <span class="crit-badge ${badgeClass}">${badge}</span>
        </div>
        <p class="crit-desc">${desc}</p>
        ${body}
        ${note ? `<div class="crit-note">${note}</div>` : ''}
    </div>`;
}

function decisionBox(label, altName, valLabel, val) {
    return `
    <div class="decision-box">
        <div class="dec-label">${label}</div>
        <div class="dec-alt">★ ${esc(altName)}</div>
        <div class="dec-val">${valLabel}: <strong>${fmt(val)}</strong></div>
    </div>`;
}

function stepBlock(label, content) {
    return `<div class="step-block"><div class="step-lbl">${label}</div>${content}</div>`;
}

function renderMaximax(alts, sts, P) {
    const data = alts.map(a => {
        const row = payRow(a.id, sts, P);
        return { a, row, best: Math.max(...row) };
    });
    const winVal = Math.max(...data.map(d => d.best));
    const winner = data.find(d => d.best === winVal);

    const headers = ['Alternative', ...sts.map(s => esc(s.name)), 'Row Max'];
    const tableHtml = `
        <div class="table-wrap">
            <table class="result-table">
                <thead><tr>${headers.map((h, i) => `<th ${i === headers.length-1 ? 'class="col-hi"' : ''}>${h}</th>`).join('')}</tr></thead>
                <tbody>
                    ${data.map(d => `
                        <tr class="${d.best === winVal ? 'winner-row' : ''}">
                            <td class="alt-cell">${d.best === winVal ? '★ ' : ''}${esc(d.a.name)}</td>
                            ${d.row.map(v => `<td class="${v === d.best ? 'cell-hi-max' : ''}">${fmt(v)}</td>`).join('')}
                            <td class="col-hi fw">${fmt(d.best)}</td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;

    const body = `
        ${stepBlock('Step 1: Find the maximum payoff for each alternative (the best-case outcome)', tableHtml)}
        ${stepBlock('Step 2: Choose the alternative with the largest row maximum',
            decisionBox('MAXIMAX DECISION', winner.a.name, 'Maximum Payoff', winVal))}`;

    document.getElementById('maximaxContent').innerHTML = criterionBlock(
        'Maximax Criterion', 'Optimistic Approach', 'badge-max',
        'Select the alternative with the <strong>maximum of the maximum payoffs</strong>. This is the most optimistic (best-case) approach — the decision maker assumes the best state of nature will occur.',
        body,
        'The maximax criterion favors bold, risk-seeking decision makers. It ignores all outcomes except the very best for each alternative.'
    );
}

function renderMaximin(alts, sts, P) {
    const data = alts.map(a => {
        const row = payRow(a.id, sts, P);
        return { a, row, worst: Math.min(...row) };
    });
    const winVal = Math.max(...data.map(d => d.worst));
    const winner = data.find(d => d.worst === winVal);

    const headers = ['Alternative', ...sts.map(s => esc(s.name)), 'Row Min'];
    const tableHtml = `
        <div class="table-wrap">
            <table class="result-table">
                <thead><tr>${headers.map((h, i) => `<th ${i === headers.length-1 ? 'class="col-hi"' : ''}>${h}</th>`).join('')}</tr></thead>
                <tbody>
                    ${data.map(d => `
                        <tr class="${d.worst === winVal ? 'winner-row' : ''}">
                            <td class="alt-cell">${d.worst === winVal ? '★ ' : ''}${esc(d.a.name)}</td>
                            ${d.row.map(v => `<td class="${v === d.worst ? 'cell-hi-min' : ''}">${fmt(v)}</td>`).join('')}
                            <td class="col-hi fw">${fmt(d.worst)}</td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;

    const body = `
        ${stepBlock('Step 1: Find the minimum payoff for each alternative (the worst-case outcome)', tableHtml)}
        ${stepBlock('Step 2: Choose the alternative with the largest row minimum',
            decisionBox('MAXIMIN DECISION', winner.a.name, 'Minimum Payoff', winVal))}`;

    document.getElementById('maximinContent').innerHTML = criterionBlock(
        'Maximin Criterion', 'Conservative Approach', 'badge-min',
        'Select the alternative with the <strong>maximum of the minimum payoffs</strong>. This is the most conservative (pessimistic) approach — the decision maker protects against the worst possible outcome.',
        body,
        'The maximin criterion is preferred by risk-averse decision makers who want to guarantee the best possible worst-case outcome.'
    );
}

function renderRegret(alts, sts, P) {
    const colBest = sts.map(s => Math.max(...alts.map(a => P[a.id]?.[s.id] ?? 0)));

    const data = alts.map(a => {
        const row = payRow(a.id, sts, P);
        const regret = row.map((v, i) => colBest[i] - v);
        return { a, row, regret, maxReg: Math.max(...regret) };
    });
    const winVal = Math.min(...data.map(d => d.maxReg));
    const winner = data.find(d => d.maxReg === winVal);

    const payTable = `
        <div class="table-wrap">
            <table class="result-table">
                <thead><tr>
                    <th>Alternative</th>
                    ${sts.map(s => `<th>${esc(s.name)}</th>`).join('')}
                </tr></thead>
                <tbody>
                    ${data.map(d => `
                        <tr>
                            <td class="alt-cell">${esc(d.a.name)}</td>
                            ${d.row.map((v, i) => `<td class="${v === colBest[i] ? 'cell-hi-max' : ''}">${fmt(v)}</td>`).join('')}
                        </tr>`).join('')}
                    <tr class="col-best-row">
                        <td><strong>Column Best →</strong></td>
                        ${colBest.map(v => `<td class="cell-hi-max fw">${fmt(v)}</td>`).join('')}
                    </tr>
                </tbody>
            </table>
        </div>`;

    const regTable = `
        <div class="table-wrap">
            <table class="result-table">
                <thead><tr>
                    <th>Alternative</th>
                    ${sts.map(s => `<th>${esc(s.name)}</th>`).join('')}
                    <th class="col-hi">Row Max Regret</th>
                </tr></thead>
                <tbody>
                    ${data.map(d => `
                        <tr class="${d.maxReg === winVal ? 'winner-row' : ''}">
                            <td class="alt-cell">${d.maxReg === winVal ? '★ ' : ''}${esc(d.a.name)}</td>
                            ${d.regret.map(v => `<td class="${v === d.maxReg ? 'cell-hi-reg' : ''}">${fmt(v)}</td>`).join('')}
                            <td class="col-hi fw">${fmt(d.maxReg)}</td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>
        <div class="regret-formula">
            <strong>Regret formula:</strong> Regret(alt, state) = Best payoff in state − Alt's payoff in that state
        </div>`;

    const body = `
        ${stepBlock('Step 1: Original payoff table — identify the best payoff in each column (state of nature)', payTable)}
        ${stepBlock('Step 2: Build the Opportunity Loss (Regret) Table — regret = column best − actual payoff', regTable)}
        ${stepBlock('Step 3: Choose the alternative with the minimum of the row maximum regrets',
            decisionBox('MINIMAX REGRET DECISION', winner.a.name, 'Max Regret', winVal))}`;

    document.getElementById('regretContent').innerHTML = criterionBlock(
        'Minimax Regret Criterion', 'Min Opportunity Loss', 'badge-reg',
        'Build a <strong>regret (opportunity loss) table</strong>. Regret is what you "miss out on" by not choosing the best option for a given state. Then choose the alternative that minimizes the maximum regret.',
        body,
        'This criterion appeals to decision makers who focus on opportunity cost — the regret of not choosing the best option after the fact.'
    );
}

function renderHurwicz(alts, sts, P, alpha) {
    const data = alts.map(a => {
        const row = payRow(a.id, sts, P);
        const mx = Math.max(...row), mn = Math.min(...row);
        const H = alpha * mx + (1 - alpha) * mn;
        return { a, row, mx, mn, H };
    });
    const winVal = Math.max(...data.map(d => d.H));
    const winner = data.find(d => d.H === winVal);

    const aFmt = parseFloat(alpha).toFixed(2);
    const bFmt = (1 - parseFloat(alpha)).toFixed(2);

    const tableHtml = `
        <div class="table-wrap">
            <table class="result-table">
                <thead><tr>
                    <th>Alternative</th>
                    <th>Best Payoff (Max)</th>
                    <th>Worst Payoff (Min)</th>
                    <th class="col-hi">H = ${aFmt}×Max + ${bFmt}×Min</th>
                </tr></thead>
                <tbody>
                    ${data.map(d => `
                        <tr class="${d.H === winVal ? 'winner-row' : ''}">
                            <td class="alt-cell">${d.H === winVal ? '★ ' : ''}${esc(d.a.name)}</td>
                            <td>${fmt(d.mx)}</td>
                            <td>${fmt(d.mn)}</td>
                            <td class="col-hi fw">${fmt(d.H.toFixed(2))}</td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>
        <div class="regret-formula">
            <strong>H(alt) = α × Max Payoff + (1 − α) × Min Payoff</strong> &nbsp;|&nbsp; Current α = ${aFmt}
        </div>`;

    const breakdown = data.map(d =>
        `<div class="ev-row">H(${esc(d.a.name)}) = ${aFmt} × ${fmt(d.mx)} + ${bFmt} × ${fmt(d.mn)} = <strong>${fmt(d.H.toFixed(2))}</strong></div>`
    ).join('');

    const body = `
        ${stepBlock(`Step 1: Compute Hurwicz value for each alternative using α = ${aFmt}`, tableHtml + `<div class="ev-breakdown">${breakdown}</div>`)}
        ${stepBlock('Step 2: Choose the alternative with the maximum Hurwicz value',
            decisionBox(`HURWICZ DECISION (α = ${aFmt})`, winner.a.name, 'H Value', winVal))}`;

    document.getElementById('hurwiczContent').innerHTML = criterionBlock(
        'Hurwicz Criterion', `α = ${aFmt}`, 'badge-hur',
        `Combines the optimistic (maximax) and pessimistic (maximin) approaches. The <strong>coefficient of optimism α</strong> (0 to 1) controls the weight given to the best vs worst outcomes. Use the slider in the left panel to adjust α.`,
        body,
        `α = 0 → identical to Maximin. &nbsp; α = 1 → identical to Maximax. &nbsp; α = 0.5 → equal weight to best and worst.`
    );
}

function renderLaplace(alts, sts, P) {
    const n = sts.length;
    const eqP = (1 / n).toFixed(4);
    const data = alts.map(a => {
        const row = payRow(a.id, sts, P);
        const avg = row.reduce((s, v) => s + v, 0) / n;
        return { a, row, avg };
    });
    const winVal = Math.max(...data.map(d => d.avg));
    const winner = data.find(d => d.avg === winVal);

    const tableHtml = `
        <div class="table-wrap">
            <table class="result-table">
                <thead><tr>
                    <th>Alternative</th>
                    ${sts.map(s => `<th>${esc(s.name)}<br><span class="prob-badge">P = ${eqP}</span></th>`).join('')}
                    <th class="col-hi">Average Payoff</th>
                </tr></thead>
                <tbody>
                    ${data.map(d => `
                        <tr class="${d.avg === winVal ? 'winner-row' : ''}">
                            <td class="alt-cell">${d.avg === winVal ? '★ ' : ''}${esc(d.a.name)}</td>
                            ${d.row.map(v => `<td>${fmt(v)}</td>`).join('')}
                            <td class="col-hi fw">${fmt(d.avg.toFixed(2))}</td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;

    const breakdown = data.map(d =>
        `<div class="ev-row">Avg(${esc(d.a.name)}) = (${d.row.map(v => fmt(v)).join(' + ')}) ÷ ${n} = <strong>${fmt(d.avg.toFixed(2))}</strong></div>`
    ).join('');

    const body = `
        ${stepBlock(`Step 1: Assign equal probability of 1/${n} = ${eqP} to each state, then compute average payoff`, tableHtml + `<div class="ev-breakdown">${breakdown}</div>`)}
        ${stepBlock('Step 2: Choose the alternative with the highest average payoff',
            decisionBox('LAPLACE DECISION', winner.a.name, 'Average Payoff', winVal))}`;

    document.getElementById('laplaceContent').innerHTML = criterionBlock(
        'Laplace Criterion', 'Equal Likelihood', 'badge-lap',
        `Assign <strong>equal probability (1/${n} each)</strong> to every state of nature, since there is no reason to favor one over another. Then choose the alternative with the highest expected value under equal likelihood.`,
        body,
        'The Laplace criterion is equivalent to the Expected Value criterion when all states are assumed equally likely. It is appropriate when there is no historical data or basis for assigning probabilities.'
    );
}

function renderEV(alts, sts, P) {
    const el = document.getElementById('evContent');
    const hasPr = sts.some(s => s.probability !== '');
    if (!hasPr) {
        el.innerHTML = `<div class="no-data"><div class="nd-icon">📐</div><p>Enter probabilities for states of nature in the left panel to enable Expected Value &amp; EVPI analysis.</p></div>`;
        return;
    }
    const probs = sts.map(s => parseFloat(s.probability) || 0);
    const pSum = probs.reduce((a, b) => a + b, 0);
    if (Math.abs(pSum - 1) > 0.005) {
        el.innerHTML = criterionBlock('Expected Value / EVPI', 'Error', 'badge-ev',
            `Probabilities must sum to 1.000.`,
            `<div class="error-box">⚠️ Current sum: <strong>${pSum.toFixed(4)}</strong>. Please correct the probabilities in the left panel.</div>`, '');
        return;
    }

    const data = alts.map(a => {
        const row = payRow(a.id, sts, P);
        const ev = row.reduce((s, v, i) => s + probs[i] * v, 0);
        return { a, row, ev };
    });
    const bestEV = Math.max(...data.map(d => d.ev));
    const winner = data.find(d => d.ev === bestEV);

    const colBest = sts.map((s, i) => Math.max(...alts.map(a => P[a.id]?.[s.id] ?? 0)));
    const evCertainty = colBest.reduce((s, v, i) => s + probs[i] * v, 0);
    const evpi = evCertainty - bestEV;

    const evTable = `
        <div class="table-wrap">
            <table class="result-table">
                <thead><tr>
                    <th>Alternative</th>
                    ${sts.map((s, i) => `<th>${esc(s.name)}<br><span class="prob-badge">P = ${probs[i]}</span></th>`).join('')}
                    <th class="col-hi">EV</th>
                </tr></thead>
                <tbody>
                    ${data.map(d => `
                        <tr class="${d.ev === bestEV ? 'winner-row' : ''}">
                            <td class="alt-cell">${d.ev === bestEV ? '★ ' : ''}${esc(d.a.name)}</td>
                            ${d.row.map(v => `<td>${fmt(v)}</td>`).join('')}
                            <td class="col-hi fw">${fmt(d.ev.toFixed(2))}</td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;

    const evBreakdown = data.map(d =>
        `<div class="ev-row">EV(${esc(d.a.name)}) = ${sts.map((s, i) => `${probs[i]}×${fmt(d.row[i])}`).join(' + ')} = <strong>${fmt(d.ev.toFixed(2))}</strong></div>`
    ).join('');

    const evpiTable = `
        <div class="table-wrap">
            <table class="result-table">
                <thead><tr>
                    <th>State of Nature</th><th>Probability</th><th>Best Payoff Under Certainty</th><th>Contribution</th>
                </tr></thead>
                <tbody>
                    ${sts.map((s, i) => `
                        <tr>
                            <td>${esc(s.name)}</td>
                            <td>${probs[i]}</td>
                            <td class="cell-hi-max">${fmt(colBest[i])}</td>
                            <td>${fmt((probs[i] * colBest[i]).toFixed(2))}</td>
                        </tr>`).join('')}
                    <tr class="sum-row">
                        <td colspan="3"><strong>EVwPI (Expected Value with Perfect Information)</strong></td>
                        <td class="fw">${fmt(evCertainty.toFixed(2))}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="evpi-calc">
            <div>EVwPI = <strong>${fmt(evCertainty.toFixed(2))}</strong></div>
            <div>Best EV (without perfect info) = <strong>${fmt(bestEV.toFixed(2))}</strong></div>
            <div class="evpi-result">EVPI = EVwPI − Best EV = ${fmt(evCertainty.toFixed(2))} − ${fmt(bestEV.toFixed(2))} = <strong>${fmt(evpi.toFixed(2))}</strong></div>
            <p class="evpi-interp">The maximum a rational decision maker should pay for perfect information is <strong>${fmt(evpi.toFixed(2))}</strong>.</p>
        </div>`;

    const body = `
        ${stepBlock('Step 1: Compute Expected Value (EV) for each alternative', evTable + `<div class="ev-breakdown">${evBreakdown}</div>`)}
        ${stepBlock('Step 2: Choose the alternative with the highest EV',
            decisionBox('EXPECTED VALUE DECISION', winner.a.name, 'EV', bestEV))}
        ${stepBlock('Step 3: Compute Expected Value of Perfect Information (EVPI)', evpiTable)}`;

    el.innerHTML = criterionBlock(
        'Expected Value (EV) &amp; EVPI', 'Decision Under Risk', 'badge-ev',
        `Use known probabilities for each state of nature to compute a <strong>probability-weighted average payoff</strong> (Expected Value). Also compute EVPI — the most you should ever pay for perfect information about which state will occur.`,
        body,
        'EV analysis is only valid when reliable probability estimates are available for each state of nature.'
    );
}

function renderSummary(alts, sts, P, alpha) {
    const n = sts.length;
    const probs = sts.map(s => parseFloat(s.probability) || 0);
    const hasProbs = Math.abs(probs.reduce((a, b) => a + b, 0) - 1) < 0.005 && sts.some(s => s.probability !== '');

    function winner(data, cmp) { return data.reduce((b, d) => cmp(d, b) ? d : b); }

    const mmaxData = alts.map(a => { const r = payRow(a.id, sts, P); return { a, v: Math.max(...r) }; });
    const mminData = alts.map(a => { const r = payRow(a.id, sts, P); return { a, v: Math.min(...r) }; });
    const colBest = sts.map(s => Math.max(...alts.map(a => P[a.id]?.[s.id] ?? 0)));
    const regData = alts.map(a => { const r = payRow(a.id, sts, P); return { a, v: Math.max(...r.map((v, i) => colBest[i] - v)) }; });
    const hurData = alts.map(a => { const r = payRow(a.id, sts, P); return { a, v: alpha * Math.max(...r) + (1 - alpha) * Math.min(...r) }; });
    const lapData = alts.map(a => { const r = payRow(a.id, sts, P); return { a, v: r.reduce((s, v) => s + v, 0) / n }; });

    const mmaxWin = winner(mmaxData, (d, b) => d.v > b.v);
    const mminWin = winner(mminData, (d, b) => d.v > b.v);
    const regWin  = winner(regData,  (d, b) => d.v < b.v);
    const hurWin  = winner(hurData,  (d, b) => d.v > b.v);
    const lapWin  = winner(lapData,  (d, b) => d.v > b.v);

    const criteria = [
        { name: 'Maximax', badge: 'badge-max', winner: mmaxWin, val: mmaxWin.v, tab: 'pt-maximax' },
        { name: 'Maximin', badge: 'badge-min', winner: mminWin, val: mminWin.v, tab: 'pt-maximin' },
        { name: 'Minimax Regret', badge: 'badge-reg', winner: regWin, val: regWin.v, tab: 'pt-regret' },
        { name: `Hurwicz α=${parseFloat(alpha).toFixed(2)}`, badge: 'badge-hur', winner: hurWin, val: hurWin.v, tab: 'pt-hurwicz' },
        { name: 'Laplace', badge: 'badge-lap', winner: lapWin, val: lapWin.v, tab: 'pt-laplace' },
    ];

    if (hasProbs) {
        const evData = alts.map(a => { const r = payRow(a.id, sts, P); return { a, v: r.reduce((s, v, i) => s + probs[i] * v, 0) }; });
        const evWin = winner(evData, (d, b) => d.v > b.v);
        criteria.push({ name: 'Expected Value', badge: 'badge-ev', winner: evWin, val: evWin.v, tab: 'pt-ev' });
    }

    const wins = {};
    alts.forEach(a => wins[a.id] = 0);
    criteria.forEach(c => { if (wins[c.winner.a.id] !== undefined) wins[c.winner.a.id]++; });
    const overallWinner = alts.reduce((b, a) => wins[a.id] > wins[b.id] ? a : b);

    const summaryCards = criteria.map(c => `
        <div class="summary-card" onclick="switchTab('ptTabs','${c.tab}')">
            <span class="crit-badge ${c.badge}">${c.name}</span>
            <div class="sc-winner">${esc(c.winner.a.name)}</div>
            <div class="sc-val">${fmt(c.val.toFixed(2))}</div>
            <div class="sc-hint">Click for details →</div>
        </div>`).join('');

    const winCards = alts.map(a => `
        <div class="win-card ${a.id === overallWinner.id ? 'win-card-top' : ''}">
            <div class="win-alt">${a.id === overallWinner.id ? '🏆 ' : ''}${esc(a.name)}</div>
            <div class="win-count">${wins[a.id]} / ${criteria.length}</div>
            <div class="win-lbl">criteria won</div>
        </div>`).join('');

    const body = `
        <div class="summary-grid">${summaryCards}</div>
        ${stepBlock('Criterion Win Count', `<div class="win-grid">${winCards}</div>`)}`;

    document.getElementById('summaryContent').innerHTML = criterionBlock(
        'Analysis Summary', 'All Criteria', 'badge-sum',
        `<strong>${esc(state.payoff.title || 'Decision Problem')}</strong> — all decision criteria applied and compared. Click any card to see the step-by-step working for that criterion.`,
        body,
        'Different criteria may recommend different alternatives. The choice depends on the decision maker\'s risk attitude and available information. No single criterion is universally "best."'
    );
}

function exportCSV() {
    const alts = state.payoff.alternatives;
    const sts = state.payoff.states;
    if (alts.length === 0 || sts.length === 0) { showToast('Nothing to export', false); return; }

    let csv = `Decision Analysis Export\n"${state.payoff.title}"\n\nPayoff Table\n`;
    csv += `Alternative,${sts.map(s => `"${s.name}${s.probability ? ` (P=${s.probability})` : ''}"`).join(',')}\n`;
    alts.forEach(a => {
        csv += `"${a.name}",${sts.map(s => state.payoff.payoffs[a.id]?.[s.id] ?? 0).join(',')}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${state.payoff.title || 'decision-analysis'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Exported!', true);
}

function loadSample(key) {
    const samples = {
        system: {
            mode: 'payoff',
            title: 'System Development Decision (p.17)',
            desc: 'A company must decide which size computer system to build given uncertain future demand levels.',
            alts: ['Build a Small System', 'Build a Medium System', 'Build a Big System'],
            states: [
                { name: 'Low Demand', prob: '' },
                { name: 'Moderate Demand', prob: '' },
                { name: 'High Demand', prob: '' }
            ],
            payoffs: [[100000, 110000, 120000], [60000, 170000, 200000], [-45000, -25000, 300000]]
        },
        manufacturer: {
            mode: 'payoff',
            title: 'Manufacturer Plant Expansion (p.23)',
            desc: 'A manufacturer of office equipment decides whether to expand now or wait another year, depending on economic conditions.',
            alts: ['Expand Now', 'Wait to Expand'],
            states: [{ name: 'Good Economy', prob: '' }, { name: 'Recession', prob: '' }],
            payoffs: [[380000, -90000], [180000, 18000]]
        },
        reyes: {
            mode: 'payoff',
            title: 'Reyes Co. – Wooden Toys Plant Decision (p.25)',
            desc: 'Reyes Co. must decide how to expand production capacity for educational wooden toys. Payoffs are in thousands (₱).',
            alts: ['Overhaul Existing Plant', 'Expand Current Plant', 'Buy Competitor\'s Plant', 'Do Nothing'],
            states: [{ name: 'High Demand', prob: '' }, { name: 'Moderate Demand', prob: '' }, { name: 'Low Demand', prob: '' }, { name: 'Failure', prob: '' }],
            payoffs: [[700, 350, -200, -800], [650, 300, -180, -650], [500, 200, -150, -500], [150, 80, -50, -50]]
        },
        crops: {
            mode: 'payoff',
            title: 'Farmer Crop Selection (p.27)',
            desc: 'A farmer in Region 2 must choose which crop to plant. Returns depend on whether a new Hong Kong trade bill passes. Payoffs in ₱.',
            alts: ['Banana', 'Corn', 'Mango'],
            states: [{ name: 'Trade Bill Passes', prob: '' }, { name: 'Trade Bill Fails', prob: '' }],
            payoffs: [[2000000, 600000], [1100000, 500000], [1400000, 1000000]]
        },
        bike: {
            mode: 'payoff',
            title: 'Bob Bike Shop Facility Decision (p.29)',
            desc: 'Bob must choose between expanding his current shop, moving to a larger facility, or doing nothing. Payoffs in ₱.',
            alts: ['Expand Current Shop', 'Move to Larger Facility', 'Do Nothing'],
            states: [{ name: 'Good Market', prob: '' }, { name: 'Average Market', prob: '' }, { name: 'Poor Market', prob: '' }],
            payoffs: [[550000, 250000, -200000], [600000, 300000, -400000], [350000, 100000, 20000]]
        },
        franchise: {
            mode: 'dtree',
            title: 'Franchise Investor Sequential Decision (p.45)',
            desc: 'An investor considers a ₱15,000 deposit to reserve a franchise. After a competitor\'s decision is revealed, a second decision must be made.',
            tree: buildFranchiseTree()
        },
        wh_drug: {
            mode: 'dtree',
            title: 'WH Drug Company – Skin Cream (p.47)',
            desc: 'WH Drug can sell the rights to a skin cream for ₱50,000 or invest ₱80,000 to develop it, then decide how to market.',
            tree: buildWHDrugTree()
        },
        marshall: {
            mode: 'dtree',
            title: 'Marshall Company – Plant Size (p.50)',
            desc: 'Marshall Company plans to build a new plant and must choose between a large or small facility given uncertain competition.',
            tree: buildMarshallTree()
        }
    };

    const s = samples[key];
    if (!s) return;

    if (s.mode === 'payoff') {
        setMode('payoff');
        const pts = {};
        const altObjs = s.alts.map((name, i) => {
            const id = 'sa' + i;
            pts[id] = {};
            s.states.forEach((st, j) => { pts[id]['ss' + j] = s.payoffs[i][j]; });
            return { id, name };
        });
        const stObjs = s.states.map((st, j) => ({ id: 'ss' + j, name: st.name, probability: st.prob }));

        state.payoff = { title: s.title, description: s.desc, alternatives: altObjs, states: stObjs, payoffs: pts, alpha: 0.5 };
        document.getElementById('ptTitle').value = s.title;
        document.getElementById('ptDesc').value = s.desc;
        document.getElementById('alphaSlider').value = 0.5;
        document.getElementById('alphaVal').textContent = '0.50';
        renderAlternatives();
        renderStates();
        renderMatrixEditor();
        switchTab('ptTabs', 'pt-matrix');
        showToast('Sample loaded! Click Analyze to run all criteria.', true);
    } else {
        setMode('dtree');
        state.dtree = { title: s.title, description: s.desc, root: s.tree, zoom: 1 };
        document.getElementById('dtTitle').value = s.title;
        document.getElementById('dtDesc').value = s.desc;
        renderDTreeBuilder();
        switchTab('dtTabs', 'dt-viz');
        showToast('Decision tree loaded! Click Compute Tree.', true);
    }
}

function makeNode(type, label, payoff) {
    return { id: 'n' + Math.random().toString(36).substr(2, 8), type, label, payoff: payoff ?? 0, branches: type !== 'terminal' ? [] : undefined };
}
function makeBranch(label, prob, cost, child) {
    return { id: 'b' + Math.random().toString(36).substr(2, 8), label, probability: prob ?? null, cost: cost ?? 0, child };
}

function buildFranchiseTree() {
    const root = makeNode('decision', 'Should investor make the ₱15,000 deposit?');
    const noPay = makeNode('terminal', 'Do Not Pay Deposit', 0);
    const payNode = makeNode('chance', 'Will competitor develop an outlet?');

    const compDec = makeNode('decision', 'Proceed with franchise or not?');
    const compProceed = makeNode('chance', 'Market size (with competition)');
    compProceed.branches.push(makeBranch('Large Market (P=0.40)', 0.4, 0, makeNode('terminal', 'Large market, competition', 50000)));
    compProceed.branches.push(makeBranch('Moderate Market (P=0.60)', 0.6, 0, makeNode('terminal', 'Moderate market, competition', 10000)));
    compDec.branches.push(makeBranch('Proceed', null, 0, compProceed));
    compDec.branches.push(makeBranch('Do Not Proceed', null, 0, makeNode('terminal', 'Abandon (competition)', -15000)));

    const noCompDec = makeNode('decision', 'Proceed with franchise or not?');
    const noCompProceed = makeNode('chance', 'Market size (no competition)');
    noCompProceed.branches.push(makeBranch('Large Market (P=0.40)', 0.4, 0, makeNode('terminal', 'Large market, no competition', 100000)));
    noCompProceed.branches.push(makeBranch('Moderate Market (P=0.60)', 0.6, 0, makeNode('terminal', 'Moderate market, no competition', 60000)));
    noCompDec.branches.push(makeBranch('Proceed', null, 0, noCompProceed));
    noCompDec.branches.push(makeBranch('Do Not Proceed', null, 0, makeNode('terminal', 'Abandon (no competition)', -15000)));

    payNode.branches.push(makeBranch('Competitor Develops (P=0.50)', 0.5, 0, compDec));
    payNode.branches.push(makeBranch('No Competitor (P=0.50)', 0.5, 0, noCompDec));

    root.branches.push(makeBranch('Pay ₱15,000 Deposit', null, 15000, payNode));
    root.branches.push(makeBranch('Do Not Pay', null, 0, noPay));
    return root;
}

function buildWHDrugTree() {
    const root = makeNode('decision', 'What should WH Drug do with the skin cream?');
    const sell = makeNode('terminal', 'Sell rights now', 50000);
    const devChance = makeNode('chance', 'Development outcome (50-50)');

    const successDec = makeNode('decision', 'How to handle successful development?');
    const sellRights = makeNode('chance', 'Sell rights (competitive offers)');
    sellRights.branches.push(makeBranch('Offer: ₱100,000 (P=0.40)', 0.4, 0, makeNode('terminal', 'High rights offer', 100000)));
    sellRights.branches.push(makeBranch('Offer: ₱70,000 (P=0.60)', 0.6, 0, makeNode('terminal', 'Low rights offer', 70000)));

    const marketSelf = makeNode('chance', 'Market product yourself');
    marketSelf.branches.push(makeBranch('₱200,000 return (P=0.20)', 0.20, 0, makeNode('terminal', 'High return', 200000)));
    marketSelf.branches.push(makeBranch('₱100,000 return (P=0.50)', 0.50, 0, makeNode('terminal', 'Medium return', 100000)));
    marketSelf.branches.push(makeBranch('₱50,000 return (P=0.30)', 0.30, 0, makeNode('terminal', 'Low return', 50000)));

    successDec.branches.push(makeBranch('Sell Rights to Others', null, 0, sellRights));
    successDec.branches.push(makeBranch('Market Product Yourself', null, 0, marketSelf));

    const failSell = makeNode('terminal', 'Sell limited rights after failure', 20000);
    devChance.branches.push(makeBranch('Success (P=0.50)', 0.5, 0, successDec));
    devChance.branches.push(makeBranch('Failure (P=0.50)', 0.5, 0, failSell));

    root.branches.push(makeBranch('Sell Rights Now for ₱50,000', null, 0, sell));
    root.branches.push(makeBranch('Develop Product (Cost: ₱80,000)', null, 80000, devChance));
    return root;
}

function buildMarshallTree() {
    const root = makeNode('decision', 'Which plant size should Marshall Company build?');

    const largeChance = makeNode('chance', 'Will competition develop?');
    largeChance.branches.push(makeBranch('No Competition (P=0.40)', 0.4, 0, makeNode('terminal', 'Large plant, no competition', 800000)));
    largeChance.branches.push(makeBranch('Competition Develops (P=0.60)', 0.6, 0, makeNode('terminal', 'Large plant, competition', 300000)));

    const smallDec = makeNode('decision', 'Expand small plant after 3 years, or maintain?');
    const expandChance = makeNode('chance', 'Competition (given small+expand)?');
    expandChance.branches.push(makeBranch('No Competition (P=0.40)', 0.4, 0, makeNode('terminal', 'Expand, no competition', 600000)));
    expandChance.branches.push(makeBranch('Competition (P=0.60)', 0.6, 0, makeNode('terminal', 'Expand, competition', 100000)));

    const maintainChance = makeNode('chance', 'Competition (given small+maintain)?');
    maintainChance.branches.push(makeBranch('No Competition (P=0.40)', 0.4, 0, makeNode('terminal', 'Maintain, no competition', 350000)));
    maintainChance.branches.push(makeBranch('Competition (P=0.60)', 0.6, 0, makeNode('terminal', 'Maintain, competition', 300000)));

    smallDec.branches.push(makeBranch('Expand Plant After 3 Years', null, 0, expandChance));
    smallDec.branches.push(makeBranch('Maintain Small Plant', null, 0, maintainChance));

    root.branches.push(makeBranch('Build Large Plant', null, 0, largeChance));
    root.branches.push(makeBranch('Build Small Plant', null, 0, smallDec));
    return root;
}

function closeSampleMenu() {
    document.getElementById('sampleMenu')?.classList.add('hidden');
}

function renderDTreeBuilder() {
    const container = document.getElementById('dtreeBuilder');
    if (!container) return;
    container.innerHTML = renderNodeForm(state.dtree.root, null, null, 0, true);
}

function renderNodeForm(node, parentId, branchId, depth, isRoot) {
    if (!node) return '';
    const nt = node.type;
    const icon = nt === 'decision' ? '■' : nt === 'chance' ? '●' : '◆';
    const cls  = nt === 'decision' ? 'nd-dec' : nt === 'chance' ? 'nd-ch' : 'nd-term';
    const lbl  = nt === 'decision' ? 'Decision Node' : nt === 'chance' ? 'Chance Node' : 'Terminal (Payoff)';

    let html = `<div class="dt-node ${cls}" style="margin-left:${depth * 18}px;">`;
    html += `<div class="dt-node-hdr">
        <span class="dt-node-icon">${icon}</span>
        <span class="dt-node-type">${lbl}</span>
        ${!isRoot ? `<select class="dt-type-sel" onchange="changeNodeType('${parentId}','${branchId}',this.value)">
            <option value="decision" ${nt==='decision'?'selected':''}>Decision</option>
            <option value="chance" ${nt==='chance'?'selected':''}>Chance</option>
            <option value="terminal" ${nt==='terminal'?'selected':''}>Terminal</option>
        </select>` : ''}
    </div>`;
    html += `<input type="text" class="item-input" placeholder="Label (e.g., Choose facility size)" value="${esc(node.label)}"
        oninput="updateNodeLabel('${node.id}', this.value)">`;

    if (nt === 'terminal') {
        html += `<div class="payoff-row">
            <label class="prob-label">Payoff:</label>
            <input type="number" class="item-input payoff-inp" value="${node.payoff ?? 0}"
                oninput="updateNodePayoff('${node.id}', this.value)">
        </div>`;
    }

    if (nt !== 'terminal' && node.branches) {
        node.branches.forEach((b) => {
            html += `<div class="dt-branch">
                <div class="dt-branch-row">
                    <span class="dt-branch-arrow">→</span>
                    <input type="text" class="item-input branch-lbl-inp" placeholder="Branch label"
                        value="${esc(b.label)}" oninput="updateBranchLabel('${node.id}','${b.id}',this.value)">
                    ${nt === 'chance' ? `
                        <input type="number" class="item-input prob-inp" placeholder="P" min="0" max="1" step="0.01"
                            title="Probability" value="${b.probability ?? ''}"
                            oninput="updateBranchProb('${node.id}','${b.id}',this.value)">` : ''}
                    <input type="number" class="item-input cost-inp" placeholder="Cost" title="Cost/investment for this branch"
                        value="${b.cost || 0}" oninput="updateBranchCost('${node.id}','${b.id}',this.value)">
                    <button class="del-btn" onclick="removeBranch('${node.id}','${b.id}')">✕</button>
                </div>
                ${b.child ? renderNodeForm(b.child, node.id, b.id, depth + 1, false) : ''}
            </div>`;
        });
        html += `<button class="add-btn add-branch-btn" onclick="addBranch('${node.id}')">+ Add Branch</button>`;
    }

    html += '</div>';
    return html;
}

function findNode(root, id) {
    if (!root) return null;
    if (root.id === id) return root;
    if (root.branches) {
        for (const b of root.branches) {
            const f = findNode(b.child, id);
            if (f) return f;
        }
    }
    return null;
}

function findBranch(root, nodeId, branchId) {
    const node = findNode(root, nodeId);
    return node?.branches?.find(b => b.id === branchId) ?? null;
}

function updateNodeLabel(id, val) { const n = findNode(state.dtree.root, id); if (n) n.label = val; }
function updateNodePayoff(id, val) { const n = findNode(state.dtree.root, id); if (n) n.payoff = parseFloat(val) || 0; }
function updateBranchLabel(nid, bid, val) { const b = findBranch(state.dtree.root, nid, bid); if (b) b.label = val; }
function updateBranchProb(nid, bid, val) { const b = findBranch(state.dtree.root, nid, bid); if (b) b.probability = parseFloat(val) || null; }
function updateBranchCost(nid, bid, val) { const b = findBranch(state.dtree.root, nid, bid); if (b) b.cost = parseFloat(val) || 0; }

function addBranch(nodeId) {
    const node = findNode(state.dtree.root, nodeId);
    if (!node?.branches) return;
    node.branches.push(makeBranch('', null, 0, makeNode('terminal', '', 0)));
    renderDTreeBuilder();
}

function removeBranch(nodeId, branchId) {
    const node = findNode(state.dtree.root, nodeId);
    if (!node?.branches) return;
    node.branches = node.branches.filter(b => b.id !== branchId);
    renderDTreeBuilder();
}

function changeNodeType(parentId, branchId, newType) {
    const parent = findNode(state.dtree.root, parentId);
    const branch = parent?.branches?.find(b => b.id === branchId);
    if (!branch) return;
    const old = branch.child;
    branch.child = makeNode(newType, old?.label || '', old?.payoff ?? 0);
    if (newType !== 'terminal' && old?.branches) branch.child.branches = old.branches;
    renderDTreeBuilder();
}

function computeTree() {
    const root = state.dtree.root;
    if (!root) { showToast('Build a decision tree first', false); return; }

    const errors = [];
    validateTree(root, errors);
    if (errors.length > 0) {
        showToast(errors[0], false);
        return;
    }

    backward(root);
    renderTreeViz(root);
    renderTreeSolution(root);
    switchTab('dtTabs', 'dt-viz');
    showToast('Tree computed! Optimal path highlighted.', true);
}

function validateTree(node, errors) {
    if (!node) return;
    if (node.type === 'chance' && node.branches?.length > 0) {
        const pSum = node.branches.reduce((s, b) => s + (b.probability || 0), 0);
        if (Math.abs(pSum - 1) > 0.01) {
            errors.push(`Chance node "${node.label}": probabilities sum to ${pSum.toFixed(3)}, not 1.000`);
        }
    }
    node.branches?.forEach(b => validateTree(b.child, errors));
}

function backward(node) {
    if (!node) return 0;
    if (node.type === 'terminal') { node.ev = node.payoff; return node.payoff; }

    if (node.type === 'chance') {
        let ev = 0;
        node.branches.forEach(b => {
            const cv = backward(b.child);
            b.childEV = cv;
            ev += (b.probability || 0) * (cv - (b.cost || 0));
        });
        node.ev = ev;
        return ev;
    }

    if (node.type === 'decision') {
        const vals = node.branches.map(b => {
            const cv = backward(b.child);
            b.childEV = cv;
            return cv - (b.cost || 0);
        });
        const best = Math.max(...vals);
        node.ev = best;
        node.branches.forEach((b, i) => { b.isOptimal = (vals[i] === best); });
        return best;
    }
    return 0;
}

function renderTreeViz(root) {
    const diagram = buildTreeDiagram(root);
    document.getElementById('dtVizContent').innerHTML = diagram;
}

function treeZoomIn() {
    const z = state.dtree.zoom || 1;
    state.dtree.zoom = Math.min(2.5, +(z + 0.1).toFixed(2));
    renderTreeViz(state.dtree.root);
}

function treeZoomOut() {
    const z = state.dtree.zoom || 1;
    state.dtree.zoom = Math.max(0.4, +(z - 0.1).toFixed(2));
    renderTreeViz(state.dtree.root);
}

function treeZoomReset() {
    state.dtree.zoom = 1;
    renderTreeViz(state.dtree.root);
}

function buildTreeDiagram(root) {
    if (!root) {
        return `<div class="no-data"><div class="nd-icon">🌳</div><p>Build a decision tree first.</p></div>`;
    }

    const nodeW = 240;
    const nodeH = 56;
    const levelGap = 300;
    const leafGap = 130;
    const marginX = 40;
    const marginY = 40;

    const positioned = [];
    const edges = [];
    let leafCounter = 0;
    let maxDepth = 0;

    function place(node, depth) {
        if (!node) return { x: 0, y: 0 };
        if (depth > maxDepth) maxDepth = depth;

        const children = node.branches?.filter(b => b.child) || [];
        let y;

        if (children.length === 0) {
            y = leafCounter * leafGap;
            leafCounter += 1;
        } else {
            const ys = [];
            children.forEach((b, idx) => {
                const childPos = place(b.child, depth + 1);
                ys.push(childPos.y);
                edges.push({
                    fromId: node.id,
                    toId: b.child.id,
                    label: b.label || 'branch',
                    probability: b.probability,
                    cost: b.cost || 0,
                    isOptimal: !!b.isOptimal,
                    branchIndex: idx,
                    siblingCount: children.length
                });
            });
            y = ys.reduce((a, b) => a + b, 0) / ys.length;
        }

        const x = depth * levelGap;
        positioned.push({ id: node.id, node, x, y });
        return { x, y };
    }

    place(root, 0);

    const posMap = {};
    positioned.forEach(p => { posMap[p.id] = p; });

    const width = marginX * 2 + (maxDepth * levelGap) + nodeW + 80;
    const rawHeight = Math.max(1, leafCounter) * leafGap;
    const height = marginY * 2 + Math.max(rawHeight, 140);
    const zoom = state.dtree.zoom || 1;
    const renderedWidth = Math.round(width * zoom);
    const renderedHeight = Math.round(height * zoom);

    const lines = edges.map(e => {
        const from = posMap[e.fromId];
        const to = posMap[e.toId];
        const x1 = marginX + from.x + nodeW;
        const y1 = marginY + from.y + nodeH / 2;
        const x2 = marginX + to.x;
        const y2 = marginY + to.y + nodeH / 2;
        const cx1 = x1 + 34;
        const cx2 = x2 - 34;

        const mx = x1 + (x2 - x1) * 0.42;
        const siblingCenter = (e.siblingCount - 1) / 2;
        const siblingOffset = (e.branchIndex - siblingCenter) * 18;
        const directionOffset = y2 >= y1 ? -8 : 8;
        const my = y1 + (y2 - y1) * 0.42 + siblingOffset + directionOffset;
        const parts = [svgEsc(shortLabel(e.label, 26))];
        if (e.probability !== null && e.probability !== undefined) parts.push(`P=${e.probability}`);
        if (e.cost > 0) parts.push(`Cost ${fmt(e.cost)}`);
        const edgeLabel = parts.join(' • ');
        const labelW = Math.max(120, Math.min(220, edgeLabel.length * 6.3 + 22));

        return `
            <path d="M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}" class="tree-edge ${e.isOptimal ? 'tree-edge-opt' : ''}" />
            <g transform="translate(${mx}, ${my - 12})">
            <rect x="-${(labelW / 2).toFixed(1)}" y="-12" width="${labelW.toFixed(1)}" height="24" rx="8" class="tree-edge-label-bg ${e.isOptimal ? 'tree-edge-label-bg-opt' : ''}"></rect>
                <text x="0" y="4" text-anchor="middle" class="tree-edge-label">${svgEsc(edgeLabel)}</text>
            </g>`;
    }).join('');

    const nodes = positioned.map(p => {
        const nt = p.node.type;
        const icon = nt === 'decision' ? '■' : nt === 'chance' ? '●' : '◆';
        const nodeClass = nt === 'decision' ? 'tree-node-decision' : nt === 'chance' ? 'tree-node-chance' : 'tree-node-terminal';
        const subtitle = nt === 'terminal'
            ? `Payoff: ${fmt(p.node.payoff)}`
            : `EV: ${p.node.ev !== undefined ? fmt(p.node.ev.toFixed(2)) : '—'}`;
        const label = shortLabel(p.node.label || 'Node', 30);
        const x = marginX + p.x;
        const y = marginY + p.y;

        return `
            <g transform="translate(${x}, ${y})" class="tree-node ${nodeClass}">
                <rect x="0" y="0" width="${nodeW}" height="${nodeH}" rx="12" class="tree-node-box"></rect>
                <text x="12" y="21" class="tree-node-title">${icon} ${svgEsc(label)}</text>
                <text x="12" y="41" class="tree-node-sub">${svgEsc(subtitle)}</text>
            </g>`;
    }).join('');

    return `
        <div class="tree-viz-shell">
            <div class="tree-viz-toolbar">
                <div class="tree-viz-help">■ Decision node &nbsp; ● Chance node &nbsp; ◆ Terminal node</div>
                <div class="tree-zoom-controls">
                    <button type="button" class="tree-zoom-btn" onclick="treeZoomOut()" title="Zoom out">−</button>
                    <span class="tree-zoom-readout">${Math.round(zoom * 100)}%</span>
                    <button type="button" class="tree-zoom-btn" onclick="treeZoomIn()" title="Zoom in">+</button>
                    <button type="button" class="tree-zoom-btn reset" onclick="treeZoomReset()" title="Reset zoom">Reset</button>
                </div>
            </div>
            <div class="tree-viz-canvas">
                <svg viewBox="0 0 ${width} ${height}" width="${renderedWidth}" height="${renderedHeight}" class="tree-svg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Decision tree diagram">
                    <defs>
                        <marker id="treeArrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L10,4 L0,8 z" fill="#7294c6"></path>
                        </marker>
                        <marker id="treeArrowOpt" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L10,4 L0,8 z" fill="#2f9f57"></path>
                        </marker>
                    </defs>
                    ${lines}
                    ${nodes}
                </svg>
            </div>
        </div>`;
}

function shortLabel(txt, maxLen) {
    const str = String(txt || '');
    if (str.length <= maxLen) return str;
    return str.slice(0, Math.max(1, maxLen - 1)).trimEnd() + '…';
}

function svgEsc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderTreeSolution(root) {
    const lines = [];
    traceOptimalPath(root, lines, '');

    const pathHtml = lines.map(l => `<div class="sol-line ${l.cls}">${l.text}</div>`).join('');

    document.getElementById('dtSolutionContent').innerHTML = `
        <div class="crit-block">
            <div class="crit-hdr">
                <div class="crit-title">Optimal Decision Strategy</div>
                <span class="crit-badge badge-ev">Backward Induction</span>
            </div>
            <p class="crit-desc">Computed using backward induction. At each <strong>decision node</strong>, choose the branch with the highest expected value (after subtracting costs). At each <strong>chance node</strong>, the EV is the probability-weighted average of outcomes.</p>
            <div class="step-block">
                <div class="step-lbl">Root Node Expected Value: <strong>${fmt(root.ev?.toFixed(2))}</strong></div>
                <div class="decision-box">
                    <div class="dec-label">OPTIMAL FIRST DECISION</div>
                    <div class="dec-alt">${esc(root.branches?.find(b => b.isOptimal)?.label || '—')}</div>
                    <div class="dec-val">Expected Value: <strong>${fmt(root.ev?.toFixed(2))}</strong></div>
                </div>
            </div>
            <div class="step-block">
                <div class="step-lbl">Full Optimal Path</div>
                <div class="sol-path">${pathHtml}</div>
            </div>
            <div class="crit-note">
                Starred (★) branches are the recommended choices. At chance nodes the expected value is shown; actual outcomes depend on which state occurs at runtime.
            </div>
        </div>`;
}

function traceOptimalPath(node, lines, prefix) {
    if (!node) return;
    const nt = node.type;
    const evStr = node.ev !== undefined ? ` [EV = ${fmt(node.ev.toFixed(2))}]` : '';
    const icon = nt === 'decision' ? '■' : nt === 'chance' ? '●' : '◆';

    lines.push({ text: `${prefix}${icon} ${esc(node.label)}${evStr}`, cls: nt === 'decision' ? 'sol-dec' : nt === 'chance' ? 'sol-ch' : 'sol-term' });

    if (node.branches?.length) {
        const optBranches = nt === 'decision' ? node.branches.filter(b => b.isOptimal) : node.branches;
        optBranches.forEach(b => {
            const costStr = b.cost > 0 ? ` (cost: ${fmt(b.cost)})` : '';
            const probStr = b.probability !== null ? ` P=${b.probability}` : '';
            const marker = b.isOptimal ? '★ ' : '';
            lines.push({ text: `${prefix}  → ${marker}${esc(b.label)}${probStr}${costStr}`, cls: b.isOptimal ? 'sol-opt' : 'sol-br' });
            traceOptimalPath(b.child, lines, prefix + '      ');
        });
    }
}

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, success) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast show${success ? ' success' : ''}`;
    setTimeout(() => t.classList.remove('show'), 3200);
}
