/* ============================================================
   auth.js — Client-side authentication utilities
   Hope3 Food Management System
   ============================================================ */

const Auth = (() => {

  const TOKEN_KEY   = 'fm_token';
  const MANAGER_KEY = 'fm_manager';

  // ── Storage helpers ──────────────────────────────────────────

  function getToken()   { return sessionStorage.getItem(TOKEN_KEY); }
  function getManager() {
    try { return JSON.parse(sessionStorage.getItem(MANAGER_KEY) || 'null'); }
    catch { return null; }
  }

  function setSession(token, managerInfo, expiresAt) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(MANAGER_KEY, JSON.stringify({ ...managerInfo, expiresAt }));
  }

  function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(MANAGER_KEY);
  }

  // ── IST-aware expiry check (client-side pre-check) ───────────

  function isTokenLikelyExpired() {
    const manager = getManager();
    if (!manager || !manager.expiresAt) return true;
    let expStr = String(manager.expiresAt).trim();
    if (expStr.indexOf('T') !== -1 && !/[+-]\d{2}:?\d{2}$|Z$/i.test(expStr)) {
      expStr += '+05:30';
    }
    const expDate = new Date(expStr);
    if (isNaN(expDate.getTime())) return true;
    // 10 second safety buffer for network latency/clock skew
    return Date.now() >= expDate.getTime() - 10000;
  }

  // ── Page protection ──────────────────────────────────────────

  /**
   * Call this on every protected page (dashboard, history, members).
   * 1. Checks sessionStorage for a token.
   * 2. Does a quick client-side expiry check.
   * 3. Validates with the server.
   * On failure: redirects to login.html.
   *
   * @returns {Promise<{username, name}|null>} Manager info or null
   */
  async function checkAuth() {
    const token = getToken();

    if (!token) {
      redirectToLogin();
      return null;
    }

    if (isTokenLikelyExpired()) {
      clearSession();
      redirectToLogin('expired');
      return null;
    }

    // Server-side validation
    try {
      const result = await API.validateSession();
      if (!result.success || !result.valid) {
        clearSession();
        redirectToLogin('expired');
        return null;
      }
      return getManager();
    } catch (e) {
      // Network error — allow temporary offline access
      // (server will ultimately reject expired token on next action)
      console.warn('Auth check network error:', e.message);
      return getManager();
    }
  }

  // ── Login ────────────────────────────────────────────────────

  /**
   * Attempt login, store session on success.
   * @returns {Promise<{success, error?}>}
   */
  async function login(username, password) {
    try {
      const result = await API.login(username, password);
      if (result.success) {
        setSession(result.token, {
          name:     result.name,
          username: result.username
        }, result.expiresAt);
        return { success: true };
      }
      return { success: false, error: result.error || 'Login failed.' };
    } catch (e) {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  }

  // ── Logout ───────────────────────────────────────────────────

  async function logout() {
    try { await API.logout(); } catch { /* ignore network errors */ }
    clearSession();
    window.location.href = 'login.html';
  }

  // ── Nav helpers ──────────────────────────────────────────────

  /**
   * Populate the navigation with manager name and attach logout handler.
   * Call this after checkAuth() on protected pages.
   */
  function populateNav() {
    const manager = getManager();
    if (!manager) return;

    const nameEl = document.getElementById('navManagerName');
    if (nameEl) nameEl.textContent = manager.name || manager.username;

    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        logoutBtn.disabled = true;
        logoutBtn.textContent = 'Logging out…';
        await logout();
      });
    }
  }

  // ── Redirect helpers ─────────────────────────────────────────

  function redirectToLogin(reason) {
    const url = reason ? `login.html?reason=${reason}` : 'login.html';
    window.location.href = url;
  }

  // ── IST date utility (shared across pages) ───────────────────

  /**
   * Get today's date in IST as "YYYY-MM-DD".
   * Safe regardless of the user's local system timezone.
   */
  function getISTDateString() {
    const now    = new Date();
    const utcMs  = now.getTime() + now.getTimezoneOffset() * 60000;
    const istMs  = utcMs + 5.5 * 3600000; // UTC+5:30
    const d      = new Date(istMs);
    const year   = d.getFullYear();
    const month  = String(d.getMonth() + 1).padStart(2, '0');
    const day    = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format "YYYY-MM-DD" → "September 16, 2026"
   */
  function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    return `${months[+month - 1]} ${+day}, ${year}`;
  }

  /**
   * Format "YYYY-MM-DD" → "Mon, Sep 16"
   */
  function formatShortDate(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const d = new Date(Date.UTC(+year, +month - 1, +day));
    return d.toLocaleDateString('en-IN', {
      weekday: 'short', month: 'short', day: 'numeric',
      timeZone: 'Asia/Kolkata'
    });
  }

  /**
   * Add N days to a "YYYY-MM-DD" string. Returns new "YYYY-MM-DD".
   */
  function addDays(dateStr, n) {
    const [year, month, day] = dateStr.split('-');
    const d = new Date(Date.UTC(+year, +month - 1, +day));
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  // ── Toast notification system (used on every page) ───────────

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} [type='info']
   * @param {number} [duration=3500] ms
   */
  function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
      success: '✓',
      error:   '✕',
      warning: '⚠',
      info:    'ℹ'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ'}</span>
      <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-exit');
      toast.addEventListener('animationend', () => toast.remove());
    }, duration);
  }

  // ── Public interface ─────────────────────────────────────────
  return {
    checkAuth,
    login,
    logout,
    populateNav,
    getManager,
    getToken,
    getISTDateString,
    formatDisplayDate,
    formatShortDate,
    addDays,
    showToast,
  };

})();
