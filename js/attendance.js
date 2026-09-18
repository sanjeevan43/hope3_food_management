/* ============================================================
   attendance.js — College Attendance Page Logic
   Hope3 Food Management System
   ============================================================ */

(() => {
  'use strict';

  // ── State ─────────────────────────────────────────────────────
  let currentDate   = Auth.getISTDateString();
  let allStudents   = [];          // { student_id, name, active }
  let attendanceMap = {};          // { student_id: 'present'|'absent'|'not_marked' }
  let savedMap      = {};          // snapshot of last saved state
  let pendingChanges = {};         // student_id → new status (unsaved)
  let searchQuery   = '';

  // ── Boot ──────────────────────────────────────────────────────
  async function init() {
    const manager = await Auth.checkAuth();
    if (!manager) return;
    Auth.populateNav();
    setupDateNav();
    setupSearch();
    setupBulkButtons();
    setupSaveCancel();
    setupManageStudents();
    setupKeyboardShortcut();
    await loadPage();
  }

  // ── Load everything for current date ─────────────────────────
  async function loadPage() {
    renderDateDisplay();
    await loadStudents();
    await loadAttendance();
  }

  // ── Students ──────────────────────────────────────────────────
  async function loadStudents() {
    try {
      const res = await API.getStudents(false);
      if (res.success && Array.isArray(res.students)) {
        allStudents = res.students;
      } else {
        allStudents = [];
      }
    } catch (e) {
      console.error('Failed to load students:', e);
      allStudents = [];
      Auth.showToast('Failed to load student list.', 'error');
    }
  }

  // ── Attendance ────────────────────────────────────────────────
  async function loadAttendance() {
    showTableLoading(true);
    pendingChanges = {};
    renderUnsavedBanner();

    try {
      const res = await API.getAttendance(currentDate);
      if (res.success && res.attendance) {
        attendanceMap = res.attendance; // { student_id: 'present'|'absent'|'not_marked' }
      } else {
        attendanceMap = {};
      }
      savedMap = { ...attendanceMap };
    } catch (e) {
      console.error('Failed to load attendance:', e);
      attendanceMap = {};
      savedMap = {};
      Auth.showToast('Failed to load attendance data.', 'error');
    } finally {
      showTableLoading(false);
      renderTable();
      renderSummary();
    }
  }

  // ── Render attendance table ───────────────────────────────────
  function renderTable() {
    const tbody = document.getElementById('attTableBody');
    const q = searchQuery.toLowerCase();

    const filtered = allStudents.filter(s =>
      s.active !== false && s.name.toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4">
            <div class="empty-state">
              <div class="empty-icon">${allStudents.length === 0 ? '🎓' : '🔍'}</div>
              <div class="empty-title">${allStudents.length === 0 ? 'No students yet' : 'No results found'}</div>
              <div class="empty-subtitle">${allStudents.length === 0
                ? 'Click "Manage Students" to add students.'
                : 'Try a different search term.'}</div>
            </div>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = filtered.map((s, i) => {
      const status = getStatus(s.student_id);
      const isChanged = pendingChanges.hasOwnProperty(s.student_id);
      return `
        <tr>
          <td class="att-col-no text-muted text-sm">${i + 1}</td>
          <td class="att-col-name">
            <div class="att-student-name">${escHtml(s.name)}</div>
            <div class="att-student-id">ID: ${escHtml(String(s.student_id))}</div>
          </td>
          <td class="att-col-status">
            <button
              class="att-badge ${badgeClass(status)}${isChanged ? ' changed' : ''}"
              data-id="${s.student_id}"
              data-status="${status}"
              type="button"
              aria-label="Toggle attendance for ${escHtml(s.name)}: currently ${status.replace('_', ' ')}"
              title="Click to toggle"
            >${badgeLabel(status)}</button>
          </td>
          <td class="att-col-actions">
            <button class="att-row-btn" data-edit-id="${s.student_id}" data-edit-name="${escHtml(s.name)}"
              type="button" title="Edit name" aria-label="Edit ${escHtml(s.name)}">✏️</button>
          </td>
        </tr>`;
    }).join('');

    // Badge click → toggle
    tbody.querySelectorAll('[data-id]').forEach(btn => {
      btn.addEventListener('click', () => toggleStatus(btn.dataset.id));
    });

    // Edit button
    tbody.querySelectorAll('[data-edit-id]').forEach(btn => {
      btn.addEventListener('click', () => openEditModal(btn.dataset.editId, btn.dataset.editName));
    });
  }

  function getStatus(studentId) {
    if (pendingChanges.hasOwnProperty(studentId)) return pendingChanges[studentId];
    return attendanceMap[studentId] || 'not_marked';
  }

  function toggleStatus(studentId) {
    const current = getStatus(studentId);
    const next = current === 'present' ? 'absent'
               : current === 'absent'  ? 'not_marked'
               : 'present';

    // Track change relative to saved state
    const saved = savedMap[studentId] || 'not_marked';
    if (next === saved) {
      delete pendingChanges[studentId];
    } else {
      pendingChanges[studentId] = next;
    }

    renderTable();
    renderSummary();
    renderUnsavedBanner();
  }

  function badgeClass(status) {
    if (status === 'present')    return 'att-badge-present';
    if (status === 'absent')     return 'att-badge-absent';
    return 'att-badge-not-marked';
  }

  function badgeLabel(status) {
    if (status === 'present')    return '✓ Present';
    if (status === 'absent')     return '✕ Absent';
    return '○ Not Marked';
  }

  // ── Summary cards ─────────────────────────────────────────────
  function renderSummary() {
    const activeStudents = allStudents.filter(s => s.active !== false);
    let present = 0, absent = 0;
    activeStudents.forEach(s => {
      const st = getStatus(s.student_id);
      if (st === 'present') present++;
      else if (st === 'absent') absent++;
    });

    document.getElementById('sumTotal').textContent   = activeStudents.length;
    document.getElementById('sumPresent').textContent = present;
    document.getElementById('sumAbsent').textContent  = absent;
  }

  // ── Unsaved banner ────────────────────────────────────────────
  function renderUnsavedBanner() {
    const count = Object.keys(pendingChanges).length;
    const banner = document.getElementById('unsavedBanner');
    if (count === 0) {
      banner.style.display = 'none';
    } else {
      banner.style.display = '';
      document.getElementById('unsavedCount').textContent =
        `${count} unsaved ${count === 1 ? 'change' : 'changes'}`;
    }
  }

  // ── Save attendance ───────────────────────────────────────────
  async function saveAttendance() {
    if (Object.keys(pendingChanges).length === 0) return;

    const btn = document.getElementById('btnSave');
    btn.disabled = true;
    btn.textContent = '⏳ Saving…';

    try {
      const res = await API.saveAttendance(currentDate, pendingChanges);
      if (res.success) {
        // Merge pending into saved & attendance maps
        Object.assign(attendanceMap, pendingChanges);
        Object.assign(savedMap, pendingChanges);
        pendingChanges = {};
        renderTable();
        renderSummary();
        renderUnsavedBanner();
        Auth.showToast('Attendance saved successfully!', 'success');
      } else {
        Auth.showToast(res.error || 'Failed to save attendance.', 'error');
      }
    } catch (e) {
      console.error('Save error:', e);
      Auth.showToast('Network error. Please try again.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 Save Attendance';
    }
  }

  // ── Cancel unsaved changes ────────────────────────────────────
  function cancelChanges() {
    pendingChanges = {};
    renderTable();
    renderSummary();
    renderUnsavedBanner();
    Auth.showToast('Changes discarded.', 'info');
  }

  function setupSaveCancel() {
    document.getElementById('btnSave').addEventListener('click', saveAttendance);
    document.getElementById('btnCancel').addEventListener('click', cancelChanges);
  }

  function setupKeyboardShortcut() {
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveAttendance();
      }
    });
  }

  // ── Bulk mark ─────────────────────────────────────────────────
  function setupBulkButtons() {
    document.getElementById('btnMarkAllPresent').addEventListener('click', () => bulkMark('present'));
    document.getElementById('btnMarkAllAbsent').addEventListener('click',  () => bulkMark('absent'));
  }

  function bulkMark(status) {
    const q = searchQuery.toLowerCase();
    const visible = allStudents.filter(s =>
      s.active !== false && s.name.toLowerCase().includes(q)
    );
    visible.forEach(s => {
      const saved = savedMap[s.student_id] || 'not_marked';
      if (status !== saved) {
        pendingChanges[s.student_id] = status;
      } else {
        delete pendingChanges[s.student_id];
      }
    });
    renderTable();
    renderSummary();
    renderUnsavedBanner();
  }

  // ── Date Navigator ────────────────────────────────────────────
  function setupDateNav() {
    document.getElementById('btnPrevDay').addEventListener('click', () => changeDate(-1));
    document.getElementById('btnNextDay').addEventListener('click', () => changeDate(+1));
    document.getElementById('btnToday').addEventListener('click', goToday);

    const display  = document.getElementById('dateDisplay');
    const picker   = document.getElementById('datePicker');

    display.addEventListener('click',   () => picker.showPicker?.() || picker.click());
    display.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); picker.click(); }
    });
    picker.addEventListener('change', () => {
      if (picker.value) { currentDate = picker.value; loadPage(); }
    });
  }

  function changeDate(delta) {
    currentDate = Auth.addDays(currentDate, delta);
    loadPage();
  }

  function goToday() {
    currentDate = Auth.getISTDateString();
    loadPage();
  }

  function renderDateDisplay() {
    document.getElementById('dateText').textContent    = Auth.formatDisplayDate(currentDate);
    document.getElementById('dateDayLabel').textContent = Auth.formatShortDate(currentDate);
    document.getElementById('datePicker').value        = currentDate;
  }

  // ── Search ────────────────────────────────────────────────────
  function setupSearch() {
    document.getElementById('studentSearch').addEventListener('input', e => {
      searchQuery = e.target.value.trim();
      renderTable();
    });
  }

  // ── Loading overlay ───────────────────────────────────────────
  function showTableLoading(show) {
    document.getElementById('tableLoading').style.display = show ? '' : 'none';
  }

  // ── Manage Students Modal ─────────────────────────────────────
  function setupManageStudents() {
    const modal   = document.getElementById('manageModal');
    const openBtn = document.getElementById('btnManageStudents');
    const closeBtn = document.getElementById('btnManageClose');
    const doneBtn  = document.getElementById('btnManageDone');
    const addBtn   = document.getElementById('btnAddStudent');
    const nameInp  = document.getElementById('newStudentName');
    const errEl    = document.getElementById('newStudentError');

    openBtn.addEventListener('click', async () => {
      modal.style.display = '';
      errEl.textContent = '';
      nameInp.value = '';
      await loadManageStudents();
      renderManageTable();
    });

    const closeModal = () => { modal.style.display = 'none'; };
    closeBtn.addEventListener('click', closeModal);
    doneBtn.addEventListener('click', async () => {
      closeModal();
      // Reload attendance table in case students changed
      await loadStudents();
      renderTable();
      renderSummary();
    });
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    addBtn.addEventListener('click', () => addStudent(nameInp, errEl));
    nameInp.addEventListener('keydown', e => {
      if (e.key === 'Enter') addStudent(nameInp, errEl);
    });
  }

  async function loadManageStudents() {
    try {
      const res = await API.getStudents(true);
      if (res.success && Array.isArray(res.students)) {
        allStudents = res.students;
      }
    } catch (e) {
      console.error('Failed to load students for manage modal:', e);
    }
  }

  function renderManageTable() {
    const tbody = document.getElementById('manageTableBody');
    if (allStudents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state" style="padding:24px"><div class="empty-icon">🎓</div><div class="empty-title">No students yet</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = allStudents.map(s => `
      <tr>
        <td>
          <div style="font-weight:500">${escHtml(s.name)}</div>
          <div class="text-xs text-muted">ID: ${s.student_id}</div>
        </td>
        <td style="text-align:center">
          <span class="badge ${s.active !== false ? 'badge-active' : 'badge-inactive'}">
            ${s.active !== false ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td style="text-align:center">
          <button class="att-row-btn" data-edit-id="${s.student_id}" data-edit-name="${escHtml(s.name)}"
            type="button" title="Edit" aria-label="Edit ${escHtml(s.name)}">✏️</button>
          <button class="att-row-btn" data-toggle-id="${s.student_id}"
            type="button" title="${s.active !== false ? 'Deactivate' : 'Activate'}"
            aria-label="${s.active !== false ? 'Deactivate' : 'Activate'} ${escHtml(s.name)}">
            ${s.active !== false ? '🚫' : '✅'}
          </button>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-edit-id]').forEach(btn => {
      btn.addEventListener('click', () => openEditModal(btn.dataset.editId, btn.dataset.editName));
    });
    tbody.querySelectorAll('[data-toggle-id]').forEach(btn => {
      btn.addEventListener('click', () => toggleStudentActive(btn.dataset.toggleId));
    });
  }

  async function addStudent(nameInp, errEl) {
    const name = nameInp.value.trim();
    errEl.textContent = '';
    if (!name) { errEl.textContent = 'Name is required.'; return; }
    if (name.length > 60) { errEl.textContent = 'Name too long (max 60 chars).'; return; }

    nameInp.disabled = true;
    try {
      const res = await API.addStudent(name);
      if (res.success) {
        nameInp.value = '';
        await loadStudents();
        renderManageTable();
        Auth.showToast(`Student "${name}" added.`, 'success');
      } else {
        errEl.textContent = res.error || 'Failed to add student.';
      }
    } catch (e) {
      errEl.textContent = 'Network error.';
    } finally {
      nameInp.disabled = false;
      nameInp.focus();
    }
  }

  async function toggleStudentActive(studentId) {
    try {
      const res = await API.toggleStudent(studentId);
      if (res.success) {
        await loadStudents();
        renderManageTable();
        Auth.showToast('Student status updated.', 'success');
      } else {
        Auth.showToast(res.error || 'Failed to update student.', 'error');
      }
    } catch (e) {
      Auth.showToast('Network error.', 'error');
    }
  }

  // ── Edit Student Name Modal ───────────────────────────────────
  function openEditModal(studentId, studentName) {
    const modal   = document.getElementById('editStudentModal');
    const inp     = document.getElementById('editStudentName');
    const idInp   = document.getElementById('editStudentId');
    const errEl   = document.getElementById('editStudentError');

    inp.value   = studentName;
    idInp.value = studentId;
    errEl.textContent = '';
    modal.style.display = '';
    inp.focus();
    inp.select();
  }

  function setupEditStudentModal() {
    const modal     = document.getElementById('editStudentModal');
    const closeBtn  = document.getElementById('btnEditStudentClose');
    const cancelBtn = document.getElementById('btnEditStudentCancel');
    const saveBtn   = document.getElementById('btnEditStudentSave');
    const inp       = document.getElementById('editStudentName');
    const idInp     = document.getElementById('editStudentId');
    const errEl     = document.getElementById('editStudentError');

    const closeModal = () => { modal.style.display = 'none'; };
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    const doSave = async () => {
      const name = inp.value.trim();
      errEl.textContent = '';
      if (!name) { errEl.textContent = 'Name is required.'; return; }
      if (name.length > 60) { errEl.textContent = 'Name too long.'; return; }

      saveBtn.disabled = true;
      try {
        const res = await API.editStudent(idInp.value, name);
        if (res.success) {
          closeModal();
          await loadStudents();
          renderTable();
          // If manage modal is open, refresh it too
          if (document.getElementById('manageModal').style.display !== 'none') {
            renderManageTable();
          }
          Auth.showToast('Student name updated.', 'success');
        } else {
          errEl.textContent = res.error || 'Failed to update name.';
        }
      } catch (e) {
        errEl.textContent = 'Network error.';
      } finally {
        saveBtn.disabled = false;
      }
    };

    saveBtn.addEventListener('click', doSave);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); });
  }

  // ── Utility ───────────────────────────────────────────────────
  function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ── Start ─────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    setupEditStudentModal();
    init();
  });

})();
