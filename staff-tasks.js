/* Bodibe Digital — Staff Tasks workspace */
(function (window, document) {
    "use strict";

    var Portal = window.BodibePortal;
    if (!Portal) return;
    var esc = Portal.escapeHtml;
    var state = { tasks: [], counts: {}, filters: {}, projects: [], selected: null, staff: null };

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

    function formatDate(value) {
        if (!value) return "—";
        var d = new Date(value + (String(value).length === 10 ? "T00:00:00" : ""));
        if (isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
    }

    function statusText(task) { return String(task.status || "Not Started"); }
    function progressPct(value) {
        var n = Number(value);
        if (!isFinite(n)) n = 0;
        if (n <= 1) n *= 100;
        return Math.max(0, Math.min(100, Math.round(n)));
    }
    function badgeClass(value) {
        var s = String(value || "not-started").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        return "task-badge task-badge-" + (s || "not-started");
    }
    function projectName(id) {
        var p = state.projects.find(function (x) { return x.projectId === id; });
        return p ? (p.clientName || p.projectType || id) : id;
    }

    function summaryCard(label, value, icon) {
        return '<article class="task-summary-card"><span><i class="fa-solid ' + icon + '" aria-hidden="true"></i>'
            + esc(label) + '</span><strong>' + Number(value || 0) + '</strong></article>';
    }
    function renderSummary() {
        summaryEl.innerHTML = summaryCard("Total", state.counts.total, "fa-list-check")
            + summaryCard("Open", state.counts.open, "fa-circle-play")
            + summaryCard("Due soon", state.counts.dueSoon, "fa-clock")
            + summaryCard("Overdue", state.counts.overdue, "fa-triangle-exclamation")
            + summaryCard("Completed", state.counts.completed, "fa-circle-check");
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
            return [task.taskId, task.taskName, task.projectId, projectName(task.projectId), task.assignedTo, task.description]
                .some(function (x) { return String(x || "").toLowerCase().indexOf(q) !== -1; });
        });
    }

    function renderList() {
        var tasks = filteredTasks();
        clearEl.hidden = !(searchEl.value || projectEl.value || statusEl.value || assigneeEl.value);
        countEl.textContent = tasks.length + " task" + (tasks.length === 1 ? "" : "s");
        if (!tasks.length) {
            listEl.innerHTML = '<div class="tasks-empty"><i class="fa-regular fa-circle-check" aria-hidden="true"></i><strong>No tasks match this view.</strong><span>Change the filters or create a task on desktop.</span></div>';
            return;
        }
        var head = '<div class="task-table-head"><span>Task</span><span>Project</span><span>Status</span><span>Assigned</span><span>Due</span><span>Progress</span></div>';
        var rows = tasks.map(function (task) {
            var pct = progressPct(task.progress);
            return '<button type="button" class="task-row" data-task="' + esc(task.taskId) + '">'
                + '<span class="task-main"><strong>' + esc(task.taskName || task.taskId) + '</strong><small>' + esc(task.taskId) + '</small></span>'
                + '<span class="task-project"><strong>' + esc(task.projectId) + '</strong><small>' + esc(projectName(task.projectId)) + '</small></span>'
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

    function renderDrawer() {
        var task = state.selected;
        if (!task) return;
        drawerId.textContent = task.taskId;
        drawerTitle.textContent = task.taskName || "Task";
        var pct = progressPct(task.progress);
        var completed = statusText(task).toLowerCase() === "completed";
        var actions = "";
        if (!completed && Portal.canHere("Projects", "Assign Tasks")) actions += actionButton("assign", "fa-user-plus", task.assignedTo ? "Reassign" : "Assign");
        if (!completed && Portal.canHere("Projects", "Complete Tasks")) actions += actionButton("complete", "fa-check", "Mark complete", "is-success");
        var restricted = !completed && ((Portal.can("Projects", "Assign Tasks") && !Portal.canHere("Projects", "Assign Tasks")) || (Portal.can("Projects", "Complete Tasks") && !Portal.canHere("Projects", "Complete Tasks")));

        drawerBody.innerHTML = '<div class="task-detail-status"><span class="' + badgeClass(statusText(task)) + '">' + esc(statusText(task)) + '</span>'
            + (task.priority ? '<span class="task-badge">' + esc(task.priority) + '</span>' : '') + '</div>'
            + '<div class="task-detail-progress"><div><span>Progress</span><strong>' + pct + '%</strong></div><div class="task-progress-track"><i style="width:' + pct + '%"></i></div></div>'
            + '<div class="task-detail-grid">'
            + detail("Project", task.projectId + (projectName(task.projectId) ? " · " + projectName(task.projectId) : ""))
            + detail("Assigned to", task.assignedTo || "Unassigned")
            + detail("Start date", formatDate(task.startDate))
            + detail("Due date", formatDate(task.dueDate))
            + detail("Last updated", formatDate(task.lastUpdated))
            + '</div>'
            + (task.description ? '<section class="task-notes"><span>Description</span><p>' + esc(task.description) + '</p></section>' : '')
            + (task.notes ? '<section class="task-notes"><span>Notes</span><p>' + esc(task.notes) + '</p></section>' : '')
            + (actions ? '<div class="task-detail-actions">' + actions + '</div>' : '')
            + (restricted ? '<p class="task-device-note"><i class="fa-solid fa-desktop" aria-hidden="true"></i>Task changes are available on desktop.</p>' : '');

        Array.prototype.forEach.call(drawerBody.querySelectorAll("[data-task-action]"), function (button) {
            button.addEventListener("click", function () {
                var action = button.getAttribute("data-task-action");
                if (action === "assign") openAssign(task);
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
            + '<div class="task-form-grid"><label>Project<select name="projectId" required><option value="">Choose a project</option>' + options + '</select></label>'
            + '<label>Task name<input name="taskName" maxlength="160" required /></label>'
            + '<label>Start date<input type="date" name="startDate" /></label><label>Due date<input type="date" name="dueDate" /></label>'
            + '<label>Priority<input name="priority" maxlength="60" placeholder="Optional" /></label></div>'
            + '<label class="task-form-wide">Description<textarea name="description" maxlength="1200"></textarea></label>'
            + '<label class="task-form-wide">Notes<textarea name="notes" maxlength="1200"></textarea></label>'
            + '<p class="task-form-hint">Assignment and completion are separate actions with separate permissions.</p>'
            + '<div class="task-form-actions"><button type="button" class="task-secondary" data-modal-cancel>Cancel</button><button class="task-primary-btn" type="submit"><i class="fa-solid fa-plus" aria-hidden="true"></i>Create task</button></div></form>';
    }

    function openCreate() {
        openModal("Create task", createFormHtml());
        var form = document.getElementById("taskCreateForm");
        form.querySelector("[data-modal-cancel]").addEventListener("click", closeModal);
        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            var fd = new FormData(form), body = {};
            ["projectId","taskName","description","startDate","dueDate","priority","notes"].forEach(function (k) { body[k] = fd.get(k) || ""; });
            try {
                var res = await Portal.authedFetch("/staff/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                var data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.message || "Could not create task.");
                closeModal(); Portal.showNotice("Task " + data.taskId + " created."); await loadTasks();
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

    async function completeTask(task) {
        if (!window.confirm("Mark " + task.taskId + " as completed? This sets task progress to 100%.")) return;
        try {
            var res = await Portal.authedFetch("/staff/tasks/" + encodeURIComponent(task.taskId) + "/complete", { method: "POST" });
            var data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Could not complete task.");
            closeDrawer(); Portal.showNotice(task.taskId + " marked completed."); await loadTasks();
        } catch (err) { if (err.sessionExpired) return Portal.goToLogin(); Portal.showNotice(err.message || "Could not complete task.", "warning"); }
    }

    function renderHeaderActions() {
        actionsEl.innerHTML = Portal.canHere("Projects", "Create Tasks") ? '<button type="button" class="tasks-create" id="taskCreate"><i class="fa-solid fa-plus" aria-hidden="true"></i>Create task</button>' : "";
        var create = document.getElementById("taskCreate"); if (create) create.addEventListener("click", openCreate);
    }

    async function loadTasks() {
        try {
            var res = await Portal.authedFetch("/staff/tasks");
            var data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Could not load tasks.");
            state.tasks = data.tasks || []; state.counts = data.counts || {}; state.filters = data.filters || {}; state.projects = data.projects || [];
            renderSummary(); renderFilters(); renderList(); renderHeaderActions();
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
