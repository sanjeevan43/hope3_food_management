// Constants & Config
const PEOPLE = [
  "Aarif",
  "Sanjeevan",
  "Praveen",
  "Naga",
  "Jeevith",
  "Sham",
  "Vinoth",
  "Shiva"
];

const MEALS = ["breakfast", "lunch", "dinner"];
const STATUSES = ["NO_RESPONSE", "EATING", "INFORMED", "NOT_EATING"];
const STATUS_ICONS = {
  "EATING": "🟢",
  "INFORMED": "🟡",
  "NOT_EATING": "🔴",
  "NO_RESPONSE": "⚪"
};

const STATUS_LABELS = {
  "EATING": "Eating",
  "INFORMED": "Informed",
  "NOT_EATING": "Not Eating",
  "NO_RESPONSE": "No Response"
};

// Global App State
let currentDate = "2026-09-16"; // Default Sep 16, 2026
let currentMonth = "2026-09";
let foodData = {};

// DOM Elements
const selectedDateInput = document.getElementById("selectedDateInput");
const monthSelectorInput = document.getElementById("monthSelectorInput");
const displayDate = document.getElementById("displayDate");
const prevDayBtn = document.getElementById("prevDayBtn");
const nextDayBtn = document.getElementById("nextDayBtn");
const todayBtn = document.getElementById("todayBtn");

// Day Summary Elements
const daySummaryTitle = document.getElementById("daySummaryTitle");
const dayBreakfastCount = document.getElementById("dayBreakfastCount");
const dayLunchCount = document.getElementById("dayLunchCount");
const dayDinnerCount = document.getElementById("dayDinnerCount");
const dayInformedCount = document.getElementById("dayInformedCount");
const dayNotEatingCount = document.getElementById("dayNotEatingCount");
const dayNoResponseCount = document.getElementById("dayNoResponseCount");

// Month Summary Elements
const monthSummaryTitle = document.getElementById("monthSummaryTitle");
const monthTotalMealsAte = document.getElementById("monthTotalMealsAte");
const monthBreakfastAte = document.getElementById("monthBreakfastAte");
const monthLunchAte = document.getElementById("monthLunchAte");
const monthDinnerAte = document.getElementById("monthDinnerAte");

// Sheet Elements
const sheetMonthTitle = document.getElementById("sheetMonthTitle");
const sheetTableBody = document.getElementById("sheetTableBody");
const personSummaryMonth = document.getElementById("personSummaryMonth");
const personSummaryBody = document.getElementById("personSummaryBody");

// App Init
document.addEventListener("DOMContentLoaded", () => {
  loadDataFromStorage();
  bindEvents();
  
  selectedDateInput.value = currentDate;
  monthSelectorInput.value = currentMonth;
  
  render();
});

// Load & Save Data
function loadDataFromStorage() {
  const stored = localStorage.getItem("food_management_data");
  if (stored) {
    try {
      foodData = JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse storage data", e);
      seedSampleData();
    }
  } else {
    seedSampleData();
  }
}

function saveDataToStorage() {
  localStorage.setItem("food_management_data", JSON.stringify(foodData));
}

// Seed Sample Data for September 2026
function seedSampleData() {
  foodData = {};
  for (let day = 1; day <= 30; day++) {
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const dateKey = `2026-09-${dayStr}`;
    foodData[dateKey] = {};

    PEOPLE.forEach((person, idx) => {
      let b = "EATING";
      let l = "EATING";
      let d = "EATING";

      if ((day + idx) % 7 === 0) {
        b = "NOT_EATING";
        l = "INFORMED";
      } else if ((day + idx) % 5 === 0) {
        d = "INFORMED";
      } else if ((day + idx) % 9 === 0) {
        b = "NO_RESPONSE";
        l = "NO_RESPONSE";
      }

      foodData[dateKey][person] = { breakfast: b, lunch: l, dinner: d };
    });
  }
  saveDataToStorage();
}

function getPersonData(dateKey, personName) {
  if (!foodData[dateKey]) foodData[dateKey] = {};
  if (!foodData[dateKey][personName]) {
    foodData[dateKey][personName] = { breakfast: "NO_RESPONSE", lunch: "NO_RESPONSE", dinner: "NO_RESPONSE" };
  }
  return foodData[dateKey][personName];
}

// Events
function bindEvents() {
  selectedDateInput.addEventListener("change", (e) => {
    if (e.target.value) {
      currentDate = e.target.value;
      currentMonth = currentDate.substring(0, 7);
      monthSelectorInput.value = currentMonth;
      render();
    }
  });

  monthSelectorInput.addEventListener("change", (e) => {
    if (e.target.value) {
      currentMonth = e.target.value;
      currentDate = `${currentMonth}-01`;
      selectedDateInput.value = currentDate;
      render();
    }
  });

  prevDayBtn.addEventListener("click", () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    currentDate = formatDateKey(d);
    currentMonth = currentDate.substring(0, 7);
    selectedDateInput.value = currentDate;
    monthSelectorInput.value = currentMonth;
    render();
  });

  nextDayBtn.addEventListener("click", () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    currentDate = formatDateKey(d);
    currentMonth = currentDate.substring(0, 7);
    selectedDateInput.value = currentDate;
    monthSelectorInput.value = currentMonth;
    render();
  });

  todayBtn.addEventListener("click", () => {
    currentDate = "2026-09-16";
    currentMonth = "2026-09";
    selectedDateInput.value = currentDate;
    monthSelectorInput.value = currentMonth;
    render();
  });
}

function formatDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Cycle State
function cycleMealStatus(dateKey, personName, meal) {
  const record = getPersonData(dateKey, personName);
  const currentStatus = record[meal];
  const nextIndex = (STATUSES.indexOf(currentStatus) + 1) % STATUSES.length;
  record[meal] = STATUSES[nextIndex];
  
  saveDataToStorage();
  render();
}

// Render Core
function render() {
  updateHeader();
  renderDaySummary();
  renderMonthSummary();
  renderSheetTable();
  renderPersonSummary();
}

function updateHeader() {
  const dateObj = new Date(currentDate);
  displayDate.textContent = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', weekday: 'short' });
  
  const monthLabel = new Date(currentMonth + "-01").toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  monthSummaryTitle.textContent = monthLabel;
  sheetMonthTitle.textContent = monthLabel;
  personSummaryMonth.textContent = monthLabel;

  const isToday = currentDate === "2026-09-16";
  daySummaryTitle.textContent = isToday ? "Today, Sep 16" : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// 1. Day-wise Requirement Summary
function renderDaySummary() {
  let b = 0, l = 0, d = 0, inf = 0, notE = 0, noResp = 0;

  PEOPLE.forEach(p => {
    const data = getPersonData(currentDate, p);
    MEALS.forEach(m => {
      const st = data[m];
      if (st === "EATING") {
        if (m === "breakfast") b++;
        if (m === "lunch") l++;
        if (m === "dinner") d++;
      } else if (st === "INFORMED") inf++;
      else if (st === "NOT_EATING") notE++;
      else if (st === "NO_RESPONSE") noResp++;
    });
  });

  dayBreakfastCount.textContent = `${b} Eating`;
  dayLunchCount.textContent = `${l} Eating`;
  dayDinnerCount.textContent = `${d} Eating`;
  dayInformedCount.textContent = inf;
  dayNotEatingCount.textContent = notE;
  dayNoResponseCount.textContent = noResp;
}

// 2. Month-wise Requirement Summary
function renderMonthSummary() {
  let bTotal = 0, lTotal = 0, dTotal = 0;

  Object.keys(foodData).forEach(dateKey => {
    if (dateKey.startsWith(currentMonth)) {
      PEOPLE.forEach(p => {
        const data = getPersonData(dateKey, p);
        if (data.breakfast === "EATING") bTotal++;
        if (data.lunch === "EATING") lTotal++;
        if (data.dinner === "EATING") dTotal++;
      });
    }
  });

  monthBreakfastAte.textContent = bTotal;
  monthLunchAte.textContent = lTotal;
  monthDinnerAte.textContent = dTotal;
  monthTotalMealsAte.textContent = bTotal + lTotal + dTotal;
}

// 3. Main Attendance Sheet
function renderSheetTable() {
  sheetTableBody.innerHTML = "";

  const [yStr, mStr] = currentMonth.split("-");
  const year = parseInt(yStr);
  const month = parseInt(mStr);
  const totalDays = new Date(year, month, 0).getDate();

  for (let day = 1; day <= totalDays; day++) {
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const dateKey = `${currentMonth}-${dayStr}`;
    const dateObj = new Date(year, month - 1, day);
    const isSelected = dateKey === currentDate;

    const tr = document.createElement("tr");
    if (isSelected) tr.className = "selected-row";

    // Date Cell
    const tdDate = document.createElement("td");
    tdDate.className = "sticky-col date-col";
    tdDate.textContent = `${dateObj.toLocaleDateString('en-US', { month: 'short' })} ${day}`;
    tr.appendChild(tdDate);

    // Day Cell
    const tdDay = document.createElement("td");
    tdDay.className = "sticky-col day-col";
    tdDay.textContent = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    tr.appendChild(tdDay);

    // People Cells
    PEOPLE.forEach(p => {
      const pData = getPersonData(dateKey, p);
      const td = document.createElement("td");
      
      const group = document.createElement("div");
      group.className = "cell-meals";

      MEALS.forEach(m => {
        const btn = document.createElement("button");
        const st = pData[m];
        btn.className = `m-btn st-${st}`;
        btn.textContent = STATUS_ICONS[st];
        btn.title = `${p} - ${m.toUpperCase()}: ${STATUS_LABELS[st]}`;
        btn.addEventListener("click", () => cycleMealStatus(dateKey, p, m));
        group.appendChild(btn);
      });

      td.appendChild(group);
      tr.appendChild(td);
    });

    sheetTableBody.appendChild(tr);
  }
}

// 4. Person-wise Summary Table
function renderPersonSummary() {
  personSummaryBody.innerHTML = "";

  PEOPLE.forEach(p => {
    let b = 0, l = 0, d = 0, inf = 0, notE = 0, noResp = 0;

    Object.keys(foodData).forEach(dateKey => {
      if (dateKey.startsWith(currentMonth)) {
        const pData = getPersonData(dateKey, p);
        MEALS.forEach(m => {
          const st = pData[m];
          if (st === "EATING") {
            if (m === "breakfast") b++;
            if (m === "lunch") l++;
            if (m === "dinner") d++;
          } else if (st === "INFORMED") inf++;
          else if (st === "NOT_EATING") notE++;
          else if (st === "NO_RESPONSE") noResp++;
        });
      }
    });

    const total = b + l + d;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p}</td>
      <td>${b}</td>
      <td>${l}</td>
      <td>${d}</td>
      <td><strong style="color: var(--primary-color);">${total}</strong></td>
      <td><span style="color: var(--color-informed-text); font-weight:600;">${inf}</span></td>
      <td><span style="color: var(--color-not-eating-text); font-weight:600;">${notE}</span></td>
      <td><span style="color: var(--color-no-response-text); font-weight:600;">${noResp}</span></td>
    `;
    personSummaryBody.appendChild(tr);
  });
}
