// ============================================================
// Utils.gs — Shared utility functions
// Hope3 Food Management System
// ============================================================

// ── Cryptography ──────────────────────────────────────────────

/**
 * Hash a password with SHA-256 using the provided salt.
 * Returns a lowercase hex string.
 */
function hashPassword(password, salt) {
  var combined = password + salt;
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    combined,
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

/**
 * Generate a cryptographically random salt (32 hex chars).
 */
function generateSalt() {
  return Utilities.getUuid().replace(/-/g, '');
}

/**
 * Generate a session token (two UUIDs joined by a dash).
 */
function generateToken() {
  return Utilities.getUuid() + '-' + Utilities.getUuid();
}

// ── Date / Time ───────────────────────────────────────────────

/**
 * Return current IST datetime as an ISO-style string.
 * Format: "YYYY-MM-DDTHH:mm:ss"
 */
function getISTNow() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
}

/**
 * Return today's date in IST as "YYYY-MM-DD".
 */
function getISTDate() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Format a Date object in IST with the given Utilities.formatDate pattern.
 * Default pattern is "yyyy-MM-dd".
 */
function formatDateIST(date, pattern) {
  return Utilities.formatDate(date, CONFIG.TIMEZONE, pattern || 'yyyy-MM-dd');
}

/**
 * Normalise any date value read from Google Sheets into "YYYY-MM-DD" string.
 * Google Sheets automatically converts date strings into Date objects.
 */
function normalizeDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }
  var s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  try {
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM-dd');
    }
  } catch (e) {}
  return s;
}

/**
 * Add a given number of hours to a Date and return a new Date.
 */
function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3600000);
}

/**
 * Return the day-of-week name (e.g. "Monday") for a "YYYY-MM-DD" string.
 * Parsing is explicit so JavaScript timezone does not shift the date.
 */
function getDayOfWeek(dateStr) {
  var p = dateStr.split('-');
  // Date.UTC avoids local-timezone interpretation
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getUTCDay()];
}

// ── Validation ────────────────────────────────────────────────

/** Returns true if dateStr matches "YYYY-MM-DD". */
function isValidDate(dateStr) {
  return typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

/** Returns true if meal is one of the allowed meal values. */
function isValidMeal(meal) {
  return CONFIG.MEALS.indexOf(meal) !== -1;
}

/** Returns true if status is one of the allowed business statuses. */
function isValidStatus(status) {
  return CONFIG.STATUSES.indexOf(status) !== -1;
}

// ── Sheet Access ──────────────────────────────────────────────

/** Open the configured spreadsheet. */
function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/** Return a sheet by name. Throws if the sheet does not exist. */
function getSheet(sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  return sheet;
}

// ── ID Generation ─────────────────────────────────────────────

/**
 * Generate a zero-padded sequential ID.
 * Example: generateId('REC', 5) → "REC006"
 *
 * @param {string} prefix     - ID prefix (e.g. "REC", "MBR", "LOG")
 * @param {number} currentCount - Number of existing data rows (excl. header)
 */
function generateId(prefix, currentCount) {
  return prefix + String(currentCount + 1).padStart(3, '0');
}

// ── HTTP Responses ────────────────────────────────────────────

/**
 * Build a successful JSON response.
 * Merges { success: true } into the data object.
 */
function successResponse(data) {
  data.success = true;
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Build an error JSON response.
 * @param {string} message - Human-readable error message
 * @param {number} [code=400] - HTTP-style error code (informational only)
 */
function errorResponse(message, code) {
  var body = { success: false, error: message, code: code || 400 };
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Activity Logging ──────────────────────────────────────────

/**
 * Append a row to the ActivityLog sheet.
 * Any parameter can be an empty string if not applicable.
 */
function logActivity(managerId, action, date, memberId, meal, oldStatus, newStatus) {
  try {
    var sheet = getSheet(CONFIG.SHEETS.ACTIVITY_LOG);
    var currentRows = sheet.getLastRow(); // includes header
    var logId = generateId('LOG', currentRows - 1);
    sheet.appendRow([
      logId,
      getISTNow(),
      managerId  || '',
      action     || '',
      date       || '',
      memberId   || '',
      meal       || '',
      oldStatus  || '',
      newStatus  || ''
    ]);
  } catch (e) {
    // Logging failure must not break the main operation
    Logger.log('logActivity error: ' + e.message);
  }
}

/**
 * Check whether a member_id exists in the Members sheet.
 */
function memberExists(memberId) {
  var sheet  = getSheet(CONFIG.SHEETS.MEMBERS);
  var data   = sheet.getDataRange().getValues();
  var col    = CONFIG.MEMBERS_COLS.MEMBER_ID;
  for (var i = 1; i < data.length; i++) {
    if (data[i][col] === memberId) return true;
  }
  return false;
}
