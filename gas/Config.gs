// ============================================================
// Config.gs — Application-wide configuration and constants
// Hope3 Food Management System
// ============================================================

var CONFIG = {

  // ── Google Sheet ──────────────────────────────────────────
  // Replace with the ID from your Google Sheet URL:
  // https://docs.google.com/spreadsheets/d/YOUR_ID_HERE/edit
  SPREADSHEET_ID: '1WG4OE6kWoXvMA6laKT3HYBGjzo1VoHj7jkEAXVfLGW4',

  // ── Timezone ──────────────────────────────────────────────
  TIMEZONE: 'Asia/Kolkata',

  // ── Session ───────────────────────────────────────────────
  SESSION_DURATION_HOURS: 8,

  // ── Sheet Names ───────────────────────────────────────────
  SHEETS: {
    MANAGERS:     'Managers',
    MEMBERS:      'Members',
    MEAL_RECORDS: 'MealRecords',
    SESSIONS:     'Sessions',
    ACTIVITY_LOG: 'ActivityLog',
    STUDENTS:     'Students',
    ATTENDANCE:   'Attendance'
  },

  // ── Allowed Values ────────────────────────────────────────
  MEALS:    ['Breakfast', 'Lunch', 'Dinner'],
  STATUSES: ['Eat', 'Not Eat', 'Informed'],

  // ── Column Indices (0-based, matches sheet column order) ──

  // Sheet: Managers
  // manager_id | username | password_hash | salt | name | active | created_at
  MANAGERS_COLS: {
    MANAGER_ID:    0,
    USERNAME:      1,
    PASSWORD_HASH: 2,
    SALT:          3,
    NAME:          4,
    ACTIVE:        5,
    CREATED_AT:    6
  },

  // Sheet: Members
  // member_id | name | active | created_at
  MEMBERS_COLS: {
    MEMBER_ID:  0,
    NAME:       1,
    ACTIVE:     2,
    CREATED_AT: 3
  },

  // Sheet: MealRecords
  // record_id | date | member_id | meal | status | updated_at | updated_by
  MEAL_RECORDS_COLS: {
    RECORD_ID:  0,
    DATE:       1,
    MEMBER_ID:  2,
    MEAL:       3,
    STATUS:     4,
    UPDATED_AT: 5,
    UPDATED_BY: 6
  },

  // Sheet: Sessions
  // session_id | manager_id | username | created_at | expires_at | active
  SESSIONS_COLS: {
    SESSION_ID:  0,
    MANAGER_ID:  1,
    USERNAME:    2,
    CREATED_AT:  3,
    EXPIRES_AT:  4,
    ACTIVE:      5
  },

  // Sheet: ActivityLog
  // log_id | timestamp | manager_id | action | date | member_id | meal | old_status | new_status
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

  // Sheet: Students
  // student_id | name | active | created_at
  STUDENTS_COLS: {
    STUDENT_ID: 0,
    NAME:       1,
    ACTIVE:     2,
    CREATED_AT: 3
  },

  // Sheet: Attendance
  // attendance_id | date | student_id | status | updated_at
  ATTENDANCE_COLS: {
    ATTENDANCE_ID: 0,
    DATE:          1,
    STUDENT_ID:    2,
    STATUS:        3,
    UPDATED_AT:    4
  }
};
