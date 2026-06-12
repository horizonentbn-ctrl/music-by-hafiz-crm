/* ===========================================================
   MUSIC BY HAFIZ - CRM FRONTEND
   Talks to a Google Apps Script Web App backend.
   =========================================================== */

// ---------- CONFIG ----------
let API_URL = localStorage.getItem("mh_api_url") || "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
let API_KEY = localStorage.getItem("mh_api_key") || "musicbyhafiz2026";

// ---------- STATE ----------
const state = {
  meta: null,
  leads: [],
  bookings: [],
  venues: [],
  content: [],
  dashboard: null,
  reports: null,
  leadFilter: "all",
  contentFilter: "all",
  bookingView: "list",
  calendarDate: new Date()
};

// ---------- API HELPER ----------
async function api(action, params = {}, method = "GET") {
  if (!API_URL || API_URL.indexOf("PASTE_") === 0) {
    toast("Set your Apps Script URL in Settings first");
    throw new Error("API URL not configured");
  }
  try {
    let res;
    if (method === "GET") {
      const qs = new URLSearchParams({ action, apiKey: API_KEY, ...flattenParams(params) });
      res = await fetch(`${API_URL}?${qs.toString()}`, { method: "GET" });
    } else {
      res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, apiKey: API_KEY, ...params })
      });
    }
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Unknown error");
    return json.data;
  } catch (err) {
    console.error(err);
    toast("Error: " + err.message);
    throw err;
  }
}

function flattenParams(params) {
  const out = {};
  Object.keys(params).forEach(k => {
    const v = params[k];
    out[k] = typeof v === "object" ? JSON.stringify(v) : v;
  });
  return out;
}

// ---------- TOAST ----------
let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2500);
}

// ---------- THEME ----------
function initTheme() {
  const saved = localStorage.getItem("mh_theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  document.getElementById("themeToggle").textContent = saved === "dark" ? "☀️" : "🌙";
  document.getElementById("darkModeToggle").checked = saved === "dark";
}
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("mh_theme", next);
  document.getElementById("themeToggle").textContent = next === "dark" ? "☀️" : "🌙";
  document.getElementById("darkModeToggle").checked = next === "dark";
  renderDashboardCharts(); // re-theme charts
}

// ---------- NAVIGATION ----------
const PAGE_TITLES = {
  dashboard: "Dashboard", leads: "Leads", bookings: "Bookings",
  venues: "Venues", content: "Content & Testimonials", reports: "Reports", settings: "Settings"
};

function navigateTo(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(`page-${page}`).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.page === page));
  document.getElementById("pageTitle").textContent = PAGE_TITLES[page];
  document.getElementById("fabBtn").style.display = ["leads", "bookings", "venues"].includes(page) ? "flex" : "none";
  state.currentPage = page;
  refreshPage(page);
}

async function refreshPage(page) {
  switch (page) {
    case "dashboard": await loadDashboard(); break;
    case "leads": await loadLeads(); break;
    case "bookings": await loadBookings(); break;
    case "venues": await loadVenues(); break;
    case "content": await loadContent(); break;
    case "reports": await loadReports(); break;
  }
}

// ---------- MODALS ----------
function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

// ---------- FORMAT HELPERS ----------
function money(n) { return "RM" + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
function fmtDate(d) {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date)) return d;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function statusBadgeClass(status) {
  const map = {
    "New Inquiry": "badge-new", "Availability Checked": "badge-checked", "Quote Sent": "badge-quote",
    "Deposit Pending": "badge-deposit", "Confirmed": "badge-confirmed", "Lost": "badge-lost", "Unavailable": "badge-unavailable",
    "Pending": "badge-pending", "Partial": "badge-partial", "Paid": "badge-paid"
  };
  return map[status] || "badge-unavailable";
}
function waLink(number, name) {
  if (!number) return "";
  const clean = String(number).replace(/[^0-9]/g, "");
  const msg = encodeURIComponent(`Hi ${name || ""}, this is Music by Hafiz! `);
  return `<a class="wa-link" href="https://wa.me/${clean}?text=${msg}" target="_blank">💬 WhatsApp</a>`;
}
function telLink(number) {
  if (!number) return "";
  return `<a class="wa-link" style="color:var(--primary)" href="tel:${number}">📞 Call</a>`;
}

// ---------- POPULATE SELECT OPTIONS ----------
function populateSelect(id, options, includeBlank = false) {
  const sel = document.getElementById(id);
  sel.innerHTML = "";
  if (includeBlank) sel.appendChild(new Option("-- Select --", ""));
  options.forEach(o => sel.appendChild(new Option(o, o)));
}

function populateAllSelects() {
  if (!state.meta) return;
  populateSelect("lead-LeadSource", state.meta.leadSources, true);
  populateSelect("lead-Instrument", state.meta.instruments, true);
  populateSelect("lead-Package", state.meta.packages, true);
  populateSelect("lead-Status", state.meta.leadStatuses);
  populateSelect("lead-LostReason", state.meta.lostReasons, true);
  populateSelect("booking-Package", state.meta.packages, true);
  populateSelect("booking-PaymentStatus", state.meta.paymentStatuses);
  populateSelect("convert-PaymentStatus", state.meta.paymentStatuses);
}

