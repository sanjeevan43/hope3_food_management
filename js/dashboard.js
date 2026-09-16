/* ============================================================
   dashboard.js — Dashboard page logic
   Hope3 Food Management System
   ============================================================ */

(async () => {

  // ── Auth guard ───────────────────────────────────────────────
  const manager = await Auth.checkAuth();
  if (!manager) return;
  Auth.populateNav();

  // ── State ────────────────────────────────────────────────────
  let currentDate   = Auth.getISTDateString();  // "YYYY-MM-DD"
  let originalData  = {};   // { memberId: { Breakfast, Lunch, Dinner } }
  let pendingChanges = {};  // { "memberId|meal": { member_id, meal, status } }
  let isLoading     = false;

  // ── DOM references ───────────────────────────────────────────
  const dateText      = document.getElementById('dateText');
  const dateDayLabel  = document.getElementById('dateDayLabel');
  const datePicker    = document.getElementById('datePicker');
  const btnPrev       = document.getElementById('btnPrevDay');
  const btnNext       = document.getElementById('btnNextDay');
  const btnToday      = document.getElementById('btnToday');
  const dateDisplay   = document.getElementById('dateDisplay');
  const tableBody     = document.getElementById('mealTableBody');
  const unsavedBanner = document.getElementById('unsavedBanner');
  const unsavedCount  = document.getElementById('unsavedCount');
  const btnSave       = document.getElementById('btnSave');
  const btnCancel     = document.getElementById('btnCancel');
  const searchInput   = document.getElementById('memberSearch');
  const tableLoading  = document.getElementById('tableLoading');

  // Summary card elements
  const summaryEls = {
    Breakfast: {
      eat:      document.getElementById('bfEat'),
      notEat:   document.getElementById('bfNotEat'),
      informed: document.getElementById('bfInformed'),
    },
    Lunch: {
      eat:      document.getElementById('lnEat'),
      notEat:   document.getElementById('lnNotEat'),
      informed: document.getElementById('lnInformed'),
    },
    Dinner: {
      eat:      document.getElementById('dnEat'),
      notEat:   document.getElementById('dnNotEat'),
      informed: document.getElementById('dnInformed'),
    },
  };

  // ── Status cycling ────────────────────────────────────────────
  // null / undefined → "Not Set" (no DB record)
  // Cycle on click: Not Set → Eat → Not Eat → Informed → Eat (wraps)
  const STATUS_CYCLE = {
    null:       'Eat',
    undefined:  'Eat',
    'Eat':      'Not Eat',
    'Not Eat':  'Informed',
    'Informed': 'Eat',
  };

  const STATUS_META = {
    null:       { label: 'Not Set',  cls: 'status-not-set',  icon: '○' },
    'Eat':      { label: 'Eat',      cls: 'status-eat',      icon: '✓' },
    'Not Eat':  { label: 'Not Eat',  cls: 'status-not-eat',  icon: '✕' },
    'Informed': { label: 'Informed', cls: 'status-informed',  icon: 'ℹ' },
  };

  function getStatusMeta(status) {
    return STATUS_META[status] || STATUS_META[null];
  }

  // ── Date navigation ───────────────────────────────────────────

  function updateDateDisplay() {
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const [y, m, d]  = currentDate.split('-');
    const date = new Date(Date.UTC(+y, +m - 1, +d));
    dateText.textContent    = Auth.formatDisplayDate(currentDate);
    dateDayLabel.textContent = days[date.getUTCDay()];
    datePicker.value = currentDate;
  }

  btnPrev.addEventListener('click', () => {
    currentDate = Auth.addDays(currentDate, -1);
    resetAndLoad();
  });

  btnNext.addEventListener('click', () => {
    currentDate = Auth.addDays(currentDate, 1);
    resetAndLoad();
  });

  btnToday.addEventListener('click', () => {
    currentDate = Auth.getISTDateString();
    resetAndLoad();
  });

  dateDisplay.addEventListener('click', () => datePicker.showPicker?.() || datePicker.click());

  datePicker.addEventListener('change', () => {
    if (datePicker.value) {
      currentDate = datePicker.value;
      resetAndLoad();
    }
  });

  // ── Load data ─────────────────────────────────────────────────

  function resetAndLoad() {
    pendingChanges = {};
    updateUnsavedBanner();
    updateDateDisplay();
    loadMeals();
  }

  async function loadMeals() {
    if (isLoading) return;
    isLoading = true;
    showTableLoading(true);

    try {
      const [mealsRes, summaryRes] = await Promise.all([
        API.getMeals(currentDate),
        API.getSummary(currentDate)
      ]);

      if (!mealsRes.success) throw new Error(mealsRes.error);
      if (!summaryRes.success) throw new Error(summaryRes.error);

      // Store original
      originalData = {};
      mealsRes.records.forEach(r => {
        originalData[r.member_id] = {
          member_id: r.member_id,
          name:      r.name,
          Breakfast: r.Breakfast || null,
          Lunch:     r.Lunch     || null,
          Dinner:    r.Dinner    || null,
        };
      });

      renderTable(mealsRes.records);
      renderSummary(summaryRes.summary);

    } catch (e) {
      showTableError(e.message || 'Failed to load data.');
    } finally {
      isLoading = false;
      showTableLoading(false);
    }
  }

  // ── Render table ──────────────────────────────────────────────

  function renderTable(records) {
    tableBody.innerHTML = '';

    if (!records || records.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4">
            <div class="empty-state">
              <div class="empty-icon">📋</div>
              <div class="empty-title">No active members</div>
              <div class="empty-subtitle">Add members from the Members page.</div>
            </div>
          </td>
        </tr>`;
      return;
    }

    records.forEach(member => {
      const tr = document.createElement('tr');
      tr.dataset.memberId  = member.member_id;
      tr.dataset.searchKey = member.name.toLowerCase();

      const initials = member.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

      tr.innerHTML = `
        <td>
          <div class="member-cell">
            <div class="member-avatar">${initials}</div>
            <span class="member-name">${escapeHtml(member.name)}</span>
          </div>
        </td>
        <td class="status-cell" id="cell-${member.member_id}-Breakfast">
          ${renderStatusBadge(member.member_id, 'Breakfast', member.Breakfast)}
        </td>
        <td class="status-cell" id="cell-${member.member_id}-Lunch">
          ${renderStatusBadge(member.member_id, 'Lunch', member.Lunch)}
        </td>
        <td class="status-cell" id="cell-${member.member_id}-Dinner">
          ${renderStatusBadge(member.member_id, 'Dinner', member.Dinner)}
        </td>`;

      tableBody.appendChild(tr);
    });

    // Attach click handlers
    tableBody.querySelectorAll('.status-badge').forEach(badge => {
      badge.addEventListener('click', handleStatusClick);
    });

    // Re-apply search filter
    applySearchFilter();
  }

  function renderStatusBadge(memberId, meal, status) {
    const meta = getStatusMeta(status);
    const key  = `${memberId}|${meal}`;

    // Check if there's a pending change for this cell
    const displayStatus = pendingChanges[key]
      ? pendingChanges[key].status
      : status;
    const displayMeta = getStatusMeta(displayStatus);
    const isChanged = !!pendingChanges[key];

    return `<button
      class="status-badge ${displayMeta.cls}${isChanged ? ' changed' : ''}"
      data-member-id="${memberId}"
      data-meal="${meal}"
      data-status="${displayStatus || ''}"
      aria-label="${meal}: ${displayMeta.label}"
      title="Click to change ${meal} status"
    >${displayMeta.icon} ${displayMeta.label}</button>`;
  }

  function updateStatusCell(memberId, meal, newStatus) {
    const cellId = `cell-${memberId}-${meal}`;
    const cell   = document.getElementById(cellId);
    if (!cell) return;

    const original = originalData[memberId]?.[meal] || null;
    const isChanged = newStatus !== original;
    const meta      = getStatusMeta(newStatus);

    const badge = cell.querySelector('.status-badge');
    if (!badge) return;

    badge.className     = `status-badge ${meta.cls}${isChanged ? ' changed' : ''}`;
    badge.dataset.status = newStatus || '';
    badge.innerHTML      = `${meta.icon} ${meta.label}`;
    badge.setAttribute('aria-label', `${meal}: ${meta.label}`);
  }

  // ── Status click handler ──────────────────────────────────────

  function handleStatusClick(e) {
    const badge    = e.currentTarget;
    const memberId = badge.dataset.memberId;
    const meal     = badge.dataset.meal;
    const current  = badge.dataset.status || null;
    const next     = STATUS_CYCLE[current] || 'Eat';
    const key      = `${memberId}|${meal}`;

    // Record in pendingChanges
    const original = originalData[memberId]?.[meal] || null;
    if (next === original) {
      delete pendingChanges[key]; // reverted to original
    } else {
      pendingChanges[key] = { member_id: memberId, meal, status: next };
    }

    updateStatusCell(memberId, meal, next);
    updateUnsavedBanner();
  }

  // ── Unsaved banner ────────────────────────────────────────────

  function updateUnsavedBanner() {
    const count = Object.keys(pendingChanges).length;
    if (count === 0) {
      unsavedBanner.style.display = 'none';
    } else {
      unsavedBanner.style.display = 'flex';
      unsavedCount.textContent = `${count} unsaved change${count !== 1 ? 's' : ''}`;
    }
  }

  // ── Save changes ──────────────────────────────────────────────

  btnSave.addEventListener('click', async () => {
    const changes = Object.values(pendingChanges);
    if (changes.length === 0) return;

    btnSave.disabled   = true;
    btnCancel.disabled = true;
    btnSave.textContent = 'Saving…';

    try {
      const result = await API.saveMeals(currentDate, changes);
      if (!result.success) throw new Error(result.error || 'Save failed.');

      Auth.showToast(result.message || 'Changes saved successfully.', 'success');

      // Commit to originalData
      changes.forEach(ch => {
        if (!originalData[ch.member_id]) originalData[ch.member_id] = {};
        originalData[ch.member_id][ch.meal] = ch.status;
      });
      pendingChanges = {};
      updateUnsavedBanner();

      // Remove 'changed' class from all badges
      tableBody.querySelectorAll('.status-badge.changed').forEach(b => {
        b.classList.remove('changed');
      });

      // Refresh summary
      const sumRes = await API.getSummary(currentDate);
      if (sumRes.success) renderSummary(sumRes.summary);

    } catch (e) {
      Auth.showToast(e.message || 'Failed to save changes. Please try again.', 'error', 5000);
    } finally {
      btnSave.disabled    = false;
      btnCancel.disabled  = false;
      btnSave.textContent = 'Save Changes';
    }
  });

  btnCancel.addEventListener('click', () => {
    pendingChanges = {};
    // Re-render table with original data
    const records = Object.values(originalData);
    renderTable(records);
    updateUnsavedBanner();
    Auth.showToast('Changes cancelled.', 'info', 2000);
  });

  // ── Summary cards ─────────────────────────────────────────────

  function renderSummary(summary) {
    ['Breakfast', 'Lunch', 'Dinner'].forEach(meal => {
      const data = summary[meal] || { Eat: 0, 'Not Eat': 0, Informed: 0 };
      const els  = summaryEls[meal];
      if (!els) return;
      els.eat.textContent      = data['Eat']      ?? 0;
      els.notEat.textContent   = data['Not Eat']  ?? 0;
      els.informed.textContent = data['Informed'] ?? 0;
    });
  }

  // ── Member search ─────────────────────────────────────────────

  searchInput.addEventListener('input', applySearchFilter);

  function applySearchFilter() {
    const q = searchInput.value.toLowerCase().trim();
    tableBody.querySelectorAll('tr[data-member-id]').forEach(tr => {
      const key = tr.dataset.searchKey || '';
      tr.classList.toggle('row-hidden', q !== '' && !key.includes(q));
    });
  }

  // ── Table loading / error states ──────────────────────────────

  function showTableLoading(show) {
    if (tableLoading) tableLoading.style.display = show ? 'flex' : 'none';
    if (show) {
      // Skeleton rows
      tableBody.innerHTML = [1,2,3,4,5].map(() => `
        <tr class="table-loading">
          <td><div class="row-skeleton"></div></td>
          <td><div class="row-skeleton"></div></td>
          <td><div class="row-skeleton"></div></td>
          <td><div class="row-skeleton"></div></td>
        </tr>`).join('');
    }
  }

  function showTableError(msg) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4">
          <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <div class="empty-title">Failed to load data</div>
            <div class="empty-subtitle">${escapeHtml(msg)}</div>
          </div>
        </td>
      </tr>`;
  }

  // ── Util ──────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Keyboard shortcut: Ctrl+S to save ────────────────────────
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (Object.keys(pendingChanges).length > 0) btnSave.click();
    }
  });

  // ── Initial load ──────────────────────────────────────────────
  updateDateDisplay();
  loadMeals();

})();
