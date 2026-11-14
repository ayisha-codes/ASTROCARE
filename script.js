/* AstroCare: educational prototype. Not a medical device. */

// ---------- Settings ----------
const ENTRIES_KEY = "astrocare_entries";
const START_KEY = "astrocare_mission_start";

// Sample data: illustrative only, NOT real astronaut measurements.
function makeSampleEntries() {
  const hr = [68, 71, 66, 73, 70, 69, 72];
  const temp = [36.6, 36.7, 36.5, 36.8, 36.6, 36.7, 36.6];
  const sleep = [7.2, 6.5, 7.0, 5.8, 6.9, 7.4, 6.6];
  const mood = ["Good", "Okay", "Good", "Low", "Okay", "Good", "Okay"];
  return hr.map((h, i) => ({
    id: "sample-" + i,
    timestamp: new Date(Date.now() - (6 - i) * 86400000).toISOString(),
    heartRate: h,
    temperature: temp[i],
    sleep: sleep[i],
    mood: mood[i],
    notes: ""
  }));
}

// ---------- Storage helpers (try/catch so errors never crash the page) ----------
function loadEntries() {
  try {
    const raw = JSON.parse(localStorage.getItem(ENTRIES_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    return [];
  }
}

function saveEntries(list) {
  try {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}

function getMissionStart() {
  try {
    let start = localStorage.getItem(START_KEY);
    if (!start) {
      start = new Date().toISOString();
      localStorage.setItem(START_KEY, start);
    }
    return new Date(start);
  } catch (e) {
    return new Date();
  }
}

// Uses sample data until the user saves a real entry.
function getActiveData() {
  const saved = loadEntries();
  return saved.length > 0
    ? { list: saved, isSample: false }
    : { list: makeSampleEntries(), isSample: true };
}

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);

function formatDate(iso) {
  return new Date(iso).toLocaleString([], {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

// ---------- Dashboard ----------
function describeChange(current, previous, unit) {
  if (previous === undefined) return "First entry";
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return "Same as previous entry";
  return (diff > 0 ? "+" : "") + diff + " " + unit + " vs previous entry";
}

function renderDashboard() {
  const { list, isSample } = getActiveData();
  const latest = list[list.length - 1];
  const prev = list.length > 1 ? list[list.length - 2] : undefined;

  $("hrValue").textContent = latest.heartRate;
  $("tempValue").textContent = Number(latest.temperature).toFixed(1);
  $("sleepValue").textContent = Number(latest.sleep).toFixed(1);
  $("moodValue").textContent = latest.mood;

  $("hrDelta").textContent = describeChange(latest.heartRate, prev && prev.heartRate, "BPM");
  $("tempDelta").textContent = describeChange(latest.temperature, prev && prev.temperature, "\u00B0C");
  $("sleepDelta").textContent = describeChange(latest.sleep, prev && prev.sleep, "h");
  $("moodDelta").textContent = prev ? "Previous: " + prev.mood : "First entry";

  $("dataBadge").textContent = isSample
    ? "Showing SAMPLE data (illustrative, not real measurements). Save a check-in to see your own."
    : "Showing your latest saved check-in.";

  const days = Math.floor((Date.now() - getMissionStart().getTime()) / 86400000) + 1;
  $("missionDay").textContent = Math.max(1, days);
}

// ---------- History table ----------
function renderTable() {
  const { list, isSample } = getActiveData();
  const body = $("historyBody");
  body.innerHTML = "";

  // 10 most recent entries, newest first
  list.slice(-10).reverse().forEach((entry) => {
    const row = document.createElement("tr");
    const cells = [
      formatDate(entry.timestamp),
      entry.heartRate,
      Number(entry.temperature).toFixed(1),
      Number(entry.sleep).toFixed(1),
      entry.mood,
      entry.notes || "\u2014"
    ];
    cells.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value; // textContent keeps user notes safe
      row.appendChild(td);
    });
    body.appendChild(row);
  });

  $("trendNote").textContent = isSample
    ? "Chart and table currently show SAMPLE data. They switch to your entries after your first check-in."
    : "Showing your saved check-ins (most recent 14 on the chart).";
}

// ---------- Chart (plain canvas, no libraries) ----------
const METRIC_INFO = {
  heartRate: { label: "Heart rate (BPM)", decimals: 0 },
  temperature: { label: "Body temperature (\u00B0C)", decimals: 1 },
  sleep: { label: "Sleep duration (hours)", decimals: 1 }
};

function drawChart() {
  const canvas = $("trendChart");
  const ctx = canvas.getContext("2d");
  const metric = $("metricSelect").value;
  const info = METRIC_INFO[metric];

  // Match canvas pixels to on-screen size (sharp on high-DPI screens)
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const W = rect.width, H = rect.height;
  const pad = { top: 28, right: 20, bottom: 40, left: 52 };
  ctx.clearRect(0, 0, W, H);

  const data = getActiveData().list.slice(-14);
  const values = data.map((e) => Number(e[metric]));

  // Y-axis range with breathing room
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const margin = (max - min) * 0.15;
  min -= margin; max += margin;

  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const xAt = (i) => pad.left + (values.length === 1 ? plotW / 2 : (i / (values.length - 1)) * plotW);
  const yAt = (v) => pad.top + (1 - (v - min) / (max - min)) * plotH;

  // Title
  ctx.fillStyle = "#a9b4d6";
  ctx.font = "13px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(info.label, pad.left, 16);

  // Grid lines and Y labels
  ctx.strokeStyle = "rgba(120,150,255,0.18)";
  ctx.lineWidth = 1;
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const v = min + ((max - min) * i) / 4;
    const y = yAt(v);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    ctx.fillText(v.toFixed(info.decimals), pad.left - 8, y + 4);
  }

  // X labels (spaced out so they do not overlap)
  ctx.textAlign = "center";
  const step = Math.max(1, Math.ceil(values.length / 6));
  data.forEach((e, i) => {
    if (i % step === 0 || i === data.length - 1) {
      const label = new Date(e.timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
      ctx.fillText(label, xAt(i), H - pad.bottom + 20);
    }
  });

  // Line
  const gradient = ctx.createLinearGradient(pad.left, 0, W - pad.right, 0);
  gradient.addColorStop(0, "#22d3ee");
  gradient.addColorStop(1, "#8b5cf6");
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.beginPath();
  values.forEach((v, i) => (i === 0 ? ctx.moveTo(xAt(i), yAt(v)) : ctx.lineTo(xAt(i), yAt(v))));
  ctx.stroke();

  // Points
  ctx.fillStyle = "#e8edff";
  values.forEach((v, i) => {
    ctx.beginPath();
    ctx.arc(xAt(i), yAt(v), 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ---------- Form handling ----------
// These ranges only catch typing mistakes. They are NOT medical thresholds.
const INPUT_LIMITS = {
  heartRate: { min: 20, max: 250, name: "Heart rate" },
  temperature: { min: 30, max: 45, name: "Temperature" },
  sleep: { min: 0, max: 24, name: "Sleep duration" }
};

const ERROR_IDS = { heartRate: "hrError", temperature: "tempError", sleep: "sleepError", mood: "moodError" };

function validateForm() {
  const errors = {};
  ["heartRate", "temperature", "sleep"].forEach((key) => {
    const raw = $(key).value.trim();
    const lim = INPUT_LIMITS[key];
    if (raw === "") {
      errors[key] = lim.name + " is required.";
    } else if (isNaN(Number(raw)) || Number(raw) < lim.min || Number(raw) > lim.max) {
      errors[key] = "Enter a number between " + lim.min + " and " + lim.max + " (typing-error check only).";
    }
  });
  if ($("mood").value === "") errors.mood = "Please select a mood.";
  return errors;
}

function showErrors(errors) {
  Object.keys(ERROR_IDS).forEach((key) => {
    const message = errors[key] || "";
    $(ERROR_IDS[key]).textContent = message;
    $(key).setAttribute("aria-invalid", message ? "true" : "false");
  });
}

function setStatus(message, isBad) {
  const status = $("formStatus");
  status.textContent = message;
  status.classList.toggle("bad", Boolean(isBad));
}

function refreshAll() {
  renderDashboard();
  renderTable();
  drawChart();
}

function handleSubmit(event) {
  event.preventDefault();

  const errors = validateForm();
  showErrors(errors);

  const firstBad = Object.keys(errors)[0];
  if (firstBad) {
    setStatus("Please fix the highlighted fields.", true);
    $(firstBad).focus();
    return;
  }

  const entry = {
    id: "entry-" + Date.now(),
    timestamp: new Date().toISOString(),
    heartRate: Number($("heartRate").value),
    temperature: Number($("temperature").value),
    sleep: Number($("sleep").value),
    mood: $("mood").value,
    notes: $("notes").value.trim()
  };

  const saved = loadEntries();
  saved.push(entry);

  if (!saveEntries(saved)) {
    setStatus("Could not save: browser storage is unavailable or full.", true);
    return;
  }

  $("checkinForm").reset();
  showErrors({});
  setStatus("Check-in saved. If you feel unwell or concerned, contact the crew medical officer.", false);
  refreshAll();
}

function handleReset() {
  showErrors({});
  setStatus("", false);
}

function handleClearData() {
  if (!confirm("Delete all saved check-ins from this browser? This cannot be undone.")) return;
  try {
    localStorage.removeItem(ENTRIES_KEY);
  } catch (e) { /* ignore */ }
  setStatus("Saved entries deleted. Showing sample data again.", false);
  refreshAll();
}

// ---------- Navigation ----------
function setupNav() {
  const toggle = $("navToggle");
  const nav = $("mainNav");

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  // Close the mobile menu after choosing a link
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });

  // Highlight the link for the section currently on screen
  const links = Array.from(nav.querySelectorAll("a"));
  const sections = links
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          links.forEach((a) =>
            a.classList.toggle("active", a.getAttribute("href") === "#" + entry.target.id)
          );
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    sections.forEach((s) => observer.observe(s));
  }
}

// ---------- Start ----------
document.addEventListener("DOMContentLoaded", () => {
  setupNav();
  refreshAll();

  $("checkinForm").addEventListener("submit", handleSubmit);
  $("checkinForm").addEventListener("reset", handleReset);
  $("clearDataBtn").addEventListener("click", handleClearData);
  $("metricSelect").addEventListener("change", drawChart);

  // Redraw the chart when the window size changes
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawChart, 150);
  });
});