// ===========================================================
// DASHBOARD
// ===========================================================
let charts = {};
async function loadDashboard() {
  try {
    state.dashboard = await api("getDashboard");
  } catch (e) { return; }
  const c = state.dashboard.cards;
  document.getElementById("stat-newEnquiries").textContent = c.newEnquiries;
  document.getElementById("stat-quotesSent").textContent = c.quotesSent;
  document.getElementById("stat-depositPending").textContent = c.depositPending;
  document.getElementById("stat-confirmedBookings").textContent = c.confirmedBookings;
  document.getElementById("stat-upcomingEvents").textContent = c.upcomingEvents;
  document.getElementById("stat-revenueMonth").textContent = money(c.revenueMonth);
  document.getElementById("stat-revenueYear").textContent = money(c.revenueYear);
  document.getElementById("stat-mostPopularPackage").textContent = c.mostPopularPackage;
  document.getElementById("stat-bestLeadSource").textContent = c.bestLeadSource;

  // follow up alerts
  const alertsEl = document.getElementById("followUpAlerts");
  if (state.dashboard.followUps && state.dashboard.followUps.length) {
    alertsEl.innerHTML = state.dashboard.followUps.map(f =>
      `<div class="alert-banner">⏰ <b>${f.ClientName}</b> (${f.LeadID}) — ${f.reason}</div>`
    ).join("");
  } else {
    alertsEl.innerHTML = "";
  }

  renderDashboardCharts();
}

function chartColors() {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  return {
    grid: dark ? "#2e3042" : "#e5e7eb",
    text: dark ? "#9ca3af" : "#6b7280",
    primary: "#6d28d9",
    accent: "#fbbf24",
    palette: ["#6d28d9", "#fbbf24", "#16a34a", "#dc2626", "#0ea5e9", "#ec4899", "#f97316", "#84cc16"]
  };
}

function renderDashboardCharts() {
  if (!state.dashboard) return;
  const colors = chartColors();
  const ch = state.dashboard.charts;
  const commonOpts = {
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: colors.text }, grid: { color: colors.grid } },
      y: { ticks: { color: colors.text }, grid: { color: colors.grid }, beginAtZero: true }
    }
  };

  destroyChart("chartEnquiries");
  charts.chartEnquiries = new Chart(document.getElementById("chartEnquiries"), {
    type: "bar",
    data: { labels: ch.enquiriesByMonth.map(m => m.month.slice(5)), datasets: [{ data: ch.enquiriesByMonth.map(m => m.count), backgroundColor: colors.primary, borderRadius: 4 }] },
    options: commonOpts
  });

  destroyChart("chartBookings");
  charts.chartBookings = new Chart(document.getElementById("chartBookings"), {
    type: "bar",
    data: { labels: ch.bookingsByMonth.map(m => m.month.slice(5)), datasets: [{ data: ch.bookingsByMonth.map(m => m.count), backgroundColor: colors.accent, borderRadius: 4 }] },
    options: commonOpts
  });

  destroyChart("chartRevenue");
  charts.chartRevenue = new Chart(document.getElementById("chartRevenue"), {
    type: "line",
    data: { labels: ch.revenueByMonth.map(m => m.month.slice(5)), datasets: [{ data: ch.revenueByMonth.map(m => m.total), borderColor: colors.primary, backgroundColor: "rgba(109,40,217,0.15)", fill: true, tension: 0.3 }] },
    options: commonOpts
  });

  destroyChart("chartLeadSource");
  const lsLabels = Object.keys(ch.leadSourceBreakdown);
  charts.chartLeadSource = new Chart(document.getElementById("chartLeadSource"), {
    type: "doughnut",
    data: { labels: lsLabels, datasets: [{ data: lsLabels.map(l => ch.leadSourceBreakdown[l]), backgroundColor: colors.palette }] },
    options: { plugins: { legend: { position: "bottom", labels: { color: colors.text, boxWidth: 12, font: { size: 10 } } } } }
  });

  destroyChart("chartPackage");
  const pkgLabels = Object.keys(ch.packageBreakdown);
  charts.chartPackage = new Chart(document.getElementById("chartPackage"), {
    type: "doughnut",
    data: { labels: pkgLabels, datasets: [{ data: pkgLabels.map(l => ch.packageBreakdown[l]), backgroundColor: colors.palette }] },
    options: { plugins: { legend: { position: "bottom", labels: { color: colors.text, boxWidth: 12, font: { size: 10 } } } } }
  });
}
function destroyChart(id) { if (charts[id]) { charts[id].destroy(); charts[id] = null; } }

// ===========================================================
// LEADS
// ===========================================================
async function loadLeads() {
  try {
    state.leads = await api("getLeads");
  } catch (e) { return; }
  renderLeadStatusTabs();
  renderLeads();
}

function renderLeadStatusTabs() {
  const tabsEl = document.getElementById("leadStatusTabs");
  const statuses = ["all", "New Inquiry", "Availability Checked", "Quote Sent", "Deposit Pending", "Confirmed", "Lost", "Unavailable"];
  tabsEl.innerHTML = statuses.map(s =>
    `<button class="tab-btn ${state.leadFilter === s ? "active" : ""}" data-leadfilter="${s}">${s === "all" ? "All" : s}</button>`
  ).join("");
  tabsEl.querySelectorAll("[data-leadfilter]").forEach(btn => {
    btn.addEventListener("click", () => { state.leadFilter = btn.dataset.leadfilter; renderLeadStatusTabs(); renderLeads(); });
  });
}

