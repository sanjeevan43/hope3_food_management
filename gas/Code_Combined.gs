// ============================================================
// Hope3 Food Management System — Complete Apps Script Backend
// Single-File Bundle for Google Apps Script Editor
// ============================================================

// ── 1. CONFIGURATION ─────────────────────────────────────────

var CONFIG = {
  // Sheet ID: https://docs.google.com/spreadsheets/d/1WG4OE6kWoXvMA6laKT3HYBGjzo1VoHj7jkEAXVfLGW4/edit
  SPREADSHEET_ID: '1WG4OE6kWoXvMA6laKT3HYBGjzo1VoHj7jkEAXVfLGW4',

  TIMEZONE: 'Asia/Kolkata',
  SESSION_DURATION_HOURS: 8,

  SHEETS: {
    MANAGERS:     'Managers',
    MEMBERS:      'Members',
    MEAL_RECORDS: 'MealRecords',
    SESSIONS:     'Sessions',
    ACTIVITY_LOG: 'ActivityLog',
    STUDENTS:     'Students',
    ATTENDANCE:   'Attendance'
  },

  MEALS:    ['Breakfast', 'Lunch', 'Dinner'],
  STATUSES: ['Eat', 'Not Eat', 'Informed'],

  MANAGERS_COLS: {
    MANAGER_ID:    0,
    USERNAME:      1,
    PASSWORD_HASH: 2,
    SALT:          3,
    NAME:          4,
    ACTIVE:        5,
    CREATED_AT:    6
  },

  MEMBERS_COLS: {
    MEMBER_ID:  0,
    NAME:       1,
    ACTIVE:     2,
    CREATED_AT: 3
  },

  MEAL_RECORDS_COLS: {
    RECORD_ID:  0,
    DATE:       1,
    MEMBER_ID:  2,
    MEAL:       3,
    STATUS:     4,
    UPDATED_AT: 5,
    UPDATED_BY: 6
  },

  SESSIONS_COLS: {
    SESSION_ID:  0,
    MANAGER_ID:  1,
    USERNAME:    2,
    CREATED_AT:  3,
    EXPIRES_AT:  4,
    ACTIVE:      5
  },

  ACTIVITY_LOG_COLS: {
    LOG_ID:     0,
    TIMESTAMP:  1,
    MANAGER_ID: 2,
    ACTION:     3,
    DATE:       4,
    MEMBER_ID:  5,
    MEAL:       6,
    OLD_STATUS: 7,
    NEW_STATUS: 8
  },

  STUDENTS_COLS: {
    STUDENT_ID: 0,
    NAME:       1,
    ACTIVE:     2,
    CREATED_AT: 3
  },

  ATTENDANCE_COLS: {
    ATTENDANCE_ID: 0,
    DATE:          1,
    STUDENT_ID:    2,
    STATUS:        3,
    UPDATED_AT:    4
  }
};

// ── 2. UTILITY FUNCTIONS ──────────────────────────────────────

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

function generateSalt() {
  return Utilities.getUuid().replace(/-/g, '');
}

function generateToken() {
  return Utilities.getUuid() + '-' + Utilities.getUuid();
}

function getISTNow() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
}

function getISTDate() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

function formatDateIST(date, pattern) {
  return Utilities.formatDate(date, CONFIG.TIMEZONE, pattern || 'yyyy-MM-dd');
}

/**
 * Robustly normalise any date format into "YYYY-MM-DD" string.
 * Handles Date objects, ISO strings, DD-MM-YYYY, DD/MM/YYYY, etc.
 */
function normalizeDate(val) {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }
  var s = String(val).trim();
  var isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    var y = isoMatch[1];
    var m = ('0' + isoMatch[2]).slice(-2);
    var d = ('0' + isoMatch[3]).slice(-2);
    return y + '-' + m + '-' + d;
  }
  var dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    var d2 = ('0' + dmyMatch[1]).slice(-2);
    var m2 = ('0' + dmyMatch[2]).slice(-2);
    var y2 = dmyMatch[3];
    return y2 + '-' + m2 + '-' + d2;
  }
  try {
    var dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      return Utilities.formatDate(dt, CONFIG.TIMEZONE, 'yyyy-MM-dd');
    }
  } catch (e) {}
  return s;
}

/**
 * Normalise any datetime value into "YYYY-MM-DDTHH:mm:ss" string.
 */
function normalizeDateTime(val) {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
  }
  var s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) return s;
  try {
    var dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      return Utilities.formatDate(dt, CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
    }
  } catch (e) {}
  return s;
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3600000);
}

function getDayOfWeek(dateStr) {
  var norm = normalizeDate(dateStr);
  if (!norm) return '';
  var p = norm.split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getUTCDay()];
}

function isValidDate(dateStr) {
  var norm = normalizeDate(dateStr);
  return typeof norm === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(norm);
}

function isValidMeal(meal) {
  return CONFIG.MEALS.indexOf(meal) !== -1;
}

