// State management
const state = {
    decision: {
        name: '',
        description: ''
    },
    alternatives: [],
    criteria: [],
    scores: {}, // alternative_id -> criterion_id -> score
    weights: {} // criterion_id -> weight
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupTabNavigation();
    setupInitialInputs();
});

function setupTabNavigation() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            
            // Remove active class from all tabs
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            // Add active to clicked
            e.target.classList.add('active');
            document.getElementById(tabName)?.classList.add('active');
            
            if (tabName === 'chart') {
                renderChart();
            }
        });
    });
}

function setupInitialInputs() {
    document.getElementById('decisionName').addEventListener('input', (e) => {
        state.decision.name = e.target.value;
    });
    
    document.getElementById('decisionDesc').addEventListener('input', (e) => {
        state.decision.description = e.target.value;
    });
}

function addAlternative() {
    const id = 'alt_' + Date.now();
    state.alternatives.push({ id, name: '', description: '' });
    renderAlternatives();
}

function removeAlternative(id) {
    state.alternatives = state.alternatives.filter(a => a.id !== id);
    delete state.scores[id];
    renderAlternatives();
    updateMatrixTable();
}

function renderAlternatives() {
    const container = document.getElementById('alternativesContainer');
    container.innerHTML = state.alternatives.map((alt, idx) => `
        <div class="item-card">
            <div class="item-num">${idx + 1}</div>
            <div class="item-body">
                <input 
                    type="text" 
                    class="item-input" 
                    placeholder="Alternative name"
                    value="${alt.name}"
                    onchange="updateAlternative('${alt.id}', 'name', this.value)"
                >
                <input 
                    type="text" 
                    class="item-input" 
                    placeholder="Description (optional)"
                    value="${alt.description}"
                    onchange="updateAlternative('${alt.id}', 'description', this.value)"
                >
            </div>
            <button class="del-btn" onclick="removeAlternative('${alt.id}')">✕</button>
        </div>
    `).join('');
}

function updateAlternative(id, field, value) {
    const alt = state.alternatives.find(a => a.id === id);
    if (alt) alt[field] = value;
}

function addCriteria() {
    const id = 'crit_' + Date.now();
    state.criteria.push({ id, name: '', weight: 1 });
    renderCriteria();
}

function removeCriteria(id) {
    state.criteria = state.criteria.filter(c => c.id !== id);
    delete state.weights[id];
    renderCriteria();
    updateMatrixTable();
}

function renderCriteria() {
    const container = document.getElementById('criteriaContainer');
    container.innerHTML = state.criteria.map((crit, idx) => `
        <div class="item-card">
            <div class="item-num">${idx + 1}</div>
            <div class="item-body">
                <input 
                    type="text" 
                    class="item-input" 
                    placeholder="Criterion name"
                    value="${crit.name}"
                    onchange="updateCriteria('${crit.id}', 'name', this.value)"
                >
                <div style="display: flex; gap: 8px;">
                    <label style="flex: 1; display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted);">
                        Weight:
                        <input 
                            type="number" 
                            class="item-input" 
                            style="width: 60px;"
                            min="0" 
                            max="100" 
                            step="0.1"
                            value="${crit.weight}"
                            onchange="updateCriteria('${crit.id}', 'weight', this.value)"
                        >
                    </label>
                </div>
            </div>
            <button class="del-btn" onclick="removeCriteria('${crit.id}')">✕</button>
        </div>
    `).join('');
}

function updateCriteria(id, field, value) {
    const crit = state.criteria.find(c => c.id === id);
    if (crit) {
        if (field === 'weight') {
            crit.weight = parseFloat(value) || 1;
        } else {
            crit[field] = value;
        }
    }
}