function renderLeads() {
  const search = (document.getElementById("leadSearch").value || "").toLowerCase();
  let leads = state.leads.filter(l => !l.Archived);
  if (state.leadFilter !== "all") leads = leads.filter(l => l.Status === state.leadFilter);
  if (search) {
    leads = leads.filter(l =>
      (l.ClientName || "").toLowerCase().includes(search) ||
      (l.Phone || "").toLowerCase().includes(search) ||
      (l.Venue || "").toLowerCase().includes(search) ||
      (l.LeadID || "").toLowerCase().includes(search)
    );
  }
  // sort newest inquiry first
  leads = leads.slice().sort((a, b) => new Date(b.InquiryDate || 0) - new Date(a.InquiryDate || 0));

  const listEl = document.getElementById("leadsList");
  if (!leads.length) {
    listEl.innerHTML = `<div class="empty-state"><div class="emoji">📭</div>No leads found.</div>`;
    return;
  }
  listEl.innerHTML = leads.map(l => `
    <div class="list-item">
      <div class="row1">
        <span class="name">${escapeHtml(l.ClientName)}</span>
        <span class="badge ${statusBadgeClass(l.Status)}">${l.Status}</span>
      </div>
      <div class="meta">🆔 ${l.LeadID} &nbsp; 🎤 ${l.EventType || "-"} ${l.Venue ? "@ " + escapeHtml(l.Venue) : ""}</div>
      <div class="meta">📅 Event: ${fmtDate(l.EventDate)} &nbsp; 📩 Enquired: ${fmtDate(l.InquiryDate)}</div>
      <div class="meta">🎵 ${l.Package || "-"} · ${l.Instrument || "-"} &nbsp; 💰 ${money(l.QuoteValue)}</div>
      <div class="meta">📍 Source: ${l.LeadSource || "-"}</div>
      ${l.Status === "Lost" && l.LostReason ? `<div class="meta">❌ Lost reason: ${l.LostReason}</div>` : ""}
      ${l.Notes ? `<div class="meta">📝 ${escapeHtml(l.Notes)}</div>` : ""}
      <div class="actions">
        ${waLink(l.WhatsApp || l.Phone, l.ClientName)}
        ${telLink(l.Phone)}
        <button class="btn small secondary" data-edit-lead="${l.LeadID}">Edit</button>
        ${l.Status !== "Confirmed" && l.Status !== "Lost" ? `<button class="btn small success" data-convert-lead="${l.LeadID}">Convert</button>` : ""}
        <button class="btn small danger" data-archive-lead="${l.LeadID}">Archive</button>
      </div>
    </div>
  `).join("");

  listEl.querySelectorAll("[data-edit-lead]").forEach(b => b.addEventListener("click", () => openLeadModal(b.dataset.editLead)));
  listEl.querySelectorAll("[data-convert-lead]").forEach(b => b.addEventListener("click", () => openConvertModal(b.dataset.convertLead)));
  listEl.querySelectorAll("[data-archive-lead]").forEach(b => b.addEventListener("click", () => archiveLead(b.dataset.archiveLead)));
}

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function openLeadModal(leadId) {
  document.getElementById("leadForm").reset();
  populateAllSelects();
  document.getElementById("lostReasonGroup").style.display = "none";
  if (leadId) {
    const l = state.leads.find(x => x.LeadID === leadId);
    document.getElementById("leadModalTitle").textContent = "Edit Lead";
    document.getElementById("lead-LeadID").value = l.LeadID;
    document.getElementById("lead-ClientName").value = l.ClientName || "";
    document.getElementById("lead-Phone").value = l.Phone || "";
    document.getElementById("lead-WhatsApp").value = l.WhatsApp || "";
    document.getElementById("lead-InquiryDate").value = l.InquiryDate || "";
    document.getElementById("lead-EventDate").value = l.EventDate || "";
    document.getElementById("lead-EventType").value = l.EventType || "";
    document.getElementById("lead-Venue").value = l.Venue || "";
    document.getElementById("lead-LeadSource").value = l.LeadSource || "";
    document.getElementById("lead-Instrument").value = l.Instrument || "";
    document.getElementById("lead-Package").value = l.Package || "";
    document.getElementById("lead-QuoteValue").value = l.QuoteValue || "";
    document.getElementById("lead-Status").value = l.Status || "New Inquiry";
    document.getElementById("lead-LostReason").value = l.LostReason || "";
    document.getElementById("lead-Notes").value = l.Notes || "";
    if (l.Status === "Lost") document.getElementById("lostReasonGroup").style.display = "block";
  } else {
    document.getElementById("leadModalTitle").textContent = "Add Lead";
    document.getElementById("lead-LeadID").value = "";
    document.getElementById("lead-InquiryDate").value = new Date().toISOString().slice(0, 10);
    document.getElementById("lead-Status").value = "New Inquiry";
  }
  openModal("leadModal");
}

document.getElementById("lead-Status").addEventListener("change", (e) => {
  document.getElementById("lostReasonGroup").style.display = e.target.value === "Lost" ? "block" : "none";
});

