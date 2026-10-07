/* Bodibe Digital — Staff Tasks workspace */
(function (window, document) {
    "use strict";

    var Portal = window.BodibePortal;
    if (!Portal) return;
    var esc = Portal.escapeHtml;
    var state = { tasks: [], counts: {}, filters: {}, projects: [], selected: null, staff: null, view: "today", batchDate: "" };

    var listEl = document.getElementById("taskList");
    var countEl = document.getElementById("taskResultCount");
    var summaryEl = document.getElementById("tasksSummary");
    var searchEl = document.getElementById("taskSearch");
    var projectEl = document.getElementById("taskProject");
    var statusEl = document.getElementById("taskStatus");
    var assigneeEl = document.getElementById("taskAssignee");
    var clearEl = document.getElementById("taskClear");
    var actionsEl = document.getElementById("tasksHeaderActions");
    var drawer = document.getElementById("taskDrawer");
    var drawerBackdrop = document.getElementById("taskBackdrop");
    var drawerBody = document.getElementById("taskDrawerBody");
    var drawerId = document.getElementById("taskDrawerId");
    var drawerTitle = document.getElementById("taskDrawerTitle");
    var modal = document.getElementById("taskModal");
    var modalBackdrop = document.getElementById("taskModalBackdrop");
    var modalTitle = document.getElementById("taskModalTitle");
    var modalBody = document.getElementById("taskModalBody");
    var pageTitle = document.querySelector(".dash-greeting h1");
    var pageRole = document.querySelector(".dash-greeting .dash-role");

    function formatDate(value) {
        if (!value) return "—";
        var d = new Date(value + (String(value).length === 10 ? "T00:00:00" : ""));
        if (isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
    }

    function statusText(task) { return String(task.status || "Not Started"); }
    function statusKey(task) { return statusText(task).trim().toLowerCase(); }
    function isClosedTask(task) { return ["completed", "cancelled", "not completed"].indexOf(statusKey(task)) !== -1; }
    function progressPct(value) {
        var n = Number(value);
        if (!isFinite(n)) n = 0;
        if (n <= 1) n *= 100;
        return Math.max(0, Math.min(100, Math.round(n)));
    }
    function isAutoSalesTask(task) {
        return Boolean(task && task.autoTracking && task.autoTracking.enabled && task.autoTracking.type === "sales_contact_target");
    }
    function badgeClass(value) {
        var s = String(value || "not-started").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        return "task-badge task-badge-" + (s || "not-started");
    }
    function projectName(id) {
        var p = state.projects.find(function (x) { return x.projectId === id; });
        return p ? (p.clientName || p.projectType || id) : id;
    }
    function taskWorkLabel(task) {
        return isAutoSalesTask(task) ? "Sales target" : (task.projectId || "—");
    }
    function taskWorkDetail(task) {
        if (isAutoSalesTask(task)) return "Automatic CRM target";
        return projectName(task.projectId) || "—";
    }

    function summaryCard(label, value, icon) {
        return '<article class="task-summary-card"><span><i class="fa-solid ' + icon + '" aria-hidden="true"></i>'
            + esc(label) + '</span><strong>' + Number(value || 0) + '</strong></article>';
    }
    function renderSummary() {
        if (state.view === "history") {
            summaryEl.innerHTML = summaryCard("History", state.counts.total, "fa-clock-rotate-left")
                + summaryCard("Completed", state.counts.completed, "fa-circle-check")
                + summaryCard("Not completed", state.counts.notCompleted, "fa-circle-xmark");
            return;
        }
        var rolled = state.tasks.filter(function (task) { return task.rolloverDate && task.rolloverDate === state.batchDate; }).length;
        summaryEl.innerHTML = summaryCard("Today", state.counts.total, "fa-calendar-day")
            + summaryCard("Open", state.counts.open, "fa-circle-play")
            + summaryCard("Completed", state.counts.completed, "fa-circle-check")
            + summaryCard("Rolled over", rolled, "fa-arrow-rotate-right");
    }

    function renderViewHeading() {
        if (!pageTitle || !pageRole) return;
        if (state.view === "history") {
            pageTitle.textContent = "Task history";
            pageRole.textContent = "Previous daily task batches are kept here for accountability and performance review.";
        } else {
            pageTitle.textContent = "Today's tasks";
            pageRole.textContent = "Only the current Johannesburg daily batch is shown here. Unfinished past work rolls forward automatically.";
        }
    }

    function optionHtml(value) { return '<option value="' + esc(value) + '">' + esc(value) + '</option>'; }
    function renderFilters() {
        var currentProject = projectEl.value, currentStatus = statusEl.value, currentAssignee = assigneeEl.value;
        projectEl.innerHTML = '<option value="">All</option>' + (state.filters.projectIds || []).map(optionHtml).join("");
        statusEl.innerHTML = '<option value="">All</option>' + (state.filters.statuses || []).map(optionHtml).join("");
        assigneeEl.innerHTML = '<option value="">All</option>' + (state.filters.assignees || []).map(optionHtml).join("");
        projectEl.value = currentProject; statusEl.value = currentStatus; assigneeEl.value = currentAssignee;
    }

    function filteredTasks() {
        var q = String(searchEl.value || "").trim().toLowerCase();
        return state.tasks.filter(function (task) {
            if (projectEl.value && task.projectId !== projectEl.value) return false;
            if (statusEl.value && statusText(task) !== statusEl.value) return false;
            if (assigneeEl.value && task.assignedTo !== assigneeEl.value) return false;
            if (!q) return true;
            return [task.taskId, task.taskName, task.projectId, projectName(task.projectId), task.assignedTo, task.description, taskWorkLabel(task)]
                .some(function (x) { return String(x || "").toLowerCase().indexOf(q) !== -1; });
        });
    }

    function renderList() {
        var tasks = filteredTasks();
        clearEl.hidden = !(searchEl.value || projectEl.value || statusEl.value || assigneeEl.value);
        countEl.textContent = tasks.length + (state.view === "history" ? " historical task" : " task") + (tasks.length === 1 ? "" : "s");
        if (!tasks.length) {
            listEl.innerHTML = state.view === "history"
                ? '<div class="tasks-empty"><i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i><strong>No task history yet.</strong><span>Previous daily batches will appear here after they close.</span></div>'
                : '<div class="tasks-empty"><i class="fa-regular fa-circle-check" aria-hidden="true"></i><strong>No tasks in today\'s batch.</strong><span>Create a task or wait for scheduled work to become active today.</span></div>';
            return;
        }
        var head = '<div class="task-table-head"><span>Task</span><span>Project / Work</span><span>Status</span><span>Assigned</span><span>Due</span><span>Progress</span></div>';
        var rows = tasks.map(function (task) {
            var pct = progressPct(task.progress);
            return '<button type="button" class="task-row" data-task="' + esc(task.taskId) + '">'
                + '<span class="task-main"><strong>' + esc(task.taskName || task.taskId) + '</strong><small>' + esc(task.taskId) + '</small></span>'
                + '<span class="task-project"><strong>' + esc(taskWorkLabel(task)) + '</strong><small>' + esc(taskWorkDetail(task)) + '</small></span>'
                + '<span><span class="' + badgeClass(statusText(task)) + '">' + esc(statusText(task)) + '</span></span>'
                + '<span class="task-assignee">' + esc(task.assignedTo || "Unassigned") + '</span>'
                + '<span class="task-date">' + esc(formatDate(task.dueDate)) + '</span>'
                + '<span class="task-progress"><span><i style="width:' + pct + '%"></i></span><small>' + pct + '%</small></span>'
                + '</button>';
        }).join("");
        listEl.innerHTML = '<div class="task-table">' + head + rows + '</div>';
        Array.prototype.forEach.call(listEl.querySelectorAll("[data-task]"), function (el) {
            el.addEventListener("click", function () { openTask(el.getAttribute("data-task")); });
        });
    }

    function actionButton(action, icon, label, extra) {
        return '<button type="button" class="task-action ' + (extra || "") + '" data-task-action="' + action + '"><i class="fa-solid ' + icon + '" aria-hidden="true"></i>' + esc(label) + '</button>';
    }

    function renderAutoTracking(task) {
        if (!isAutoSalesTask(task)) return "";
        var t = task.autoTracking;
        var carried = Number(t.carriedCount || 0);
        var newlyClaimed = Number(t.newlyClaimedCount || 0);
        var firstLine = carried
            ? '<strong>' + carried + '</strong> carried from yesterday · <strong>' + newlyClaimed + '</strong> newly claimed today · '
            : '<strong>' + Number(t.claimedCount || 0) + '/' + Number(t.targetCount || 0) + '</strong> leads claimed · ';
        return '<section class="task-notes"><span>Automatic sales tracking</span>'
            + '<p>' + firstLine
            + '<strong>' + Number(t.contactedCount || 0) + '/' + Number(t.targetCount || 0) + '</strong> completed today · '
            + '<strong>' + Number(t.remaining || 0) + '</strong> remaining.</p>'
            + '<p>' + esc(t.progressRule || 'Progress updates automatically from CRM activity.') + '</p></section>';
    }

    function renderDrawer() {
        var task = state.selected;
        if (!task) return;
        drawerId.textContent = task.taskId;
        drawerTitle.textContent = task.taskName || "Task";
        var pct = progressPct(task.progress);
        var closed = isClosedTask(task);
        var missed = statusKey(task) === "not completed";
        var readOnlyHistory = state.view === "history";
        var autoTracked = isAutoSalesTask(task);
        var actions = "";
        if (!readOnlyHistory && !closed && Portal.canHere("Projects", "Assign Tasks")) actions += actionButton("assign", "fa-user-plus", task.assignedTo ? "Reassign" : "Assign");
        if (!readOnlyHistory && !autoTracked && !closed && Portal.canHere("Projects", "Complete Tasks")) actions += actionButton("progress", "fa-chart-line", "Update progress");
        if (!readOnlyHistory && !autoTracked && !closed && Portal.canHere("Projects", "Complete Tasks")) actions += actionButton("complete", "fa-check", "Mark complete", "is-success");
        var restricted = !readOnlyHistory && !autoTracked && !closed && ((Portal.can("Projects", "Assign Tasks") && !Portal.canHere("Projects", "Assign Tasks"))
            || (Portal.can("Projects", "Complete Tasks") && !Portal.canHere("Projects", "Complete Tasks")));

        drawerBody.innerHTML = '<div class="task-detail-status"><span class="' + badgeClass(statusText(task)) + '">' + esc(statusText(task)) + '</span>'
            + (task.priority ? '<span class="task-badge">' + esc(task.priority) + '</span>' : '')
            + (autoTracked ? '<span class="task-badge">Auto tracked</span>' : '') + '</div>'
            + (missed ? '<p class="task-closed-note"><i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>This daily task closed unfinished and is preserved in history. Its unfinished work was rolled into the next active daily batch.</p>' : '')
            + (task.rolloverFrom ? '<p class="task-rollover-note"><i class="fa-solid fa-arrow-rotate-right" aria-hidden="true"></i>Rolled over from ' + esc(task.rolloverFrom) + ' after the previous daily batch closed unfinished.</p>' : '')
            + '<div class="task-detail-progress"><div><span>Progress</span><strong>' + pct + '%</strong></div><div class="task-progress-track"><i style="width:' + pct + '%"></i></div></div>'
            + '<div class="task-detail-grid">'
            + detail(autoTracked ? "Work type" : "Project", autoTracked ? "Sales target" : task.projectId + (projectName(task.projectId) ? " · " + projectName(task.projectId) : ""))
            + detail("Assigned to", task.assignedTo || "Unassigned")
            + detail("Start date", formatDate(task.startDate))
            + detail("Due date", formatDate(task.dueDate))
            + detail("Last updated", formatDate(task.lastUpdated))
            + '</div>'
            + renderAutoTracking(task)
            + (task.description ? '<section class="task-notes"><span>Description</span><p>' + esc(task.description) + '</p></section>' : '')
            + (task.notes ? '<section class="task-notes"><span>Notes</span><p>' + esc(task.notes) + '</p></section>' : '')
            + (actions ? '<div class="task-detail-actions">' + actions + '</div>' : '')
            + (restricted ? '<p class="task-device-note"><i class="fa-solid fa-desktop" aria-hidden="true"></i>Task changes are available on desktop.</p>' : '');

        Array.prototype.forEach.call(drawerBody.querySelectorAll("[data-task-action]"), function (button) {
            button.addEventListener("click", function () {
                var action = button.getAttribute("data-task-action");
                if (action === "assign") openAssign(task);
                if (action === "progress") openProgress(task);
                if (action === "complete") completeTask(task);
            });
        });
    }
    function detail(label, value) { return '<div class="task-detail-item"><span>' + esc(label) + '</span><strong>' + esc(value || "—") + '</strong></div>'; }

    function openTask(taskId) {
        state.selected = state.tasks.find(function (t) { return t.taskId === taskId; }) || null;
        if (!state.selected) return;
        renderDrawer();
        drawer.hidden = false; drawerBackdrop.hidden = false; document.body.classList.add("tasks-lock-scroll");
        document.getElementById("taskClose").focus();
    }
    function closeDrawer() { drawer.hidden = true; drawerBackdrop.hidden = true; document.body.classList.remove("tasks-lock-scroll"); state.selected = null; }

    function openModal(title, html) {
        modalTitle.textContent = title; modalBody.innerHTML = html; modal.hidden = false; modalBackdrop.hidden = false; document.body.classList.add("tasks-lock-scroll");
    }
    function closeModal() { modal.hidden = true; modalBackdrop.hidden = true; modalBody.innerHTML = ""; document.body.classList.remove("tasks-lock-scroll"); }

    function createFormHtml() {
        var options = state.projects.map(function (p) { return '<option value="' + esc(p.projectId) + '">' + esc(p.projectId + " · " + (p.clientName || p.projectType || "Project")) + '</option>'; }).join("");
        return '<form id="taskCreateForm" class="task-form">'
            + '<div class="task-form-grid"><label>Task type<select name="taskType"><option value="project">Project / delivery task</option><option value="sales-target">Sales target — claim & contact leads</option></select></label>'
            + '<label>Project<select name="projectId"><option value="">No project / choose a project</option>' + options + '</select></label>'
            + '<label>Task name<input name="taskName" maxlength="160" placeholder="e.g. Claim and contact 20 leads" /></label>'
            + '<label>Target leads<input type="number" name="targetCount" min="1" max="500" value="20" /></label>'
            + '<label>Start date<input type="date" name="startDate" value="' + esc(state.batchDate || "") + '" /></label><label>Due date<input type="date" name="dueDate" value="' + esc(state.batchDate || "") + '" /></label>'
            + '<label>Priority<input name="priority" maxlength="60" placeholder="Optional" /></label></div>'
            + '<label class="task-form-wide">Description<textarea name="description" maxlength="1200"></textarea></label>'
            + '<label class="task-form-wide">Notes<textarea name="notes" maxlength="1200"></textarea></label>'
            + '<p class="task-form-hint"><strong>Daily batch:</strong> new tasks default to today. Future-dated work is stored but appears in Tasks only when its scheduled day becomes active. Unfinished work is archived as Not Completed and rolled forward automatically.</p>'
            + '<div class="task-form-actions"><button type="button" class="task-secondary" data-modal-cancel>Cancel</button><button class="task-primary-btn" type="submit"><i class="fa-solid fa-plus" aria-hidden="true"></i>Create task</button></div></form>';
    }

    function openCreate() {
        openModal("Create task", createFormHtml());
        var form = document.getElementById("taskCreateForm");
        form.querySelector("[data-modal-cancel]").addEventListener("click", closeModal);
        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            var fd = new FormData(form), body = {};
            ["taskType","projectId","taskName","description","startDate","dueDate","priority","notes","targetCount"].forEach(function (k) { body[k] = fd.get(k) || ""; });
            if (body.taskType === "sales-target" && !body.taskName) body.taskName = "Claim and contact " + (body.targetCount || 20) + " leads";
            try {
                var res = await Portal.authedFetch("/staff/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                var data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.message || "Could not create task.");
                closeModal(); Portal.showNotice("Task " + data.taskId + " created. Assign it to the salesperson who should complete it."); await loadTasks();
            } catch (err) { if (err.sessionExpired) return Portal.goToLogin(); Portal.showNotice(err.message || "Could not create task.", "warning"); }
        });
    }

    async function ensureStaff() {
        if (state.staff) return state.staff;
        var res = await Portal.authedFetch("/staff/tasks-assignees");
        var data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || "Could not load staff.");
        state.staff = data.staff || [];
        return state.staff;
    }

    async function openAssign(task) {
        try {
            var staff = await ensureStaff();
            var options = '<option value="">Unassigned</option>' + staff.map(function (s) { return '<option value="' + esc(s.staffId) + '">' + esc(s.name + " · " + s.role) + '</option>'; }).join("");
            openModal("Assign " + task.taskId, '<form id="taskAssignForm" class="task-form"><label>Active staff<select name="staffId">' + options + '</select></label><div class="task-form-actions"><button type="button" class="task-secondary" data-modal-cancel>Cancel</button><button class="task-primary-btn" type="submit">Save assignment</button></div></form>');
            var form = document.getElementById("taskAssignForm");
            form.querySelector("[data-modal-cancel]").addEventListener("click", closeModal);
            form.addEventListener("submit", async function (event) {
                event.preventDefault();
                var staffId = new FormData(form).get("staffId") || "";
                try {
                    var res = await Portal.authedFetch("/staff/tasks/" + encodeURIComponent(task.taskId) + "/assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffId: staffId }) });
                    var data = await res.json();
                    if (!res.ok || !data.success) throw new Error(data.message || "Could not assign task.");
                    closeModal(); closeDrawer(); Portal.showNotice("Task assignment updated."); await loadTasks();
                } catch (err) { if (err.sessionExpired) return Portal.goToLogin(); Portal.showNotice(err.message || "Could not assign task.", "warning"); }
            });
        } catch (err) { if (err.sessionExpired) return Portal.goToLogin(); Portal.showNotice(err.message || "Could not load staff.", "warning"); }
    }

    function openProgress(task) {
        if (isAutoSalesTask(task)) {
            Portal.showNotice("This sales target updates automatically from CRM activity.");
            return;
        }
        var current = progressPct(task.progress);
        var steps = [0, 25, 50, 75, 100];
        var options = steps.map(function (value) {
            return '<option value="' + value + '"' + (value === current ? ' selected' : '') + '>' + value + '%</option>';
        }).join("");
        openModal("Update " + task.taskId + " progress",
            '<form id="taskProgressForm" class="task-form">'
            + '<label>Progress<select name="progress" required>' + options + '</select></label>'
            + '<p class="task-form-hint">0% = Not Started, 25–75% = In Progress, 100% = Completed. Project progress updates automatically from its tasks.</p>'
            + '<div class="task-form-actions"><button type="button" class="task-secondary" data-modal-cancel>Cancel</button><button class="task-primary-btn" type="submit">Save progress</button></div></form>');
        var form = document.getElementById("taskProgressForm");
        form.querySelector("[data-modal-cancel]").addEventListener("click", closeModal);
        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            var progress = Number(new FormData(form).get("progress"));
            try {
                var res = await Portal.authedFetch("/staff/tasks/" + encodeURIComponent(task.taskId) + "/progress", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ progress: progress })
                });
                var data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.message || "Could not update task progress.");
                closeModal(); closeDrawer(); Portal.showNotice(task.taskId + " progress updated to " + data.progressPercent + "%."); await loadTasks();
            } catch (err) { if (err.sessionExpired) return Portal.goToLogin(); Portal.showNotice(err.message || "Could not update task progress.", "warning"); }
        });
    }

    async function completeTask(task) {
        if (isAutoSalesTask(task)) {
            Portal.showNotice("This sales target completes automatically when the CRM target is reached.");
            return;
        }
        if (!window.confirm("Mark " + task.taskId + " as completed? This sets task progress to 100%.")) return;
        try {
            var res = await Portal.authedFetch("/staff/tasks/" + encodeURIComponent(task.taskId) + "/complete", { method: "POST" });
            var data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Could not complete task.");
            closeDrawer(); Portal.showNotice(task.taskId + " marked completed."); await loadTasks();
        } catch (err) { if (err.sessionExpired) return Portal.goToLogin(); Portal.showNotice(err.message || "Could not complete task.", "warning"); }
    }

    function renderHeaderActions() {
        var toggleLabel = state.view === "history" ? "Today's tasks" : "Task history";
        var toggleIcon = state.view === "history" ? "fa-calendar-day" : "fa-clock-rotate-left";
        var html = '<button type="button" class="tasks-view-toggle" id="taskViewToggle"><i class="fa-solid ' + toggleIcon + '" aria-hidden="true"></i>' + toggleLabel + '</button>';
        if (state.view === "today" && Portal.canHere("Projects", "Create Tasks")) {
            html += '<button type="button" class="tasks-create" id="taskCreate"><i class="fa-solid fa-plus" aria-hidden="true"></i>Create task</button>';
        }
        actionsEl.innerHTML = html;
        var create = document.getElementById("taskCreate");
        if (create) create.addEventListener("click", openCreate);
        var toggle = document.getElementById("taskViewToggle");
        if (toggle) toggle.addEventListener("click", function () {
            state.view = state.view === "history" ? "today" : "history";
            searchEl.value = projectEl.value = statusEl.value = assigneeEl.value = "";
            closeDrawer();
            loadTasks();
        });
    }

    async function loadTasks() {
        try {
            var endpoint = state.view === "history" ? "/staff/tasks/history" : "/staff/tasks";
            var res = await Portal.authedFetch(endpoint);
            var data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Could not load tasks.");
            state.tasks = data.tasks || []; state.counts = data.counts || {}; state.filters = data.filters || {}; state.projects = data.projects || []; state.batchDate = data.batchDate || state.batchDate;
            renderViewHeading(); renderSummary(); renderFilters(); renderList(); renderHeaderActions();
        } catch (err) {
            if (err.sessionExpired) return Portal.goToLogin();
            console.error("Task load failed:", err); listEl.innerHTML = '<p class="tasks-empty">Tasks could not be loaded right now.</p>';
        }
    }

    [searchEl, projectEl, statusEl, assigneeEl].forEach(function (el) { el.addEventListener(el.tagName === "INPUT" ? "input" : "change", renderList); });
    clearEl.addEventListener("click", function () { searchEl.value = projectEl.value = statusEl.value = assigneeEl.value = ""; renderList(); });
    document.getElementById("taskClose").addEventListener("click", closeDrawer);
    drawerBackdrop.addEventListener("click", closeDrawer);
    document.getElementById("taskModalClose").addEventListener("click", closeModal);
    modalBackdrop.addEventListener("click", closeModal);
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") { if (!modal.hidden) closeModal(); else if (!drawer.hidden) closeDrawer(); } });

    Portal.onReady(function () { loadTasks(); });
    Portal.onFail(function () { listEl.innerHTML = '<p class="tasks-empty">The portal is temporarily unavailable.</p>'; });
    Portal.onModeChange(function () { renderHeaderActions(); if (!drawer.hidden) renderDrawer(); });
})(window, document);