// ============================================================
// Setup.gs — One-time database initialisation script
// Hope3 Food Management System
//
// HOW TO USE:
//   1. Open the Apps Script editor for this project.
//   2. Select function "setupDatabase" from the function dropdown.
//   3. Click Run.  (Grant permissions when prompted.)
//   4. After success, select "createFirstManager" and run it once
//      to seed the initial manager account.
//   5. Delete or comment out this file after setup is complete.
// ============================================================

/**
 * Create all required sheets with correct headers.
 * Safe to re-run: existing sheets are not overwritten.
 */
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
      Logger.log('Sheet already exists (skipped): ' + def.name);
    }
    // Write headers if the sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(def.headers);
      // Style the header row
      var headerRange = sheet.getRange(1, 1, 1, def.headers.length);
      headerRange.setBackground('#1E3A5F');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  });

  // Seed the 8 initial team members
  seedInitialMembers();

  Logger.log('✅ Database setup complete.');
  SpreadsheetApp.getUi().alert('✅ Database setup complete! Now run createFirstManager() to add the first manager account.');
}

/**
 * Seed the initial 8 team members if the Members sheet is empty.
 */
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

/**
 * Create the first manager account.
 *
 * IMPORTANT: Change the username/password/name below before running.
 * After running, delete or modify this function so the credentials
 * are no longer visible in the script source.
 */
function createFirstManager() {
  // ── CHANGE THESE VALUES ──────────────────────────────────
  var USERNAME = 'admin';
  var PASSWORD = 'ChangeMe123!';   // ← CHANGE THIS
  var NAME     = 'Admin Manager';
  // ─────────────────────────────────────────────────────────

  var sheet = getSheet(CONFIG.SHEETS.MANAGERS);
  var data  = sheet.getDataRange().getValues();
  var cols  = CONFIG.MANAGERS_COLS;

  // Prevent duplicate usernames
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][cols.USERNAME]).toLowerCase() === USERNAME.toLowerCase()) {
      Logger.log('⚠️  Manager with username "' + USERNAME + '" already exists.');
      SpreadsheetApp.getUi().alert('⚠️  Manager "' + USERNAME + '" already exists. No changes made.');
      return;
    }
  }

  var salt    = generateSalt();
  var hash    = hashPassword(PASSWORD, salt);
  var now     = getISTNow();
  var mgId    = generateId('MGR', data.length - 1);

  sheet.appendRow([mgId, USERNAME, hash, salt, NAME, true, now]);

  Logger.log('✅ Manager created: ' + USERNAME + ' (ID: ' + mgId + ')');
  SpreadsheetApp.getUi().alert(
    '✅ Manager account created!\n\n' +
    'Username: ' + USERNAME + '\n' +
    'ID: ' + mgId + '\n\n' +
    '⚠️  Please delete or modify the createFirstManager() function now to remove the plaintext password from the script source.'
  );
}