document.getElementById("leadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("lead-LeadID").value;
  const record = {
    ClientName: document.getElementById("lead-ClientName").value,
    Phone: document.getElementById("lead-Phone").value,
    WhatsApp: document.getElementById("lead-WhatsApp").value,
    InquiryDate: document.getElementById("lead-InquiryDate").value,
    EventDate: document.getElementById("lead-EventDate").value,
    EventType: document.getElementById("lead-EventType").value,
    Venue: document.getElementById("lead-Venue").value,
    LeadSource: document.getElementById("lead-LeadSource").value,
    Instrument: document.getElementById("lead-Instrument").value,
    Package: document.getElementById("lead-Package").value,
    QuoteValue: document.getElementById("lead-QuoteValue").value,
    Status: document.getElementById("lead-Status").value,
    LostReason: document.getElementById("lead-LostReason").value,
    Notes: document.getElementById("lead-Notes").value
  };
  try {
    if (id) {
      await api("updateLead", { id, record }, "POST");
      toast("Lead updated");
    } else {
      await api("addLead", { record }, "POST");
      toast("Lead added");
    }
    closeModal("leadModal");
    await loadLeads();
    await loadDashboard();
  } catch (err) {}
});

async function archiveLead(leadId) {
  if (!confirm("Archive this lead? It will be hidden from the active list.")) return;
  await api("updateLead", { id: leadId, record: { Archived: true } }, "POST");
  toast("Lead archived");
  await loadLeads();
}

function openConvertModal(leadId) {
  const l = state.leads.find(x => x.LeadID === leadId);
  document.getElementById("convertForm").reset();
  populateSelect("convert-PaymentStatus", state.meta.paymentStatuses);
  document.getElementById("convert-LeadID").value = leadId;
  document.getElementById("convert-FinalPrice").value = l.QuoteValue || "";
  document.getElementById("convert-DepositPaid").value = 0;
  document.getElementById("convert-PaymentStatus").value = "Pending";
  openModal("convertModal");
}

document.getElementById("convertForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const leadId = document.getElementById("convert-LeadID").value;
  const record = {
    FinalPrice: document.getElementById("convert-FinalPrice").value,
    DepositPaid: document.getElementById("convert-DepositPaid").value,
    PaymentStatus: document.getElementById("convert-PaymentStatus").value,
    RehearsalRequired: document.getElementById("convert-RehearsalRequired").checked,
    RehearsalDate: document.getElementById("convert-RehearsalDate").value
  };
  try {
    await api("convertLeadToBooking", { id: leadId, record }, "POST");
    toast("Lead converted to booking!");
    closeModal("convertModal");
    await loadLeads();
    await loadDashboard();
  } catch (err) {}
});

// ===========================================================
// BOOKINGS
// ===========================================================
async function loadBookings() {
  try {
    state.bookings = await api("getBookings");
  } catch (e) { return; }
  renderBookings();
  if (state.bookingView === "calendar") renderCalendar();
}

function renderBookings() {
  const search = (document.getElementById("bookingSearch").value || "").toLowerCase();
  let bookings = state.bookings.slice();
  if (search) {
    bookings = bookings.filter(b =>
      (b.ClientName || "").toLowerCase().includes(search) ||
      (b.Venue || "").toLowerCase().includes(search) ||
      (b.BookingID || "").toLowerCase().includes(search)
    );
  }
  bookings.sort((a, b) => new Date(a.EventDate || 0) - new Date(b.EventDate || 0));

  const listEl = document.getElementById("bookingsList");
  if (!bookings.length) {
    listEl.innerHTML = `<div class="empty-state"><div class="emoji">📭</div>No bookings yet.</div>`;
    return;
  }
  listEl.innerHTML = bookings.map(b => `
    <div class="list-item">
      <div class="row1">
        <span class="name">${escapeHtml(b.ClientName)}</span>
        <span class="badge ${statusBadgeClass(b.PaymentStatus)}">${b.PaymentStatus}</span>
      </div>
      <div class="meta">🆔 ${b.BookingID} &nbsp; ${b.Completed ? "✅ Completed" : "🔜 Upcoming"}</div>
      <div class="meta">📅 ${fmtDate(b.EventDate)} &nbsp; 📍 ${escapeHtml(b.Venue || "-")}</div>
      <div class="meta">🎵 ${b.Package || "-"}</div>
      <div class="meta">💰 Final: ${money(b.FinalPrice)} · Deposit: ${money(b.DepositPaid)} · Balance: ${money(b.BalanceDue)}</div>
      ${b.RehearsalRequired ? `<div class="meta">🎼 Rehearsal: ${fmtDate(b.RehearsalDate)}</div>` : ""}
      ${b.SongRequests ? `<div class="meta">🎶 Songs: ${escapeHtml(b.SongRequests)}</div>` : ""}
      ${b.SpecialNotes ? `<div class="meta">📝 ${escapeHtml(b.SpecialNotes)}</div>` : ""}
      <div class="actions">
        ${waLink(b.WhatsApp || b.Phone, b.ClientName)}
        ${telLink(b.Phone)}
        <button class="btn small secondary" data-edit-booking="${b.BookingID}">Edit</button>
        ${!b.Completed ? `<button class="btn small success" data-complete-booking="${b.BookingID}">Mark Completed</button>` : ""}
      </div>
    </div>
  `).join("");

  listEl.querySelectorAll("[data-edit-booking]").forEach(btn => btn.addEventListener("click", () => openBookingModal(btn.dataset.editBooking)));
  listEl.querySelectorAll("[data-complete-booking]").forEach(btn => btn.addEventListener("click", () => completeBooking(btn.dataset.completeBooking)));
}

