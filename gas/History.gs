// ============================================================
// History.gs — Historical records and reporting endpoints
// Hope3 Food Management System
// ============================================================

// ── getHistory ────────────────────────────────────────────────

/**
 * Return filtered, paginated meal records.
 *
 * GET  ?action=getHistory&token=...
 *   &date=YYYY-MM-DD          (exact date)
 *   &dateFrom=YYYY-MM-DD      (range start)
 *   &dateTo=YYYY-MM-DD        (range end)
 *   &dayOfWeek=Monday         (filter by weekday name)
 *   &memberId=MBR001          (specific member)
 *   &meal=Breakfast           (specific meal)
 *   &status=Eat               (specific status)
 *   &page=1                   (1-based page number)
 */
function handleGetHistory(params, session) {
  try {
    var date      = params.date      || null;
    var dateFrom  = params.dateFrom  || null;
    var dateTo    = params.dateTo    || null;
    var dayOfWeek = params.dayOfWeek || null;
    var memberId  = params.memberId  || null;
    var meal      = params.meal      || null;
    var status    = params.status    || null;
    var page      = Math.max(1, parseInt(params.page) || 1);
    var PAGE_SIZE = 50;

    // Validate filter values
    if (date     && !isValidDate(date))     return errorResponse('Invalid date filter.', 400);
    if (dateFrom && !isValidDate(dateFrom)) return errorResponse('Invalid dateFrom filter.', 400);
    if (dateTo   && !isValidDate(dateTo))   return errorResponse('Invalid dateTo filter.', 400);
    if (meal     && !isValidMeal(meal))     return errorResponse('Invalid meal filter.', 400);
    if (status   && !isValidStatus(status)) return errorResponse('Invalid status filter.', 400);

    // Build member name lookup
    var memberNames = buildMemberNameMap();

    // Scan MealRecords
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
        updated_at:  String(rec[cols.UPDATED_AT]),
        updated_by:  String(rec[cols.UPDATED_BY])
      });
    }

    // Sort: date descending, then member name ascending
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

// ── getDayReport ──────────────────────────────────────────────

/**
 * Return a full day report: summary counts + member-level detail.
 *
 * GET  ?action=getDayReport&date=YYYY-MM-DD&token=...
 */
function handleGetDayReport(params, session) {
  try {
    var date = params.date;
    if (!date || !isValidDate(date)) return errorResponse('A valid date is required.', 400);

    var memberNames = buildMemberNameMap();

    var sheet = getSheet(CONFIG.SHEETS.MEAL_RECORDS);
    var data  = sheet.getDataRange().getValues();
    var cols  = CONFIG.MEAL_RECORDS_COLS;

    // summary[meal] = { Eat, Not Eat, Informed, members: [{ name, status }] }
    var summary = {};
    CONFIG.MEALS.forEach(function(meal) {
      summary[meal] = { Eat: 0, 'Not Eat': 0, Informed: 0, members: [] };
    });

    for (var i = 1; i < data.length; i++) {
      var rec = data[i];
      if (normalizeDate(rec[cols.DATE]) !== date) continue;
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

    // Sort member lists alphabetically
    CONFIG.MEALS.forEach(function(meal) {
      summary[meal].members.sort(function(a, b) {
        return a.name.localeCompare(b.name);
      });
    });

    return successResponse({
      date:       date,
      day_of_week: getDayOfWeek(date),
      summary:    summary
    });

  } catch (e) {
    Logger.log('handleGetDayReport error: ' + e.message);
    return errorResponse('Failed to retrieve day report.', 500);
  }
}

// ── getMonthReport ────────────────────────────────────────────

/**
 * Return a monthly statistical report.
 *
 * GET  ?action=getMonthReport&year=YYYY&month=MM&token=...
 */
function handleGetMonthReport(params, session) {
  try {
    var year  = params.year;
    var month = params.month; // "01"–"12"

    if (!year || !month) return errorResponse('year and month parameters are required.', 400);
    if (!/^\d{4}$/.test(year))  return errorResponse('Invalid year.', 400);
    if (!/^\d{1,2}$/.test(month)) return errorResponse('Invalid month.', 400);

    var paddedMonth = month.length === 1 ? '0' + month : month;
    var prefix      = year + '-' + paddedMonth; // e.g. "2026-09"

    var memberNames = buildMemberNameMap();

    var sheet = getSheet(CONFIG.SHEETS.MEAL_RECORDS);
    var data  = sheet.getDataRange().getValues();
    var cols  = CONFIG.MEAL_RECORDS_COLS;

    // Overall totals
    var overall = {
      total: 0, Eat: 0, 'Not Eat': 0, Informed: 0,
      Breakfast: { total: 0, Eat: 0, 'Not Eat': 0, Informed: 0 },
      Lunch:     { total: 0, Eat: 0, 'Not Eat': 0, Informed: 0 },
      Dinner:    { total: 0, Eat: 0, 'Not Eat': 0, Informed: 0 }
    };

    // Per-member stats indexed by member_id
    var memberStats = {};

    for (var i = 1; i < data.length; i++) {
      var rec    = data[i];
      var recDate = normalizeDate(rec[cols.DATE]);
      if (!recDate.startsWith(prefix)) continue;

      var meal   = String(rec[cols.MEAL]);
      var status = String(rec[cols.STATUS]);
      var mid    = String(rec[cols.MEMBER_ID]);

      // Overall
      overall.total++;
      if (overall[status] !== undefined)    overall[status]++;
      if (overall[meal]) {
        overall[meal].total++;
        if (overall[meal][status] !== undefined) overall[meal][status]++;
      }

      // Per member
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

    // Convert memberStats to sorted array
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

// ── Helper ────────────────────────────────────────────────────

/**
 * Build a { member_id: name } lookup map from the Members sheet.
 */
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