function isValidStatus(status) {
  return CONFIG.STATUSES.indexOf(status) !== -1;
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getSheet(sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  return sheet;
}

function generateId(prefix, currentCount) {
  return prefix + String(currentCount + 1).padStart(3, '0');
}

function successResponse(data) {
  data.success = true;
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message, code) {
  var body = { success: false, error: message, code: code || 400 };
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function logActivity(managerId, action, date, memberId, meal, oldStatus, newStatus) {
  try {
    var sheet = getSheet(CONFIG.SHEETS.ACTIVITY_LOG);
    var currentRows = sheet.getLastRow();
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
    Logger.log('logActivity error: ' + e.message);
  }
}

function memberExists(memberId) {
  var sheet  = getSheet(CONFIG.SHEETS.MEMBERS);
  var data   = sheet.getDataRange().getValues();
  var col    = CONFIG.MEMBERS_COLS.MEMBER_ID;
  for (var i = 1; i < data.length; i++) {
    if (data[i][col] === memberId) return true;
  }
  return false;
}

// ── 3. AUTHENTICATION & SESSIONS ──────────────────────────────

function handleLogin(requestData) {
  try {
    var username = (requestData.username || '').trim();
    var password = requestData.password || '';

    if (!username || !password) {
      return errorResponse('Username and password are required.', 400);
    }

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

    var saltToUse = manager ? manager.salt : generateSalt();
    var hash      = hashPassword(password, saltToUse);
    var hashMatch = manager && (hash === manager.passwordHash);

    if (!hashMatch) {
      return errorResponse('Invalid username or password.', 401);
    }

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

function handleValidateSession(params) {
  var token   = params.token;
  var session = validateToken(token);
  if (session) {
    return successResponse({ valid: true, username: session.username, name: session.name });
  }
  return errorResponse('Session is invalid or has expired.', 401);
}

function validateToken(token) {
  if (!token || typeof token !== 'string') return null;
  return getSession(token);
}

function getSession(token) {
  try {
    var sheet = getSheet(CONFIG.SHEETS.SESSIONS);
    var data  = sheet.getDataRange().getValues();
    var cols  = CONFIG.SESSIONS_COLS;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var isActive = row[cols.ACTIVE] === true || row[cols.ACTIVE] === 'TRUE';

      if (row[cols.SESSION_ID] === token && isActive) {
        var expVal = row[cols.EXPIRES_AT];
        var expDate = expVal instanceof Date ? expVal : new Date(String(expVal).replace('T', ' ') + ' GMT+0530');

        if (new Date() > expDate) {
          sheet.getRange(i + 1, cols.ACTIVE + 1).setValue(false);
          return null;
        }

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

// ── 4. MEMBER MANAGEMENT ─────────────────────────────────────

function handleGetMembers(params, session) {
  try {
    var includeInactive = params.includeInactive === 'true';

    var sheet  = getSheet(CONFIG.SHEETS.MEMBERS);
    var data   = sheet.getDataRange().getValues();
    var cols   = CONFIG.MEMBERS_COLS;
    var members = [];

    for (var i = 1; i < data.length; i++) {
      var row    = data[i];
      var active = row[cols.ACTIVE] === true || row[cols.ACTIVE] === 'TRUE';

      if (!includeInactive && !active) continue;

      members.push({
        member_id:  String(row[cols.MEMBER_ID]),
        name:       String(row[cols.NAME]),
        active:     active,
        created_at: String(row[cols.CREATED_AT])
      });
    }

    return successResponse({ members: members });

  } catch (e) {
    Logger.log('handleGetMembers error: ' + e.message);
    return errorResponse('Failed to retrieve members.', 500);
  }
}

function handleAddMember(requestData, session) {
  try {
    var name = (requestData.name || '').trim();
    if (!name) return errorResponse('Member name is required.', 400);
    if (name.length > 60) return errorResponse('Member name is too long (max 60 chars).', 400);

    var sheet = getSheet(CONFIG.SHEETS.MEMBERS);
    var data  = sheet.getDataRange().getValues();
    var cols  = CONFIG.MEMBERS_COLS;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][cols.NAME]).toLowerCase() === name.toLowerCase()) {
        return errorResponse('A member named "' + name + '" already exists.', 400);
      }
    }

    var memberId = generateId('MBR', data.length - 1);
    var now      = getISTNow();

    sheet.appendRow([memberId, name, true, now]);

    logActivity(session.managerId, 'ADD_MEMBER', '', memberId, '', '', name);

    return successResponse({
      member: { member_id: memberId, name: name, active: true, created_at: now }
    });

  } catch (e) {
    Logger.log('handleAddMember error: ' + e.message);
    return errorResponse('Failed to add member.', 500);
  }
}

function handleEditMember(requestData, session) {
  try {
    var memberId = (requestData.member_id || '').trim();
    var newName  = (requestData.name || '').trim();

    if (!memberId) return errorResponse('member_id is required.', 400);
    if (!newName)  return errorResponse('New name is required.', 400);
    if (newName.length > 60) return errorResponse('Name is too long (max 60 chars).', 400);

    var sheet = getSheet(CONFIG.SHEETS.MEMBERS);
    var data  = sheet.getDataRange().getValues();
    var cols  = CONFIG.MEMBERS_COLS;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][cols.MEMBER_ID]) === memberId) {
        var oldName = String(data[i][cols.NAME]);
        sheet.getRange(i + 1, cols.NAME + 1).setValue(newName);
        logActivity(session.managerId, 'EDIT_MEMBER', '', memberId, '', oldName, newName);
        return successResponse({ member_id: memberId, name: newName });
      }
    }

    return errorResponse('Member not found.', 404);

  } catch (e) {
    Logger.log('handleEditMember error: ' + e.message);
    return errorResponse('Failed to edit member.', 500);
  }
}

