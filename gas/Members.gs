// ============================================================
// Members.gs — Member management endpoints
// Hope3 Food Management System
// ============================================================

/**
 * Return all members.
 * By default, returns only active members.
 * Pass includeInactive=true to return all.
 */
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

/**
 * Add a new member.
 * Required: { name: "..." }
 */
function handleAddMember(requestData, session) {
  try {
    var name = (requestData.name || '').trim();
    if (!name) return errorResponse('Member name is required.', 400);
    if (name.length > 60) return errorResponse('Member name is too long (max 60 chars).', 400);

    var sheet = getSheet(CONFIG.SHEETS.MEMBERS);
    var data  = sheet.getDataRange().getValues();
    var cols  = CONFIG.MEMBERS_COLS;

    // Prevent duplicate names (case-insensitive)
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

/**
 * Edit a member's name.
 * Required: { member_id: "...", name: "..." }
 */
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

/**
 * Toggle a member's active/inactive status.
 * Required: { member_id: "..." }
 * Deactivation does NOT delete meal history.
 */
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
