// ============================================================
// Attendance.gs — College Attendance endpoints
// Hope3 Food Management System
//
// Required sheets:
//   Students   → student_id | name | active | created_at
//   Attendance → attendance_id | date | student_id | status | updated_at
//
// Allowed status values: 'present', 'absent', 'not_marked'
// ============================================================

var ATTENDANCE_STATUSES = ['present', 'absent', 'not_marked'];

// ── Students ──────────────────────────────────────────────────

/**
 * Return all students.
 * By default, returns only active students.
 * Pass includeInactive=true to return all.
 */
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

/**
 * Add a new student.
 * Required: { name: "..." }
 */
function handleAddStudent(requestData, session) {
  try {
    var name = (requestData.name || '').trim();
    if (!name) return errorResponse('Student name is required.', 400);
    if (name.length > 60) return errorResponse('Student name is too long (max 60 chars).', 400);

    var sheet = getSheet(CONFIG.SHEETS.STUDENTS);
    var data  = sheet.getDataRange().getValues();
    var cols  = CONFIG.STUDENTS_COLS;

    // Prevent duplicate names (case-insensitive)
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][cols.NAME]).toLowerCase() === name.toLowerCase()) {
        return errorResponse('A student named "' + name + '" already exists.', 400);
      }
    }

    var studentId = generateId('STU', data.length - 1);
    var now       = getISTNow();

    sheet.appendRow([studentId, name, true, now]);

    logActivity(session.managerId, 'ADD_STUDENT', '', studentId, '', '', name);

    return successResponse({
      student: { student_id: studentId, name: name, active: true, created_at: now }
    });

  } catch (e) {
    Logger.log('handleAddStudent error: ' + e.message);
    return errorResponse('Failed to add student.', 500);
  }
}

/**
 * Edit a student's name.
 * Required: { student_id: "...", name: "..." }
 */
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

/**
 * Toggle a student's active/inactive status.
 * Required: { student_id: "..." }
 * Deactivation does NOT delete attendance history.
 */
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

// ── Attendance ────────────────────────────────────────────────

/**
 * Get attendance for a specific date.
 * Returns a map of { student_id: status } for all students that have a record.
 * Students with no record are implicitly 'not_marked'.
 *
 * Required params: date (YYYY-MM-DD)
 */
function handleGetAttendance(params, session) {
  try {
    var date = (params.date || '').trim();
    if (!isValidDate(date)) return errorResponse('Invalid or missing date.', 400);

    var sheet = getSheet(CONFIG.SHEETS.ATTENDANCE);
    var data  = sheet.getDataRange().getValues();
    var cols  = CONFIG.ATTENDANCE_COLS;

    // Build a map: student_id → status for the requested date
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

/**
 * Save (upsert) attendance records for a specific date.
 *
 * Required body: {
 *   date: "YYYY-MM-DD",
 *   changes: { "STU001": "present", "STU002": "absent", ... }
 * }
 *
 * Only the changed entries are sent. Existing records for the same
 * (date, student_id) are updated; missing ones are inserted as new rows.
 */
function handleSaveAttendance(requestData, session) {
  try {
    var date    = (requestData.date    || '').trim();
    var changes = requestData.changes  || {};

    if (!isValidDate(date)) return errorResponse('Invalid or missing date.', 400);

    var changeKeys = Object.keys(changes);
    if (changeKeys.length === 0) return successResponse({ saved: 0 });

    // Validate all status values up front
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

    // Build index of existing rows for this date: student_id → row-index (1-based)
    var existingRows = {}; // student_id → spreadsheet row number (1-based)
    for (var i = 1; i < data.length; i++) {
      var rowDate = normalizeDate(data[i][cols.DATE]);
      if (rowDate === date) {
        existingRows[String(data[i][cols.STUDENT_ID])] = i + 1; // +1 → 1-based sheet row
      }
    }

    var savedCount = 0;

    changeKeys.forEach(function(studentId) {
      var newStatus = changes[studentId];

      if (existingRows[studentId]) {
        // Update existing row — only status and updated_at columns
        var rowNum = existingRows[studentId];
        sheet.getRange(rowNum, cols.STATUS     + 1).setValue(newStatus);
        sheet.getRange(rowNum, cols.UPDATED_AT + 1).setValue(now);
      } else {
        // Insert new row
        var currentRows = sheet.getLastRow();
        var attId       = generateId('ATT', currentRows - 1);
        sheet.appendRow([attId, date, studentId, newStatus, now]);
      }

      savedCount++;
    });

    logActivity(
      session.managerId,
      'SAVE_ATTENDANCE',
      date,
      '',
      '',
      '',
      savedCount + ' record(s)'
    );

    return successResponse({ date: date, saved: savedCount });

  } catch (e) {
    Logger.log('handleSaveAttendance error: ' + e.message);
    return errorResponse('Failed to save attendance.', 500);
  }
}
