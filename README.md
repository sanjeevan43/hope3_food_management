# Hope3 Food Management System

A manager-only web application for recording team meal statuses (Eat / Not Eat / Informed) across three daily meals (Breakfast, Lunch, Dinner), backed by Google Sheets via Google Apps Script.

---

## Project Structure

```
hope3 food manage/
├── index.html          ← Auth-aware redirect
├── login.html          ← Login page
├── dashboard.html      ← Daily meal management
├── history.html        ← History & Reports
├── members.html        ← Member management
│
├── css/
│   ├── style.css       ← Global design system
│   ├── login.css
│   ├── dashboard.css
│   ├── history.css
│   └── members.css
│
├── js/
│   ├── api.js          ← GAS API client (set GAS_URL here)
│   ├── auth.js         ← Auth utilities & toast system
│   ├── dashboard.js
│   ├── history.js
│   └── members.js
│
└── gas/                ← Google Apps Script source files
    ├── Config.gs
    ├── Utils.gs
    ├── Auth.gs
    ├── Members.gs
    ├── Meals.gs
    ├── History.gs
    ├── Code.gs         ← Main router (doGet/doPost)
    └── Setup.gs        ← One-time database initialisation
```

---

## Deployment Guide

### Step 1 — Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet.
2. Name it **"Hope3 Food Manager"** (or any name you prefer).
3. Copy the **Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit
   ```

---

### Step 2 — Set Up Google Apps Script

1. In your spreadsheet, click **Extensions → Apps Script**.
2. Delete the default `Code.gs` content.
3. Create the following files in the Apps Script editor (click **+** → **Script**):
   - `Config.gs`
   - `Utils.gs`
   - `Auth.gs`
   - `Members.gs`
   - `Meals.gs`
   - `History.gs`
   - `Code.gs`
   - `Setup.gs`
4. Copy the contents of each `.gs` file from the `gas/` folder into the corresponding file in the Apps Script editor.

---

### Step 3 — Configure the Spreadsheet ID

In `Config.gs`, replace the placeholder:

```javascript
SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',
```

with your actual Spreadsheet ID from Step 1.

---

### Step 4 — Run the Database Setup

1. In the Apps Script editor, select `setupDatabase` from the function dropdown.
2. Click **Run**.
3. Grant the required permissions when prompted.
4. This will:
   - Create all 5 sheets with correct headers and formatting
   - Seed the 8 initial team members

---

### Step 5 — Create the First Manager Account

1. Open `Setup.gs` and change the credentials:
   ```javascript
   var USERNAME = 'admin';         // ← change this
   var PASSWORD = 'ChangeMe123!'; // ← change this to a strong password
   var NAME     = 'Admin Manager'; // ← change this
   ```
2. Select `createFirstManager` from the function dropdown and click **Run**.
3. ⚠️ **After running, delete or clear the plaintext password from `Setup.gs`** (or delete the entire `Setup.gs` file from the project).

---

### Step 6 — Deploy as a Web App

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Click the gear icon → **Web app**.
3. Set:
   - **Execute as:** Me (your Google account)
   - **Who has access:** Anyone
4. Click **Deploy**.
5. Copy the **Web App URL** — it looks like:
   ```
   https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
   ```

> ⚠️ **Every time you change GAS code**, you must create a **new deployment** (not just save). Use **Deploy → Manage deployments → New version**.

---

### Step 7 — Configure the Frontend

Open `js/api.js` and replace the placeholder URL:

```javascript
const GAS_URL = 'YOUR_GAS_WEB_APP_URL_HERE';
```

with the Web App URL from Step 6.

---

### Step 8 — Host the Frontend

Open `index.html` in a browser. For local testing, use a simple HTTP server (not file://):

```bash
# Using Python (from the project folder)
python -m http.server 8080

# Then open: http://localhost:8080
```

Or host on GitHub Pages, Netlify, Vercel, or any static file host.

---

## Adding More Managers

Managers are added manually in the Google Sheet. You can reuse the `createFirstManager` function in `Setup.gs` temporarily, or add the following helper function to `Setup.gs` and run it:

```javascript
function addManager() {
  var USERNAME = 'manager2';
  var PASSWORD = 'AnotherStrongPassword!';
  var NAME     = 'Second Manager';
  createManagerRecord(USERNAME, PASSWORD, NAME); // uses same logic as createFirstManager
}
```

Alternatively, add rows manually to the `Managers` sheet:
1. Generate a salt: any random string (32+ chars)
2. Compute `SHA256(password + salt)` using an online tool (for setup only)
3. Fill in: `manager_id`, `username`, `password_hash`, `salt`, `name`, `active=TRUE`, `created_at`

---

## Adding Team Members

Members can be added via the **Members** page in the web app. Initial members (Aarif, Sanjeevan, Praveen, Naga, Jeevith, Sham, Vinoth, Shiva) are seeded automatically by `setupDatabase`.

---

## Security Notes

| Protection | Implementation |
|---|---|
| Password storage | SHA-256(password + salt) — never stored as plaintext |
| Session tokens | Random UUID-based token, 8-hour expiry |
| Token storage | `sessionStorage` — cleared when browser tab closes |
| API validation | Every request validates token server-side before executing |
| Input validation | Meal, status, member_id all validated against allowlists |
| Activity logging | Every meal change logged with old/new status and manager |

### Known limitations (Google Apps Script platform)

- **No row locking**: Concurrent saves by two managers at the exact same time could cause a race condition on the same record. Single-manager use is the intended pattern.
- **GAS execution quota**: Free Google Workspace accounts have daily script runtime limits. For high-volume use, monitor quota in the Apps Script dashboard.
- **Session tokens in Sheets**: Tokens live in the Sessions sheet. A Google Workspace admin with sheet access could see them. Use a dedicated backend for high-security requirements.
- **Cold start latency**: The first GAS request after an idle period may take 2–5 seconds.

---

## Meal Status Reference

| Status | Meaning |
|---|---|
| **Eat** | The member will eat this meal |
| **Not Eat** | The member will not eat this meal |
| **Informed** | The member has informed the manager |
| *Not Set* | No record exists yet (UI only, not saved to database) |

Status cycle on click: **Not Set → Eat → Not Eat → Informed → Eat →** …

---

## Google Sheets Reference

| Sheet | Purpose |
|---|---|
| `Managers` | Manager accounts with hashed passwords |
| `Members` | Team members (active/inactive) |
| `MealRecords` | Primary meal database — unique on date + member_id + meal |
| `Sessions` | Active login sessions with expiry timestamps |
| `ActivityLog` | Full audit trail of all changes |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + S` | Save pending meal changes (on Dashboard) |

---

## Troubleshooting

**"Failed to load data" on dashboard**
- Verify the GAS URL in `js/api.js` is correct and the deployment is live.
- Check that the Spreadsheet ID in `Config.gs` matches your sheet.
- Open the GAS URL directly in a browser — you should see a JSON response.

**Login says "Invalid username or password"**
- Confirm the manager account was created by running `createFirstManager`.
- Check the Managers sheet row — `active` column must be `TRUE`.

**Changes not saving**
- Check the browser console for errors.
- Ensure the GAS deployment has "Who has access: Anyone" (not "Anyone with Google account").

**GAS deployment returns error**
- In Apps Script: View → Logs for recent execution errors.
- Re-deploy: Deploy → Manage deployments → New version.
