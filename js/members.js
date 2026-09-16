/* ============================================================
   members.js — Member Management page logic
   Hope3 Food Management System
   ============================================================ */

(async () => {

  // ── Auth guard ───────────────────────────────────────────────
  const manager = await Auth.checkAuth();
  if (!manager) return;
  Auth.populateNav();

  // ── State ────────────────────────────────────────────────────
  let allMembers    = [];
  let showInactive  = false;

  // ── DOM refs ─────────────────────────────────────────────────
  const memberTableBody = document.getElementById('memberTableBody');
  const memberCount     = document.getElementById('memberCount');
  const searchInput     = document.getElementById('memberSearch');
  const btnAddMember    = document.getElementById('btnAddMember');
  const filterBtns      = document.querySelectorAll('.filter-toggle');

  // Modal
  const modal       = document.getElementById('memberModal');
  const modalTitle  = document.getElementById('modalTitle');
  const modalNameInput = document.getElementById('modalMemberName');
  const modalNameError = document.getElementById('modalNameError');
  const btnModalSave   = document.getElementById('btnModalSave');
  const btnModalCancel = document.getElementById('btnModalCancel');
  const btnModalClose  = document.getElementById('btnModalClose');

  let editingMemberId = null; // null = adding, string = editing

  // ── Load members ──────────────────────────────────────────────

  async function loadMembers() {
    memberTableBody.innerHTML = renderSkeleton(5, 5);
    try {
      const result = await API.getMembers(true); // include inactive
      if (!result.success) throw new Error(result.error);
      allMembers = result.members || [];
      renderTable();
    } catch (e) {
      memberTableBody.innerHTML = errorRow(5, e.message || 'Failed to load members.');
    }
  }

  // ── Render table ──────────────────────────────────────────────

  function renderTable() {
    const query   = searchInput.value.toLowerCase().trim();
    const visible = allMembers.filter(m => {
      if (!showInactive && !m.active) return false;
      if (query && !m.name.toLowerCase().includes(query)) return false;
      return true;
    });

    memberCount.textContent = visible.length;

    if (visible.length === 0) {
      memberTableBody.innerHTML = emptyRow(5,
        allMembers.length === 0 ? 'No members found' : 'No members match your filter',
        allMembers.length === 0 ? 'Click "Add Member" to add the first member.' : 'Try adjusting the search or filter.');
      return;
    }

    memberTableBody.innerHTML = visible.map(m => {
      const initials = m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const activeClass = m.active ? '' : 'inactive';
      const rowClass    = m.active ? '' : 'row-inactive';
      const created     = formatDate(m.created_at);

      return `<tr class="${rowClass}" data-member-id="${m.member_id}">
        <td class="col-id">
          <span class="text-xs text-muted" style="font-family:monospace">${escapeHtml(m.member_id)}</span>
        </td>
        <td class="col-name">
          <div class="member-row-name">
            <div class="member-row-avatar ${activeClass}">${escapeHtml(initials)}</div>
            <div class="member-row-info">
              <div class="member-row-fullname">${escapeHtml(m.name)}</div>
            </div>
          </div>
        </td>
        <td class="col-status">
          <span class="badge ${m.active ? 'badge-active' : 'badge-inactive'}">
            ${m.active ? '● Active' : '○ Inactive'}
          </span>
        </td>
        <td class="col-created text-sm text-muted">${created}</td>
        <td class="col-actions">
          <div class="action-btns">
            <button class="btn-action btn-edit" data-id="${m.member_id}" data-name="${escapeHtml(m.name)}" title="Edit member name">
              ✏️ Edit
            </button>
            <button class="btn-action ${m.active ? 'btn-deactivate' : 'btn-activate'}"
              data-id="${m.member_id}" data-active="${m.active}"
              title="${m.active ? 'Deactivate member' : 'Activate member'}">
              ${m.active ? '⊖ Deactivate' : '⊕ Activate'}
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');

    // Attach action listeners
    memberTableBody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => openEditModal(btn.dataset.id, btn.dataset.name));
    });

    memberTableBody.querySelectorAll('.btn-deactivate, .btn-activate').forEach(btn => {
      btn.addEventListener('click', () => toggleMember(btn.dataset.id, btn.dataset.active === 'true'));
    });
  }

  // ── Search & filter ───────────────────────────────────────────

  searchInput?.addEventListener('input', renderTable);

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showInactive = btn.dataset.filter === 'all';
      renderTable();
    });
  });

  // ── Toggle member status ──────────────────────────────────────

  async function toggleMember(memberId, currentlyActive) {
    const action = currentlyActive ? 'deactivate' : 'activate';
    const confirmMsg = currentlyActive
      ? `Deactivate this member? They will no longer appear in the dashboard, but their meal history will be preserved.`
      : `Activate this member? They will appear in the dashboard again.`;

    if (!confirm(confirmMsg)) return;

    const row = memberTableBody.querySelector(`tr[data-member-id="${memberId}"]`);
    if (row) row.style.opacity = '0.4';

    try {
      const result = await API.toggleMember(memberId);
      if (!result.success) throw new Error(result.error);

      const idx = allMembers.findIndex(m => m.member_id === memberId);
      if (idx !== -1) allMembers[idx].active = result.active;

      renderTable();
      Auth.showToast(
        `Member ${result.active ? 'activated' : 'deactivated'} successfully.`,
        result.active ? 'success' : 'info'
      );
    } catch (e) {
      if (row) row.style.opacity = '';
      Auth.showToast(e.message || 'Failed to update member status.', 'error');
    }
  }

  // ── Add Member modal ──────────────────────────────────────────

  btnAddMember?.addEventListener('click', openAddModal);

  function openAddModal() {
    editingMemberId  = null;
    modalTitle.textContent = 'Add New Member';
    modalNameInput.value   = '';
    modalNameError.textContent = '';
    btnModalSave.textContent   = 'Add Member';
    openModal();
  }

  function openEditModal(memberId, currentName) {
    editingMemberId  = memberId;
    modalTitle.textContent = 'Edit Member';
    modalNameInput.value   = currentName;
    modalNameError.textContent = '';
    btnModalSave.textContent   = 'Save Changes';
    openModal();
  }

  function openModal() {
    modal.style.display = 'flex';
    setTimeout(() => modalNameInput.focus(), 50);
  }

  function closeModal() {
    modal.style.display = 'none';
    editingMemberId = null;
  }

  btnModalClose?.addEventListener('click',  closeModal);
  btnModalCancel?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  // Enter key in name input
  modalNameInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnModalSave.click();
  });

  btnModalSave?.addEventListener('click', async () => {
    const name = modalNameInput.value.trim();
    modalNameError.textContent = '';

    if (!name) {
      modalNameError.textContent = 'Name is required.';
      modalNameInput.focus();
      return;
    }
    if (name.length > 60) {
      modalNameError.textContent = 'Name must be 60 characters or less.';
      return;
    }

    btnModalSave.disabled    = true;
    btnModalSave.textContent = editingMemberId ? 'Saving…' : 'Adding…';

    try {
      let result;
      if (editingMemberId) {
        result = await API.editMember(editingMemberId, name);
      } else {
        result = await API.addMember(name);
      }

      if (!result.success) throw new Error(result.error);

      if (editingMemberId) {
        const idx = allMembers.findIndex(m => m.member_id === editingMemberId);
        if (idx !== -1) allMembers[idx].name = name;
        Auth.showToast(`Member "${name}" updated.`, 'success');
      } else {
        allMembers.push(result.member);
        Auth.showToast(`Member "${name}" added successfully.`, 'success');
      }

      renderTable();
      closeModal();

    } catch (e) {
      modalNameError.textContent = e.message || 'Failed to save. Please try again.';
    } finally {
      btnModalSave.disabled    = false;
      btnModalSave.textContent = editingMemberId ? 'Save Changes' : 'Add Member';
    }
  });

  // ── Helpers ───────────────────────────────────────────────────

  function formatDate(str) {
    if (!str) return '—';
    return String(str).slice(0, 10); // "YYYY-MM-DD"
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderSkeleton(rows, cols) {
    return Array.from({length: rows}).map(() =>
      `<tr>${Array.from({length: cols}).map(() =>
        `<td><div class="row-skeleton" style="height:20px;border-radius:4px"></div></td>`
      ).join('')}</tr>`
    ).join('');
  }

  function emptyRow(cols, title, sub) {
    return `<tr><td colspan="${cols}"><div class="empty-state">
      <div class="empty-icon">👥</div>
      <div class="empty-title">${escapeHtml(title)}</div>
      <div class="empty-subtitle">${escapeHtml(sub)}</div>
    </div></td></tr>`;
  }

  function errorRow(cols, msg) {
    return `<tr><td colspan="${cols}"><div class="empty-state">
      <div class="empty-icon">⚠️</div>
      <div class="empty-title">Error loading members</div>
      <div class="empty-subtitle">${escapeHtml(msg)}</div>
    </div></td></tr>`;
  }

  // ── Init ──────────────────────────────────────────────────────
  loadMembers();

})();