function handleToggleMember(requestData, session) {
  try {
    var memberId = (requestData.member_id || '').trim();
    if (!memberId) return errorResponse('member_id is required.', 400);

    var sheet = getSheet(CONFIG.SHEETS.MEMBERS);
    var data  = sheet.getDataRange().getValues();
    var cols  = CONFIG.MEMBERS_COLS;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][cols.MEMBER_ID]) === memberId) {
        var wasActive = data[i][cols.ACTIVE] === true || data[i][cols.ACTIVE] === 'TRUE';
        var nowActive = !wasActive;
        sheet.getRange(i + 1, cols.ACTIVE + 1).setValue(nowActive);

        var action = nowActive ? 'ACTIVATE' : 'DEACTIVATE';
        logActivity(session.managerId, action, '', memberId, '', '', '');

        return successResponse({ member_id: memberId, active: nowActive });
      }
    }

    return errorResponse('Member not found.', 404);

  } catch (e) {
    Logger.log('handleToggleMember error: ' + e.message);
    return errorResponse('Failed to toggle member status.', 500);
  }
}

// ── 5. MEAL RECORDS & SUMMARY ────────────────────────────────

function handleGetMeals(params, session) {
  try {
    var date = normalizeDate(params.date);
    if (!date || !isValidDate(date)) {
      return errorResponse('A valid date (YYYY-MM-DD) is required.', 400);
    }

    var membersSheet = getSheet(CONFIG.SHEETS.MEMBERS);
    var membersData  = membersSheet.getDataRange().getValues();
    var mCols        = CONFIG.MEMBERS_COLS;
    var activeMembers = [];

    for (var m = 1; m < membersData.length; m++) {
      var mRow   = membersData[m];
      var active = mRow[mCols.ACTIVE] === true || mRow[mCols.ACTIVE] === 'TRUE';
      if (active) {
        activeMembers.push({
          member_id: String(mRow[mCols.MEMBER_ID]),
          name:      String(mRow[mCols.NAME])
        });
      }
    }

    var recordsSheet = getSheet(CONFIG.SHEETS.MEAL_RECORDS);
    var recordsData  = recordsSheet.getDataRange().getValues();
    var rCols        = CONFIG.MEAL_RECORDS_COLS;
    var lookup       = {};

    for (var r = 1; r < recordsData.length; r++) {
      var rec = recordsData[r];
      var recDate = normalizeDate(rec[rCols.DATE]);
      if (recDate !== date) continue;
      var mid  = String(rec[rCols.MEMBER_ID]);
      var meal = String(rec[rCols.MEAL]);
      var stat = String(rec[rCols.STATUS]);
      if (!lookup[mid]) lookup[mid] = {};
      lookup[mid][meal] = stat;
    }

    var records = activeMembers.map(function(mem) {
      var mealData = lookup[mem.member_id] || {};
      return {
        member_id: mem.member_id,
        name:      mem.name,
        Breakfast: mealData['Breakfast'] || null,
        Lunch:     mealData['Lunch']     || null,
        Dinner:    mealData['Dinner']    || null
      };
    });

    return successResponse({ date: date, records: records });

  } catch (e) {
    Logger.log('handleGetMeals error: ' + e.message);
    return errorResponse('Failed to retrieve meal data.', 500);
  }
}

