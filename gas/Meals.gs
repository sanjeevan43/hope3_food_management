// ============================================================
// Meals.gs — Meal status management endpoints
// Hope3 Food Management System
// ============================================================

// ── getMeals ──────────────────────────────────────────────────

/**
 * Return meal statuses for all active members on a given date.
 * Missing records are returned as null (displayed as "Not Set" in UI).
 *
 * GET  ?action=getMeals&date=YYYY-MM-DD&token=...
 */
function handleGetMeals(params, session) {
  try {
    var date = params.date;
    if (!date || !isValidDate(date)) {
      return errorResponse('A valid date (YYYY-MM-DD) is required.', 400);
    }

    // ── Fetch active members ──
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

    // ── Build status lookup for the date ──
    // lookup[member_id][meal] = status
    var recordsSheet = getSheet(CONFIG.SHEETS.MEAL_RECORDS);
    var recordsData  = recordsSheet.getDataRange().getValues();
    var rCols        = CONFIG.MEAL_RECORDS_COLS;
    var lookup       = {};

    for (var r = 1; r < recordsData.length; r++) {
      var rec = recordsData[r];
      if (normalizeDate(rec[rCols.DATE]) !== date) continue;
      var mid  = String(rec[rCols.MEMBER_ID]);
      var meal = String(rec[rCols.MEAL]);
      var stat = String(rec[rCols.STATUS]);
      if (!lookup[mid]) lookup[mid] = {};
      lookup[mid][meal] = stat;
    }

    // ── Assemble result ──
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

// ── saveMeals ─────────────────────────────────────────────────

/**
 * Batch upsert meal status changes.
 * Uses date + member_id + meal as the unique key.
 *  - If record exists → UPDATE status, updated_at, updated_by
 *  - If record is new → INSERT
 * Also writes to ActivityLog for every change.
 *
 * POST  ?action=saveMeals
 * Body: { token, date, changes: [{ member_id, meal, status }] }
 */
function handleSaveMeals(requestData, session) {
  try {
    var date    = requestData.date;
    var changes = requestData.changes;

    if (!date || !isValidDate(date)) {
      return errorResponse('A valid date (YYYY-MM-DD) is required.', 400);
    }
    if (!Array.isArray(changes) || changes.length === 0) {
      return errorResponse('No changes provided.', 400);
    }

    // ── Validate every change before touching the sheet ──
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

    // ── Deduplicate changes (last one wins for same member+meal) ──
    var dedupMap = {};
    for (var d = 0; d < changes.length; d++) {
      dedupMap[changes[d].member_id + '|' + changes[d].meal] = changes[d];
    }
    var dedupedChanges = [];
    for (var k2 in dedupMap) {
      if (dedupMap.hasOwnProperty(k2)) dedupedChanges.push(dedupMap[k2]);
    }

    // ── Build index of existing records for this date ──
    // key = "date|member_id|meal" → 1-based sheet row number
    var recordsSheet = getSheet(CONFIG.SHEETS.MEAL_RECORDS);
    var recordsData  = recordsSheet.getDataRange().getValues();
    var rCols        = CONFIG.MEAL_RECORDS_COLS;
    var existingIndex = {};
    var existingStatus = {};  // same key → current status (for old_status in log)

    for (var i = 1; i < recordsData.length; i++) {
      var rec = recordsData[i];
      if (normalizeDate(rec[rCols.DATE]) === date) {
        var key = date + '|' + String(rec[rCols.MEMBER_ID]) + '|' + String(rec[rCols.MEAL]);
        existingIndex[key]  = i + 1; // 1-based row
        existingStatus[key] = String(rec[rCols.STATUS]);
      }
    }

    // Track next record number for new inserts
    var nextRecordNum = recordsData.length - 1; // data rows excluding header
    var now       = getISTNow();
    var savedCount = 0;

    for (var c = 0; c < dedupedChanges.length; c++) {
      var change = dedupedChanges[c];
      var key    = date + '|' + change.member_id + '|' + change.meal;

      if (existingIndex[key]) {
        // ── UPDATE ──
        var rowNum    = existingIndex[key];
        var oldStatus = existingStatus[key] || '';
        recordsSheet.getRange(rowNum, rCols.STATUS     + 1).setValue(change.status);
        recordsSheet.getRange(rowNum, rCols.UPDATED_AT + 1).setValue(now);
        recordsSheet.getRange(rowNum, rCols.UPDATED_BY + 1).setValue(session.username);
        logActivity(session.managerId, 'UPDATE', date, change.member_id, change.meal, oldStatus, change.status);
      } else {
        // ── INSERT ──
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
        // Mark as existing to handle edge-case duplicates within the same batch
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

// ── getSummary ────────────────────────────────────────────────

/**
 * Return per-meal, per-status counts for a date.
 * Only counts records that exist (null = Not Set, not counted).
 *
 * GET  ?action=getSummary&date=YYYY-MM-DD&token=...
 */
function handleGetSummary(params, session) {
  try {
    var date = params.date;
    if (!date || !isValidDate(date)) {
      return errorResponse('A valid date (YYYY-MM-DD) is required.', 400);
    }

    var recordsSheet = getSheet(CONFIG.SHEETS.MEAL_RECORDS);
    var recordsData  = recordsSheet.getDataRange().getValues();
    var rCols        = CONFIG.MEAL_RECORDS_COLS;

    // Initialise summary counts
    var summary = {};
    CONFIG.MEALS.forEach(function(meal) {
      summary[meal] = { Eat: 0, 'Not Eat': 0, Informed: 0 };
    });

    for (var i = 1; i < recordsData.length; i++) {
      var rec = recordsData[i];
      if (normalizeDate(rec[rCols.DATE]) !== date) continue;
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