function updateMatrixTable() {
    const container = document.getElementById('matrixContent');
    
    if (state.alternatives.length === 0 || state.criteria.length === 0) {
        container.innerHTML = `
            <div class="no-data">
                <div class="nd-icon">📋</div>
                <p>Create alternatives and criteria to build a decision matrix</p>
            </div>
        `;
        return;
    }
    
    // Initialize scores if needed
    state.alternatives.forEach(alt => {
        if (!state.scores[alt.id]) {
            state.scores[alt.id] = {};
        }
        state.criteria.forEach(crit => {
            if (state.scores[alt.id][crit.id] === undefined) {
                state.scores[alt.id][crit.id] = 0;
            }
        });
    });
    
    const table = `
        <table class="matrix-table">
            <thead>
                <tr>
                    <th>Alternative</th>
                    ${state.criteria.map(c => `<th>${c.name}<br><span style="font-size: 10px; font-weight: 400;">(w: ${c.weight})</span></th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${state.alternatives.map(alt => `
                    <tr>
                        <td><strong>${alt.name}</strong></td>
                        ${state.criteria.map(crit => `
                            <td>
                                <input 
                                    type="number" 
                                    class="score-input"
                                    min="0" 
                                    max="10" 
                                    step="0.1"
                                    value="${state.scores[alt.id][crit.id]}"
                                    onchange="updateScore('${alt.id}', '${crit.id}', this.value)"
                                >
                            </td>
                        `).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = table;
}

function updateScore(altId, critId, value) {
    if (!state.scores[altId]) state.scores[altId] = {};
    state.scores[altId][critId] = parseFloat(value) || 0;
}

function performAnalysis() {
    if (state.alternatives.length === 0) {
        showToast('Please add at least one alternative', false);
        return;
    }
    
    if (state.criteria.length === 0) {
        showToast('Please add at least one criterion', false);
        return;
    }
    
    // Build matrix if not already done
    updateMatrixTable();
    
    // Calculate scores
    const results = state.alternatives.map(alt => {
        let weightedScore = 0;
        let totalWeight = 0;
        
        state.criteria.forEach(crit => {
            const score = state.scores[alt.id]?.[crit.id] || 0;
            const weight = crit.weight || 1;
            weightedScore += score * weight;
            totalWeight += weight;
        });
        
        const avgWeightedScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
        
        return {
            id: alt.id,
            name: alt.name,
            description: alt.description,
            weightedScore: avgWeightedScore.toFixed(2),
            rawScore: Object.values(state.scores[alt.id] || {}).reduce((a, b) => a + b, 0).toFixed(2)
        };
    });
    
    // Sort by weighted score
    results.sort((a, b) => b.weightedScore - a.weightedScore);
    
    // Display results
    const resultsContainer = document.getElementById('resultsContent');
    resultsContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="text-align: center; margin-bottom: 10px;">
                <h3 style="font-size: 14px; color: var(--text);">Decision Analysis Results</h3>
                <p style="font-size: 11px; color: var(--muted); margin-top: 4px;">Ranked by weighted score</p>
            </div>
            ${results.map((result, idx) => `
                <div class="result-item">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--bg); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--primary); font-size: 12px;">${idx + 1}</div>
                        <div>
                            <div class="result-title">${result.name}</div>
                            <div class="result-meta">${result.description || 'No description'}</div>
                        </div>
                    </div>
                    <div style="margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <div style="font-size: 10px; color: var(--muted); text-transform: uppercase;">Weighted Score</div>
                            <div class="result-score">${result.weightedScore}</div>
                        </div>
                        <div>
                            <div style="font-size: 10px; color: var(--muted); text-transform: uppercase;">Total Raw Score</div>
                            <div class="result-score" style="color: var(--primary); opacity: 0.7; font-size: 18px;">${result.rawScore}</div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    // Switch to analysis tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="analysis"]').classList.add('active');
    document.getElementById('analysis').classList.add('active');
    
    showToast('Analysis completed!', true);
}

function renderChart() {
    const canvas = document.getElementById('analysisChart');
    
    if (state.alternatives.length === 0) {
        canvas.parentElement.innerHTML = `
            <div class="no-data" style="grid-column: 1 / -1;">
                <div class="nd-icon">📊</div>
                <p>No data to visualize</p>
            </div>
        `;
        return;
    }
    
    // Simple chart using canvas or table
    const results = state.alternatives.map(alt => {
        let weightedScore = 0;
        let totalWeight = 0;
        
        state.criteria.forEach(crit => {
            const score = state.scores[alt.id]?.[crit.id] || 0;
            const weight = crit.weight || 1;
            weightedScore += score * weight;
            totalWeight += weight;
        });
        
        return {
            name: alt.name,
            score: totalWeight > 0 ? (weightedScore / totalWeight).toFixed(2) : 0
        };
    });
    
    results.sort((a, b) => b.score - a.score);
    
    const chartHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
            ${results.map(r => `
                <div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                        <span style="font-size: 13px; font-weight: 600;">${r.name}</span>
                        <span style="font-size: 13px; font-weight: 700; color: var(--primary);">${r.score}</span>
                    </div>
                    <div style="background: var(--bg3); height: 24px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border);">
                        <div style="height: 100%; background: linear-gradient(90deg, var(--primary), var(--success)); width: ${(r.score / 10) * 100}%;"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    canvas.parentElement.innerHTML = chartHTML;
}

function showToast(msg, isSuccess = false) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast show ${isSuccess ? 'success' : ''}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function exportAnalysis() {
    if (state.alternatives.length === 0) {
        showToast('Nothing to export', false);
        return;
    }
    
    let csv = `Decision Analysis Export\n`;
    csv += `Decision: ${state.decision.name}\n`;
    csv += `Description: ${state.decision.description}\n\n`;
    
    csv += `Alternative,${state.criteria.map(c => `${c.name} (w:${c.weight})`).join(',')},Raw Total,Weighted Score\n`;
    
    state.alternatives.forEach(alt => {
        const rawTotal = Object.values(state.scores[alt.id] || {}).reduce((a, b) => a + b, 0);
        const weightedScore = state.criteria.reduce((sum, crit) => {
            return sum + ((state.scores[alt.id]?.[crit.id] || 0) * crit.weight);
        }, 0) / state.criteria.reduce((sum, c) => sum + c.weight, 0);
        
        csv += `${alt.name},${state.criteria.map(c => state.scores[alt.id]?.[c.id] || 0).join(',')},${rawTotal.toFixed(2)},${weightedScore.toFixed(2)}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.decision.name || 'analysis'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showToast('Analysis exported!', true);
}

// Hook export button
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('exportBtn')?.addEventListener('click', exportAnalysis);
    document.getElementById('analyzeBtn')?.addEventListener('click', performAnalysis);
});