function handleSaveMeals(requestData, session) {
  try {
    var date    = normalizeDate(requestData.date);
    var changes = requestData.changes;

    if (!date || !isValidDate(date)) {
      return errorResponse('A valid date (YYYY-MM-DD) is required.', 400);
    }
    if (!Array.isArray(changes) || changes.length === 0) {
      return errorResponse('No changes provided.', 400);
    }

    for (var k = 0; k < changes.length; k++) {
      var ch = changes[k];
      if (!ch.member_id || !memberExists(String(ch.member_id))) {
        return errorResponse('Invalid or unknown member_id: ' + ch.member_id, 400);
      }
      if (!isValidMeal(ch.meal)) {
        return errorResponse('Invalid meal value: ' + ch.meal, 400);
      }
      if (!isValidStatus(ch.status)) {
        return errorResponse('Invalid status value: ' + ch.status, 400);
      }
    }

    var dedupMap = {};
    for (var d = 0; d < changes.length; d++) {
      dedupMap[changes[d].member_id + '|' + changes[d].meal] = changes[d];
    }
    var dedupedChanges = [];
    for (var k2 in dedupMap) {
      if (dedupMap.hasOwnProperty(k2)) dedupedChanges.push(dedupMap[k2]);
    }

    var recordsSheet = getSheet(CONFIG.SHEETS.MEAL_RECORDS);
    var recordsData  = recordsSheet.getDataRange().getValues();
    var rCols        = CONFIG.MEAL_RECORDS_COLS;
    var existingIndex = {};
    var existingStatus = {};

    for (var i = 1; i < recordsData.length; i++) {
      var rec = recordsData[i];
      var recDate = normalizeDate(rec[rCols.DATE]);
      if (recDate === date) {
        var key = date + '|' + String(rec[rCols.MEMBER_ID]) + '|' + String(rec[rCols.MEAL]);
        existingIndex[key]  = i + 1;
        existingStatus[key] = String(rec[rCols.STATUS]);
      }
    }

    var nextRecordNum = recordsData.length - 1;
    var now       = getISTNow();
    var savedCount = 0;

    for (var c = 0; c < dedupedChanges.length; c++) {
      var change = dedupedChanges[c];
      var key    = date + '|' + change.member_id + '|' + change.meal;

      if (existingIndex[key]) {
        var rowNum    = existingIndex[key];
        var oldStatus = existingStatus[key] || '';
        recordsSheet.getRange(rowNum, rCols.STATUS     + 1).setValue(change.status);
        recordsSheet.getRange(rowNum, rCols.UPDATED_AT + 1).setValue(now);
        recordsSheet.getRange(rowNum, rCols.UPDATED_BY + 1).setValue(session.username);
        logActivity(session.managerId, 'UPDATE', date, change.member_id, change.meal, oldStatus, change.status);
      } else {
        nextRecordNum++;
        var recordId = 'REC' + String(nextRecordNum).padStart(3, '0');
        recordsSheet.appendRow([
          recordId,
          date,
          change.member_id,
          change.meal,
          change.status,
          now,
          session.username
        ]);
        logActivity(session.managerId, 'INSERT', date, change.member_id, change.meal, '', change.status);
        existingIndex[key]  = recordsSheet.getLastRow();
        existingStatus[key] = change.status;
      }

      savedCount++;
    }

    return successResponse({
      saved:   savedCount,
      message: savedCount + ' change' + (savedCount !== 1 ? 's' : '') + ' saved successfully.'
    });

  } catch (e) {
    Logger.log('handleSaveMeals error: ' + e.message);
    return errorResponse('Failed to save meal changes. Please try again.', 500);
  }
}

function handleGetSummary(params, session) {
  try {
    var date = normalizeDate(params.date);
    if (!date || !isValidDate(date)) {
      return errorResponse('A valid date (YYYY-MM-DD) is required.', 400);
    }

    var recordsSheet = getSheet(CONFIG.SHEETS.MEAL_RECORDS);
    var recordsData  = recordsSheet.getDataRange().getValues();
    var rCols        = CONFIG.MEAL_RECORDS_COLS;

    var summary = {};
    CONFIG.MEALS.forEach(function(meal) {
      summary[meal] = { Eat: 0, 'Not Eat': 0, Informed: 0 };
    });

    for (var i = 1; i < recordsData.length; i++) {
      var rec = recordsData[i];
      var recDate = normalizeDate(rec[rCols.DATE]);
      if (recDate !== date) continue;
      var meal   = String(rec[rCols.MEAL]);
      var status = String(rec[rCols.STATUS]);
      if (summary[meal] && summary[meal][status] !== undefined) {
        summary[meal][status]++;
      }
    }

    return successResponse({ date: date, summary: summary });

  } catch (e) {
    Logger.log('handleGetSummary error: ' + e.message);
    return errorResponse('Failed to retrieve summary.', 500);
  }
}

// ── 6. HISTORY & REPORTS ──────────────────────────────────────