function openBookingModal(bookingId) {
  document.getElementById("bookingForm").reset();
  populateSelect("booking-Package", state.meta.packages, true);
  populateSelect("booking-PaymentStatus", state.meta.paymentStatuses);
  if (bookingId) {
    const b = state.bookings.find(x => x.BookingID === bookingId);
    document.getElementById("bookingModalTitle").textContent = "Edit Booking";
    document.getElementById("booking-BookingID").value = b.BookingID;
    document.getElementById("booking-LeadID").value = b.LeadID || "";
    document.getElementById("booking-ClientName").value = b.ClientName || "";
    document.getElementById("booking-Phone").value = b.Phone || "";
    document.getElementById("booking-WhatsApp").value = b.WhatsApp || "";
    document.getElementById("booking-EventDate").value = b.EventDate || "";
    document.getElementById("booking-Venue").value = b.Venue || "";
    document.getElementById("booking-Package").value = b.Package || "";
    document.getElementById("booking-FinalPrice").value = b.FinalPrice || "";
    document.getElementById("booking-DepositPaid").value = b.DepositPaid || "";
    document.getElementById("booking-PaymentStatus").value = b.PaymentStatus || "Pending";
    document.getElementById("booking-RehearsalRequired").checked = !!b.RehearsalRequired;
    document.getElementById("booking-RehearsalDate").value = b.RehearsalDate || "";
    document.getElementById("booking-SongRequests").value = b.SongRequests || "";
    document.getElementById("booking-SpecialNotes").value = b.SpecialNotes || "";
  } else {
    document.getElementById("bookingModalTitle").textContent = "Add Booking";
    document.getElementById("booking-BookingID").value = "";
    document.getElementById("booking-PaymentStatus").value = "Pending";
  }
  openModal("bookingModal");
}

document.getElementById("bookingForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("booking-BookingID").value;
  const finalPrice = parseFloat(document.getElementById("booking-FinalPrice").value) || 0;
  const deposit = parseFloat(document.getElementById("booking-DepositPaid").value) || 0;
  const record = {
    LeadID: document.getElementById("booking-LeadID").value,
    ClientName: document.getElementById("booking-ClientName").value,
    Phone: document.getElementById("booking-Phone").value,
    WhatsApp: document.getElementById("booking-WhatsApp").value,
    EventDate: document.getElementById("booking-EventDate").value,
    Venue: document.getElementById("booking-Venue").value,
    Package: document.getElementById("booking-Package").value,
    FinalPrice: finalPrice,
    DepositPaid: deposit,
    BalanceDue: finalPrice - deposit,
    PaymentStatus: document.getElementById("booking-PaymentStatus").value,
    RehearsalRequired: document.getElementById("booking-RehearsalRequired").checked,
    RehearsalDate: document.getElementById("booking-RehearsalDate").value,
    SongRequests: document.getElementById("booking-SongRequests").value,
    SpecialNotes: document.getElementById("booking-SpecialNotes").value
  };
  try {
    if (id) {
      await api("updateBooking", { id, record }, "POST");
      toast("Booking updated");
    } else {
      await api("addBooking", { record }, "POST");
      toast("Booking added");
      await ensureVenueTracked(record.Venue);
    }
    closeModal("bookingModal");
    await loadBookings();
    await loadDashboard();
  } catch (err) {}
});

async function ensureVenueTracked(venueName) {
  if (!venueName) return;
  const venues = await api("getVenues");
  if (!venues.find(v => v.VenueName === venueName)) {
    try { await api("addVenue", { record: { VenueName: venueName } }, "POST"); } catch (e) {}
  }
}

async function completeBooking(bookingId) {
  if (!confirm("Mark this booking as completed? This will add it to the Content tracker.")) return;
  await api("markBookingCompleted", { id: bookingId }, "POST");
  toast("Booking marked completed");
  await loadBookings();
  await loadDashboard();
}

// ----- Calendar view -----
document.querySelectorAll("[data-bview]").forEach(btn => {
  btn.addEventListener("click", () => {
    state.bookingView = btn.dataset.bview;
    document.querySelectorAll("[data-bview]").forEach(b => b.classList.toggle("active", b === btn));
    document.getElementById("bookingListView").style.display = state.bookingView === "list" ? "flex" : "none";
    document.getElementById("bookingsList").style.display = state.bookingView === "list" ? "block" : "none";
    document.getElementById("bookingCalendarView").style.display = state.bookingView === "calendar" ? "block" : "none";
    if (state.bookingView === "calendar") renderCalendar();
  });
});

document.getElementById("calPrev").addEventListener("click", () => {
  state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
  renderCalendar();
});
document.getElementById("calNext").addEventListener("click", () => {
  state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
  renderCalendar();
});

