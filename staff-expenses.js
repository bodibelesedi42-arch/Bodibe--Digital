/* Bodibe Digital — Expenses workspace */
(function (window, document) {
  "use strict";

  var Portal = window.BodibePortal;
  if (!Portal) return;

  var state = {
    options: null,
    data: null,
    current: null,
    formMode: "create",
    action: "",
    charts: {},
  };

  var rows = document.getElementById("expenseRows");
  var count = document.getElementById("expenseCount");
  var statusFilter = document.getElementById("filterStatus");
  var categoryFilter = document.getElementById("filterCategory");
  var fromFilter = document.getElementById("filterFrom");
  var toFilter = document.getElementById("filterTo");
  var searchInput = document.getElementById("expenseSearch");
  var newExpenseButton = document.getElementById("newExpense");
  var exportButton = document.getElementById("exportExpenses");
  var expenseDialog = document.getElementById("expenseDialog");
  var expenseForm = document.getElementById("expenseForm");
  var actionDialog = document.getElementById("actionDialog");
  var actionForm = document.getElementById("actionForm");
  var drawer = document.getElementById("expenseDrawer");
  var drawerBackdrop = document.getElementById("expenseDrawerBackdrop");
  var drawerBody = document.getElementById("expenseDrawerBody");

  function esc(value) { return Portal.escapeHtml(value == null ? "" : value); }
  function key(value) { return String(value == null ? "" : value).trim().toLowerCase(); }
  function can(action) { return Portal.canHere ? Portal.canHere("Expenses", action) : true; }
  function money(value) {
    var n = Number(value || 0);
    return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 }).format(isFinite(n) ? n : 0);
  }
  function prettyDate(value) {
    if (!value) return "—";
    var d = new Date(String(value).slice(0, 10) + "T00:00:00Z");
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : value;
  }
  function todayJohannesburg() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }
  function statusClass(status) { return "expense-status-" + key(status).replace(/\s+/g, "-"); }

  async function json(path, options) {
    var res = await Portal.authedFetch(path, options || {});
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.success) throw new Error(data.message || "Expenses request failed.");
    return data;
  }

  function currentQuery() {
    var q = new URLSearchParams();
    if (statusFilter.value) q.set("status", statusFilter.value);
    if (categoryFilter.value) q.set("category", categoryFilter.value);
    if (fromFilter.value) q.set("from", fromFilter.value);
    if (toFilter.value) q.set("to", toFilter.value);
    var text = q.toString();
    return text ? "?" + text : "";
  }

  function filteredRows() {
    var list = (state.data && state.data.expenses) || [];
    var q = key(searchInput.value);
    if (!q) return list;
    return list.filter(function (e) {
      return [e.expenseId, e.supplier, e.description, e.category, e.department, e.projectId, e.clientName, e.status, e.reference]
        .some(function (value) { return key(value).indexOf(q) !== -1; });
    });
  }

  function renderSummary() {
    var s = (state.data && state.data.summary) || {};
    document.getElementById("kpiMonth").textContent = money(s.thisMonth);
    document.getElementById("kpiPending").textContent = money(s.pending);
    document.getElementById("kpiApproved").textContent = money(s.unpaidApproved);
    document.getElementById("kpiPaid").textContent = money(s.paid);
  }

  function renderTable() {
    var list = filteredRows();
    count.textContent = list.length + (list.length === 1 ? " record" : " records");
    if (!list.length) {
      rows.innerHTML = '<tr><td colspan="9" class="expense-empty">No expenses match these filters.</td></tr>';
      return;
    }
    rows.innerHTML = list.map(function (e) {
      return '<tr>'
        + '<td><span class="expense-id">' + esc(e.expenseId) + '</span></td>'
        + '<td>' + esc(prettyDate(e.date)) + '</td>'
        + '<td><span class="expense-supplier">' + esc(e.supplier || "—") + '</span><div class="expense-muted">' + esc(e.description || "") + '</div></td>'
        + '<td>' + esc(e.category || "—") + '</td>'
        + '<td>' + esc(e.department || "—") + '</td>'
        + '<td>' + esc(e.projectId || "—") + '</td>'
        + '<td><span class="expense-total">' + esc(money(e.total)) + '</span></td>'
        + '<td><span class="expense-status ' + statusClass(e.status) + '">' + esc(e.status) + '</span></td>'
        + '<td><button type="button" class="expense-row-action" data-expense-id="' + esc(e.expenseId) + '" aria-label="Open ' + esc(e.expenseId) + '"><i class="fa-solid fa-chevron-right"></i></button></td>'
        + '</tr>';
    }).join("");
  }

  function chartColours() { return ["#2563eb", "#60a5fa", "#14b8a6", "#8b5cf6", "#f59e0b", "#94a3b8"]; }
  function destroyChart(name) { if (state.charts[name]) { state.charts[name].destroy(); state.charts[name] = null; } }

  function renderDoughnut(name, canvasId, items) {
    if (!window.Chart) return;
    destroyChart(name);
    var list = (items || []).slice(0, 6);
    var canvas = document.getElementById(canvasId);
    state.charts[name] = new Chart(canvas, {
      type: "doughnut",
      data: { labels: list.map(function (x) { return x.label; }), datasets: [{ data: list.map(function (x) { return x.total; }), backgroundColor: chartColours(), borderWidth: 0, hoverOffset: 3 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: "68%",
        plugins: { legend: { position: "bottom", labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: "circle", color: "#64748b", font: { family: "Poppins", size: 8 }, padding: 12 } }, tooltip: { callbacks: { label: function (ctx) { return " " + ctx.label + ": " + money(ctx.raw); } } } }
      }
    });
  }

  function renderTrend() {
    if (!window.Chart) return;
    destroyChart("trend");
    var totals = {};
    ((state.data && state.data.expenses) || []).forEach(function (e) {
      if (["Draft", "Rejected", "Cancelled"].indexOf(e.status) >= 0) return;
      var month = String(e.date || "").slice(0, 7);
      if (!month) return;
      totals[month] = (totals[month] || 0) + Number(e.total || 0);
    });
    var now = new Date();
    var months = [];
    for (var i = 5; i >= 0; i -= 1) {
      var d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      months.push(d.toISOString().slice(0, 7));
    }
    state.charts.trend = new Chart(document.getElementById("trendChart"), {
      type: "bar",
      data: {
        labels: months.map(function (m) { return new Date(m + "-01T00:00:00Z").toLocaleDateString("en-ZA", { month: "short", timeZone: "UTC" }); }),
        datasets: [{ label: "Expenses", data: months.map(function (m) { return totals[m] || 0; }), backgroundColor: "#2563eb", borderRadius: 5, maxBarThickness: 34 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (ctx) { return " " + money(ctx.raw); } } } },
        scales: { x: { grid: { display: false }, border: { display: false }, ticks: { color: "#7c879a", font: { family: "Poppins", size: 8 } } }, y: { beginAtZero: true, border: { display: false }, grid: { color: "rgba(148,163,184,.16)" }, ticks: { color: "#7c879a", font: { family: "Poppins", size: 8 }, callback: function (v) { return "R" + Number(v).toLocaleString("en-ZA"); } } } }
      }
    });
  }

  function renderCharts() {
    renderDoughnut("category", "categoryChart", state.data && state.data.byCategory);
    renderDoughnut("department", "departmentChart", state.data && state.data.byDepartment);
    renderTrend();
  }

  async function loadExpenses() {
    Portal.clearNotice();
    rows.innerHTML = '<tr><td colspan="9" class="expense-empty">Loading expenses&hellip;</td></tr>';
    try {
      state.data = await json("/staff/expenses" + currentQuery());
      renderSummary();
      renderTable();
      renderCharts();
    } catch (err) {
      console.error(err);
      Portal.showNotice(err.message || "Could not load expenses.", "warning");
      rows.innerHTML = '<tr><td colspan="9" class="expense-empty">Expenses could not be loaded.</td></tr>';
    }
  }

  function populateOptions() {
    var options = state.options || {};
    statusFilter.innerHTML = '<option value="">All statuses</option>' + (options.statuses || []).map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join("");
    categoryFilter.innerHTML = '<option value="">All categories</option>' + (options.categories || []).map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join("");
    document.getElementById("expenseCategory").innerHTML = (options.categories || []).map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join("");
    document.getElementById("expenseProject").innerHTML = '<option value="">No project</option>' + (options.projects || []).map(function (p) { return '<option value="' + esc(p.projectId) + '">' + esc(p.projectId + (p.clientName ? " · " + p.clientName : "")) + '</option>'; }).join("");
    newExpenseButton.hidden = !can("Create Expense");
    exportButton.hidden = !can("View Reports");
  }

  async function loadOptions() {
    state.options = await json("/staff/expenses/options");
    populateOptions();
  }

  function openDrawer() {
    drawerBackdrop.hidden = false;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
  }
  function closeDrawer() {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    window.setTimeout(function () { drawerBackdrop.hidden = true; }, 220);
  }

  function receiptHtml(r) {
    return '<div class="expense-receipt"><span><i class="fa-regular fa-file-lines"></i> ' + esc(r.name || r.receiptId || "Receipt") + '</span><button class="expense-row-action" type="button" data-receipt-id="' + esc(r.receiptId) + '" aria-label="Download receipt"><i class="fa-solid fa-download"></i></button></div>';
  }

  function actionButton(action, label, cls, icon) {
    return '<button type="button" class="expense-btn ' + (cls || "expense-btn-secondary") + '" data-expense-action="' + action + '"><i class="fa-solid ' + icon + '"></i>' + label + '</button>';
  }

  function renderDetail(detail) {
    var e = detail.expense;
    state.current = e;
    document.getElementById("drawerTitle").textContent = e.expenseId;
    var buttons = [];
    if (["Draft", "Rejected"].indexOf(e.status) >= 0 && can("Edit Expense")) buttons.push(actionButton("edit", "Edit", "expense-btn-secondary", "fa-pen"));
    if (["Draft", "Rejected"].indexOf(e.status) >= 0 && can("Submit Expense")) buttons.push(actionButton("submit", "Submit", "expense-btn-primary", "fa-paper-plane"));
    if (e.status === "Submitted" && can("Approve Expense")) buttons.push(actionButton("review", "Send to review", "expense-btn-warning", "fa-magnifying-glass"));
    if (["Submitted", "Pending Approval"].indexOf(e.status) >= 0 && can("Approve Expense")) buttons.push(actionButton("approve", "Approve", "expense-btn-success", "fa-check"));
    if (["Submitted", "Pending Approval"].indexOf(e.status) >= 0 && can("Reject Expense")) buttons.push(actionButton("reject", "Reject", "expense-btn-danger", "fa-xmark"));
    if (e.status === "Approved" && can("Mark Paid")) buttons.push(actionButton("paid", "Mark paid", "expense-btn-success", "fa-money-check-dollar"));
    if (["Paid", "Cancelled"].indexOf(e.status) < 0 && can("Void Expense")) buttons.push(actionButton("cancel", "Cancel", "expense-btn-danger", "fa-ban"));

    var canAttach = ["Draft", "Rejected"].indexOf(e.status) >= 0 && can("Edit Expense");
    var receipts = detail.receipts || [];
    var history = (detail.history || []).slice().reverse();

    drawerBody.innerHTML = ''
      + '<div class="expense-detail-grid">'
      + '<div class="expense-detail-item"><span>Status</span><strong><span class="expense-status ' + statusClass(e.status) + '">' + esc(e.status) + '</span></strong></div>'
      + '<div class="expense-detail-item"><span>Total</span><strong>' + esc(money(e.total)) + '</strong></div>'
      + '<div class="expense-detail-item"><span>Date</span><strong>' + esc(prettyDate(e.date)) + '</strong></div>'
      + '<div class="expense-detail-item"><span>Supplier</span><strong>' + esc(e.supplier || "—") + '</strong></div>'
      + '<div class="expense-detail-item"><span>Category</span><strong>' + esc(e.category || "—") + '</strong></div>'
      + '<div class="expense-detail-item"><span>Department</span><strong>' + esc(e.department || "—") + '</strong></div>'
      + '<div class="expense-detail-item"><span>Project</span><strong>' + esc(e.projectId || "—") + '</strong></div>'
      + '<div class="expense-detail-item"><span>Reference</span><strong>' + esc(e.reference || "—") + '</strong></div>'
      + '<div class="expense-detail-item is-wide"><span>Description</span><strong>' + esc(e.description || "—") + '</strong></div>'
      + '<div class="expense-detail-item is-wide"><span>Notes</span><strong>' + esc(e.notes || "—") + '</strong></div>'
      + '</div>'
      + (buttons.length ? '<div class="expense-detail-section"><h3>Actions</h3><div class="expense-action-row">' + buttons.join("") + '</div></div>' : '')
      + '<div class="expense-detail-section"><h3>Receipts & proof</h3><div class="expense-receipt-list">' + (receipts.length ? receipts.map(receiptHtml).join("") : '<div class="expense-muted">No receipts attached.</div>') + '</div>'
      + (canAttach ? '<div class="expense-upload"><input id="receiptFile" type="file" accept="application/pdf,image/jpeg,image/png" /><button class="expense-btn expense-btn-secondary" id="uploadReceipt" type="button"><i class="fa-solid fa-paperclip"></i>Attach</button></div>' : '')
      + '</div>'
      + '<div class="expense-detail-section"><h3>History</h3><div class="expense-history-list">' + (history.length ? history.map(function (h) { return '<div class="expense-history-item"><strong>' + esc(h.action || "Updated") + '</strong><br>' + esc(h.actor || "System") + ' · ' + esc(new Date(h.at).toLocaleString("en-ZA")) + '</div>'; }).join("") : '<div class="expense-muted">No history yet.</div>') + '</div></div>';
  }

  async function openExpense(id) {
    drawerBody.innerHTML = '<div class="expense-empty">Loading expense&hellip;</div>';
    openDrawer();
    try { renderDetail(await json("/staff/expenses/" + encodeURIComponent(id))); }
    catch (err) { drawerBody.innerHTML = '<div class="expense-empty">' + esc(err.message) + '</div>'; }
  }

  function clearForm() {
    expenseForm.reset();
    document.getElementById("expenseVat").value = "0.00";
    document.getElementById("expenseDate").value = todayJohannesburg();
    document.getElementById("expenseDepartment").value = (Portal.getStaff() && Portal.getStaff().department) || "";
    document.getElementById("editReasonWrap").hidden = true;
    document.getElementById("expenseEditReason").required = false;
    document.getElementById("expenseReimbursement").disabled = false;
    document.getElementById("approvalReferenceWrap").hidden = !(state.options && state.options.policy && state.options.policy.reimbursementsEnabled);
  }

  function openCreateDialog() {
    state.formMode = "create";
    state.current = null;
    clearForm();
    document.getElementById("expenseDialogEyebrow").textContent = "NEW EXPENSE";
    document.getElementById("expenseDialogTitle").textContent = "Record expense";
    document.getElementById("saveExpense").textContent = "Save expense";
    expenseDialog.showModal();
  }

  function openEditDialog() {
    var e = state.current;
    if (!e) return;
    state.formMode = "edit";
    clearForm();
    document.getElementById("expenseDialogEyebrow").textContent = "CORRECT EXPENSE";
    document.getElementById("expenseDialogTitle").textContent = e.expenseId;
    document.getElementById("saveExpense").textContent = "Save correction";
    document.getElementById("expenseSupplier").value = e.supplier || "";
    document.getElementById("expenseDate").value = e.date || "";
    document.getElementById("expenseCategory").value = e.category || "";
    document.getElementById("expenseDepartment").value = e.department || "";
    document.getElementById("expenseAmount").value = Number(e.amount || 0).toFixed(2);
    document.getElementById("expenseVat").value = Number(e.vatAmount || 0).toFixed(2);
    document.getElementById("expenseProject").value = e.projectId || "";
    document.getElementById("expensePaymentMethod").value = e.paymentMethod || "";
    document.getElementById("expenseDescription").value = e.description || "";
    document.getElementById("expenseReference").value = e.reference || "";
    document.getElementById("expenseNotes").value = e.notes || "";
    document.getElementById("expenseApprovalReference").value = e.approvalReference || "";
    document.getElementById("expenseReimbursement").checked = !!e.reimbursement;
    document.getElementById("expenseReimbursement").disabled = true;
    document.getElementById("editReasonWrap").hidden = false;
    document.getElementById("expenseEditReason").required = true;
    expenseDialog.showModal();
  }

  function formPayload() {
    return {
      supplier: document.getElementById("expenseSupplier").value.trim(),
      date: document.getElementById("expenseDate").value,
      category: document.getElementById("expenseCategory").value,
      department: document.getElementById("expenseDepartment").value.trim(),
      amount: document.getElementById("expenseAmount").value.trim(),
      vatAmount: document.getElementById("expenseVat").value.trim() || "0",
      projectId: document.getElementById("expenseProject").value,
      paymentMethod: document.getElementById("expensePaymentMethod").value.trim(),
      description: document.getElementById("expenseDescription").value.trim(),
      reference: document.getElementById("expenseReference").value.trim(),
      notes: document.getElementById("expenseNotes").value.trim(),
      approvalReference: document.getElementById("expenseApprovalReference").value.trim(),
    };
  }

  async function saveExpense(event) {
    event.preventDefault();
    var button = document.getElementById("saveExpense");
    button.disabled = true;
    try {
      var payload = formPayload();
      if (state.formMode === "create") {
        payload.reimbursement = document.getElementById("expenseReimbursement").checked;
        await json("/staff/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        Portal.showNotice("Expense saved as a draft.");
      } else {
        payload.version = state.current.version;
        payload.reason = document.getElementById("expenseEditReason").value.trim();
        if (!payload.reason) throw new Error("Explain why this expense is being corrected.");
        await json("/staff/expenses/" + encodeURIComponent(state.current.expenseId), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        Portal.showNotice("Expense correction saved.");
      }
      expenseDialog.close();
      await loadExpenses();
      if (state.current && state.current.expenseId) await openExpense(state.current.expenseId);
    } catch (err) { Portal.showNotice(err.message || "Could not save expense.", "warning"); }
    finally { button.disabled = false; }
  }

  function openAction(action) {
    state.action = action;
    var titles = { submit: "Submit expense", review: "Send for review", approve: "Approve expense", reject: "Reject expense", paid: "Mark expense paid", cancel: "Cancel expense" };
    var copy = { submit: "Submit this draft for approval. A receipt or proof must already be attached.", review: "Move this submitted expense into formal review.", approve: "Approve this expense for payment.", reject: "Reject this expense and record the reason.", paid: "Confirm the actual payment reference and paid date.", cancel: "Cancel this expense and keep the reason in its audit history." };
    document.getElementById("actionTitle").textContent = titles[action] || "Update expense";
    document.getElementById("actionCopy").textContent = copy[action] || "";
    var reasonNeeded = action === "reject" || action === "cancel";
    document.getElementById("actionReasonWrap").hidden = !reasonNeeded;
    document.getElementById("actionReason").required = reasonNeeded;
    document.getElementById("actionReason").value = "";
    document.getElementById("actionPaymentRefWrap").hidden = action !== "paid";
    document.getElementById("actionPaidDateWrap").hidden = action !== "paid";
    document.getElementById("actionPaymentRef").value = "";
    document.getElementById("actionPaidDate").value = todayJohannesburg();
    actionDialog.showModal();
  }

  async function submitAction(event) {
    event.preventDefault();
    if (!state.current || !state.action) return;
    var payload = { version: state.current.version };
    if (state.action === "reject" || state.action === "cancel") payload.reason = document.getElementById("actionReason").value.trim();
    if (state.action === "paid") {
      payload.paymentReference = document.getElementById("actionPaymentRef").value.trim();
      payload.paidDate = document.getElementById("actionPaidDate").value;
    }
    var button = document.getElementById("confirmAction");
    button.disabled = true;
    try {
      await json("/staff/expenses/" + encodeURIComponent(state.current.expenseId) + "/" + encodeURIComponent(state.action), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      actionDialog.close();
      Portal.showNotice("Expense updated.");
      await loadExpenses();
      await openExpense(state.current.expenseId);
    } catch (err) { Portal.showNotice(err.message || "Could not update expense.", "warning"); }
    finally { button.disabled = false; }
  }

  async function uploadReceipt() {
    var input = document.getElementById("receiptFile");
    var file = input && input.files && input.files[0];
    if (!file) return Portal.showNotice("Choose a PDF, JPG or PNG receipt first.", "warning");
    if (file.size > 1048576) return Portal.showNotice("Receipt must be 1 MB or smaller.", "warning");
    var allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (allowed.indexOf(file.type) < 0) return Portal.showNotice("Use PDF, JPG or PNG.", "warning");
    var reader = new FileReader();
    reader.onload = async function () {
      try {
        var base64 = String(reader.result || "").split(",")[1] || "";
        await json("/staff/expenses/" + encodeURIComponent(state.current.expenseId) + "/receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, mime: file.type, data: base64, reason: "Receipt attached" }) });
        Portal.showNotice("Receipt attached.");
        await openExpense(state.current.expenseId);
      } catch (err) { Portal.showNotice(err.message || "Could not attach receipt.", "warning"); }
    };
    reader.readAsDataURL(file);
  }

  async function downloadReceipt(id) {
    try {
      var res = await Portal.authedFetch("/staff/expense-receipts/" + encodeURIComponent(id));
      if (!res.ok) throw new Error("Could not download receipt.");
      var blob = await res.blob();
      var disposition = res.headers.get("Content-Disposition") || "";
      var match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      var name = match ? decodeURIComponent(match[1]) : "receipt";
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (err) { Portal.showNotice(err.message || "Could not download receipt.", "warning"); }
  }

  async function exportExpenses() {
    exportButton.disabled = true;
    try {
      var res = await Portal.authedFetch("/staff/expenses/export" + currentQuery());
      if (!res.ok) {
        var body = await res.json().catch(function () { return {}; });
        throw new Error(body.message || "Could not export expenses.");
      }
      var blob = await res.blob();
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a"); a.href = url; a.download = "bodibe-expenses.csv"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (err) { Portal.showNotice(err.message || "Could not export expenses.", "warning"); }
    finally { exportButton.disabled = false; }
  }

  rows.addEventListener("click", function (event) {
    var button = event.target.closest("[data-expense-id]");
    if (button) openExpense(button.getAttribute("data-expense-id"));
  });
  drawerBody.addEventListener("click", function (event) {
    var receipt = event.target.closest("[data-receipt-id]");
    if (receipt) return downloadReceipt(receipt.getAttribute("data-receipt-id"));
    var upload = event.target.closest("#uploadReceipt");
    if (upload) return uploadReceipt();
    var action = event.target.closest("[data-expense-action]");
    if (!action) return;
    var name = action.getAttribute("data-expense-action");
    if (name === "edit") openEditDialog(); else openAction(name);
  });

  [statusFilter, categoryFilter, fromFilter, toFilter].forEach(function (el) { el.addEventListener("change", loadExpenses); });
  searchInput.addEventListener("input", renderTable);
  document.getElementById("clearExpenseFilters").addEventListener("click", function () { statusFilter.value = ""; categoryFilter.value = ""; fromFilter.value = ""; toFilter.value = ""; searchInput.value = ""; loadExpenses(); });
  newExpenseButton.addEventListener("click", openCreateDialog);
  exportButton.addEventListener("click", exportExpenses);
  document.getElementById("closeExpenseDrawer").addEventListener("click", closeDrawer);
  drawerBackdrop.addEventListener("click", closeDrawer);
  expenseForm.addEventListener("submit", saveExpense);
  actionForm.addEventListener("submit", submitAction);
  document.querySelectorAll("[data-close-expense-dialog]").forEach(function (el) { el.addEventListener("click", function () { expenseDialog.close(); }); });
  document.querySelectorAll("[data-close-action-dialog]").forEach(function (el) { el.addEventListener("click", function () { actionDialog.close(); }); });
  document.getElementById("expenseReimbursement").addEventListener("change", function () { document.getElementById("approvalReferenceWrap").hidden = !this.checked; });

  Portal.onReady(async function () {
    try {
      await loadOptions();
      await loadExpenses();
    } catch (err) {
      console.error("Expenses workspace failed:", err);
      Portal.showNotice(err.message || "Expenses is temporarily unavailable.", "warning");
    }
  });
})(window, document);