function handleGetHistory(params, session) {
  try {
    var date      = params.date      ? normalizeDate(params.date)      : null;
    var dateFrom  = params.dateFrom  ? normalizeDate(params.dateFrom)  : null;
    var dateTo    = params.dateTo    ? normalizeDate(params.dateTo)    : null;
    var dayOfWeek = params.dayOfWeek || null;
    var memberId  = params.memberId  || null;
    var meal      = params.meal      || null;
    var status    = params.status    || null;
    var page      = Math.max(1, parseInt(params.page) || 1);
    var PAGE_SIZE = 50;

    if (date     && !isValidDate(date))     return errorResponse('Invalid date filter.', 400);
    if (dateFrom && !isValidDate(dateFrom)) return errorResponse('Invalid dateFrom filter.', 400);
    if (dateTo   && !isValidDate(dateTo))   return errorResponse('Invalid dateTo filter.', 400);
    if (meal     && !isValidMeal(meal))     return errorResponse('Invalid meal filter.', 400);
    if (status   && !isValidStatus(status)) return errorResponse('Invalid status filter.', 400);

    var memberNames = buildMemberNameMap();

    var sheet = getSheet(CONFIG.SHEETS.MEAL_RECORDS);
    var data  = sheet.getDataRange().getValues();
    var cols  = CONFIG.MEAL_RECORDS_COLS;
    var filtered = [];

    for (var i = 1; i < data.length; i++) {
      var rec     = data[i];
      var recDate = normalizeDate(rec[cols.DATE]);
      var recMid  = String(rec[cols.MEMBER_ID]);
      var recMeal = String(rec[cols.MEAL]);
      var recStat = String(rec[cols.STATUS]);

      if (date      && recDate !== date)             continue;
      if (dateFrom  && recDate < dateFrom)           continue;
      if (dateTo    && recDate > dateTo)             continue;
      if (dayOfWeek && getDayOfWeek(recDate) !== dayOfWeek) continue;
      if (memberId  && recMid !== memberId)          continue;
      if (meal      && recMeal !== meal)             continue;
      if (status    && recStat !== status)           continue;

      filtered.push({
        record_id:   String(rec[cols.RECORD_ID]),
        date:        recDate,
        day_of_week: getDayOfWeek(recDate),
        member_id:   recMid,
        member_name: memberNames[recMid] || 'Unknown',
        meal:        recMeal,
        status:      recStat,
        updated_at:  normalizeDateTime(rec[cols.UPDATED_AT]),
        updated_by:  String(rec[cols.UPDATED_BY])
      });
    }

    filtered.sort(function(a, b) {
      var dateDiff = b.date.localeCompare(a.date);
      if (dateDiff !== 0) return dateDiff;
      var mealOrder = CONFIG.MEALS.indexOf(a.meal) - CONFIG.MEALS.indexOf(b.meal);
      if (mealOrder !== 0) return mealOrder;
      return a.member_name.localeCompare(b.member_name);
    });

    var total      = filtered.length;
    var startIdx   = (page - 1) * PAGE_SIZE;
    var paginated  = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    return successResponse({
      records:    paginated,
      total:      total,
      page:       page,
      pageSize:   PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE)
    });

  } catch (e) {
    Logger.log('handleGetHistory error: ' + e.message);
    return errorResponse('Failed to retrieve history.', 500);
  }
}

function handleGetDayReport(params, session) {
  try {
    var date = normalizeDate(params.date);
    if (!date || !isValidDate(date)) return errorResponse('A valid date is required.', 400);

    var memberNames = buildMemberNameMap();

    var sheet = getSheet(CONFIG.SHEETS.MEAL_RECORDS);
    var data  = sheet.getDataRange().getValues();
    var cols  = CONFIG.MEAL_RECORDS_COLS;

    var summary = {};
    CONFIG.MEALS.forEach(function(meal) {
      summary[meal] = { Eat: 0, 'Not Eat': 0, Informed: 0, members: [] };
    });

    for (var i = 1; i < data.length; i++) {
      var rec = data[i];
      var recDate = normalizeDate(rec[cols.DATE]);
      if (recDate !== date) continue;
      var meal   = String(rec[cols.MEAL]);
      var status = String(rec[cols.STATUS]);
      var mid    = String(rec[cols.MEMBER_ID]);

      if (!summary[meal]) continue;
      if (summary[meal][status] !== undefined) summary[meal][status]++;
      summary[meal].members.push({
        member_id: mid,
        name:      memberNames[mid] || 'Unknown',
        status:    status
      });
    }

    CONFIG.MEALS.forEach(function(meal) {
      summary[meal].members.sort(function(a, b) {
        return a.name.localeCompare(b.name);
      });
    });

    return successResponse({
      date:        date,
      day_of_week: getDayOfWeek(date),
      summary:     summary
    });

  } catch (e) {
    Logger.log('handleGetDayReport error: ' + e.message);
    return errorResponse('Failed to retrieve day report.', 500);
  }
}

function handleGetMonthReport(params, session) {
  try {
    var year  = String(params.year || '').trim();
    var month = String(params.month || '').trim();

    if (!year || !month) return errorResponse('year and month parameters are required.', 400);
    if (!/^\d{4}$/.test(year))  return errorResponse('Invalid year.', 400);
    if (!/^\d{1,2}$/.test(month)) return errorResponse('Invalid month.', 400);

    var paddedMonth = month.length === 1 ? '0' + month : month;
    var prefix      = year + '-' + paddedMonth;

    var memberNames = buildMemberNameMap();

    var sheet = getSheet(CONFIG.SHEETS.MEAL_RECORDS);
    var data  = sheet.getDataRange().getValues();
    var cols  = CONFIG.MEAL_RECORDS_COLS;

    var overall = {
      total: 0, Eat: 0, 'Not Eat': 0, Informed: 0,
      Breakfast: { total: 0, Eat: 0, 'Not Eat': 0, Informed: 0 },
      Lunch:     { total: 0, Eat: 0, 'Not Eat': 0, Informed: 0 },
      Dinner:    { total: 0, Eat: 0, 'Not Eat': 0, Informed: 0 }
    };

    var memberStats = {};

    for (var i = 1; i < data.length; i++) {
      var rec    = data[i];
      var recDate = normalizeDate(rec[cols.DATE]);
      if (!recDate.startsWith(prefix)) continue;

      var meal   = String(rec[cols.MEAL]);
      var status = String(rec[cols.STATUS]);
      var mid    = String(rec[cols.MEMBER_ID]);

      overall.total++;
      if (overall[status] !== undefined)    overall[status]++;
      if (overall[meal]) {
        overall[meal].total++;
        if (overall[meal][status] !== undefined) overall[meal][status]++;
      }

      if (!memberStats[mid]) {
        memberStats[mid] = {
          member_id: mid,
          name:      memberNames[mid] || 'Unknown',
          total:     0, Eat: 0, 'Not Eat': 0, Informed: 0,
          Breakfast: { Eat: 0, 'Not Eat': 0, Informed: 0 },
          Lunch:     { Eat: 0, 'Not Eat': 0, Informed: 0 },
          Dinner:    { Eat: 0, 'Not Eat': 0, Informed: 0 }
        };
      }
      var ms = memberStats[mid];
      ms.total++;
      if (ms[status] !== undefined) ms[status]++;
      if (ms[meal] && ms[meal][status] !== undefined) ms[meal][status]++;
    }

    var memberArray = [];
    for (var mid2 in memberStats) {
      if (memberStats.hasOwnProperty(mid2)) memberArray.push(memberStats[mid2]);
    }
    memberArray.sort(function(a, b) { return a.name.localeCompare(b.name); });

    return successResponse({
      year:    year,
      month:   paddedMonth,
      overall: overall,
      members: memberArray
    });

  } catch (e) {
    Logger.log('handleGetMonthReport error: ' + e.message);
    return errorResponse('Failed to retrieve month report.', 500);
  }
}

