/* Bodibe Digital — Performance analytics */
(function (window, document) {
  "use strict";

  var Portal = window.BodibePortal;
  if (!Portal) return;

  var state = {
    options: null,
    detail: null,
    trend: [],
    selectedStaffId: "",
    period: "",
    chart: null,
  };

  var staffSelect = document.getElementById("staffSelect");
  var periodSelect = document.getElementById("periodSelect");
  var refreshButton = document.getElementById("refreshPerformance");
  var kpiGrid = document.getElementById("kpiGrid");
  var targetProgress = document.getElementById("targetProgress");
  var taskHealth = document.getElementById("taskHealth");
  var snapshot = document.getElementById("snapshot");
  var reviewContent = document.getElementById("reviewContent");
  var reviewStatus = document.getElementById("reviewStatus");
  var managerPanel = document.getElementById("managerPanel");
  var targetForm = document.getElementById("targetForm");
  var targetMetric = document.getElementById("targetMetric");
  var targetValue = document.getElementById("targetValue");
  var targetNote = document.getElementById("targetNote");
  var reviewStrengths = document.getElementById("reviewStrengths");
  var reviewImprovements = document.getElementById("reviewImprovements");
  var reviewNextSteps = document.getElementById("reviewNextSteps");
  var saveDraftReview = document.getElementById("saveDraftReview");
  var publishReview = document.getElementById("publishReview");

  function key(value) { return String(value == null ? "" : value).trim().toLowerCase(); }
  function esc(value) { return Portal.escapeHtml(value); }
  function valueOrDash(value) { return value == null ? "—" : String(value); }

  function johannesburgMonth(date) {
    var parts = new Intl.DateTimeFormat("en-ZA", {
      timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit"
    }).formatToParts(date || new Date());
    var year = (parts.find(function (p) { return p.type === "year"; }) || {}).value;
    var month = (parts.find(function (p) { return p.type === "month"; }) || {}).value;
    return year + "-" + month;
  }

  function prettyMonth(period) {
    if (!/^\d{4}-\d{2}$/.test(period || "")) return period || "";
    var d = new Date(period + "-01T00:00:00Z");
    return d.toLocaleDateString("en-ZA", { month: "short", year: "numeric", timeZone: "UTC" });
  }

  function shiftMonth(period, delta) {
    var parts = period.split("-");
    var d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1 + delta, 1));
    return d.toISOString().slice(0, 7);
  }

  function metricLabel(metric) {
    var catalog = (state.detail && state.detail.catalog) || (state.options && state.options.metrics) || [];
    var item = catalog.find(function (entry) { return entry.key === metric; });
    return item ? item.label : metric;
  }

  function currentTarget(metric) {
    return ((state.detail && state.detail.targets) || []).find(function (t) { return t.metric === metric; }) || null;
  }

  function metricValue(detail, metric) {
    return detail && detail.metrics && detail.metrics.values ? detail.metrics.values[metric] : null;
  }

  function percentChange(current, previous) {
    if (current == null || previous == null) return null;
    current = Number(current); previous = Number(previous);
    if (!isFinite(current) || !isFinite(previous)) return null;
    if (previous === 0) return current === 0 ? 0 : null;
    return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
  }

  async function json(path, options) {
    var response = await Portal.authedFetch(path, options);
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok || !data.success) throw new Error(data.message || "Could not load performance data.");
    return data;
  }

  function renderSelectedEmployee() {
    var detail = state.detail;
    if (!detail) return;
    document.getElementById("selectedEmployee").textContent = detail.employee.name || detail.employee.staffId;
    document.getElementById("selectedRole").textContent = detail.employee.role || "";
    document.getElementById("selectedDepartment").textContent = (detail.employee.department || "Performance overview") + " · " + prettyMonth(detail.period);
  }

  function kpiCard(config, previousDetail) {
    var current = metricValue(state.detail, config.key);
    var previous = metricValue(previousDetail, config.key);
    var change = percentChange(current, previous);
    var target = currentTarget(config.key);
    var changeHtml = '<span class="performance-kpi-change">No comparison</span>';
    if (change != null) {
      var cls = change > 0 ? " is-up" : (change < 0 ? " is-down" : "");
      var arrow = change > 0 ? "fa-arrow-up" : (change < 0 ? "fa-arrow-down" : "fa-minus");
      changeHtml = '<span class="performance-kpi-change' + cls + '"><i class="fa-solid ' + arrow + '"></i>' + Math.abs(change) + '%</span>';
    }
    var targetHtml = target
      ? '<div class="performance-kpi-target"><span>Monthly target</span><b>' + Number(target.value || 0) + '</b></div>'
      : '<div class="performance-kpi-target"><span>Monthly target</span><b>Not set</b></div>';
    return '<article class="performance-kpi">'
      + '<div class="performance-kpi-head"><span class="performance-kpi-label">' + esc(config.label) + '</span><span class="performance-kpi-icon"><i class="fa-solid ' + config.icon + '"></i></span></div>'
      + '<strong>' + esc(valueOrDash(current)) + '</strong>'
      + changeHtml
      + '<div class="performance-kpi-detail">' + esc(config.detail) + '</div>'
      + targetHtml
      + '</article>';
  }

  function renderKpis() {
    var previousDetail = state.trend.length > 1 ? state.trend[state.trend.length - 2] : null;
    var cards = [
      { key: "salesContacts", label: "Sales contacts", icon: "fa-comments", detail: "Calls, WhatsApp, email and meetings logged this month." },
      { key: "salesCalls", label: "Sales calls", icon: "fa-phone", detail: "Call activities recorded for the selected employee." },
      { key: "tasksDueCompleted", label: "Tasks completed", icon: "fa-circle-check", detail: "Tasks due in this month that are currently completed." },
      { key: "supportResolved", label: "Support resolved", icon: "fa-headset", detail: "Support resolution events recorded this month." },
    ];
    kpiGrid.innerHTML = cards.map(function (card) { return kpiCard(card, previousDetail); }).join("");
  }

  function renderTargets() {
    var targets = (state.detail && state.detail.targets) || [];
    if (!targets.length) {
      targetProgress.innerHTML = '<p class="performance-empty">No monthly targets are set for this employee yet.</p>';
      return;
    }
    targetProgress.innerHTML = targets.map(function (target) {
      var actual = metricValue(state.detail, target.metric);
      var pct = actual == null ? 0 : Math.max(0, Math.min(100, Math.round((Number(actual) / Number(target.value || 1)) * 100)));
      return '<div class="performance-target-row">'
        + '<div class="performance-target-top"><strong>' + esc(metricLabel(target.metric)) + '</strong><span>' + esc(valueOrDash(actual)) + ' / ' + Number(target.value || 0) + '</span></div>'
        + '<div class="performance-target-bar"><i style="width:' + pct + '%"></i></div>'
        + '<p class="performance-target-note">' + pct + '% of target' + (target.note ? ' · ' + esc(target.note) : '') + '</p>'
        + '</div>';
    }).join("");
  }

  function renderTaskHealth() {
    var summary = state.detail && state.detail.metrics ? state.detail.metrics.taskSummary || {} : {};
    var due = summary.due;
    var completed = metricValue(state.detail, "tasksDueCompleted");
    var completionPct = due && completed != null ? Math.max(0, Math.min(100, Math.round((completed / due) * 100))) : 0;
    taskHealth.innerHTML = ''
      + '<div class="performance-health-card"><span>Due this month</span><strong>' + esc(valueOrDash(due)) + '</strong></div>'
      + '<div class="performance-health-card is-success"><span>Completed</span><strong>' + esc(valueOrDash(completed)) + '</strong></div>'
      + '<div class="performance-health-card is-danger"><span>Overdue now</span><strong>' + esc(valueOrDash(summary.overdueNow)) + '</strong></div>'
      + '<div class="performance-health-meter"><div><span>Due-task completion</span><strong>' + completionPct + '%</strong></div><div class="performance-health-track"><i style="width:' + completionPct + '%"></i></div></div>';
  }

  function renderSnapshot() {
    var metrics = state.detail.metrics || {};
    var values = metrics.values || {};
    var warnings = metrics.warnings || [];
    snapshot.innerHTML = ''
      + '<div class="performance-snapshot-item"><span>Open tasks now</span><strong>' + esc(valueOrDash(metrics.taskSummary && metrics.taskSummary.openNow)) + '</strong></div>'
      + '<div class="performance-snapshot-item"><span>Avg. support resolution</span><strong>' + (metrics.supportResolutionHours == null ? '—' : esc(metrics.supportResolutionHours + ' hrs')) + '</strong></div>'
      + '<div class="performance-snapshot-item"><span>Calls / contacts</span><strong>' + esc(valueOrDash(values.salesCalls)) + ' / ' + esc(valueOrDash(values.salesContacts)) + '</strong></div>'
      + '<div class="performance-snapshot-item"><span>Measured at</span><strong>' + esc(new Date(metrics.measuredAt || Date.now()).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })) + '</strong></div>'
      + (warnings.length ? '<div class="performance-warning"><strong>Data note:</strong> ' + esc(warnings.join(" ")) + '</div>' : '');
  }

  function renderReview() {
    var review = state.detail.review;
    var currentStaff = Portal.getStaff();
    var isSelf = currentStaff && state.detail.employee && key(currentStaff.staffId) === key(state.detail.employee.staffId);
    if (!review) {
      reviewStatus.textContent = "No review";
      reviewStatus.className = "performance-review-status";
      reviewContent.innerHTML = '<p class="performance-empty">No published monthly review is available for this period.</p>';
      return;
    }
    reviewStatus.textContent = review.status || "Review";
    reviewStatus.className = "performance-review-status" + (review.status === "Published" ? " is-published" : "");
    reviewContent.innerHTML = '<div class="performance-review-content">'
      + '<div class="performance-review-block"><span>Strengths</span><p>' + esc(review.strengths || "—") + '</p></div>'
      + '<div class="performance-review-block"><span>Improvement areas</span><p>' + esc(review.improvements || "—") + '</p></div>'
      + '<div class="performance-review-block"><span>Next steps</span><p>' + esc(review.nextSteps || "—") + '</p></div>'
      + '</div>'
      + (isSelf && review.status === "Published" && !state.detail.acknowledged
          ? '<div style="margin-top:12px;text-align:right"><button type="button" id="acknowledgeReview" class="performance-refresh">Acknowledge review</button></div>'
          : '');
    var acknowledge = document.getElementById("acknowledgeReview");
    if (acknowledge) acknowledge.addEventListener("click", acknowledgeReview);
  }

  function renderManagement() {
    var detail = state.detail;
    managerPanel.hidden = !detail.canManage;
    if (!detail.canManage) return;

    targetMetric.innerHTML = (detail.catalog || []).map(function (item) {
      return '<option value="' + esc(item.key) + '">' + esc(item.label) + '</option>';
    }).join("");
    syncTargetForm();

    var review = detail.review || null;
    reviewStrengths.value = review ? review.strengths || "" : "";
    reviewImprovements.value = review ? review.improvements || "" : "";
    reviewNextSteps.value = review ? review.nextSteps || "" : "";
    var locked = Boolean(review && review.status === "Published");
    [reviewStrengths, reviewImprovements, reviewNextSteps, saveDraftReview, publishReview].forEach(function (el) { if (el) el.disabled = locked; });
  }

  function syncTargetForm() {
    var existing = currentTarget(targetMetric.value);
    targetValue.value = existing ? existing.value : "";
    targetNote.value = existing ? existing.note || "" : "";
  }

  function renderTrend() {
    if (!window.Chart) return;
    if (state.chart) state.chart.destroy();
    var canvas = document.getElementById("trendChart");
    if (!canvas) return;
    var labels = state.trend.map(function (d) { return prettyMonth(d.period).replace(/\s\d{4}$/, ""); });
    var contacts = state.trend.map(function (d) { var v = metricValue(d, "salesContacts"); return v == null ? 0 : v; });
    var calls = state.trend.map(function (d) { var v = metricValue(d, "salesCalls"); return v == null ? 0 : v; });
    state.chart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          { label: "Contacts", data: contacts, backgroundColor: "#2563eb", borderRadius: 5, maxBarThickness: 26 },
          { label: "Calls", data: calls, backgroundColor: "#bfdbfe", borderRadius: 5, maxBarThickness: 26 },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { display: false }, tooltip: { padding: 10, cornerRadius: 8 } },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: "#8a94a8", font: { family: "Poppins", size: 9 } } },
          y: { beginAtZero: true, border: { display: false }, grid: { color: "rgba(148,163,184,.16)" }, ticks: { precision: 0, color: "#8a94a8", font: { family: "Poppins", size: 9 } } }
        }
      }
    });
  }

  async function fetchDetail(staffId, period) {
    return json("/staff/performance/" + encodeURIComponent(staffId) + "/" + encodeURIComponent(period));
  }

  async function loadPerformance() {
    if (!state.selectedStaffId || !state.period) return;
    refreshButton.disabled = true;
    refreshButton.querySelector("span").textContent = "Loading";
    Portal.clearNotice();
    try {
      var periods = [];
      for (var i = -5; i <= 0; i += 1) periods.push(shiftMonth(state.period, i));
      var results = await Promise.all(periods.map(function (period) { return fetchDetail(state.selectedStaffId, period); }));
      state.trend = results;
      state.detail = results[results.length - 1];
      renderSelectedEmployee();
      renderKpis();
      renderTargets();
      renderTaskHealth();
      renderSnapshot();
      renderReview();
      renderManagement();
      renderTrend();
    } catch (err) {
      console.error("Performance dashboard failed:", err);
      Portal.showNotice(err.message || "Could not load the performance dashboard.", "warning");
    } finally {
      refreshButton.disabled = false;
      refreshButton.querySelector("span").textContent = "Refresh";
    }
  }

  async function loadOptions(ready) {
    try {
      var data = await json("/staff/performance/options");
      state.options = data;
      var staff = data.staff || [];
      if (!staff.length) throw new Error("No performance records are available for your account.");
      staffSelect.innerHTML = staff.map(function (person) {
        return '<option value="' + esc(person.staffId) + '">' + esc(person.name + (person.role ? " · " + person.role : "")) + '</option>';
      }).join("");
      var current = ready.staff || Portal.getStaff();
      var own = current && staff.find(function (person) { return key(person.staffId) === key(current.staffId); });
      state.selectedStaffId = own ? own.staffId : staff[0].staffId;
      staffSelect.value = state.selectedStaffId;
      state.period = johannesburgMonth(new Date());
      periodSelect.value = state.period;
      await loadPerformance();
    } catch (err) {
      console.error("Performance options failed:", err);
      Portal.showNotice(err.message || "Performance is temporarily unavailable.", "warning");
    }
  }

  async function saveTarget(event) {
    event.preventDefault();
    if (!state.detail || !state.detail.canManage) return;
    var existing = currentTarget(targetMetric.value);
    var value = Number(targetValue.value);
    if (!Number.isInteger(value) || value < 1) return Portal.showNotice("Enter a whole-number target of at least 1.", "warning");
    try {
      await json("/staff/performance/" + encodeURIComponent(state.selectedStaffId) + "/" + encodeURIComponent(state.period) + "/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metric: targetMetric.value, value: value, note: targetNote.value || "", version: existing ? existing.version : 0 })
      });
      Portal.showNotice("Performance target saved.");
      await loadPerformance();
    } catch (err) { Portal.showNotice(err.message || "Could not save that target.", "warning"); }
  }

  async function saveReview(publish) {
    if (!state.detail || !state.detail.canManage) return;
    var existing = state.detail.review;
    try {
      await json("/staff/performance/" + encodeURIComponent(state.selectedStaffId) + "/" + encodeURIComponent(state.period) + "/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: existing ? existing.version : 0,
          strengths: reviewStrengths.value || "",
          improvements: reviewImprovements.value || "",
          nextSteps: reviewNextSteps.value || "",
          publish: Boolean(publish)
        })
      });
      Portal.showNotice(publish ? "Monthly review published." : "Review draft saved.");
      await loadPerformance();
    } catch (err) { Portal.showNotice(err.message || "Could not save the review.", "warning"); }
  }

  async function acknowledgeReview() {
    try {
      await json("/staff/performance/" + encodeURIComponent(state.selectedStaffId) + "/" + encodeURIComponent(state.period) + "/acknowledge", { method: "POST" });
      Portal.showNotice("Review acknowledged.");
      await loadPerformance();
    } catch (err) { Portal.showNotice(err.message || "Could not acknowledge the review.", "warning"); }
  }

  staffSelect.addEventListener("change", function () { state.selectedStaffId = staffSelect.value; loadPerformance(); });
  periodSelect.addEventListener("change", function () { if (periodSelect.value) { state.period = periodSelect.value; loadPerformance(); } });
  refreshButton.addEventListener("click", loadPerformance);
  targetMetric.addEventListener("change", syncTargetForm);
  targetForm.addEventListener("submit", saveTarget);
  saveDraftReview.addEventListener("click", function () { saveReview(false); });
  publishReview.addEventListener("click", function () { saveReview(true); });

  Portal.onReady(loadOptions);
})(window, document);
