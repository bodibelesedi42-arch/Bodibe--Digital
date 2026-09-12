/* ==========================================================================
   BODIBE DIGITAL — CRM / LEADS WORKSPACE

   The page answers one question first and everything else second:

       WHO DO I NEED TO CONTACT TODAY?

   so the follow-up summary sits above the list, and clicking a follow-up
   bucket filters the list rather than opening a separate screen.

   SECURITY NOTE
   -------------
   Everything in this file decides what to DRAW. It is not authorisation.
   Hiding a button is not security: any employee can read this file, or skip
   it entirely and call the API with their token. Every endpoint this page
   touches re-checks the Permission Actions matrix server-side via
   requireAuth + requirePermission("CRM", "<exact action>"), and the action
   strings below are spelled exactly as the sheet spells them — including
   "Convert Lead", which really is singular where its neighbours are plural.
   ========================================================================== */

(function (window, document) {
    "use strict";

    var Portal = window.BodibePortal;
    if (!Portal) return;             // no session; the shell already redirected

    var esc = Portal.escapeHtml;

    /* ------------------------------------------------------------- constants */

    // Spelled exactly as the Permission Actions sheet spells them.
    var A_VIEW    = "View Leads";
    var A_CREATE  = "Create Leads";
    var A_EDIT    = "Edit Leads";
    var A_DELETE  = "Delete Leads";
    var A_CONVERT = "Convert Lead";
    var A_EXPORT  = "Export Leads";
    var MODULE = "CRM";

    var FOLLOWUP_LOOK = {
        overdue:  { label: "Overdue",     icon: "fa-triangle-exclamation" },
        today:    { label: "Due today",   icon: "fa-circle-dot" },
        upcoming: { label: "Upcoming",    icon: "fa-calendar-day" },
        none:     { label: "No date set", icon: "fa-minus" },
    };

    /* ----------------------------------------------------------------- state */

    var allLeads = [];
    var statuses = [];
    // The discovery questionnaire, sent by the server so the option wording
    // exists in one place rather than a second copy in here.
    var discoveryForm = { fields: [], options: {} };
    var loadFailed = false;
    var noAccess = false;
    var openLeadId = null;
    var lastFocused = null;

    var filters = { search: "", status: "", followUp: "", pkg: "", projectType: "" };

    /* ----------------------------------------------------------------- nodes */

    var el = {};
    ["crmSubtitle", "crmHeaderActions", "crmFollowUps", "crmFollowUpRow", "crmSearch",
     "crmStatus", "crmFollowUp", "crmPackage", "crmProjectType", "crmClear",
     "crmResultCount", "crmList", "leadBackdrop", "leadDrawer", "leadDrawerId",
     "leadDrawerTitle", "leadClose", "leadDrawerBody"].forEach(function (id) {
        el[id] = document.getElementById(id);
    });

    /* --------------------------------------------------------------- helpers */

    function canHere(action) { return Portal.canHere(MODULE, action); }

    // A short line explaining a control's absence, but only when the employee
    // IS authorised and it is the device policy withholding it. Someone who
    // simply lacks the permission is told nothing — their screen is just
    // smaller, which is the point of role-based navigation.
    function deviceNote(action) { return Portal.whyNotHere(MODULE, action); }

    function niceDate(value) {
        var raw = String(value == null ? "" : value).trim();
        if (!raw) return "";
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
        if (!m) return raw;                       // show whatever the sheet holds
        var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        if (isNaN(d.getTime())) return raw;
        return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
    }

    function isoDate(value) {
        var m = /^(\d{4}-\d{2}-\d{2})/.exec(String(value == null ? "" : value).trim());
        return m ? m[1] : "";
    }

    function statusClass(status) {
        return "is-" + String(status || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    }

    function unique(list) {
        var seen = {};
        var out = [];
        list.forEach(function (v) {
            var s = String(v == null ? "" : v).trim();
            if (!s || seen[s.toLowerCase()]) return;
            seen[s.toLowerCase()] = true;
            out.push(s);
        });
        return out.sort(function (a, b) { return a.localeCompare(b); });
    }

    function matchesSearch(lead, needle) {
        if (!needle) return true;
        // Lead ID, Client Name, Business Name, Email, Phone — and nothing else,
        // so a search for "won" does not quietly match a status or a note.
        return [lead.leadId, lead.clientName, lead.businessName, lead.email, lead.phone]
            .some(function (field) {
                return String(field == null ? "" : field).toLowerCase().indexOf(needle) !== -1;
            });
    }

    function visibleLeads() {
        var needle = filters.search.trim().toLowerCase();
        return allLeads.filter(function (lead) {
            if (filters.status && lead.status !== filters.status) return false;
            if (filters.followUp && lead.followUp !== filters.followUp) return false;
            if (filters.pkg && lead.selectedPackage !== filters.pkg) return false;
            if (filters.projectType && lead.projectType !== filters.projectType) return false;
            return matchesSearch(lead, needle);
        });
    }

    function anyFilterActive() {
        return Boolean(filters.search || filters.status || filters.followUp
            || filters.pkg || filters.projectType);
    }

    /* ------------------------------------------------------------ header bar */

    function renderHeaderActions() {
        if (!el.crmHeaderActions) return;
        var html = "";

        if (canHere(A_CREATE)) {
            html += '<button type="button" class="crm-btn crm-btn-primary" id="crmNew">'
                  + '<i class="fa-solid fa-plus" aria-hidden="true"></i> New lead</button>';
        }
        if (canHere(A_EXPORT)) {
            html += '<button type="button" class="crm-btn" id="crmExport">'
                  + '<i class="fa-solid fa-file-csv" aria-hidden="true"></i> Export CSV</button>';
        }

        // One combined line rather than one per control, so a phone does not
        // grow a stack of identical notices.
        var withheld = [A_CREATE, A_EXPORT].filter(function (a) { return deviceNote(a); });
        if (withheld.length) {
            html += '<p class="crm-device-note">' + esc(Portal.whyNotHere(MODULE, withheld[0])) + '</p>';
        }

        el.crmHeaderActions.innerHTML = html;

        var newBtn = document.getElementById("crmNew");
        if (newBtn) newBtn.addEventListener("click", openCreate);
        var exportBtn = document.getElementById("crmExport");
        if (exportBtn) exportBtn.addEventListener("click", exportCsv);
    }

    /* --------------------------------------------------------- follow-up bar */

    function renderFollowUps() {
        if (!el.crmFollowUps || !el.crmFollowUpRow) return;
        if (loadFailed || !allLeads.length) { el.crmFollowUps.hidden = true; return; }

        var order = ["overdue", "today", "upcoming"];
        var tally = { overdue: 0, today: 0, upcoming: 0 };
        allLeads.forEach(function (l) {
            if (tally[l.followUp] !== undefined) tally[l.followUp] += 1;
        });

        var live = order.filter(function (k) { return tally[k] > 0; });
        if (!live.length) {
            el.crmFollowUps.hidden = false;
            el.crmFollowUpRow.innerHTML = '<p class="crm-followup-clear">'
                + '<i class="fa-solid fa-check" aria-hidden="true"></i> '
                + 'Nothing is due. No lead has a follow-up date today or earlier.</p>';
            return;
        }

        el.crmFollowUps.hidden = false;
        el.crmFollowUpRow.innerHTML = order.map(function (key) {
            var look = FOLLOWUP_LOOK[key];
            var n = tally[key];
            var active = filters.followUp === key;
            return '<button type="button" class="crm-followup crm-fu-' + key
                + (active ? " is-active" : "") + '" data-followup="' + key + '"'
                + ' aria-pressed="' + (active ? "true" : "false") + '">'
                + '<span class="crm-followup-icon" aria-hidden="true"><i class="fa-solid '
                + look.icon + '"></i></span>'
                + '<span class="crm-followup-n">' + n + '</span>'
                + '<span class="crm-followup-label">' + look.label + '</span>'
                + '</button>';
        }).join("");

        Array.prototype.forEach.call(
            el.crmFollowUpRow.querySelectorAll("[data-followup]"),
            function (btn) {
                btn.addEventListener("click", function () {
                    var key = btn.getAttribute("data-followup");
                    filters.followUp = filters.followUp === key ? "" : key;
                    if (el.crmFollowUp) el.crmFollowUp.value = filters.followUp;
                    render();
                });
            }
        );
    }

    /* ------------------------------------------------------------- the list */

    // Desktop gets a table because ten columns of the same shape are easier to
    // scan in rows. Below the desktop band the same records render as cards --
    // a ten-column table on a 360px screen is a horizontal-scroll trap.
    function renderList() {
        if (!el.crmList) return;

        if (loadFailed) {
            el.crmList.innerHTML = '<p class="crm-empty">Leads could not be loaded. '
                + 'Please try again in a moment.</p>';
            if (el.crmResultCount) el.crmResultCount.textContent = "";
            return;
        }

        var rows = visibleLeads();

        if (el.crmResultCount) {
            el.crmResultCount.textContent = allLeads.length
                ? (rows.length === allLeads.length
                    ? rows.length + (rows.length === 1 ? " lead" : " leads")
                    : "Showing " + rows.length + " of " + allLeads.length + " leads")
                : "";
        }
        if (el.crmClear) el.crmClear.hidden = !anyFilterActive();

        if (!allLeads.length) {
            el.crmList.innerHTML = '<p class="crm-empty">No leads yet. '
                + 'Enquiries from the website arrive here automatically.</p>';
            return;
        }
        if (!rows.length) {
            el.crmList.innerHTML = '<p class="crm-empty">No leads match these filters.</p>';
            return;
        }

        el.crmList.innerHTML =
              '<div class="crm-table-wrap">' + tableHtml(rows) + '</div>'
            + '<ul class="crm-cards">' + rows.map(cardHtml).join("") + '</ul>';

        Array.prototype.forEach.call(
            el.crmList.querySelectorAll("[data-open-lead]"),
            function (node) {
                node.addEventListener("click", function () {
                    openLead(node.getAttribute("data-open-lead"));
                });
            }
        );
    }

    function followUpCell(lead) {
        var look = FOLLOWUP_LOOK[lead.followUp] || FOLLOWUP_LOOK.none;
        var date = niceDate(lead.followUpDate);
        // The bucket is carried by an icon AND a word, not just a colour, so it
        // survives greyscale printing and colour-blindness.
        return '<span class="crm-fu-tag crm-fu-' + lead.followUp + '">'
            + '<i class="fa-solid ' + look.icon + '" aria-hidden="true"></i>'
            + '<span>' + (date || look.label) + '</span>'
            + '</span>'
            + (date ? '<span class="crm-fu-sub">' + esc(look.label) + '</span>' : "");
    }

    function statusPill(status) {
        return '<span class="crm-status ' + statusClass(status) + '">'
            + esc(status || "—") + '</span>';
    }

    function tableHtml(rows) {
        return '<table class="crm-table">'
            + '<caption class="crm-visually-hidden">Leads</caption>'
            + '<thead><tr>'
            + '<th scope="col">Lead ID</th><th scope="col">Date</th><th scope="col">Client</th>'
            + '<th scope="col">Business</th><th scope="col">Email</th><th scope="col">Phone</th>'
            + '<th scope="col">Package</th><th scope="col">Project type</th>'
            + '<th scope="col">Status</th><th scope="col">Follow-up</th>'
            + '</tr></thead><tbody>'
            + rows.map(function (lead) {
                return '<tr class="crm-row crm-row-' + lead.followUp + '">'
                    + '<td><button type="button" class="crm-idlink" data-open-lead="'
                        + esc(lead.leadId) + '">' + esc(lead.leadId || "—") + '</button></td>'
                    + '<td>' + esc(niceDate(lead.dateReceived)) + '</td>'
                    + '<td class="crm-cell-strong">' + esc(lead.clientName || "—") + '</td>'
                    + '<td>' + esc(lead.businessName || "—") + '</td>'
                    + '<td class="crm-cell-wrap">' + (lead.email
                        ? '<a href="mailto:' + esc(lead.email) + '">' + esc(lead.email) + '</a>' : "—") + '</td>'
                    + '<td>' + (lead.phone
                        ? '<a href="tel:' + esc(lead.phone.replace(/\s+/g, "")) + '">'
                          + esc(lead.phone) + '</a>' : "—") + '</td>'
                    + '<td>' + esc(lead.selectedPackage || "—") + '</td>'
                    + '<td>' + esc(lead.projectType || "—") + '</td>'
                    + '<td>' + statusPill(lead.status) + '</td>'
                    + '<td>' + followUpCell(lead) + '</td>'
                    + '</tr>';
            }).join("")
            + '</tbody></table>';
    }

    function cardHtml(lead) {
        return '<li class="crm-card crm-row-' + lead.followUp + '">'
            + '<button type="button" class="crm-card-open" data-open-lead="' + esc(lead.leadId) + '">'
            + '<span class="crm-card-top">'
                + '<span class="crm-card-id">' + esc(lead.leadId || "—") + '</span>'
                + statusPill(lead.status)
            + '</span>'
            + '<span class="crm-card-name">' + esc(lead.clientName || "Unnamed lead") + '</span>'
            + (lead.businessName
                ? '<span class="crm-card-biz">' + esc(lead.businessName) + '</span>' : "")
            + '<span class="crm-card-meta">'
                + (lead.selectedPackage || lead.projectType
                    ? '<span>' + esc(lead.selectedPackage || lead.projectType) + '</span>' : "")
                + '<span>' + esc(niceDate(lead.dateReceived)) + '</span>'
            + '</span>'
            + '<span class="crm-card-fu">' + followUpCell(lead) + '</span>'
            + '</button>'
            + '<span class="crm-card-contact">'
                + (lead.phone ? '<a href="tel:' + esc(lead.phone.replace(/\s+/g, "")) + '">'
                    + '<i class="fa-solid fa-phone" aria-hidden="true"></i> Call</a>' : "")
                + (lead.email ? '<a href="mailto:' + esc(lead.email) + '">'
                    + '<i class="fa-solid fa-envelope" aria-hidden="true"></i> Email</a>' : "")
            + '</span>'
            + '</li>';
    }

    /* --------------------------------------------------------------- filters */

    function renderFilterOptions() {
        function fill(node, values, current) {
            if (!node) return;
            node.innerHTML = '<option value="">All</option>'
                + values.map(function (v) {
                    return '<option value="' + esc(v) + '"'
                        + (v === current ? " selected" : "") + '>' + esc(v) + '</option>';
                }).join("");
            node.value = current || "";
        }

        // The status filter offers the pipeline the server reports, plus any
        // status actually present in the data -- a lead sitting on "Paid" from
        // reconciliation must still be filterable, not invisible.
        var present = unique(allLeads.map(function (l) { return l.status; }));
        var statusOptions = statuses.slice();
        present.forEach(function (s) {
            if (statusOptions.indexOf(s) === -1) statusOptions.push(s);
        });

        fill(el.crmStatus, statusOptions, filters.status);
        fill(el.crmPackage, unique(allLeads.map(function (l) { return l.selectedPackage; })), filters.pkg);
        fill(el.crmProjectType, unique(allLeads.map(function (l) { return l.projectType; })), filters.projectType);
        if (el.crmFollowUp) el.crmFollowUp.value = filters.followUp;
    }

    function wireFilters() {
        if (el.crmSearch) {
            el.crmSearch.addEventListener("input", function () {
                filters.search = el.crmSearch.value;
                renderList();
            });
        }
        var map = [[el.crmStatus, "status"], [el.crmFollowUp, "followUp"],
                   [el.crmPackage, "pkg"], [el.crmProjectType, "projectType"]];
        map.forEach(function (pair) {
            if (!pair[0]) return;
            pair[0].addEventListener("change", function () {
                filters[pair[1]] = pair[0].value;
                render();
            });
        });
        if (el.crmClear) {
            el.crmClear.addEventListener("click", function () {
                filters = { search: "", status: "", followUp: "", pkg: "", projectType: "" };
                if (el.crmSearch) el.crmSearch.value = "";
                renderFilterOptions();
                render();
                if (el.crmSearch) el.crmSearch.focus();
            });
        }
    }

    /* ---------------------------------------------------------- lead drawer */

    function openDrawer(title, eyebrow, bodyHtml) {
        lastFocused = document.activeElement;
        if (el.leadDrawerId) el.leadDrawerId.textContent = eyebrow || "";
        if (el.leadDrawerTitle) el.leadDrawerTitle.textContent = title;
        if (el.leadDrawerBody) el.leadDrawerBody.innerHTML = bodyHtml;
        if (el.leadBackdrop) el.leadBackdrop.hidden = false;
        if (el.leadDrawer) {
            el.leadDrawer.hidden = false;
            el.leadDrawer.classList.add("is-open");
        }
        document.body.classList.add("crm-drawer-open");
        if (el.leadClose) el.leadClose.focus();
    }

    function closeDrawer() {
        openLeadId = null;
        if (el.leadDrawer) {
            el.leadDrawer.classList.remove("is-open");
            el.leadDrawer.hidden = true;
        }
        if (el.leadBackdrop) el.leadBackdrop.hidden = true;
        document.body.classList.remove("crm-drawer-open");
        if (lastFocused && lastFocused.focus) lastFocused.focus();
        lastFocused = null;
    }

    if (el.leadClose) el.leadClose.addEventListener("click", closeDrawer);
    if (el.leadBackdrop) el.leadBackdrop.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && el.leadDrawer && !el.leadDrawer.hidden) closeDrawer();
    });

    function field(label, value, opts) {
        var o = opts || {};
        var shown = String(value == null ? "" : value).trim();
        if (!shown && !o.always) return "";
        var body = o.html || esc(shown);
        return '<div class="crm-field' + (o.wide ? " is-wide" : "") + '">'
            + '<dt>' + esc(label) + '</dt><dd>' + (shown ? body : "—") + '</dd></div>';
    }

    /* =====================================================================
       DISCOVERY & QUALIFICATION

       The answers live inside the lead's Notes cell; the server parses them
       out and hands this page a structured object. The VERDICT is computed
       server-side too and simply displayed here -- deliberately, so the
       screen and the stored record can never disagree about what Bodibe
       Digital should offer.
       ===================================================================== */

    var VERDICT_LOOK = {
        "GOOD FIT":       { icon: "fa-circle-check",     tone: "good" },
        "PARTIAL FIT":    { icon: "fa-circle-half-stroke", tone: "partial" },
        "DUPLICATE RISK": { icon: "fa-triangle-exclamation", tone: "risk" },
        "NOT READY":      { icon: "fa-hourglass-half",   tone: "wait" },
        "INCOMPLETE":     { icon: "fa-circle-question",  tone: "unknown" },
    };

    function discoveryOf(lead) {
        return (lead && lead.discovery) || null;
    }

    function verdictPill(q) {
        if (!q) return "";
        var look = VERDICT_LOOK[q.verdict] || VERDICT_LOOK.INCOMPLETE;
        return '<span class="crm-verdict is-' + look.tone + '">'
            + '<i class="fa-solid ' + look.icon + '" aria-hidden="true"></i>'
            + '<span>' + esc(q.verdict) + '</span></span>';
    }

    // Renders one question from the form definition the server sent, so the
    // wording of the options exists in exactly one place.
    function discoveryControl(fieldSpec, current) {
        var key = fieldSpec.key;
        var options = (discoveryForm.options || {})[key] || [];

        if (fieldSpec.free) {
            return '<label class="crm-edit-field"><span>' + esc(fieldSpec.label) + '</span>'
                + '<input type="text" name="' + esc(key) + '" autocomplete="off" value="'
                + esc(current || "") + '" /></label>';
        }

        if (fieldSpec.multi) {
            var chosen = Array.isArray(current) ? current : [];
            return '<fieldset class="crm-disc-set">'
                + '<legend>' + esc(fieldSpec.label) + '</legend>'
                + '<div class="crm-disc-checks">'
                + options.map(function (o) {
                    var on = chosen.some(function (c) { return c.toLowerCase() === o.toLowerCase(); });
                    return '<label class="crm-disc-check"><input type="checkbox" name="' + esc(key)
                        + '" value="' + esc(o) + '"' + (on ? " checked" : "") + ' />'
                        + '<span>' + esc(o) + '</span></label>';
                  }).join("")
                + '</div></fieldset>';
        }

        return '<label class="crm-edit-field"><span>' + esc(fieldSpec.label) + '</span>'
            + '<select name="' + esc(key) + '">'
            + '<option value="">Not answered</option>'
            + options.map(function (o) {
                return '<option value="' + esc(o) + '"'
                    + (String(current || "").toLowerCase() === o.toLowerCase() ? " selected" : "")
                    + '>' + esc(o) + '</option>';
              }).join("")
            + (current && options.every(function (o) { return o.toLowerCase() !== String(current).toLowerCase(); })
                ? '<option value="' + esc(current) + '" selected>' + esc(current) + '</option>'
                : "")
            + '</select></label>';
    }

    function discoverySummaryHtml(d) {
        var rows = (discoveryForm.fields || []).map(function (f) {
            var v = d.answers ? d.answers[f.key] : "";
            var text = Array.isArray(v) ? v.join(", ") : String(v == null ? "" : v);
            return field(f.label, text, { wide: f.free || f.multi });
        }).join("");
        return rows
            ? '<dl class="crm-fields is-stacked">' + rows + '</dl>'
            : '';
    }

    // "Recommended focus" -- only what the answers actually support. Nothing
    // is added here that the prospect did not select.
    function recommendedFocusHtml(q) {
        if (!q || q.verdict === "INCOMPLETE") return "";
        var html = '<h4 class="crm-disc-subhead">Recommended focus</h4>';
        if (q.covered && q.covered.length) {
            html += '<p class="crm-disc-avoid"><i class="fa-solid fa-ban" aria-hidden="true"></i> '
                + 'Do not re-propose: <strong>' + esc(q.covered.join(", ")) + '</strong></p>';
        }
        if (q.opportunities && q.opportunities.length) {
            html += '<ul class="crm-disc-ops">'
                + q.opportunities.map(function (o) {
                    return '<li><i class="fa-solid fa-arrow-right" aria-hidden="true"></i> '
                        + esc(o) + '</li>';
                  }).join("")
                + '</ul>'
                + '<p class="crm-drawer-hint">These are the needs they selected that nobody is '
                + 'currently handling. Nothing else is suggested.</p>';
        } else {
            html += '<p class="crm-disc-avoid"><i class="fa-solid fa-ban" aria-hidden="true"></i> '
                + 'No remaining need was identified. There is nothing to propose yet.</p>';
        }
        return html;
    }

    function discoverySectionHtml(lead) {
        var d = discoveryOf(lead);
        var completed = Boolean(d && d.completed);
        var q = d && d.qualification;

        var html = '<h3 class="crm-drawer-heading">Discovery &amp; Qualification</h3>';

        html += '<div class="crm-disc-head">'
            + '<span class="crm-disc-state' + (completed ? " is-done" : "") + '">'
            + '<i class="fa-solid ' + (completed ? "fa-clipboard-check" : "fa-clipboard-list")
            + '" aria-hidden="true"></i> '
            + (completed ? "Completed" : "Not completed") + '</span>'
            + (completed && d.updatedAt
                ? '<span class="crm-disc-when">' + esc(niceDate(d.updatedAt) || d.updatedAt) + '</span>'
                : "")
            + (completed ? verdictPill(q) : "")
            + '</div>';

        if (completed && q) {
            html += '<div class="crm-disc-verdict is-' + esc((VERDICT_LOOK[q.verdict]
                || VERDICT_LOOK.INCOMPLETE).tone) + '">'
                + '<p class="crm-disc-headline">' + esc(q.headline) + '</p>'
                + '<p class="crm-disc-guidance">' + esc(q.guidance) + '</p>'
                + recommendedFocusHtml(q)
                + '</div>';
            html += discoverySummaryHtml(d);
        } else {
            html += '<p class="crm-drawer-hint">Nobody has asked this prospect what they are '
                + 'already doing. Complete discovery before preparing an audit, proposal or '
                + 'quotation.</p>';
        }

        // Answering is an edit to the lead, so it needs Edit Leads -- and the
        // device policy keeps it desktop-only exactly like every other edit.
        if (canHere(A_EDIT)) {
            html += '<div class="crm-drawer-ops">'
                + '<button type="button" class="crm-btn' + (completed ? "" : " crm-btn-primary")
                + '" id="leadDiscovery">'
                + '<i class="fa-solid fa-clipboard-question" aria-hidden="true"></i> '
                + (completed ? "Update Discovery" : "Start Discovery") + '</button>'
                + '</div>'
                + '<div id="leadDiscoveryForm" hidden></div>'
                + '<p class="crm-op-status" id="leadDiscStatus" role="status" aria-live="polite"></p>';
        }
        return html;
    }

    function discoveryFormHtml(lead) {
        var d = discoveryOf(lead);
        var answers = (d && d.answers) || {};
        return '<form class="crm-edit crm-disc-form" id="leadDiscForm" novalidate>'
            + '<p class="crm-drawer-hint">Ask these before preparing anything. Saved into this '
            + 'lead\'s notes — your existing notes are kept.</p>'
            + (discoveryForm.fields || []).map(function (f) {
                return discoveryControl(f, answers[f.key]);
              }).join("")
            + '<div class="crm-edit-actions">'
            + '<button type="submit" class="crm-btn crm-btn-primary">Save discovery</button>'
            + '<button type="button" class="crm-btn" id="leadDiscCancel">Cancel</button>'
            + '</div></form>';
    }

    function leadDetailHtml(lead) {
        var look = FOLLOWUP_LOOK[lead.followUp] || FOLLOWUP_LOOK.none;

        var html = '<div class="crm-drawer-summary">'
            + statusPill(lead.status)
            + '<span class="crm-fu-tag crm-fu-' + lead.followUp + '">'
                + '<i class="fa-solid ' + look.icon + '" aria-hidden="true"></i>'
                + '<span>' + esc(niceDate(lead.followUpDate) || look.label) + '</span></span>'
            + '</div>';

        html += '<dl class="crm-fields">'
            + field("Client", lead.clientName, { always: true })
            + field("Business", lead.businessName)
            + field("Email", lead.email, {
                html: '<a href="mailto:' + esc(lead.email) + '">' + esc(lead.email) + '</a>' })
            + field("Phone", lead.phone, {
                html: '<a href="tel:' + esc(String(lead.phone).replace(/\s+/g, "")) + '">'
                      + esc(lead.phone) + '</a>' })
            + field("Received", niceDate(lead.dateReceived))
            + field("Reference", lead.referenceId)
            + field("Package", lead.selectedPackage)
            + field("Package price", lead.packagePrice)
            + field("Project type", lead.projectType)
            + field("Quote", lead.quote)
            + '</dl>';

        var enquiry = field("Business description", lead.businessDescription, { wide: true })
            + field("Website goal", lead.websiteGoal, { wide: true })
            + field("Branding", lead.branding, { wide: true })
            + field("Content", lead.content, { wide: true })
            + field("Features", lead.features, { wide: true })
            + field("Reference website", lead.referenceWebsite, { wide: true })
            + field("Message", lead.message, { wide: true });
        if (enquiry) {
            html += '<h3 class="crm-drawer-heading">What they submitted</h3>'
                + '<dl class="crm-fields is-stacked">' + enquiry + '</dl>'
                + '<p class="crm-drawer-hint">Submitted by the client. Not editable here.</p>';
        }

        // Discovery sits between what the client told us and what we do next,
        // which is exactly where it belongs in the conversation.
        html += discoverySectionHtml(lead);

        html += '<h3 class="crm-drawer-heading">Working notes</h3>';

        if (canHere(A_EDIT)) {
            html += '<form class="crm-edit" id="leadEdit" novalidate>'
                + '<div class="crm-edit-grid">'
                + '<label class="crm-edit-field"><span>Status</span>'
                + '<select name="status">' + statuses.map(function (s) {
                    return '<option value="' + esc(s) + '"'
                        + (s === lead.status ? " selected" : "") + '>' + esc(s) + '</option>';
                  }).join("")
                + (statuses.indexOf(lead.status) === -1 && lead.status
                    ? '<option value="' + esc(lead.status) + '" selected>' + esc(lead.status)
                      + ' (current)</option>' : "")
                + '</select></label>'
                + '<label class="crm-edit-field"><span>Follow-up date</span>'
                + '<input type="date" name="followUpDate" value="' + esc(isoDate(lead.followUpDate)) + '" />'
                + '</label>'
                + '</div>'
                + '<label class="crm-edit-field"><span>Notes</span>'
                + '<textarea name="notes" rows="4" placeholder="What happened on the last call?">'
                + esc(lead.notes) + '</textarea></label>'
                + '<div class="crm-edit-actions">'
                + '<button type="submit" class="crm-btn crm-btn-primary">Save changes</button>'
                + '<span class="crm-edit-status" id="leadEditStatus" role="status" aria-live="polite"></span>'
                + '</div></form>';
        } else {
            html += '<dl class="crm-fields is-stacked">'
                + field("Follow-up date", niceDate(lead.followUpDate), { always: true, wide: true })
                + field("Notes", lead.notes, { always: true, wide: true })
                + '</dl>';
        }

        // Convert / Delete
        var ops = "";
        if (canHere(A_CONVERT)) {
            ops += '<button type="button" class="crm-btn" id="leadConvert">'
                + '<i class="fa-solid fa-file-invoice" aria-hidden="true"></i> Send to quoting</button>';
        }
        if (canHere(A_DELETE)) {
            ops += '<button type="button" class="crm-btn crm-btn-danger" id="leadDelete">'
                + '<i class="fa-solid fa-trash" aria-hidden="true"></i> Delete lead</button>';
        }
        if (ops) {
            html += '<h3 class="crm-drawer-heading">Actions</h3>'
                + '<div class="crm-drawer-ops">' + ops + '</div>'
                + '<p class="crm-op-status" id="leadOpStatus" role="status" aria-live="polite"></p>';
        }

        // ONE line for everything the device withholds, not one per section --
        // three identical "available on desktop" notices stacked down a phone
        // screen is noise, and it hides which capabilities are actually missing.
        var withheld = [
            [A_EDIT, "editing"],
            [A_CONVERT, "sending to quoting"],
            [A_EDIT, "recording discovery"],
            [A_DELETE, "deleting"],
        ].filter(function (pair) { return deviceNote(pair[0]); }).map(function (pair) { return pair[1]; });

        if (withheld.length) {
            var list = withheld.length === 1
                ? withheld[0]
                : withheld.slice(0, -1).join(", ") + " and " + withheld[withheld.length - 1];
            html += '<p class="crm-device-note is-block">For workflow quality, '
                + esc(list) + ' ' + (withheld.length === 1 ? "is" : "are")
                + ' available on desktop.</p>';
        }

        return html;
    }

    async function openLead(leadId) {
        var lead = allLeads.find(function (l) { return l.leadId === leadId; });
        if (!lead) return;
        openLeadId = leadId;
        openDrawer(lead.clientName || "Lead", lead.leadId, leadDetailHtml(lead));
        wireLeadDrawer(lead);
    }

    function wireLeadDrawer(lead) {
        var form = document.getElementById("leadEdit");
        if (form) {
            form.addEventListener("submit", function (event) {
                event.preventDefault();
                saveLead(lead, form);
            });
        }
        var disc = document.getElementById("leadDiscovery");
        if (disc) disc.addEventListener("click", function () { toggleDiscoveryForm(lead, disc); });

        var convert = document.getElementById("leadConvert");
        if (convert) convert.addEventListener("click", function () { convertLead(lead, convert); });
        var del = document.getElementById("leadDelete");
        if (del) del.addEventListener("click", function () { deleteLead(lead, del); });
    }

    function setBusy(button, busy, busyLabel) {
        if (!button) return;
        if (busy) {
            button.dataset.label = button.innerHTML;
            button.disabled = true;
            button.textContent = busyLabel || "Working…";
        } else {
            button.disabled = false;
            if (button.dataset.label) button.innerHTML = button.dataset.label;
        }
    }

    /* ------------------------------------------------------------ mutations */

    async function saveLead(lead, form) {
        var statusEl = document.getElementById("leadEditStatus");
        var submit = form.querySelector('button[type="submit"]');
        var payload = {
            status: form.elements.status.value,
            followUpDate: form.elements.followUpDate.value,
            notes: form.elements.notes.value,
        };

        setBusy(submit, true, "Saving…");
        if (statusEl) statusEl.textContent = "";
        try {
            var res = await Portal.authedFetch("/staff/leads/" + encodeURIComponent(lead.leadId), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            var data = await res.json().catch(function () { return {}; });
            setBusy(submit, false);
            if (!res.ok || !data.success) {
                if (statusEl) {
                    statusEl.textContent = data.message || "That didn't save. Please try again.";
                    statusEl.className = "crm-edit-status is-error";
                }
                return;
            }
            if (statusEl) {
                statusEl.textContent = "Saved.";
                statusEl.className = "crm-edit-status is-ok";
            }
            await reload({ keepDrawer: true });
        } catch (err) {
            setBusy(submit, false);
            if (err.sessionExpired) return Portal.goToLogin();
            console.error("Lead save failed:", err);
            if (statusEl) {
                statusEl.textContent = "Couldn't reach the server. Please try again.";
                statusEl.className = "crm-edit-status is-error";
            }
        }
    }

    /* ------------------------------------------------ discovery mutations */

    function toggleDiscoveryForm(lead, button) {
        var host = document.getElementById("leadDiscoveryForm");
        if (!host) return;
        if (!host.hidden) {
            host.hidden = true;
            host.innerHTML = "";
            button.focus();
            return;
        }
        host.hidden = false;
        host.innerHTML = discoveryFormHtml(lead);

        var form = document.getElementById("leadDiscForm");
        if (form) {
            form.addEventListener("submit", function (event) {
                event.preventDefault();
                saveDiscovery(lead, form);
            });
            var first = form.querySelector("select, input, textarea");
            if (first) first.focus();
        }
        var cancel = document.getElementById("leadDiscCancel");
        if (cancel) {
            cancel.addEventListener("click", function () {
                host.hidden = true;
                host.innerHTML = "";
                button.focus();
            });
        }
    }

    function readDiscoveryForm(form) {
        var answers = {};
        (discoveryForm.fields || []).forEach(function (f) {
            if (f.multi) {
                answers[f.key] = Array.prototype.slice
                    .call(form.querySelectorAll('input[name="' + f.key + '"]:checked'))
                    .map(function (cb) { return cb.value; });
            } else {
                var el = form.elements[f.key];
                answers[f.key] = el ? el.value : "";
            }
        });
        return answers;
    }

    async function saveDiscovery(lead, form) {
        var submit = form.querySelector('button[type="submit"]');
        var statusEl = document.getElementById("leadDiscStatus");
        setBusy(submit, true, "Saving…");
        if (statusEl) statusEl.textContent = "";
        try {
            // The existing CRM edit endpoint and the existing Notes field. No
            // new route, no new sheet, no new column.
            var res = await Portal.authedFetch(
                "/staff/leads/" + encodeURIComponent(lead.leadId),
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ discovery: readDiscoveryForm(form) }),
                }
            );
            var data = await res.json().catch(function () { return {}; });
            setBusy(submit, false);
            if (!res.ok || !data.success) {
                if (statusEl) {
                    statusEl.textContent = data.message || "That didn't save.";
                    statusEl.className = "crm-op-status is-error";
                }
                return;
            }
            // The verdict comes back from the server rather than being worked
            // out here, then the drawer redraws with it.
            await reload({ keepDrawer: true });
        } catch (err) {
            setBusy(submit, false);
            if (err.sessionExpired) return Portal.goToLogin();
            console.error("Discovery save failed:", err);
            if (statusEl) {
                statusEl.textContent = "Couldn't reach the server. Please try again.";
                statusEl.className = "crm-op-status is-error";
            }
        }
    }

    async function convertLead(lead, button) {
        var statusEl = document.getElementById("leadOpStatus");
        setBusy(button, true, "Sending…");
        if (statusEl) statusEl.textContent = "";
        try {
            var res = await Portal.authedFetch(
                "/staff/leads/" + encodeURIComponent(lead.leadId) + "/convert",
                { method: "POST" }
            );
            var data = await res.json().catch(function () { return {}; });
            setBusy(button, false);
            if (statusEl) {
                statusEl.textContent = data.message
                    || (res.ok ? "Lead moved to Quoted." : "That didn't work.");
                statusEl.className = "crm-op-status " + (res.ok && data.success ? "is-ok" : "is-error");
            }
            // A PROCESS GUARDRAIL, NOT A BLOCK. The conversion has already
            // succeeded by this point; this is the thing we wish someone had
            // seen before preparing a website proposal for a prospect who
            // already had one being built.
            if (res.ok && data.success && data.warning) {
                Portal.showNotice(data.warning);
            }
            if (res.ok && data.success) await reload({ keepDrawer: true });
        } catch (err) {
            setBusy(button, false);
            if (err.sessionExpired) return Portal.goToLogin();
            console.error("Lead convert failed:", err);
            if (statusEl) {
                statusEl.textContent = "Couldn't reach the server. Please try again.";
                statusEl.className = "crm-op-status is-error";
            }
        }
    }

    // Two deliberate speed bumps: the employee confirms in the UI, and the
    // request itself carries ?confirm=yes, so nothing deletes by accident or by
    // a replayed request. The server refuses outright when a quote or payment
    // references the lead.
    async function deleteLead(lead, button) {
        var statusEl = document.getElementById("leadOpStatus");
        var label = lead.leadId + (lead.clientName ? " (" + lead.clientName + ")" : "");
        if (!window.confirm("Delete lead " + label + "?\n\nThis clears the record. "
            + "It is refused if a quote or payment is linked to it.")) return;

        setBusy(button, true, "Deleting…");
        if (statusEl) statusEl.textContent = "";
        try {
            var res = await Portal.authedFetch(
                "/staff/leads/" + encodeURIComponent(lead.leadId) + "?confirm=yes",
                { method: "DELETE" }
            );
            var data = await res.json().catch(function () { return {}; });
            setBusy(button, false);
            if (!res.ok || !data.success) {
                if (statusEl) {
                    statusEl.textContent = data.message || "That lead couldn't be deleted.";
                    statusEl.className = "crm-op-status is-error";
                }
                return;
            }
            closeDrawer();
            Portal.showNotice(data.message || ("Lead " + lead.leadId + " was removed."));
            await reload();
        } catch (err) {
            setBusy(button, false);
            if (err.sessionExpired) return Portal.goToLogin();
            console.error("Lead delete failed:", err);
            if (statusEl) {
                statusEl.textContent = "Couldn't reach the server. Please try again.";
                statusEl.className = "crm-op-status is-error";
            }
        }
    }

    /* ------------------------------------------------------- manual capture */

    function openCreate() {
        openDrawer("New lead", "Manual capture",
              '<p class="crm-drawer-hint">For a phone enquiry, a walk-in or a referral. '
            + 'Website enquiries arrive on their own.</p>'
            + '<form class="crm-edit" id="leadCreate" novalidate>'
            + '<label class="crm-edit-field"><span>Client name *</span>'
            + '<input type="text" name="name" required autocomplete="off" /></label>'
            + '<label class="crm-edit-field"><span>Email *</span>'
            + '<input type="email" name="email" required autocomplete="off" /></label>'
            + '<div class="crm-edit-grid">'
            + '<label class="crm-edit-field"><span>Business name</span>'
            + '<input type="text" name="business" autocomplete="off" /></label>'
            + '<label class="crm-edit-field"><span>Phone</span>'
            + '<input type="tel" name="phone" autocomplete="off" /></label>'
            + '</div>'
            + '<label class="crm-edit-field"><span>Project type</span>'
            + '<input type="text" name="projectType" autocomplete="off"'
            + ' placeholder="Website Design, Branding…" /></label>'
            + '<label class="crm-edit-field"><span>What they need</span>'
            + '<textarea name="message" rows="4"></textarea></label>'
            + '<div class="crm-edit-actions">'
            + '<button type="submit" class="crm-btn crm-btn-primary">Create lead</button>'
            + '<span class="crm-edit-status" id="leadCreateStatus" role="status" aria-live="polite"></span>'
            + '</div></form>');

        var form = document.getElementById("leadCreate");
        if (!form) return;
        var first = form.elements.name;
        if (first) first.focus();
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            createLead(form);
        });
    }

    async function createLead(form) {
        var statusEl = document.getElementById("leadCreateStatus");
        var submit = form.querySelector('button[type="submit"]');
        var payload = {
            name: form.elements.name.value.trim(),
            email: form.elements.email.value.trim(),
            business: form.elements.business.value.trim(),
            phone: form.elements.phone.value.trim(),
            projectType: form.elements.projectType.value.trim(),
            message: form.elements.message.value.trim(),
        };
        if (!payload.name || !payload.email) {
            if (statusEl) {
                statusEl.textContent = "A client name and email address are required.";
                statusEl.className = "crm-edit-status is-error";
            }
            return;
        }

        setBusy(submit, true, "Creating…");
        if (statusEl) statusEl.textContent = "";
        try {
            var res = await Portal.authedFetch("/staff/leads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            var data = await res.json().catch(function () { return {}; });
            setBusy(submit, false);
            if (!res.ok || !data.success) {
                if (statusEl) {
                    statusEl.textContent = data.message || "That lead couldn't be created.";
                    statusEl.className = "crm-edit-status is-error";
                }
                return;
            }
            closeDrawer();
            Portal.showNotice("Lead " + (data.leadId || "") + " created.");
            await reload();
        } catch (err) {
            setBusy(submit, false);
            if (err.sessionExpired) return Portal.goToLogin();
            console.error("Lead create failed:", err);
            if (statusEl) {
                statusEl.textContent = "Couldn't reach the server. Please try again.";
                statusEl.className = "crm-edit-status is-error";
            }
        }
    }

    /* ---------------------------------------------------------------- export */

    // The CSV endpoint needs the Authorization header, so a plain link cannot
    // fetch it — the file is pulled as a blob and handed to the browser.
    async function exportCsv() {
        var button = document.getElementById("crmExport");
        setBusy(button, true, "Preparing…");
        try {
            var res = await Portal.authedFetch("/staff/leads-export.csv");
            if (!res.ok) {
                setBusy(button, false);
                Portal.showNotice("The export couldn't be produced right now.", "warning");
                return;
            }
            var blob = await res.blob();
            var url = URL.createObjectURL(blob);
            var a = document.createElement("a");
            a.href = url;
            a.download = "bodibe-leads-" + new Date().toISOString().slice(0, 10) + ".csv";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setBusy(button, false);
        } catch (err) {
            setBusy(button, false);
            if (err.sessionExpired) return Portal.goToLogin();
            console.error("Lead export failed:", err);
            Portal.showNotice("The export couldn't be produced right now.", "warning");
        }
    }

    /* ------------------------------------------------------------------ load */

    async function load() {
        try {
            var res = await Portal.authedFetch("/staff/leads");
            // 403 is not a failure to retry -- the role simply does not have
            // View Leads. The server is the one that decided it.
            if (res.status === 403) {
                noAccess = true;
                return;
            }
            if (!res.ok) throw new Error("leads_failed_" + res.status);
            var data = await res.json();
            if (!data.success || !Array.isArray(data.leads)) throw new Error("leads_malformed");
            allLeads = data.leads;
            statuses = Array.isArray(data.statuses) ? data.statuses : [];
            if (data.discoveryForm && Array.isArray(data.discoveryForm.fields)) {
                discoveryForm = data.discoveryForm;
            }
            loadFailed = false;
        } catch (err) {
            if (err.sessionExpired) return Portal.goToLogin();
            console.error("Leads load failed:", err);
            loadFailed = true;
        }
    }

    async function reload(options) {
        var keep = options && options.keepDrawer ? openLeadId : null;
        await load();
        renderFilterOptions();
        render();
        if (keep) {
            var still = allLeads.find(function (l) { return l.leadId === keep; });
            if (still && el.leadDrawerBody) {
                // Redraw the open drawer against the saved record rather than
                // closing it, so the employee sees the change land.
                el.leadDrawerBody.innerHTML = leadDetailHtml(still);
                wireLeadDrawer(still);
            }
        }
    }

    /* ---------------------------------------------------------------- render */

    function subtitleText() {
        if (loadFailed) return "Leads are unavailable right now.";
        if (!allLeads.length) return "No leads captured yet.";
        var due = allLeads.filter(function (l) {
            return l.followUp === "overdue" || l.followUp === "today";
        }).length;
        return allLeads.length + (allLeads.length === 1 ? " lead" : " leads")
            + (due ? " · " + due + " needing contact today" : " · nothing due today");
    }

    function render() {
        if (noAccess) { showNoAccess(); return; }
        if (el.crmSubtitle) el.crmSubtitle.textContent = subtitleText();
        renderHeaderActions();
        renderFollowUps();
        renderList();
    }

    function showNoAccess() {
        if (el.crmSubtitle) el.crmSubtitle.textContent = "";
        if (el.crmHeaderActions) el.crmHeaderActions.innerHTML = "";
        if (el.crmFollowUps) el.crmFollowUps.hidden = true;
        var toolbar = document.querySelector(".crm-toolbar");
        if (toolbar) toolbar.hidden = true;
        if (el.crmResultCount) el.crmResultCount.textContent = "";
        if (el.crmList) {
            el.crmList.innerHTML = '<p class="crm-empty">'
                + 'You don\'t have access to the CRM. If you think that\'s wrong, '
                + 'speak to your manager.</p>';
        }
    }

    /* ------------------------------------------------------------------ boot */

    Portal.onReady(async function () {
        // The server decides this too (requirePermission on every route). This
        // check only avoids drawing a workspace that would answer 403.
        if (!Portal.can(MODULE, A_VIEW)) {
            showNoAccess();
            return;
        }
        wireFilters();
        await load();
        renderFilterOptions();
        render();

        // Crossing a device band has to redraw every control the policy gates,
        // otherwise a button withheld at 500px stays missing after the window
        // is widened.
        Portal.onModeChange(function () {
            render();
            if (openLeadId) {
                var lead = allLeads.find(function (l) { return l.leadId === openLeadId; });
                if (lead && el.leadDrawerBody) {
                    el.leadDrawerBody.innerHTML = leadDetailHtml(lead);
                    wireLeadDrawer(lead);
                }
            }
        });
    });

    Portal.onFail(function () {
        loadFailed = true;
        render();
    });
})(window, document);