function buildMemberNameMap() {
  var sheet = getSheet(CONFIG.SHEETS.MEMBERS);
  var data  = sheet.getDataRange().getValues();
  var cols  = CONFIG.MEMBERS_COLS;
  var map   = {};
  for (var i = 1; i < data.length; i++) {
    map[String(data[i][cols.MEMBER_ID])] = String(data[i][cols.NAME]);
  }
  return map;
}

// ── 7. MAIN ROUTER (doGet / doPost) ───────────────────────────

function doGet(e) {
  try {
    var params = e.parameter || {};
    var action = params.action;

    if (!action) {
      return errorResponse('Missing required parameter: action', 400);
    }

    if (action === 'validateSession') {
      return handleValidateSession(params);
    }

    var session = validateToken(params.token);
    if (!session) {
      return errorResponse('Unauthorized: invalid or expired session.', 401);
    }

    switch (action) {
      case 'getMembers':     return handleGetMembers(params, session);
      case 'getMeals':       return handleGetMeals(params, session);
      case 'getSummary':     return handleGetSummary(params, session);
      case 'getHistory':     return handleGetHistory(params, session);
      case 'getDayReport':   return handleGetDayReport(params, session);
      case 'getMonthReport': return handleGetMonthReport(params, session);
      case 'getStudents':    return handleGetStudents(params, session);
      case 'getAttendance':  return handleGetAttendance(params, session);
      default:               return errorResponse('Unknown action: ' + action, 400);
    }

  } catch (err) {
    Logger.log('doGet error: ' + err.message + '\n' + err.stack);
    return errorResponse('Internal server error.', 500);
  }
}

function doPost(e) {
  try {
    var params      = e.parameter || {};
    var action      = params.action;
    var requestData = {};

    if (e.postData && e.postData.contents) {
      try {
        requestData = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        return errorResponse('Invalid JSON in request body.', 400);
      }
    }

    if (!action) {
      return errorResponse('Missing required parameter: action', 400);
    }

    if (action === 'login') {
      return handleLogin(requestData);
    }

    var token   = requestData.token || params.token;
    var session = validateToken(token);
    if (!session) {
      return errorResponse('Unauthorized: invalid or expired session.', 401);
    }

    switch (action) {
      case 'logout':          return handleLogout(requestData);
      case 'saveMeals':       return handleSaveMeals(requestData, session);
      case 'addMember':       return handleAddMember(requestData, session);
      case 'editMember':      return handleEditMember(requestData, session);
      case 'toggleMember':    return handleToggleMember(requestData, session);
      case 'addStudent':      return handleAddStudent(requestData, session);
      case 'editStudent':     return handleEditStudent(requestData, session);
      case 'toggleStudent':   return handleToggleStudent(requestData, session);
      case 'saveAttendance':  return handleSaveAttendance(requestData, session);
      default:                return errorResponse('Unknown action: ' + action, 400);
    }

  } catch (err) {
    Logger.log('doPost error: ' + err.message + '\n' + err.stack);
    return errorResponse('Internal server error.', 500);
  }
}

// ── 8. ONE-TIME DATABASE SETUP & INITIALIZATION ───────────────

