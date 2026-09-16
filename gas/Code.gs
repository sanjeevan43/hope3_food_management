// ============================================================
// Code.gs — Main doGet / doPost router
// Hope3 Food Management System
// ============================================================

/**
 * Handle all GET requests.
 * Route is determined by the `action` query parameter.
 * All protected routes require a valid `token` query parameter.
 */
function doGet(e) {
  try {
    var params = e.parameter || {};
    var action = params.action;

    if (!action) {
      return errorResponse('Missing required parameter: action', 400);
    }

    // ── Public GET endpoints (no auth required) ──
    if (action === 'validateSession') {
      return handleValidateSession(params);
    }

    // ── Protected GET endpoints ──
    var session = validateToken(params.token);
    if (!session) {
      return errorResponse('Unauthorized: invalid or expired session.', 401);
    }

    switch (action) {
      case 'getMembers':
        return handleGetMembers(params, session);

      case 'getMeals':
        return handleGetMeals(params, session);

      case 'getSummary':
        return handleGetSummary(params, session);

      case 'getHistory':
        return handleGetHistory(params, session);

      case 'getDayReport':
        return handleGetDayReport(params, session);

      case 'getMonthReport':
        return handleGetMonthReport(params, session);

      default:
        return errorResponse('Unknown action: ' + action, 400);
    }

  } catch (err) {
    Logger.log('doGet error: ' + err.message + '\n' + err.stack);
    return errorResponse('Internal server error.', 500);
  }
}

/**
 * Handle all POST requests.
 * Route is determined by the `action` query parameter.
 * Request body is expected to be a JSON string (Content-Type: text/plain
 * avoids CORS preflight while still carrying JSON payload).
 */
function doPost(e) {
  try {
    var params      = e.parameter || {};
    var action      = params.action;
    var requestData = {};

    // Parse JSON body
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

    // ── Public POST endpoints ──
    if (action === 'login') {
      return handleLogin(requestData);
    }

    // ── Protected POST endpoints ──
    // Token may appear in body or query string
    var token   = requestData.token || params.token;
    var session = validateToken(token);
    if (!session) {
      return errorResponse('Unauthorized: invalid or expired session.', 401);
    }

    switch (action) {
      case 'logout':
        return handleLogout(requestData);

      case 'saveMeals':
        return handleSaveMeals(requestData, session);

      case 'addMember':
        return handleAddMember(requestData, session);

      case 'editMember':
        return handleEditMember(requestData, session);

      case 'toggleMember':
        return handleToggleMember(requestData, session);

      default:
        return errorResponse('Unknown action: ' + action, 400);
    }

  } catch (err) {
    Logger.log('doPost error: ' + err.message + '\n' + err.stack);
    return errorResponse('Internal server error.', 500);
  }
}
