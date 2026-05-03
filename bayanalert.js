const STORAGE_KEY = "bayanalert_reports_ui";

const reportForm = document.getElementById("reportForm");
const incidentTypeInput = document.getElementById("incidentType");
const locationInput = document.getElementById("locationInput");
const descriptionInput = document.getElementById("descriptionInput");
const contactInput = document.getElementById("contactInput");
const consentInput = document.getElementById("consentInput");
const getLocationBtn = document.getElementById("getLocationBtn");
const charCount = document.getElementById("charCount");

const totalReportsEl = document.getElementById("totalReports");
const activeReportsEl = document.getElementById("activeReports");
const resolvedReportsEl = document.getElementById("resolvedReports");
const reportsListEl = document.getElementById("reportsList");
const clearResolvedBtn = document.getElementById("clearResolvedBtn");
const resetReportsBtn = document.getElementById("resetReportsBtn");
const yearNowEl = document.getElementById("yearNow");
const toastContainer = document.getElementById("toastContainer");

function loadReports() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveReports(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function removeDefaultActiveReport() {
  const current = loadReports();
  const filtered = current.filter((report) => report.reportId !== "BAY-001000");
  if (filtered.length !== current.length) saveReports(filtered);
}

function showToast(message, kind = "") {
  if (!toastContainer) return;
  const toast = document.createElement("div");
  toast.className = ["toast", kind].filter(Boolean).join(" ");
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

function formatTime(dateString) {
  const d = new Date(dateString);
  return d.toLocaleString();
}

function nextReportId() {
  const list = loadReports();
  const highest = list.reduce((max, report) => {
    const numeric = Number(String(report.reportId || "").replace("BAY-", ""));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);
  const next = highest + 1;
  return `BAY-${String(next).padStart(6, "0")}`;
}

function dashboardStatus(type) {
  return type === "Resolved" ? "Resolved" : "Active";
}

function renderStatsAndList() {
  const reports = loadReports().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const total = reports.length;
  const active = reports.filter((r) => r.status === "Active").length;
  const resolved = reports.filter((r) => r.status === "Resolved").length;

  if (totalReportsEl) totalReportsEl.textContent = String(total);
  if (activeReportsEl) activeReportsEl.textContent = String(active);
  if (resolvedReportsEl) resolvedReportsEl.textContent = String(resolved);

  if (!reportsListEl) return;
  reportsListEl.innerHTML = "";
  if (!reports.length) {
    reportsListEl.innerHTML = '<div class="report-card">No reports submitted yet.</div>';
    return;
  }

  reports.forEach((report) => {
    const card = document.createElement("article");
    card.className = "report-card";
    const badgeClass = report.status === "Resolved" ? "badge-resolved" : "badge-active";

    card.innerHTML = `
      <div class="report-head">
        <i class="fa-solid fa-truck-medical report-icon"></i>
        <span class="badge ${badgeClass}">${report.status.toUpperCase()}</span>
      </div>
      <div class="report-grid">
        <span>Incident Type:</span><strong>${report.incidentType}</strong>
        <span>Location:</span><strong>${report.location}</strong>
        <span>Report ID:</span><strong>${report.reportId}</strong>
        <span>Description:</span><strong>${report.description}</strong>
      </div>
      <div class="report-time">
        <i class="fa-regular fa-clock"></i>
        <span>${formatTime(report.createdAt)}</span>
      </div>
    `;

    if (report.status === "Active") {
      const actions = document.createElement("div");
      actions.className = "report-actions";
      actions.innerHTML = `
        <button class="btn btn-resolve" type="button" data-action="resolve" data-id="${report.reportId}">
          <i class="fa-solid fa-check"></i>
          <span>Mark as Resolved</span>
        </button>
      `;
      card.appendChild(actions);
    }

    reportsListEl.appendChild(card);
  });
}

function markReportResolved(reportId) {
  const reports = loadReports();
  const index = reports.findIndex((r) => r.reportId === reportId);
  if (index === -1) {
    showToast("Report not found.", "error");
    return;
  }
  reports[index].status = "Resolved";
  saveReports(reports);
  renderStatsAndList();
  showToast("Report marked as resolved.", "success");
}

function clearResolvedReports() {
  const reports = loadReports();
  const activeOnly = reports.filter((report) => report.status !== "Resolved");
  if (activeOnly.length === reports.length) {
    showToast("No resolved reports to clear.");
    return;
  }
  saveReports(activeOnly);
  renderStatsAndList();
  showToast("Resolved reports cleared.", "success");
}

function resetAllReports() {
  localStorage.removeItem(STORAGE_KEY);
  renderStatsAndList();
  showToast("All reports have been reset.", "success");
}

async function getAddressFromCoords(lat, lng) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`);
    const data = await response.json();
    if (!data) return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    
    // Return the full display name which includes the complete address
    return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch (error) {
    console.error("Reverse geocoding failed:", error);
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}

function sanitizeContact(value) {
  return value.replace(/[^0-9]/g, "").slice(0, 11);
}

function validateForm() {
  const incidentType = incidentTypeInput.value.trim();
  const location = locationInput.value.trim();
  const description = descriptionInput.value.trim();
  const contact = sanitizeContact(contactInput.value.trim());

  if (!incidentType) {
    showToast("Please select an incident type.", "error");
    return null;
  }
  if (!location) {
    showToast("Please enter a location.", "error");
    return null;
  }
  if (description.length < 10) {
    showToast("Description must be at least 10 characters.", "error");
    return null;
  }
  if (contact.length !== 11 || !contact.startsWith("09")) {
    showToast("Enter a valid 11-digit mobile number starting with 09.", "error");
    return null;
  }
  if (!consentInput.checked) {
    showToast("You must agree to the consent checkbox.", "error");
    return null;
  }

  return { incidentType, location, description, contact };
}

// Sta Rita, Olongapo City approximate center and boundary
const STA_RITA_CENTER = { lat: 14.3561, lng: 120.2854 };
const STA_RITA_RADIUS_KM = 3; // ~3km radius around Sta Rita

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isWithinStaRita(lat, lng) {
  const distance = calculateDistance(STA_RITA_CENTER.lat, STA_RITA_CENTER.lng, lat, lng);
  return distance <= STA_RITA_RADIUS_KM;
}

async function getAddressFromCoords(lat, lng) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`);
    const data = await response.json();
    if (!data) return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    
    // Return the full display name which includes the complete address
    return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch (error) {
    console.error("Reverse geocoding failed:", error);
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}

function onGetLocation() {
  if (!navigator.geolocation) {
    showToast("Geolocation is not supported in this browser.", "error");
    return;
  }

  getLocationBtn.disabled = true;
  const originalHtml = getLocationBtn.innerHTML;
  getLocationBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Locating...</span>';

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      if (!isWithinStaRita(lat, lng)) {
        showToast("Your location is outside Sta Rita. Please ensure you are in the Sta Rita vicinity.", "error");
        getLocationBtn.disabled = false;
        getLocationBtn.innerHTML = originalHtml;
        return;
      }

      const address = await getAddressFromCoords(lat, lng);
      if (!locationInput.value.trim()) locationInput.value = address;
      showToast("Location captured successfully within Sta Rita.", "success");
      getLocationBtn.disabled = false;
      getLocationBtn.innerHTML = originalHtml;
    },
    (error) => {
      showToast(`Unable to get location: ${error.message}`, "error");
      getLocationBtn.disabled = false;
      getLocationBtn.innerHTML = originalHtml;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function handleSubmit(event) {
  event.preventDefault();
  const valid = validateForm();
  if (!valid) return;

  const reports = loadReports();
  reports.unshift({
    reportId: nextReportId(),
    incidentType: valid.incidentType,
    location: valid.location,
    description: valid.description,
    contact: valid.contact,
    status: dashboardStatus("Active"),
    createdAt: new Date().toISOString()
  });

  saveReports(reports);
  reportForm.reset();
  charCount.textContent = "0";
  renderStatsAndList();
  showToast("Emergency report submitted successfully.", "success");
  document.getElementById("dashboardSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

// Event listeners
if (descriptionInput) descriptionInput.addEventListener("input", () => charCount && (charCount.textContent = String(descriptionInput.value.length)));
if (contactInput) contactInput.addEventListener("input", () => { contactInput.value = sanitizeContact(contactInput.value); });
if (getLocationBtn) getLocationBtn.addEventListener("click", onGetLocation);
if (reportForm) reportForm.addEventListener("submit", handleSubmit);
if (clearResolvedBtn) clearResolvedBtn.addEventListener("click", clearResolvedReports);
if (resetReportsBtn) resetReportsBtn.addEventListener("click", resetAllReports);

if (reportsListEl) {
  reportsListEl.addEventListener("click", (event) => {
    const targetButton = event.target.closest("button[data-action='resolve']");
    if (!targetButton) return;
    const reportId = targetButton.getAttribute("data-id");
    if (reportId) markReportResolved(reportId);
  });
}

window.addEventListener("storage", (event) => { if (event.key === STORAGE_KEY) renderStatsAndList(); });

if (yearNowEl) yearNowEl.textContent = String(new Date().getFullYear());
removeDefaultActiveReport();
renderStatsAndList();
