// ============================================================
// Auth.gs — Authentication and session management
// Hope3 Food Management System
// ============================================================

// ── Login ─────────────────────────────────────────────────────

/**
 * Validate manager credentials and create a session.
 * Called by doPost with action=login.
 */
function handleLogin(requestData) {
  try {
    var username = (requestData.username || '').trim();
    var password = requestData.password || '';

    if (!username || !password) {
      return errorResponse('Username and password are required.', 400);
    }

    // Lookup manager by username
    var sheet   = getSheet(CONFIG.SHEETS.MANAGERS);
    var data    = sheet.getDataRange().getValues();
    var cols    = CONFIG.MANAGERS_COLS;
    var manager = null;

    for (var i = 1; i < data.length; i++) {
      var row    = data[i];
      var active = row[cols.ACTIVE] === true || row[cols.ACTIVE] === 'TRUE';
      if (String(row[cols.USERNAME]).trim() === username && active) {
        manager = {
          managerId:    String(row[cols.MANAGER_ID]),
          username:     String(row[cols.USERNAME]),
          passwordHash: String(row[cols.PASSWORD_HASH]),
          salt:         String(row[cols.SALT]),
          name:         String(row[cols.NAME])
        };
        break;
      }
    }

    // Use a constant-time-equivalent check: always hash, then compare
    // This avoids timing side-channels from early returns
    var saltToUse = manager ? manager.salt : generateSalt();
    var hash      = hashPassword(password, saltToUse);
    var hashMatch = manager && (hash === manager.passwordHash);

    if (!hashMatch) {
      return errorResponse('Invalid username or password.', 401);
    }

    // Create session token
    var token     = generateToken();
    var now       = new Date();
    var expiresAt = addHours(now, CONFIG.SESSION_DURATION_HOURS);
    var createdStr = formatDateIST(now, "yyyy-MM-dd'T'HH:mm:ss");
    var expiresStr = formatDateIST(expiresAt, "yyyy-MM-dd'T'HH:mm:ss");

    var sessSheet = getSheet(CONFIG.SHEETS.SESSIONS);
    sessSheet.appendRow([
      token,
      manager.managerId,
      manager.username,
      createdStr,
      expiresStr,
      true
    ]);

    logActivity(manager.managerId, 'LOGIN', '', '', '', '', '');

    return successResponse({
      token:     token,
      name:      manager.name,
      username:  manager.username,
      expiresAt: expiresStr
    });

  } catch (e) {
    Logger.log('handleLogin error: ' + e.message);
    return errorResponse('Login failed. Please try again.', 500);
  }
}

// ── Logout ────────────────────────────────────────────────────

/**
 * Invalidate an active session token.
 * Called by doPost with action=logout.
 */
function handleLogout(requestData) {
  try {
    var token = requestData.token;
    if (!token) return errorResponse('Token is required.', 400);

    var sessSheet = getSheet(CONFIG.SHEETS.SESSIONS);
    var data      = sessSheet.getDataRange().getValues();
    var cols      = CONFIG.SESSIONS_COLS;
    var managerId = '';

    for (var i = 1; i < data.length; i++) {
      if (data[i][cols.SESSION_ID] === token) {
        managerId = data[i][cols.MANAGER_ID];
        // Mark session inactive
        sessSheet.getRange(i + 1, cols.ACTIVE + 1).setValue(false);
        break;
      }
    }

    if (managerId) {
      logActivity(managerId, 'LOGOUT', '', '', '', '', '');
    }

    return successResponse({ message: 'Logged out successfully.' });

  } catch (e) {
    Logger.log('handleLogout error: ' + e.message);
    return errorResponse('Logout failed.', 500);
  }
}

// ── Session Validation ────────────────────────────────────────

/**
 * Validate a session token (used on GET requests via query param).
 * Called by doGet with action=validateSession.
 */
function handleValidateSession(params) {
  var token   = params.token;
  var session = validateToken(token);
  if (session) {
    return successResponse({ valid: true, username: session.username, name: session.name });
  }
  return errorResponse('Session is invalid or has expired.', 401);
}

/**
 * Look up a session by token. Returns session object or null.
 * This is the authorisation gate used by every protected endpoint.
 *
 * @param  {string} token
 * @returns {{ managerId, username, name } | null}
 */
function validateToken(token) {
  if (!token || typeof token !== 'string') return null;
  return getSession(token);
}

/**
 * Internal: retrieve and validate a session from the Sessions sheet.
 */
function getSession(token) {
  try {
    var sheet = getSheet(CONFIG.SHEETS.SESSIONS);
    var data  = sheet.getDataRange().getValues();
    var cols  = CONFIG.SESSIONS_COLS;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var isActive = row[cols.ACTIVE] === true || row[cols.ACTIVE] === 'TRUE';

      if (row[cols.SESSION_ID] === token && isActive) {
        // Parse expiry — stored as "YYYY-MM-DDTHH:mm:ss" (IST string)
        // Convert to JS Date for comparison
        var expiresStr = String(row[cols.EXPIRES_AT]);
        var expDate    = new Date(expiresStr.replace('T', ' ') + ' GMT+0530');

        if (new Date() > expDate) {
          // Expire the session in-place
          sheet.getRange(i + 1, cols.ACTIVE + 1).setValue(false);
          return null;
        }

        // Also fetch manager name for convenience
        var name = getManagerName(String(row[cols.MANAGER_ID]));

        return {
          managerId: String(row[cols.MANAGER_ID]),
          username:  String(row[cols.USERNAME]),
          name:      name
        };
      }
    }
    return null;
  } catch (e) {
    Logger.log('getSession error: ' + e.message);
    return null;
  }
}

/**
 * Look up a manager's display name from the Managers sheet.
 */
function getManagerName(managerId) {
  try {
    var sheet = getSheet(CONFIG.SHEETS.MANAGERS);
    var data  = sheet.getDataRange().getValues();
    var cols  = CONFIG.MANAGERS_COLS;
    for (var i = 1; i < data.length; i++) {
      if (data[i][cols.MANAGER_ID] === managerId) {
        return String(data[i][cols.NAME]);
      }
    }
  } catch (e) { /* ignore */ }
  return '';
}