function setupDatabase() {
  var ss = getSpreadsheet();

  var sheetDefs = [
    {
      name:    CONFIG.SHEETS.MANAGERS,
      headers: ['manager_id','username','password_hash','salt','name','active','created_at']
    },
    {
      name:    CONFIG.SHEETS.MEMBERS,
      headers: ['member_id','name','active','created_at']
    },
    {
      name:    CONFIG.SHEETS.MEAL_RECORDS,
      headers: ['record_id','date','member_id','meal','status','updated_at','updated_by']
    },
    {
      name:    CONFIG.SHEETS.SESSIONS,
      headers: ['session_id','manager_id','username','created_at','expires_at','active']
    },
    {
      name:    CONFIG.SHEETS.ACTIVITY_LOG,
      headers: ['log_id','timestamp','manager_id','action','date','member_id','meal','old_status','new_status']
    },
    {
      name:    CONFIG.SHEETS.STUDENTS,
      headers: ['student_id','name','active','created_at']
    },
    {
      name:    CONFIG.SHEETS.ATTENDANCE,
      headers: ['attendance_id','date','student_id','status','updated_at']
    }
  ];

  sheetDefs.forEach(function(def) {
    var sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
      Logger.log('Created sheet: ' + def.name);
    } else {
      Logger.log('Sheet already exists: ' + def.name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(def.headers);
      var headerRange = sheet.getRange(1, 1, 1, def.headers.length);
      headerRange.setBackground('#1E3A5F');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  });

  seedInitialMembers();

  Logger.log('✅ Database setup complete.');
  SpreadsheetApp.getUi().alert('✅ Database setup complete! Now select "createFirstManager" and click Run.');
}

function seedInitialMembers() {
  var sheet = getSheet(CONFIG.SHEETS.MEMBERS);
  if (sheet.getLastRow() > 1) {
    Logger.log('Members sheet already has data — skipping seed.');
    return;
  }

  var members = ['Aarif','Sanjeevan','Praveen','Naga','Jeevith','Sham','Vinoth','Shiva'];
  var now     = getISTNow();

  members.forEach(function(name, idx) {
    var memberId = 'MBR' + String(idx + 1).padStart(3, '0');
    sheet.appendRow([memberId, name, true, now]);
  });

  Logger.log('Seeded ' + members.length + ' initial members.');
}

function createFirstManager() {
  var USERNAME = 'admin';
  var PASSWORD = 'ChangeMe123!';
  var NAME     = 'Admin Manager';

  var sheet = getSheet(CONFIG.SHEETS.MANAGERS);
  var data  = sheet.getDataRange().getValues();
  var cols  = CONFIG.MANAGERS_COLS;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][cols.USERNAME]).toLowerCase() === USERNAME.toLowerCase()) {
      Logger.log('Manager "' + USERNAME + '" already exists.');
      SpreadsheetApp.getUi().alert('⚠️ Manager "' + USERNAME + '" already exists.');
      return;
    }
  }

  var salt    = generateSalt();
  var hash    = hashPassword(PASSWORD, salt);
  var now     = getISTNow();
  var mgId    = generateId('MGR', data.length - 1);

  sheet.appendRow([mgId, USERNAME, hash, salt, NAME, true, now]);

  Logger.log('✅ Manager created: ' + USERNAME + ' (' + mgId + ')');
  SpreadsheetApp.getUi().alert(
    '✅ Manager account created successfully!\n\n' +
    'Username: ' + USERNAME + '\n' +
    'Password: ' + PASSWORD + '\n' +
    'ID: ' + mgId + '\n\n' +
    'Now deploy as Web App to get your API URL.'
  );
}

// ── 9. COLLEGE ATTENDANCE ──────────────────────────────────────

var ATTENDANCE_STATUSES = ['present', 'absent', 'not_marked'];

function handleGetStudents(params, session) {
  try {
    var includeInactive = params.includeInactive === 'true';
    var sheet    = getSheet(CONFIG.SHEETS.STUDENTS);
    var data     = sheet.getDataRange().getValues();
    var cols     = CONFIG.STUDENTS_COLS;
    var students = [];

    for (var i = 1; i < data.length; i++) {
      var row    = data[i];
      var active = row[cols.ACTIVE] === true || row[cols.ACTIVE] === 'TRUE';
      if (!includeInactive && !active) continue;
      students.push({
        student_id: String(row[cols.STUDENT_ID]),
        name:       String(row[cols.NAME]),
        active:     active,
        created_at: String(row[cols.CREATED_AT])
      });
    }
    return successResponse({ students: students });
  } catch (e) {
    Logger.log('handleGetStudents error: ' + e.message);
    return errorResponse('Failed to retrieve students.', 500);
  }
}

function handleAddStudent(requestData, session) {
  try {
    var name = (requestData.name || '').trim();
    if (!name) return errorResponse('Student name is required.', 400);
    if (name.length > 60) return errorResponse('Student name is too long (max 60 chars).', 400);

    var sheet = getSheet(CONFIG.SHEETS.STUDENTS);
    var data  = sheet.getDataRange().getValues();
    var cols  = CONFIG.STUDENTS_COLS;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][cols.NAME]).toLowerCase() === name.toLowerCase()) {
        return errorResponse('A student named "' + name + '" already exists.', 400);
      }
    }

    var studentId = generateId('STU', data.length - 1);
    var now       = getISTNow();
    sheet.appendRow([studentId, name, true, now]);
    logActivity(session.managerId, 'ADD_STUDENT', '', studentId, '', '', name);
    return successResponse({ student: { student_id: studentId, name: name, active: true, created_at: now } });
  } catch (e) {
    Logger.log('handleAddStudent error: ' + e.message);
    return errorResponse('Failed to add student.', 500);
  }
}

