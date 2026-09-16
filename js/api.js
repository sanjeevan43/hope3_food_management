/* ============================================================
   api.js — Centralised Google Apps Script API client
   Hope3 Food Management System
   ============================================================

   IMPORTANT:
   Replace GAS_URL below with your deployed Google Apps Script
   Web App URL after deployment.
   It looks like:
   https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
   ============================================================ */

const API = (() => {

  // ── Configuration ──────────────────────────────────────────
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbyS2HrzgMFiJrQQ6n3rL1dWFOYWOAvBNX1PbqKuPNAoYK5fS3EZlZeM2rkpX2TA0KHl/exec';

  // ── Token management ────────────────────────────────────────
  function getToken() {
    return sessionStorage.getItem('fm_token') || '';
  }

  // ── Core fetch helpers ──────────────────────────────────────

  /**
   * Perform a GET request to the GAS API.
   * @param {string} action - The ?action= value
   * @param {Object} [params={}] - Additional query parameters
   * @returns {Promise<Object>} Parsed JSON response
   */
  async function get(action, params = {}) {
    const url = new URL(GAS_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('token', getToken());
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') {
        url.searchParams.set(k, v);
      }
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    handleSessionExpiry(data);
    return data;
  }

  /**
   * Perform a POST request to the GAS API.
   * Uses Content-Type: text/plain to avoid CORS preflight.
   * @param {string} action - The ?action= query parameter
   * @param {Object} [body={}] - JSON body payload
   * @returns {Promise<Object>} Parsed JSON response
   */
  async function post(action, body = {}) {
    // Inject token into body (for protected endpoints)
    if (action !== 'login') {
      body.token = getToken();
    }

    const url = `${GAS_URL}?action=${encodeURIComponent(action)}`;

    const response = await fetch(url, {
      method: 'POST',
      // text/plain avoids CORS preflight while still carrying JSON payload.
      // GAS reads it via e.postData.contents.
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    handleSessionExpiry(data);
    return data;
  }

  /**
   * If the server says the session is invalid, clear storage and
   * redirect to login — unless we are already on the login page.
   */
  function handleSessionExpiry(data) {
    if (data && data.code === 401 && !data.success) {
      const onLoginPage =
        window.location.pathname.endsWith('login.html') ||
        window.location.pathname === '/';
      if (!onLoginPage) {
        sessionStorage.clear();
        window.location.href = 'login.html?reason=expired';
      }
    }
  }

  // ── Auth endpoints ───────────────────────────────────────────

  async function login(username, password) {
    return post('login', { username, password });
  }

  async function logout() {
    return post('logout', {});
  }

  async function validateSession() {
    return get('validateSession');
  }

  // ── Member endpoints ─────────────────────────────────────────

  async function getMembers(includeInactive = false) {
    return get('getMembers', { includeInactive: includeInactive ? 'true' : 'false' });
  }

  async function addMember(name) {
    return post('addMember', { name });
  }

  async function editMember(member_id, name) {
    return post('editMember', { member_id, name });
  }

  async function toggleMember(member_id) {
    return post('toggleMember', { member_id });
  }

  // ── Meal endpoints ───────────────────────────────────────────

  async function getMeals(date) {
    return get('getMeals', { date });
  }

  async function saveMeals(date, changes) {
    return post('saveMeals', { date, changes });
  }

  async function getSummary(date) {
    return get('getSummary', { date });
  }

  // ── History / Report endpoints ───────────────────────────────

  async function getHistory(filters = {}) {
    return get('getHistory', filters);
  }

  async function getDayReport(date) {
    return get('getDayReport', { date });
  }

  async function getMonthReport(year, month) {
    return get('getMonthReport', { year, month });
  }

  // ── Public interface ─────────────────────────────────────────
  return {
    login,
    logout,
    validateSession,
    getMembers,
    addMember,
    editMember,
    toggleMember,
    getMeals,
    saveMeals,
    getSummary,
    getHistory,
    getDayReport,
    getMonthReport,
  };

})();