function renderCalendar() {
  const date = state.calendarDate;
  const year = date.getFullYear(), month = date.getMonth();
  document.getElementById("calLabel").textContent = date.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const eventsByDay = {};
  state.bookings.forEach(b => {
    if (!b.EventDate) return;
    const d = new Date(b.EventDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      (eventsByDay[day] = eventsByDay[day] || []).push(b);
    }
  });

  const dayNames = ["S", "M", "T", "W", "T", "F", "S"];
  let html = dayNames.map(d => `<div class="day-name">${d}</div>`).join("");
  for (let i = 0; i < startOffset; i++) html += `<div class="day-cell empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const hasEvent = eventsByDay[d];
    html += `<div class="day-cell ${hasEvent ? "has-event" : ""}" data-day="${d}">${d}${hasEvent ? "<br>•" : ""}</div>`;
  }
  document.getElementById("calendarGrid").innerHTML = html;

  document.querySelectorAll("#calendarGrid .day-cell[data-day]").forEach(cell => {
    cell.addEventListener("click", () => {
      const day = parseInt(cell.dataset.day, 10);
      const events = eventsByDay[day] || [];
      const listEl = document.getElementById("calendarEventList");
      if (!events.length) { listEl.innerHTML = ""; return; }
      listEl.innerHTML = `<div class="section-title">Events on ${fmtDate(new Date(year, month, day))}</div>` + events.map(b => `
        <div class="list-item">
          <div class="row1"><span class="name">${escapeHtml(b.ClientName)}</span><span class="badge ${statusBadgeClass(b.PaymentStatus)}">${b.PaymentStatus}</span></div>
          <div class="meta">📍 ${escapeHtml(b.Venue || "-")} &nbsp; 🎵 ${b.Package || "-"}</div>
          <div class="actions"><button class="btn small secondary" data-edit-booking="${b.BookingID}">Edit</button></div>
        </div>
      `).join("");
      listEl.querySelectorAll("[data-edit-booking]").forEach(btn => btn.addEventListener("click", () => openBookingModal(btn.dataset.editBooking)));
    });
  });
}

// ===========================================================
// VENUES
// ===========================================================
async function loadVenues() {
  try {
    state.venues = await api("getVenues");
  } catch (e) { return; }
  renderVenues();
}

function renderVenues() {
  const search = (document.getElementById("venueSearch").value || "").toLowerCase();
  let venues = state.venues.slice();
  if (search) venues = venues.filter(v => (v.VenueName || "").toLowerCase().includes(search));

  const listEl = document.getElementById("venuesList");
  if (!venues.length) {
    listEl.innerHTML = `<div class="empty-state"><div class="emoji">📍</div>No venues yet.</div>`;
    return;
  }

  // top venues banner
  const top = venues.slice(0, 3).filter(v => v.BookingCount > 0);
  const topHtml = top.length ? `<div class="card"><div class="section-title" style="margin-top:0;">🏆 Top Venues</div>${top.map((v, i) => `<div class="meta">${i + 1}. ${escapeHtml(v.VenueName)} — ${v.BookingCount} booking(s)</div>`).join("")}</div>` : "";

  listEl.innerHTML = topHtml + venues.map(v => `
    <div class="list-item">
      <div class="row1">
        <span class="name">${escapeHtml(v.VenueName)}</span>
        <span class="badge badge-confirmed">${v.BookingCount || 0}× booked</span>
      </div>
      ${v.ContactPerson ? `<div class="meta">👤 ${escapeHtml(v.ContactPerson)} ${v.ContactNumber ? "· " + v.ContactNumber : ""}</div>` : ""}
      ${v.ParkingNotes ? `<div class="meta">🚗 Parking: ${escapeHtml(v.ParkingNotes)}</div>` : ""}
      ${v.SetupNotes ? `<div class="meta">🛠️ Setup: ${escapeHtml(v.SetupNotes)}</div>` : ""}
      ${v.PowerAvailability ? `<div class="meta">🔌 Power: ${escapeHtml(v.PowerAvailability)}</div>` : ""}
      <div class="actions">
        ${v.ContactNumber ? telLink(v.ContactNumber) : ""}
        <button class="btn small secondary" data-edit-venue="${escapeHtml(v.VenueName)}">Edit</button>
        ${v.BookingHistory && v.BookingHistory.length ? `<button class="btn small secondary" data-history-venue="${escapeHtml(v.VenueName)}">History (${v.BookingHistory.length})</button>` : ""}
      </div>
      <div class="venue-history" id="history-${cssId(v.VenueName)}" style="display:none; margin-top:8px;"></div>
    </div>
  `).join("");

  listEl.querySelectorAll("[data-edit-venue]").forEach(btn => btn.addEventListener("click", () => openVenueModal(btn.dataset.editVenue)));
  listEl.querySelectorAll("[data-history-venue]").forEach(btn => btn.addEventListener("click", () => toggleVenueHistory(btn.dataset.historyVenue)));
}

function cssId(str) { return String(str).replace(/[^a-zA-Z0-9]/g, "_"); }

function toggleVenueHistory(venueName) {
  const v = state.venues.find(x => x.VenueName === venueName);
  const el = document.getElementById("history-" + cssId(venueName));
  if (el.style.display === "none") {
    el.innerHTML = (v.BookingHistory || []).map(h => `<div class="meta">• ${fmtDate(h.EventDate)} — ${escapeHtml(h.ClientName)} (${h.Package}) ${h.Completed ? "✅" : ""}</div>`).join("");
    el.style.display = "block";
  } else {
    el.style.display = "none";
  }
}

function openVenueModal(venueName) {
  document.getElementById("venueForm").reset();
  if (venueName) {
    const v = state.venues.find(x => x.VenueName === venueName);
    document.getElementById("venueModalTitle").textContent = "Edit Venue";
    document.getElementById("venue-OriginalName").value = v.VenueName;
    document.getElementById("venue-VenueName").value = v.VenueName || "";
    document.getElementById("venue-ParkingNotes").value = v.ParkingNotes || "";
    document.getElementById("venue-SetupNotes").value = v.SetupNotes || "";
    document.getElementById("venue-PowerAvailability").value = v.PowerAvailability || "";
    document.getElementById("venue-ContactPerson").value = v.ContactPerson || "";
    document.getElementById("venue-ContactNumber").value = v.ContactNumber || "";
  } else {
    document.getElementById("venueModalTitle").textContent = "Add Venue";
    document.getElementById("venue-OriginalName").value = "";
  }
  openModal("venueModal");
}

document.getElementById("venueForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const originalName = document.getElementById("venue-OriginalName").value;
  const record = {
    VenueName: document.getElementById("venue-VenueName").value,
    ParkingNotes: document.getElementById("venue-ParkingNotes").value,
    SetupNotes: document.getElementById("venue-SetupNotes").value,
    PowerAvailability: document.getElementById("venue-PowerAvailability").value,
    ContactPerson: document.getElementById("venue-ContactPerson").value,
    ContactNumber: document.getElementById("venue-ContactNumber").value
  };
  try {
    if (originalName) {
      await api("updateVenue", { name: originalName, record }, "POST");
      toast("Venue updated");
    } else {
      await api("addVenue", { record }, "POST");
      toast("Venue added");
    }
    closeModal("venueModal");
    await loadVenues();
  } catch (err) {}
});

// ===========================================================
// CONTENT & TESTIMONIALS
// ===========================================================
async function loadContent() {
  try {
    state.content = await api("getContent");
  } catch (e) { return; }
  renderContent();
}

document.querySelectorAll("[data-cfilter]").forEach(btn => {
  btn.addEventListener("click", () => {
    state.contentFilter = btn.dataset.cfilter;
    document.querySelectorAll("[data-cfilter]").forEach(b => b.classList.toggle("active", b === btn));
    renderContent();
  });
});

function renderContent() {
  let items = state.content.slice();
  if (state.contentFilter === "unposted") items = items.filter(c => !c.TikTokPosted || !c.InstagramPosted);
  if (state.contentFilter === "testimonial") items = items.filter(c => !c.TestimonialReceived);
  items.sort((a, b) => new Date(b.EventDate || 0) - new Date(a.EventDate || 0));

  const listEl = document.getElementById("contentList");
  if (!items.length) {
    listEl.innerHTML = `<div class="empty-state"><div class="emoji">🎬</div>No content items yet. Complete a booking to add one.</div>`;
    return;
  }
  listEl.innerHTML = items.map(c => `
    <div class="list-item">
      <div class="row1"><span class="name">${escapeHtml(c.ClientName)}</span><span class="meta">${fmtDate(c.EventDate)}</span></div>
      <div class="meta">📍 ${escapeHtml(c.Venue || "-")} &nbsp; 🆔 ${c.BookingID}</div>
      <div class="meta">
        ${c.PhotosAvailable ? "📸 Photos ✅" : "📸 Photos ❌"} ·
        ${c.VideosAvailable ? "🎥 Videos ✅" : "🎥 Videos ❌"}
      </div>
      <div class="meta">
        ${c.TikTokPosted ? "🎵 TikTok ✅" : "🎵 TikTok ❌"} ·
        ${c.InstagramPosted ? "📷 Instagram ✅" : "📷 Instagram ❌"}
      </div>
      <div class="meta">${c.TestimonialReceived ? "⭐ Testimonial received" : "⏳ Awaiting testimonial"}</div>
      ${c.TestimonialText ? `<div class="meta">💬 "${escapeHtml(c.TestimonialText)}"</div>` : ""}
      <div class="actions"><button class="btn small secondary" data-edit-content="${c.BookingID}">Update</button></div>
    </div>
  `).join("");

  listEl.querySelectorAll("[data-edit-content]").forEach(btn => btn.addEventListener("click", () => openContentModal(btn.dataset.editContent)));
}

function openContentModal(bookingId) {
  const c = state.content.find(x => x.BookingID === bookingId);
  document.getElementById("content-BookingID").value = bookingId;
  document.getElementById("content-PhotosAvailable").checked = !!(c && c.PhotosAvailable);
  document.getElementById("content-VideosAvailable").checked = !!(c && c.VideosAvailable);
  document.getElementById("content-TikTokPosted").checked = !!(c && c.TikTokPosted);
  document.getElementById("content-InstagramPosted").checked = !!(c && c.InstagramPosted);
  document.getElementById("content-TestimonialReceived").checked = !!(c && c.TestimonialReceived);
  document.getElementById("content-TestimonialText").value = (c && c.TestimonialText) || "";
  openModal("contentModal");
}

document.getElementById("contentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const bookingId = document.getElementById("content-BookingID").value;
  const record = {
    PhotosAvailable: document.getElementById("content-PhotosAvailable").checked,
    VideosAvailable: document.getElementById("content-VideosAvailable").checked,
    TikTokPosted: document.getElementById("content-TikTokPosted").checked,
    InstagramPosted: document.getElementById("content-InstagramPosted").checked,
    TestimonialReceived: document.getElementById("content-TestimonialReceived").checked,
    TestimonialText: document.getElementById("content-TestimonialText").value
  };
  try {
    await api("updateContent", { bookingId, record }, "POST");
    toast("Content updated");
    closeModal("contentModal");
    await loadContent();
  } catch (err) {}
});

// ===========================================================
// REPORTS
// ===========================================================
async function loadReports() {
  try {
    state.reports = await api("getReports");
  } catch (e) { return; }
  renderReport(state.currentReport || "conversion");
}

document.querySelectorAll("[data-report]").forEach(btn => {
  btn.addEventListener("click", () => {
    state.currentReport = btn.dataset.report;
    document.querySelectorAll("[data-report]").forEach(b => b.classList.toggle("active", b === btn));
    renderReport(state.currentReport);
  });
});

function renderReport(type) {
  const el = document.getElementById("reportContent");
  const r = state.reports;
  if (!r) { el.innerHTML = ""; return; }

  if (type === "conversion") {
    const cr = r.conversionRate;
    el.innerHTML = `
      <div class="card">
        <div class="section-title" style="margin-top:0;">Conversion Rate</div>
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-label">Total Leads</div><div class="stat-value">${cr.totalLeads}</div></div>
          <div class="stat-card"><div class="stat-label">Confirmed</div><div class="stat-value">${cr.confirmed}</div></div>
        </div>
        <div class="stat-card" style="margin-top:10px;"><div class="stat-label">Conversion Rate</div><div class="stat-value">${cr.rate.toFixed(1)}%</div></div>
      </div>`;
  } else if (type === "leadsource") {
    const ls = r.leadSourceReport;
    el.innerHTML = `<div class="card"><div class="section-title" style="margin-top:0;">Lead Source Report</div>` +
      Object.keys(ls).map(src => `
        <div class="list-item">
          <div class="row1"><span class="name">${src}</span><span class="badge badge-confirmed">${ls[src].total} total</span></div>
          <div class="meta">✅ Confirmed: ${ls[src].confirmed} &nbsp; ❌ Lost: ${ls[src].lost}</div>
        </div>
      `).join("") + `</div>`;
  } else if (type === "revenue") {
    const rev = r.revenueReport;
    const section = (title, obj) => `
      <div class="card"><div class="section-title" style="margin-top:0;">${title}</div>${
        Object.keys(obj).sort().map(k => `<div class="list-item"><div class="row1"><span class="name">${k}</span><span class="badge badge-confirmed">${money(obj[k])}</span></div></div>`).join("") || `<div class="empty-state">No data yet.</div>`
      }</div>`;
    el.innerHTML = section("Monthly Revenue", rev.monthly) + section("Quarterly Revenue", rev.quarterly) + section("Yearly Revenue", rev.yearly);
  } else if (type === "packages") {
    const pp = r.packagePerformance;
    el.innerHTML = `<div class="card"><div class="section-title" style="margin-top:0;">Package Performance</div>` +
      Object.keys(pp).map(pkg => `
        <div class="list-item">
          <div class="row1"><span class="name">${pkg}</span></div>
          <div class="meta">👤 Leads interested: ${pp[pkg].leadsInterested}</div>
          <div class="meta">📅 Bookings: ${pp[pkg].bookings}</div>
          <div class="meta">💰 Revenue: ${money(pp[pkg].revenue)}</div>
        </div>
      `).join("") + `</div>`;
  } else if (type === "lost") {
    const la = r.lostLeadsAnalysis;
    el.innerHTML = `<div class="card"><div class="section-title" style="margin-top:0;">Lost Leads Analysis</div>` +
      Object.keys(la).map(reason => `<div class="list-item"><div class="row1"><span class="name">${reason}</span><span class="badge badge-lost">${la[reason]}</span></div></div>`).join("") + `</div>`;
  }
}

// ===========================================================
// SETTINGS
// ===========================================================
function initSettings() {
  document.getElementById("settingsApiUrl").value = API_URL.indexOf("PASTE_") === 0 ? "" : API_URL;
  document.getElementById("settingsApiKey").value = API_KEY;
}

document.getElementById("saveSettingsBtn").addEventListener("click", () => {
  const url = document.getElementById("settingsApiUrl").value.trim();
  const key = document.getElementById("settingsApiKey").value.trim();
  if (!url) { toast("Please enter the Apps Script Web App URL"); return; }
  localStorage.setItem("mh_api_url", url);
  localStorage.setItem("mh_api_key", key);
  API_URL = url;
  API_KEY = key;
  toast("Settings saved!");
  initApp();
});

document.getElementById("darkModeToggle").addEventListener("change", toggleTheme);

document.querySelectorAll("[data-export]").forEach(btn => {
  btn.addEventListener("click", async () => {
    const sheet = btn.dataset.export;
    try {
      const data = await api("exportCsv", { sheet }, "GET");
      downloadCsv(data.csv, data.filename);
    } catch (err) {}
  });
});

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ===========================================================
// FAB (Floating Add Button)
// ===========================================================
document.getElementById("fabBtn").addEventListener("click", () => {
  switch (state.currentPage) {
    case "leads": openLeadModal(null); break;
    case "bookings": openBookingModal(null); break;
    case "venues": openVenueModal(null); break;
  }
});

// ===========================================================
// SEARCH LISTENERS
// ===========================================================
document.getElementById("leadSearch").addEventListener("input", renderLeads);
document.getElementById("bookingSearch").addEventListener("input", renderBookings);
document.getElementById("venueSearch").addEventListener("input", renderVenues);

// ===========================================================
// BOTTOM NAV
// ===========================================================
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => navigateTo(btn.dataset.page));
});
document.getElementById("themeToggle").addEventListener("click", toggleTheme);

// ===========================================================
// INIT
// ===========================================================
async function initApp() {
  initTheme();
  initSettings();
  if (API_URL.indexOf("PASTE_") === 0) {
    toast("Welcome! Configure your Apps Script URL in Settings.");
    navigateTo("settings");
    return;
  }
  try {
    state.meta = await api("getMeta");
    populateAllSelects();
  } catch (e) {}
  navigateTo(state.currentPage || "dashboard");
}

document.addEventListener("DOMContentLoaded", initApp);

// ===========================================================
// PWA SERVICE WORKER REGISTRATION
// ===========================================================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(err => console.warn("SW registration failed", err));
  });
}