function handleEditStudent(requestData, session) {
  try {
    var studentId = (requestData.student_id || '').trim();
    var newName   = (requestData.name || '').trim();
    if (!studentId) return errorResponse('student_id is required.', 400);
    if (!newName)   return errorResponse('New name is required.', 400);
    if (newName.length > 60) return errorResponse('Name is too long (max 60 chars).', 400);

    var sheet = getSheet(CONFIG.SHEETS.STUDENTS);
    var data  = sheet.getDataRange().getValues();
    var cols  = CONFIG.STUDENTS_COLS;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][cols.STUDENT_ID]) === studentId) {
        var oldName = String(data[i][cols.NAME]);
        sheet.getRange(i + 1, cols.NAME + 1).setValue(newName);
        logActivity(session.managerId, 'EDIT_STUDENT', '', studentId, '', oldName, newName);
        return successResponse({ student_id: studentId, name: newName });
      }
    }
    return errorResponse('Student not found.', 404);
  } catch (e) {
    Logger.log('handleEditStudent error: ' + e.message);
    return errorResponse('Failed to edit student.', 500);
  }
}

function handleToggleStudent(requestData, session) {
  try {
    var studentId = (requestData.student_id || '').trim();
    if (!studentId) return errorResponse('student_id is required.', 400);

    var sheet = getSheet(CONFIG.SHEETS.STUDENTS);
    var data  = sheet.getDataRange().getValues();
    var cols  = CONFIG.STUDENTS_COLS;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][cols.STUDENT_ID]) === studentId) {
        var wasActive = data[i][cols.ACTIVE] === true || data[i][cols.ACTIVE] === 'TRUE';
        var nowActive = !wasActive;
        sheet.getRange(i + 1, cols.ACTIVE + 1).setValue(nowActive);
        var action = nowActive ? 'ACTIVATE_STUDENT' : 'DEACTIVATE_STUDENT';
        logActivity(session.managerId, action, '', studentId, '', '', '');
        return successResponse({ student_id: studentId, active: nowActive });
      }
    }
    return errorResponse('Student not found.', 404);
  } catch (e) {
    Logger.log('handleToggleStudent error: ' + e.message);
    return errorResponse('Failed to toggle student status.', 500);
  }
}

function handleGetAttendance(params, session) {
  try {
    var date = (params.date || '').trim();
    if (!isValidDate(date)) return errorResponse('Invalid or missing date.', 400);

    var sheet = getSheet(CONFIG.SHEETS.ATTENDANCE);
    var data  = sheet.getDataRange().getValues();
    var cols  = CONFIG.ATTENDANCE_COLS;
    var attendance = {};

    for (var i = 1; i < data.length; i++) {
      var row       = data[i];
      var rowDate   = normalizeDate(row[cols.DATE]);
      var studentId = String(row[cols.STUDENT_ID]);
      var status    = String(row[cols.STATUS]);
      if (rowDate === date) {
        attendance[studentId] = status;
      }
    }
    return successResponse({ date: date, attendance: attendance });
  } catch (e) {
    Logger.log('handleGetAttendance error: ' + e.message);
    return errorResponse('Failed to retrieve attendance.', 500);
  }
}

function handleSaveAttendance(requestData, session) {
  try {
    var date    = (requestData.date || '').trim();
    var changes = requestData.changes || {};
    if (!isValidDate(date)) return errorResponse('Invalid or missing date.', 400);

    var changeKeys = Object.keys(changes);
    if (changeKeys.length === 0) return successResponse({ saved: 0 });

    for (var k = 0; k < changeKeys.length; k++) {
      var st = changes[changeKeys[k]];
      if (ATTENDANCE_STATUSES.indexOf(st) === -1) {
        return errorResponse('Invalid status "' + st + '" for student ' + changeKeys[k], 400);
      }
    }

    var sheet = getSheet(CONFIG.SHEETS.ATTENDANCE);
    var data  = sheet.getDataRange().getValues();
    var cols  = CONFIG.ATTENDANCE_COLS;
    var now   = getISTNow();

    // Index existing rows for this date
    var existingRows = {};
    for (var i = 1; i < data.length; i++) {
      var rowDate = normalizeDate(data[i][cols.DATE]);
      if (rowDate === date) {
        existingRows[String(data[i][cols.STUDENT_ID])] = i + 1;
      }
    }

    var savedCount = 0;
    changeKeys.forEach(function(studentId) {
      var newStatus = changes[studentId];
      if (existingRows[studentId]) {
        var rowNum = existingRows[studentId];
        sheet.getRange(rowNum, cols.STATUS     + 1).setValue(newStatus);
        sheet.getRange(rowNum, cols.UPDATED_AT + 1).setValue(now);
      } else {
        var currentRows = sheet.getLastRow();
        var attId       = generateId('ATT', currentRows - 1);
        sheet.appendRow([attId, date, studentId, newStatus, now]);
      }
      savedCount++;
    });

    logActivity(session.managerId, 'SAVE_ATTENDANCE', date, '', '', '', savedCount + ' record(s)');
    return successResponse({ date: date, saved: savedCount });
  } catch (e) {
    Logger.log('handleSaveAttendance error: ' + e.message);
    return errorResponse('Failed to save attendance.', 500);
  }
}
