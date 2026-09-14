/* Bodibe Digital — Staff Finance workspace */
(function (window, document) {
    "use strict";

    var Portal = window.BodibePortal;
    if (!Portal) return;
    var esc = Portal.escapeHtml;

    var state = {
        invoices: [], invoiceSummary: {}, payments: [], paymentSummary: {}, report: null,
        activeTab: null, selectedType: null, selected: null,
    };

    var tabsEl = document.getElementById("financeTabs");
    var headerActionsEl = document.getElementById("financeHeaderActions");
    var invoiceView = document.getElementById("invoiceView");
    var paymentView = document.getElementById("paymentView");
    var reportView = document.getElementById("reportView");
    var invoiceSummaryEl = document.getElementById("invoiceSummary");
    var paymentSummaryEl = document.getElementById("paymentSummary");
    var invoiceListEl = document.getElementById("invoiceList");
    var paymentListEl = document.getElementById("paymentList");
    var invoiceCountEl = document.getElementById("invoiceCount");
    var paymentCountEl = document.getElementById("paymentCount");
    var invoiceSearch = document.getElementById("invoiceSearch");
    var paymentSearch = document.getElementById("paymentSearch");
    var invoiceStatus = document.getElementById("invoiceStatus");
    var paymentStatus = document.getElementById("paymentStatus");
    var paymentMethod = document.getElementById("paymentMethod");
    var reportEl = document.getElementById("financeReport");
    var drawer = document.getElementById("financeDrawer");
    var drawerBackdrop = document.getElementById("financeBackdrop");
    var drawerTitle = document.getElementById("financeDrawerTitle");
    var drawerEyebrow = document.getElementById("financeDrawerEyebrow");
    var drawerBody = document.getElementById("financeDrawerBody");
    var modal = document.getElementById("financeModal");
    var modalBackdrop = document.getElementById("financeModalBackdrop");
    var modalTitle = document.getElementById("financeModalTitle");
    var modalBody = document.getElementById("financeModalBody");

    function money(value) {
        var n = Number(value || 0);
        return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(isFinite(n) ? n : 0);
    }
    function formatDate(value) {
        if (!value) return "—";
        var d = new Date(String(value).length === 10 ? value + "T00:00:00" : value);
        return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
    }
    function badge(value) {
        var text = String(value || "Unknown");
        var key = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        return '<span class="finance-badge finance-badge-' + esc(key) + '">' + esc(text) + '</span>';
    }
    function unique(values) {
        var seen = {};
        return values.filter(function (value) {
            var text = String(value || "").trim();
            var key = text.toLowerCase();
            if (!text || seen[key]) return false;
            seen[key] = true; return true;
        });
    }
    function kpi(label, value) {
        return '<article class="finance-kpi"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></article>';
    }
    function detail(label, value) {
        return '<div class="finance-detail"><span>' + esc(label) + '</span><strong>' + esc(value == null || value === "" ? "—" : value) + '</strong></div>';
    }
    function apiError(data, fallback) { return data && data.message ? data.message : fallback; }

    function availableTabs() {
        var tabs = [];
        if (Portal.can("Finance", "View Invoices")) tabs.push({ id: "invoices", label: "Invoices", icon: "fa-file-invoice-dollar" });
        if (Portal.can("Finance", "View Payments")) tabs.push({ id: "payments", label: "Payments", icon: "fa-credit-card" });
        if (Portal.can("Finance", "View Financial Reports")) tabs.push({ id: "reports", label: "Reports", icon: "fa-chart-line" });
        return tabs;
    }

    function renderTabs() {
        var tabs = availableTabs();
        if (!state.activeTab || !tabs.some(function (x) { return x.id === state.activeTab; })) state.activeTab = tabs.length ? tabs[0].id : null;
        tabsEl.innerHTML = tabs.map(function (tab) {
            return '<button type="button" class="finance-tab' + (tab.id === state.activeTab ? ' is-active' : '') + '" data-finance-tab="' + tab.id + '"><i class="fa-solid ' + tab.icon + '"></i> ' + esc(tab.label) + '</button>';
        }).join("");
        Array.prototype.forEach.call(tabsEl.querySelectorAll("[data-finance-tab]"), function (button) {
            button.addEventListener("click", function () { state.activeTab = button.getAttribute("data-finance-tab"); renderTabs(); renderViews(); renderHeaderActions(); });
        });
        renderViews();
    }

    function renderViews() {
        invoiceView.hidden = state.activeTab !== "invoices";
        paymentView.hidden = state.activeTab !== "payments";
        reportView.hidden = state.activeTab !== "reports";
    }

    function renderHeaderActions() {
        var html = '<div class="finance-actions">';
        if (state.activeTab === "invoices" && Portal.canHere("Finance", "Create Invoices")) html += '<button class="finance-primary" id="financeCreateInvoice"><i class="fa-solid fa-plus"></i>Create invoice</button>';
        if (state.activeTab === "payments" && Portal.canHere("Finance", "Record Payments")) html += '<button class="finance-primary" id="financeRecordBank"><i class="fa-solid fa-building-columns"></i>Record bank payment</button>';
        html += '</div>';
        headerActionsEl.innerHTML = html;
        var create = document.getElementById("financeCreateInvoice"); if (create) create.addEventListener("click", openCreateInvoice);
        var bank = document.getElementById("financeRecordBank"); if (bank) bank.addEventListener("click", openRecordBank);
    }

    function renderInvoiceSummary() {
        var s = state.invoiceSummary || {};
        invoiceSummaryEl.innerHTML = kpi("Total invoiced", money(s.totalInvoiced)) + kpi("Received", money(s.totalPaid)) + kpi("Outstanding", money(s.outstanding)) + kpi("Overdue", String(s.overdue || 0));
    }
    function renderPaymentSummary() {
        var s = state.paymentSummary || {};
        paymentSummaryEl.innerHTML = kpi("Verified", money(s.verifiedAmount)) + kpi("Pending", money(s.pendingAmount)) + kpi("Verified records", String(s.verified || 0)) + kpi("Pending records", String(s.pending || 0));
    }

    function renderInvoiceFilters() {
        var current = invoiceStatus.value;
        invoiceStatus.innerHTML = '<option value="">All statuses</option>' + unique(state.invoices.map(function (x) { return x.status; })).map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + '</option>'; }).join("");
        invoiceStatus.value = current;
    }
    function renderPaymentFilters() {
        var st = paymentStatus.value, method = paymentMethod.value;
        paymentStatus.innerHTML = '<option value="">All statuses</option>' + unique(state.payments.map(function (x) { return x.status; })).map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + '</option>'; }).join("");
        paymentMethod.innerHTML = '<option value="">All methods</option>' + unique(state.payments.map(function (x) { return x.method; })).map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + '</option>'; }).join("");
        paymentStatus.value = st; paymentMethod.value = method;
    }

    function filteredInvoices() {
        var q = String(invoiceSearch.value || "").trim().toLowerCase();
        return state.invoices.filter(function (x) {
            if (invoiceStatus.value && x.status !== invoiceStatus.value) return false;
            if (!q) return true;
            return [x.invoiceId, x.quoteId, x.leadId, x.clientName, x.clientEmail].some(function (v) { return String(v || "").toLowerCase().indexOf(q) !== -1; });
        });
    }
    function filteredPayments() {
        var q = String(paymentSearch.value || "").trim().toLowerCase();
        return state.payments.filter(function (x) {
            if (paymentStatus.value && x.status !== paymentStatus.value) return false;
            if (paymentMethod.value && x.method !== paymentMethod.value) return false;
            if (!q) return true;
            return [x.transactionId, x.invoiceId, x.referenceId, x.providerReference, x.method].some(function (v) { return String(v || "").toLowerCase().indexOf(q) !== -1; });
        });
    }

    function renderInvoices() {
        var rows = filteredInvoices();
        invoiceCountEl.textContent = rows.length + " invoice" + (rows.length === 1 ? "" : "s");
        if (!rows.length) { invoiceListEl.innerHTML = '<p class="finance-empty">No invoices match this view.</p>'; return; }
        var head = '<div class="finance-head"><span>Invoice</span><span>Client</span><span>Status</span><span>Total</span><span>Paid</span><span>Due</span></div>';
        var body = rows.map(function (x) {
            return '<button type="button" class="finance-row" data-invoice="' + esc(x.invoiceId) + '"><span><strong>' + esc(x.invoiceId) + '</strong><small>' + esc(x.quoteId || "No quote") + '</small></span><span><strong>' + esc(x.clientName || "—") + '</strong><small>' + esc(x.clientEmail || "") + '</small></span><span>' + badge(x.status) + '</span><span class="finance-money">' + esc(money(x.total)) + '</span><span class="finance-money">' + esc(money(x.amountPaid)) + '</span><span><strong>' + esc(formatDate(x.dueDate)) + '</strong><small>' + esc(money(x.balanceDue)) + ' due</small></span></button>';
        }).join("");
        invoiceListEl.innerHTML = head + body;
        Array.prototype.forEach.call(invoiceListEl.querySelectorAll("[data-invoice]"), function (el) { el.addEventListener("click", function () { openInvoice(el.getAttribute("data-invoice")); }); });
    }

    function renderPayments() {
        var rows = filteredPayments();
        paymentCountEl.textContent = rows.length + " payment" + (rows.length === 1 ? "" : "s");
        if (!rows.length) { paymentListEl.innerHTML = '<p class="finance-empty">No payments match this view.</p>'; return; }
        var head = '<div class="finance-head"><span>Transaction</span><span>Method</span><span>Status</span><span>Invoice</span><span>Amount</span><span>Received</span></div>';
        var body = rows.map(function (x) {
            return '<button type="button" class="finance-row" data-payment="' + esc(x.transactionId) + '"><span><strong>' + esc(x.transactionId) + '</strong><small>' + esc(x.providerReference || x.referenceId || "") + '</small></span><span><strong>' + esc(x.method || "—") + '</strong><small>' + esc(x.source || "") + '</small></span><span>' + badge(x.status) + '</span><span><strong>' + esc(x.invoiceId || "—") + '</strong></span><span class="finance-money">' + esc(money(x.amount)) + '</span><span><strong>' + esc(formatDate(x.dateReceived)) + '</strong><small>' + esc(x.verifiedBy ? "Verified by " + x.verifiedBy : "") + '</small></span></button>';
        }).join("");
        paymentListEl.innerHTML = head + body;
        Array.prototype.forEach.call(paymentListEl.querySelectorAll("[data-payment]"), function (el) { el.addEventListener("click", function () { openPayment(el.getAttribute("data-payment")); }); });
    }

    function openDrawer(type, record) {
        state.selectedType = type; state.selected = record;
        drawer.hidden = false; drawerBackdrop.hidden = false; document.body.classList.add("finance-lock");
        renderDrawer();
        document.getElementById("financeDrawerClose").focus();
    }
    function closeDrawer() { drawer.hidden = true; drawerBackdrop.hidden = true; document.body.classList.remove("finance-lock"); state.selected = null; state.selectedType = null; }

    function renderDrawer() {
        var x = state.selected; if (!x) return;
        if (state.selectedType === "invoice") {
            drawerEyebrow.textContent = x.invoiceId; drawerTitle.textContent = x.clientName || "Invoice";
            var actions = "";
            if (Portal.canHere("Finance", "Edit Invoices")) actions += '<button class="finance-secondary" data-finance-action="edit-invoice"><i class="fa-solid fa-pen"></i>Edit due date / notes</button>';
            drawerBody.innerHTML = '<div class="finance-detail-grid">' + detail("Status", x.status) + detail("Quote", x.quoteId) + detail("Lead", x.leadId) + detail("Issued", formatDate(x.dateIssued)) + detail("Due", formatDate(x.dueDate)) + detail("Total", money(x.total)) + detail("Amount paid", money(x.amountPaid)) + detail("Balance due", money(x.balanceDue)) + detail("Deposit due", money(x.depositDue)) + detail("VAT", money(x.vat)) + '</div>' + (x.notes ? '<div class="finance-note">' + esc(x.notes) + '</div>' : '') + (actions ? '<div class="finance-drawer-actions">' + actions + '</div>' : '');
        } else {
            drawerEyebrow.textContent = x.transactionId; drawerTitle.textContent = x.method || "Payment";
            var pendingBank = String(x.method || "").toLowerCase() === "bank transfer" && String(x.status || "").toLowerCase() === "pending verification";
            var paymentActions = "";
            if (pendingBank && Portal.canHere("Finance", "Verify Payments")) {
                paymentActions += '<button class="finance-primary" data-finance-action="verify-payment"><i class="fa-solid fa-check"></i>Verify received</button>';
                paymentActions += '<button class="finance-danger" data-finance-action="reject-payment"><i class="fa-solid fa-xmark"></i>Reject</button>';
            }
            drawerBody.innerHTML = '<div class="finance-detail-grid">' + detail("Status", x.status) + detail("Method", x.method) + detail("Invoice", x.invoiceId) + detail("Amount", money(x.amount)) + detail("Received", formatDate(x.dateReceived)) + detail("Bank/provider reference", x.providerReference || x.referenceId) + detail("Verified by", x.verifiedBy) + detail("Verified date", formatDate(x.verifiedDate)) + '</div>' + (x.notes ? '<div class="finance-note">' + esc(x.notes) + '</div>' : '') + (paymentActions ? '<div class="finance-drawer-actions">' + paymentActions + '</div>' : '');
        }
        Array.prototype.forEach.call(drawerBody.querySelectorAll("[data-finance-action]"), function (btn) {
            btn.addEventListener("click", function () {
                var action = btn.getAttribute("data-finance-action");
                if (action === "edit-invoice") openEditInvoice(x);
                if (action === "verify-payment") openVerifyPayment(x);
                if (action === "reject-payment") openRejectPayment(x);
            });
        });
    }
    function openInvoice(id) { var x = state.invoices.find(function (i) { return i.invoiceId === id; }); if (x) openDrawer("invoice", x); }
    function openPayment(id) { var x = state.payments.find(function (p) { return p.transactionId === id; }); if (x) openDrawer("payment", x); }

    function openModal(title, html) { modalTitle.textContent = title; modalBody.innerHTML = html; modal.hidden = false; modalBackdrop.hidden = false; document.body.classList.add("finance-lock"); }
    function closeModal() { modal.hidden = true; modalBackdrop.hidden = true; modalBody.innerHTML = ""; document.body.classList.remove("finance-lock"); }
    function formActions(label) { return '<div class="finance-form-actions"><button type="button" class="finance-secondary" data-modal-cancel>Cancel</button><button type="submit" class="finance-primary">' + esc(label) + '</button></div>'; }
    function bindCancel(form) { var b = form.querySelector("[data-modal-cancel]"); if (b) b.addEventListener("click", closeModal); }

    async function openCreateInvoice() {
        try {
            var res = await Portal.authedFetch("/staff/invoices/options"); var data = await res.json();
            if (!res.ok || !data.success) throw new Error(apiError(data, "Could not load accepted quotes."));
            var options = (data.quotes || []).map(function (q) { return '<option value="' + esc(q.quoteId) + '">' + esc(q.quoteId + " · " + (q.clientName || "Client") + " · " + money(q.total)) + '</option>'; }).join("");
            openModal("Create invoice", '<form class="finance-form" id="invoiceCreateForm"><div class="finance-form-grid"><label class="finance-form-wide">Accepted quote<select name="quoteId" required><option value="">Choose quote</option>' + options + '</select></label><label>Due date<input type="date" name="dueDate" /></label><label class="finance-form-wide">Notes<textarea name="notes" maxlength="1200"></textarea></label></div><p class="finance-help">Only accepted quotes are available. Money, client identity and payment state are server-controlled.</p>' + formActions("Create invoice") + '</form>');
            var form = document.getElementById("invoiceCreateForm"); bindCancel(form);
            form.addEventListener("submit", async function (e) { e.preventDefault(); var fd = new FormData(form); await submitJson("/staff/invoices", "POST", { quoteId: fd.get("quoteId") || "", dueDate: fd.get("dueDate") || "", notes: fd.get("notes") || "" }, "Invoice created."); closeModal(); await loadInvoices(); });
        } catch (err) { if (err.sessionExpired) return Portal.goToLogin(); Portal.showNotice(err.message, "warning"); }
    }

    function openEditInvoice(invoice) {
        closeDrawer();
        openModal("Edit " + invoice.invoiceId, '<form class="finance-form" id="invoiceEditForm"><div class="finance-form-grid"><label>Due date<input type="date" name="dueDate" value="' + esc(invoice.dueDate || "") + '" required /></label><label class="finance-form-wide">Notes<textarea name="notes" maxlength="1200">' + esc(invoice.notes || "") + '</textarea></label></div><p class="finance-help">Payment totals and status cannot be edited here.</p>' + formActions("Save changes") + '</form>');
        var form = document.getElementById("invoiceEditForm"); bindCancel(form);
        form.addEventListener("submit", async function (e) { e.preventDefault(); var fd = new FormData(form); await submitJson("/staff/invoices/" + encodeURIComponent(invoice.invoiceId), "PATCH", { dueDate: fd.get("dueDate"), notes: fd.get("notes") || "" }, "Invoice updated."); closeModal(); await loadInvoices(); });
    }

    function openRecordBank() {
        var options = state.invoices.filter(function (x) { return String(x.status || "").toLowerCase() !== "paid"; }).map(function (x) { return '<option value="' + esc(x.invoiceId) + '">' + esc(x.invoiceId + " · " + (x.clientName || "Client") + " · balance " + money(x.balanceDue)) + '</option>'; }).join("");
        openModal("Record bank transfer", '<form class="finance-form" id="bankPaymentForm"><div class="finance-form-grid"><label class="finance-form-wide">Invoice<select name="invoiceId" required><option value="">Choose invoice</option>' + options + '</select></label><label>Amount received<input type="number" min="0.01" step="0.01" name="amount" required /></label><label>Bank / statement reference<input name="providerReference" maxlength="160" required /></label><label class="finance-form-wide">Notes<textarea name="notes" maxlength="1200"></textarea></label></div><p class="finance-help">Recording a transfer does not mark the invoice paid. A user with Verify Payments must confirm the money is visible in the business bank account.</p>' + formActions("Record pending payment") + '</form>');
        var form = document.getElementById("bankPaymentForm"); bindCancel(form);
        form.addEventListener("submit", async function (e) { e.preventDefault(); var fd = new FormData(form); await submitJson("/staff/payments/bank", "POST", { invoiceId: fd.get("invoiceId"), amount: Number(fd.get("amount")), providerReference: fd.get("providerReference"), notes: fd.get("notes") || "" }, "Bank payment recorded for verification."); closeModal(); await loadPayments(); });
    }

    function openVerifyPayment(payment) {
        closeDrawer();
        openModal("Verify " + payment.transactionId, '<form class="finance-form" id="verifyPaymentForm"><p class="finance-help"><strong>Do not verify from a proof-of-payment image alone.</strong> Confirm the funds are actually visible in the Bodibe Digital bank account.</p><label class="finance-confirm"><input type="checkbox" name="confirmed" required /><span>I have checked the business bank account and confirm this payment was received.</span></label><label class="finance-form-wide">Verification note<textarea name="verificationNote" maxlength="600"></textarea></label>' + formActions("Verify payment") + '</form>');
        var form = document.getElementById("verifyPaymentForm"); bindCancel(form);
        form.addEventListener("submit", async function (e) { e.preventDefault(); var fd = new FormData(form); await submitJson("/staff/payments/" + encodeURIComponent(payment.transactionId) + "/verify", "POST", { confirmedReceived: fd.get("confirmed") === "on", verificationNote: fd.get("verificationNote") || "" }, "Payment verified."); closeModal(); await Promise.all([loadInvoices(), loadPayments(), loadReport()]); });
    }

    function openRejectPayment(payment) {
        closeDrawer();
        openModal("Reject " + payment.transactionId, '<form class="finance-form" id="rejectPaymentForm"><label>Reason<textarea name="reason" maxlength="600" required></textarea></label><p class="finance-help">Reject only when the transfer cannot be confirmed or the record is incorrect.</p>' + formActions("Reject payment") + '</form>');
        var form = document.getElementById("rejectPaymentForm"); bindCancel(form);
        form.addEventListener("submit", async function (e) { e.preventDefault(); var fd = new FormData(form); await submitJson("/staff/payments/" + encodeURIComponent(payment.transactionId) + "/reject", "POST", { reason: fd.get("reason") || "" }, "Payment rejected."); closeModal(); await loadPayments(); });
    }

    async function submitJson(path, method, body, successMessage) {
        try {
            var res = await Portal.authedFetch(path, { method: method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            var data = await res.json();
            if (!res.ok || !data.success) throw new Error(apiError(data, "Finance action failed."));
            Portal.showNotice(successMessage); return data;
        } catch (err) { if (err.sessionExpired) { Portal.goToLogin(); throw err; } Portal.showNotice(err.message || "Finance action failed.", "warning"); throw err; }
    }

    async function loadInvoices() {
        if (!Portal.can("Finance", "View Invoices")) return;
        try { var res = await Portal.authedFetch("/staff/invoices"); var data = await res.json(); if (!res.ok || !data.success) throw new Error(apiError(data, "Could not load invoices.")); state.invoices = data.invoices || []; state.invoiceSummary = data.summary || {}; renderInvoiceSummary(); renderInvoiceFilters(); renderInvoices(); renderHeaderActions(); }
        catch (err) { if (err.sessionExpired) return Portal.goToLogin(); invoiceListEl.innerHTML = '<p class="finance-empty">Invoices could not be loaded.</p>'; }
    }
    async function loadPayments() {
        if (!Portal.can("Finance", "View Payments")) return;
        try { var res = await Portal.authedFetch("/staff/payments"); var data = await res.json(); if (!res.ok || !data.success) throw new Error(apiError(data, "Could not load payments.")); state.payments = data.payments || []; state.paymentSummary = data.summary || {}; renderPaymentSummary(); renderPaymentFilters(); renderPayments(); renderHeaderActions(); }
        catch (err) { if (err.sessionExpired) return Portal.goToLogin(); paymentListEl.innerHTML = '<p class="finance-empty">Payments could not be loaded.</p>'; }
    }
    async function loadReport() {
        if (!Portal.can("Finance", "View Financial Reports")) return;
        try { var res = await Portal.authedFetch("/staff/finance-report"); var data = await res.json(); if (!res.ok || !data.success) throw new Error(apiError(data, "Could not load report.")); state.report = data.report; renderReport(); }
        catch (err) { if (err.sessionExpired) return Portal.goToLogin(); reportEl.innerHTML = '<p class="finance-empty">Financial report could not be loaded.</p>'; }
    }

    function reportRows(rows) { return rows.map(function (r) { return '<div class="finance-report-row"><span>' + esc(r[0]) + '</span><strong>' + esc(r[1]) + '</strong></div>'; }).join(""); }
    function renderReport() {
        var r = state.report || {}, i = r.invoices || {}, p = r.payments || {}, by = r.byMethod || {};
        var methods = Object.keys(by).map(function (name) { return [name, money(by[name].amount) + " · " + by[name].count + " records"]; });
        reportEl.innerHTML = '<div class="finance-report-grid"><article class="finance-report-card"><h3>Invoices</h3>' + reportRows([["Total invoiced", money(i.totalInvoiced)], ["Received", money(i.totalPaid)], ["Outstanding", money(i.outstanding)], ["Overdue", String(i.overdue || 0)]]) + '</article><article class="finance-report-card"><h3>Payments</h3>' + reportRows([["Verified", money(p.verifiedAmount)], ["Pending", money(p.pendingAmount)], ["Verified records", String(p.verified || 0)], ["Rejected", String(p.rejected || 0)]]) + '</article><article class="finance-report-card"><h3>By payment method</h3>' + (methods.length ? reportRows(methods) : '<p class="finance-help">No payment records yet.</p>') + '</article></div>';
    }

    invoiceSearch.addEventListener("input", renderInvoices); invoiceStatus.addEventListener("change", renderInvoices);
    paymentSearch.addEventListener("input", renderPayments); paymentStatus.addEventListener("change", renderPayments); paymentMethod.addEventListener("change", renderPayments);
    document.getElementById("financeDrawerClose").addEventListener("click", closeDrawer); drawerBackdrop.addEventListener("click", closeDrawer);
    document.getElementById("financeModalClose").addEventListener("click", closeModal); modalBackdrop.addEventListener("click", closeModal);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (!modal.hidden) closeModal(); else if (!drawer.hidden) closeDrawer(); } });

    Portal.onReady(function () {
        renderTabs(); renderHeaderActions();
        Promise.all([loadInvoices(), loadPayments(), loadReport()]);
    });
    Portal.onFail(function () { tabsEl.innerHTML = ""; headerActionsEl.innerHTML = ""; });
    Portal.onModeChange(function () { renderHeaderActions(); if (!drawer.hidden) renderDrawer(); });
})(window, document);
