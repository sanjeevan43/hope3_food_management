/* ============================================================
   history.js — History & Reports page logic
   Hope3 Food Management System
   ============================================================ */

(async () => {

  // ── Auth guard ───────────────────────────────────────────────
  const manager = await Auth.checkAuth();
  if (!manager) return;
  Auth.populateNav();

  // ── Tab switching ─────────────────────────────────────────────
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TAB 1 — RECORDS
  // ═══════════════════════════════════════════════════════════════

  let currentPage  = 1;
  let totalPages   = 1;
  let totalRecords = 0;
  let currentFilters = {};

  // DOM refs
  const quickChips    = document.querySelectorAll('.quick-chip');
  const filterDateType = document.getElementById('filterDateType');
  const filterDate    = document.getElementById('filterDate');
  const filterFrom    = document.getElementById('filterFrom');
  const filterTo      = document.getElementById('filterTo');
  const filterDayGrp  = document.getElementById('filterDayGroup');
  const filterDay     = document.getElementById('filterDayOfWeek');
  const filterMember  = document.getElementById('filterMember');
  const filterMeal    = document.getElementById('filterMeal');
  const filterStatus  = document.getElementById('filterStatus');
  const btnSearch     = document.getElementById('btnSearch');
  const btnReset      = document.getElementById('btnReset');
  const resultsTable  = document.getElementById('historyTableBody');
  const resultCount   = document.getElementById('resultCount');
  const paginationEl  = document.getElementById('pagination');

  // Date type toggle
  const dateGroups = {
    specific:   document.getElementById('dateSpecificGroup'),
    range:      document.getElementById('dateRangeGroup'),
    dayOfWeek:  document.getElementById('dateDayGroup'),
  };

  function showDateGroup(type) {
    Object.values(dateGroups).forEach(el => el?.classList.add('d-none'));
    if (type === 'specific')  dateGroups.specific?.classList.remove('d-none');
    if (type === 'range')     dateGroups.range?.classList.remove('d-none');
    if (type === 'dayOfWeek') dateGroups.dayOfWeek?.classList.remove('d-none');
  }

  filterDateType?.addEventListener('change', () => showDateGroup(filterDateType.value));
  showDateGroup('specific'); // default

  // Quick chips
  quickChips.forEach(chip => {
    chip.addEventListener('click', () => {
      quickChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      applyQuickFilter(chip.dataset.filter);
    });
  });

  function applyQuickFilter(filter) {
    const today     = Auth.getISTDateString();
    const yesterday = Auth.addDays(today, -1);

    // Calculate week/month bounds
    const [ty, tm, td] = today.split('-').map(Number);
    const todayObj = new Date(Date.UTC(ty, tm - 1, td));
    const dayOfWeek = todayObj.getUTCDay(); // 0=Sun

    const weekStart = Auth.addDays(today, -dayOfWeek);

    const monthStart = `${ty}-${String(tm).padStart(2,'0')}-01`;
    const monthEnd   = today;

    if (filterDateType) filterDateType.value = 'range';
    showDateGroup('range');

    switch (filter) {
      case 'today':
        if (filterFrom) filterFrom.value = today;
        if (filterTo)   filterTo.value   = today;
        break;
      case 'yesterday':
        if (filterFrom) filterFrom.value = yesterday;
        if (filterTo)   filterTo.value   = yesterday;
        break;
      case 'thisWeek':
        if (filterFrom) filterFrom.value = weekStart;
        if (filterTo)   filterTo.value   = today;
        break;
      case 'thisMonth':
        if (filterFrom) filterFrom.value = monthStart;
        if (filterTo)   filterTo.value   = monthEnd;
        break;
    }

    searchRecords(1);
  }

  btnSearch?.addEventListener('click', () => searchRecords(1));
  btnReset?.addEventListener('click',  () => { resetFilters(); });

  // Enter key on date inputs
  [filterDate, filterFrom, filterTo].forEach(el => {
    el?.addEventListener('keydown', e => { if (e.key === 'Enter') searchRecords(1); });
  });

  function buildFilters() {
    const filters = {};
    const dateType = filterDateType?.value || 'specific';

    if (dateType === 'specific' && filterDate?.value) {
      filters.date = filterDate.value;
    } else if (dateType === 'range') {
      if (filterFrom?.value) filters.dateFrom = filterFrom.value;
      if (filterTo?.value)   filters.dateTo   = filterTo.value;
    } else if (dateType === 'dayOfWeek' && filterDay?.value) {
      filters.dayOfWeek = filterDay.value;
    }

    if (filterMember?.value) filters.memberId = filterMember.value;
    if (filterMeal?.value)   filters.meal     = filterMeal.value;
    if (filterStatus?.value) filters.status   = filterStatus.value;

    return filters;
  }

  async function searchRecords(page = 1) {
    currentPage    = page;
    currentFilters = buildFilters();
    resultsTable.innerHTML = renderSkeletonRows(5, 7);
    resultCount.innerHTML  = 'Searching…';
    paginationEl.innerHTML = '';

    try {
      const result = await API.getHistory({ ...currentFilters, page });
      if (!result.success) throw new Error(result.error);

      totalPages   = result.totalPages || 1;
      totalRecords = result.total || 0;

      renderRecords(result.records);
      resultCount.innerHTML = `<strong>${totalRecords}</strong> record${totalRecords !== 1 ? 's' : ''} found`;
      renderPagination();

    } catch (e) {
      resultsTable.innerHTML = errorRow(7, e.message || 'Failed to load history.');
      resultCount.textContent = '';
    }
  }

  function renderRecords(records) {
    if (!records || records.length === 0) {
      resultsTable.innerHTML = emptyRow(7, 'No records match your filters.', 'Try adjusting the filters above.');
      return;
    }

    resultsTable.innerHTML = records.map(r => `
      <tr>
        <td class="text-sm fw-600">${escapeHtml(r.date)}</td>
        <td class="text-sm text-muted">${escapeHtml(r.day_of_week || '')}</td>
        <td>
          <span class="fw-600">${escapeHtml(r.member_name)}</span>
        </td>
        <td>
          <span class="meal-tag meal-${r.meal.toLowerCase()}">${mealIcon(r.meal)} ${escapeHtml(r.meal)}</span>
        </td>
        <td>
          <span class="status-badge status-${statusClass(r.status)}" style="cursor:default;pointer-events:none;min-width:90px">
            ${statusIcon(r.status)} ${escapeHtml(r.status)}
          </span>
        </td>
        <td class="text-xs text-muted">${formatDateTime(r.updated_at)}</td>
        <td class="text-xs text-muted">${escapeHtml(r.updated_by || '—')}</td>
      </tr>`).join('');
  }

  function renderPagination() {
    if (totalPages <= 1) { paginationEl.innerHTML = ''; return; }

    let html = '';
    html += `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} data-page="${currentPage - 1}">‹</button>`;

    const start = Math.max(1, currentPage - 2);
    const end   = Math.min(totalPages, currentPage + 2);

    if (start > 1)  html += `<button class="page-btn" data-page="1">1</button>${start > 2 ? '<span class="page-info">…</span>' : ''}`;
    for (let p = start; p <= end; p++) {
      html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }
    if (end < totalPages) html += `${end < totalPages - 1 ? '<span class="page-info">…</span>' : ''}<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;

    html += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">›</button>`;
    html += `<span class="page-info">Page ${currentPage} of ${totalPages}</span>`;

    paginationEl.innerHTML = html;
    paginationEl.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => searchRecords(+btn.dataset.page));
    });
  }

  function resetFilters() {
    [filterDate, filterFrom, filterTo, filterMember, filterMeal, filterStatus, filterDay].forEach(el => {
      if (el) el.value = '';
    });
    if (filterDateType) filterDateType.value = 'specific';
    showDateGroup('specific');
    quickChips.forEach(c => c.classList.remove('active'));
    currentFilters = {};
    resultsTable.innerHTML = emptyRow(7, 'No search performed yet.', 'Set filters above and click Search.');
    resultCount.innerHTML  = '';
    paginationEl.innerHTML = '';
  }

  // Load members into filter dropdown
  async function loadMembersDropdown() {
    if (!filterMember) return;
    try {
      const result = await API.getMembers(true);
      if (!result.success) return;
      result.members.forEach(m => {
        const opt  = document.createElement('option');
        opt.value  = m.member_id;
        opt.textContent = m.name + (m.active ? '' : ' (inactive)');
        filterMember.appendChild(opt);
      });
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════
  // TAB 2 — DAY REPORT
  // ═══════════════════════════════════════════════════════════════

  const dayReportInput  = document.getElementById('dayReportDate');
  const btnDayReport    = document.getElementById('btnDayReport');
  const dayReportResult = document.getElementById('dayReportResult');

  if (dayReportInput) dayReportInput.value = Auth.getISTDateString();

  btnDayReport?.addEventListener('click', loadDayReport);

  async function loadDayReport() {
    const date = dayReportInput?.value;
    if (!date) { Auth.showToast('Please select a date.', 'warning'); return; }

    dayReportResult.innerHTML = `<div class="flex-center gap-md" style="padding:40px;justify-content:center"><div class="spinner"></div></div>`;

    try {
      const result = await API.getDayReport(date);
      if (!result.success) throw new Error(result.error);
      renderDayReport(result);
    } catch (e) {
      dayReportResult.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Error</div><div class="empty-subtitle">${escapeHtml(e.message)}</div></div>`;
    }
  }

  function renderDayReport(data) {
    const meals = ['Breakfast', 'Lunch', 'Dinner'];
    const mealIcons = { Breakfast: '🌅', Lunch: '☀️', Dinner: '🌙' };

    let html = `
      <div class="day-report-date-title" style="margin-bottom:var(--space-md)">
        <span style="font-size:17px;font-weight:700;color:var(--color-text)">${Auth.formatDisplayDate(data.date)}</span>
        <span class="text-muted text-sm" style="margin-left:8px">${data.day_of_week || ''}</span>
      </div>
      <div class="report-meals-grid">`;

    meals.forEach(meal => {
      const mData  = data.summary[meal] || { Eat: 0, 'Not Eat': 0, Informed: 0, members: [] };
      html += `
        <div class="report-meal-card">
          <div class="report-meal-title">${mealIcons[meal]} ${meal}</div>
          <div class="report-stat">
            <span class="report-stat-label"><span class="summary-stat-dot dot-eat"></span>Eat</span>
            <span class="report-stat-num" style="color:var(--color-eat-text)">${mData.Eat}</span>
          </div>
          <div class="report-stat">
            <span class="report-stat-label"><span class="summary-stat-dot dot-not-eat"></span>Not Eat</span>
            <span class="report-stat-num" style="color:var(--color-not-eat-text)">${mData['Not Eat']}</span>
          </div>
          <div class="report-stat">
            <span class="report-stat-label"><span class="summary-stat-dot dot-informed"></span>Informed</span>
            <span class="report-stat-num" style="color:var(--color-informed-text)">${mData.Informed}</span>
          </div>
        </div>`;
    });

    html += `</div>`;

    // Member detail table
    html += `
      <div class="results-card" style="margin-top:var(--space-xl)">
        <div class="results-header">
          <span class="card-title">Member Details</span>
        </div>
        <div class="table-wrapper">
          <table class="data-table member-detail-table">
            <thead>
              <tr>
                <th>Member</th>
                <th style="text-align:center">Breakfast</th>
                <th style="text-align:center">Lunch</th>
                <th style="text-align:center">Dinner</th>
              </tr>
            </thead>
            <tbody>`;

    // Collect all members across all meals
    const memberMap = {};
    meals.forEach(meal => {
      (data.summary[meal]?.members || []).forEach(m => {
        if (!memberMap[m.member_id]) {
          memberMap[m.member_id] = { name: m.name, Breakfast: null, Lunch: null, Dinner: null };
        }
        memberMap[m.member_id][meal] = m.status;
      });
    });

    const memberList = Object.values(memberMap).sort((a, b) => a.name.localeCompare(b.name));

    if (memberList.length === 0) {
      html += `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No records for this date</div></div></td></tr>`;
    } else {
      memberList.forEach(m => {
        html += `<tr>
          <td class="fw-600">${escapeHtml(m.name)}</td>
          ${meals.map(meal => {
            const s    = m[meal];
            const meta = statusMeta(s);
            return `<td style="text-align:center">
              <span class="status-badge status-${meta.cls}" style="cursor:default;pointer-events:none;min-width:90px">
                ${meta.icon} ${meta.label}
              </span></td>`;
          }).join('')}
        </tr>`;
      });
    }

    html += `</tbody></table></div></div>`;
    dayReportResult.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════
  // TAB 3 — MONTH REPORT
  // ═══════════════════════════════════════════════════════════════

  const monthInput      = document.getElementById('monthInput');
  const btnMonthReport  = document.getElementById('btnMonthReport');
  const monthReportResult = document.getElementById('monthReportResult');

  // Default: current month
  if (monthInput) {
    const today = Auth.getISTDateString();
    monthInput.value = today.slice(0, 7); // "YYYY-MM"
  }

  btnMonthReport?.addEventListener('click', loadMonthReport);

  async function loadMonthReport() {
    const val = monthInput?.value;
    if (!val || !val.match(/^\d{4}-\d{2}$/)) {
      Auth.showToast('Please select a valid month.', 'warning');
      return;
    }
    const [year, month] = val.split('-');
    monthReportResult.innerHTML = `<div class="flex-center gap-md" style="padding:40px;justify-content:center"><div class="spinner"></div></div>`;

    try {
      const result = await API.getMonthReport(year, month);
      if (!result.success) throw new Error(result.error);
      renderMonthReport(result, val);
    } catch (e) {
      monthReportResult.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Error</div><div class="empty-subtitle">${escapeHtml(e.message)}</div></div>`;
    }
  }

  function renderMonthReport(data, monthVal) {
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const [y, m]     = monthVal.split('-');
    const monthLabel = `${monthNames[+m - 1]} ${y}`;
    const ov         = data.overall || {};

    let html = `
      <h3 style="font-size:16px;font-weight:700;margin-bottom:var(--space-md)">📅 ${monthLabel}</h3>
      <div class="overall-stats">
        <div class="stat-card stat-total">
          <div class="stat-card-icon">📊</div>
          <div class="stat-card-body">
            <div class="stat-card-value">${ov.total || 0}</div>
            <div class="stat-card-label">Total Records</div>
          </div>
        </div>
        <div class="stat-card stat-eat">
          <div class="stat-card-icon">✅</div>
          <div class="stat-card-body">
            <div class="stat-card-value" style="color:var(--color-eat-text)">${ov.Eat || 0}</div>
            <div class="stat-card-label">Eat</div>
          </div>
        </div>
        <div class="stat-card stat-not-eat">
          <div class="stat-card-icon">❌</div>
          <div class="stat-card-body">
            <div class="stat-card-value" style="color:var(--color-not-eat-text)">${ov['Not Eat'] || 0}</div>
            <div class="stat-card-label">Not Eat</div>
          </div>
        </div>
        <div class="stat-card stat-informed">
          <div class="stat-card-icon">ℹ️</div>
          <div class="stat-card-body">
            <div class="stat-card-value" style="color:var(--color-informed-text)">${ov.Informed || 0}</div>
            <div class="stat-card-label">Informed</div>
          </div>
        </div>
      </div>`;

    // Meal breakdown
    html += `
      <div class="report-meals-grid" style="margin-bottom:var(--space-xl)">`;
    ['Breakfast', 'Lunch', 'Dinner'].forEach(meal => {
      const md = ov[meal] || { total: 0, Eat: 0, 'Not Eat': 0, Informed: 0 };
      const mealIcons = { Breakfast: '🌅', Lunch: '☀️', Dinner: '🌙' };
      html += `
        <div class="report-meal-card">
          <div class="report-meal-title">${mealIcons[meal]} ${meal} <span class="text-muted text-xs">(${md.total} records)</span></div>
          <div class="report-stat"><span class="report-stat-label"><span class="summary-stat-dot dot-eat"></span>Eat</span><span class="report-stat-num" style="color:var(--color-eat-text)">${md.Eat}</span></div>
          <div class="report-stat"><span class="report-stat-label"><span class="summary-stat-dot dot-not-eat"></span>Not Eat</span><span class="report-stat-num" style="color:var(--color-not-eat-text)">${md['Not Eat']}</span></div>
          <div class="report-stat"><span class="report-stat-label"><span class="summary-stat-dot dot-informed"></span>Informed</span><span class="report-stat-num" style="color:var(--color-informed-text)">${md.Informed}</span></div>
        </div>`;
    });
    html += `</div>`;

    // Per-member table
    html += `
      <div class="results-card">
        <div class="results-header"><span class="card-title">Member Breakdown — ${monthLabel}</span></div>
        <div class="table-wrapper">
          <table class="data-table member-month-table">
            <thead>
              <tr>
                <th class="col-name">Member</th>
                <th class="col-stat" colspan="3" style="text-align:center;border-right:1px solid var(--color-border)">Breakfast</th>
                <th class="col-stat" colspan="3" style="text-align:center;border-right:1px solid var(--color-border)">Lunch</th>
                <th class="col-stat" colspan="3" style="text-align:center">Dinner</th>
              </tr>
              <tr style="background:#F8FAFC">
                <th></th>
                <th class="col-stat" style="color:var(--color-eat-text)">Eat</th>
                <th class="col-stat" style="color:var(--color-not-eat-text)">No</th>
                <th class="col-stat" style="color:var(--color-informed-text);border-right:1px solid var(--color-border)">Info</th>
                <th class="col-stat" style="color:var(--color-eat-text)">Eat</th>
                <th class="col-stat" style="color:var(--color-not-eat-text)">No</th>
                <th class="col-stat" style="color:var(--color-informed-text);border-right:1px solid var(--color-border)">Info</th>
                <th class="col-stat" style="color:var(--color-eat-text)">Eat</th>
                <th class="col-stat" style="color:var(--color-not-eat-text)">No</th>
                <th class="col-stat" style="color:var(--color-informed-text)">Info</th>
              </tr>
            </thead>
            <tbody>`;

    if (!data.members || data.members.length === 0) {
      html += `<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No records for this month</div></div></td></tr>`;
    } else {
      data.members.forEach(m => {
        const bf = m.Breakfast || {};
        const ln = m.Lunch     || {};
        const dn = m.Dinner    || {};
        html += `<tr>
          <td class="fw-600">${escapeHtml(m.name)}</td>
          <td class="col-stat" style="color:var(--color-eat-text)">${bf.Eat || 0}</td>
          <td class="col-stat" style="color:var(--color-not-eat-text)">${bf['Not Eat'] || 0}</td>
          <td class="col-stat" style="color:var(--color-informed-text);border-right:1px solid var(--color-border)">${bf.Informed || 0}</td>
          <td class="col-stat" style="color:var(--color-eat-text)">${ln.Eat || 0}</td>
          <td class="col-stat" style="color:var(--color-not-eat-text)">${ln['Not Eat'] || 0}</td>
          <td class="col-stat" style="color:var(--color-informed-text);border-right:1px solid var(--color-border)">${ln.Informed || 0}</td>
          <td class="col-stat" style="color:var(--color-eat-text)">${dn.Eat || 0}</td>
          <td class="col-stat" style="color:var(--color-not-eat-text)">${dn['Not Eat'] || 0}</td>
          <td class="col-stat" style="color:var(--color-informed-text)">${dn.Informed || 0}</td>
        </tr>`;
      });
    }

    html += `</tbody></table></div></div>`;
    monthReportResult.innerHTML = html;
  }

  // ── Shared helpers ────────────────────────────────────────────

  function statusClass(s) {
    if (s === 'Eat')      return 'eat';
    if (s === 'Not Eat')  return 'not-eat';
    if (s === 'Informed') return 'informed';
    return 'not-set';
  }

  function statusIcon(s) {
    if (s === 'Eat')      return '✓';
    if (s === 'Not Eat')  return '✕';
    if (s === 'Informed') return 'ℹ';
    return '○';
  }

  function statusMeta(s) {
    if (s === 'Eat')      return { cls: 'eat',      icon: '✓', label: 'Eat' };
    if (s === 'Not Eat')  return { cls: 'not-eat',  icon: '✕', label: 'Not Eat' };
    if (s === 'Informed') return { cls: 'informed',  icon: 'ℹ', label: 'Informed' };
    return { cls: 'not-set', icon: '○', label: 'Not Set' };
  }

  function mealIcon(meal) {
    return { Breakfast: '🌅', Lunch: '☀️', Dinner: '🌙' }[meal] || '';
  }

  function formatDateTime(str) {
    if (!str) return '—';
    return str.replace('T', ' ').slice(0, 16);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderSkeletonRows(rows, cols) {
    return Array.from({length: rows}).map(() =>
      `<tr>${Array.from({length: cols}).map(() =>
        `<td><div class="row-skeleton" style="height:22px;border-radius:4px"></div></td>`
      ).join('')}</tr>`
    ).join('');
  }

  function emptyRow(cols, title, sub) {
    return `<tr><td colspan="${cols}"><div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">${escapeHtml(title)}</div><div class="empty-subtitle">${escapeHtml(sub)}</div></div></td></tr>`;
  }

  function errorRow(cols, msg) {
    return `<tr><td colspan="${cols}"><div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Error loading data</div><div class="empty-subtitle">${escapeHtml(msg)}</div></div></td></tr>`;
  }

  // ── Initialise ────────────────────────────────────────────────
  await loadMembersDropdown();

  // Show initial state for records tab
  if (resultsTable) {
    resultsTable.innerHTML = emptyRow(7, 'Set filters and click Search', 'Use quick filters or set custom date ranges above.');
  }

})();
