/* Bodibe Digital — Staff Projects workspace */
(function (window, document) {
    "use strict";

    var Portal = window.BodibePortal;
    if (!Portal) return;

    var esc = Portal.escapeHtml;
    var state = { projects: [], counts: {}, filters: {}, selected: null, staff: null };

    var listEl = document.getElementById("projectList");
    var countEl = document.getElementById("projectResultCount");
    var summaryEl = document.getElementById("projectsSummary");
    var searchEl = document.getElementById("projectSearch");
    var statusEl = document.getElementById("projectStatus");
    var priorityEl = document.getElementById("projectPriority");
    var assigneeEl = document.getElementById("projectAssignee");
    var clearEl = document.getElementById("projectClear");
    var actionsEl = document.getElementById("projectsHeaderActions");

    var drawer = document.getElementById("projectDrawer");
    var drawerBackdrop = document.getElementById("projectBackdrop");
    var drawerBody = document.getElementById("projectDrawerBody");
    var drawerTitle = document.getElementById("projectDrawerTitle");
    var drawerId = document.getElementById("projectDrawerId");
    var drawerClose = document.getElementById("projectClose");

    var modal = document.getElementById("projectModal");
    var modalBackdrop = document.getElementById("projectModalBackdrop");
    var modalBody = document.getElementById("projectModalBody");
    var modalTitle = document.getElementById("projectModalTitle");
    var modalClose = document.getElementById("projectModalClose");

    function text(value) { return String(value == null ? "" : value); }

    function formatDate(value) {
        if (!value) return "Not set";
        var d = new Date(value);
        if (isNaN(d.getTime())) return text(value);
        return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
    }

    function formatMoney(value) {
        if (value === null || value === undefined || value === "" || !isFinite(Number(value))) return "Not set";
        return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(value));
    }

    function progressPercent(value) {
        var n = Number(value);
        if (!isFinite(n) || n < 0) return 0;
        if (n <= 1) n *= 100;
        return Math.max(0, Math.min(100, Math.round(n)));
    }

    function slug(value) {
        return text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "default";
    }

    function badge(label, kind) {
        return '<span class="project-badge project-badge-' + esc(slug(kind || label)) + '">' + esc(label || "Not set") + '</span>';
    }

    function renderSummary() {
        var c = state.counts || {};
        summaryEl.innerHTML = [
            ["Total", c.total || 0, "fa-layer-group"],
            ["Active", c.active || 0, "fa-bolt"],
            ["Due soon", c.dueSoon || 0, "fa-clock"],
            ["Overdue", c.overdue || 0, "fa-triangle-exclamation"],
            ["Completed", c.completed || 0, "fa-circle-check"],
        ].map(function (x) {
            return '<div class="project-summary-card"><i class="fa-solid ' + x[2] + '" aria-hidden="true"></i>'
                + '<div><strong>' + x[1] + '</strong><span>' + esc(x[0]) + '</span></div></div>';
        }).join("");
    }

    function fillSelect(select, values) {
        var current = select.value;
        select.innerHTML = '<option value="">All</option>' + (values || []).map(function (v) {
            return '<option value="' + esc(v) + '">' + esc(v) + '</option>';
        }).join("");
        select.value = current;
    }

    function renderFilters() {
        fillSelect(statusEl, state.filters.statuses || []);
        fillSelect(priorityEl, state.filters.priorities || []);
        fillSelect(assigneeEl, state.filters.assignees || []);
    }

    function filteredProjects() {
        var q = text(searchEl.value).trim().toLowerCase();
        var status = statusEl.value;
        var priority = priorityEl.value;
        var assignee = assigneeEl.value;
        clearEl.hidden = !(q || status || priority || assignee);

        return state.projects.filter(function (p) {
            if (q) {
                var hay = [p.projectId, p.clientName, p.projectType].join(" ").toLowerCase();
                if (hay.indexOf(q) === -1) return false;
            }
            if (status && p.status !== status) return false;
            if (priority && p.priority !== priority) return false;
            if (assignee && p.assignedTo !== assignee) return false;
            return true;
        });
    }

    function projectRowHtml(p) {
        var pct = progressPercent(p.progress);
        return '<button type="button" class="project-row" data-project-id="' + esc(p.projectId) + '">'
            + '<span class="project-primary"><strong>' + esc(p.projectId) + '</strong><small>' + esc(p.clientName || "Unnamed client") + '</small></span>'
            + '<span class="project-type">' + esc(p.projectType || "—") + '</span>'
            + '<span>' + badge(p.status || "Not set", p.status) + '</span>'
            + '<span class="project-date">' + esc(formatDate(p.deadline)) + '</span>'
            + '<span class="project-progress"><span class="project-progress-track"><span style="width:' + pct + '%"></span></span><small>' + pct + '%</small></span>'
            + '<span class="project-assignee">' + esc(p.assignedTo || "Unassigned") + '</span>'
            + '<span>' + badge(p.health || "No health", p.health) + '</span>'
            + '<i class="fa-solid fa-chevron-right project-chevron" aria-hidden="true"></i>'
            + '</button>';
    }

    function renderList() {
        var rows = filteredProjects();
        countEl.textContent = rows.length + " of " + state.projects.length + " project" + (state.projects.length === 1 ? "" : "s");
        if (!rows.length) {
            listEl.innerHTML = '<div class="projects-empty"><i class="fa-regular fa-folder-open" aria-hidden="true"></i><strong>No projects found</strong><span>Try changing the filters.</span></div>';
            return;
        }

        listEl.innerHTML = '<div class="project-table-head" aria-hidden="true">'
            + '<span>Project</span><span>Type</span><span>Status</span><span>Deadline</span><span>Progress</span><span>Assigned to</span><span>Health</span><span></span>'
            + '</div><div class="project-table-body">' + rows.map(projectRowHtml).join("") + '</div>';

        Array.prototype.forEach.call(listEl.querySelectorAll("[data-project-id]"), function (el) {
            el.addEventListener("click", function () { openProject(el.getAttribute("data-project-id")); });
        });
    }

    function detailItem(label, value) {
        return '<div class="project-detail-item"><span>' + esc(label) + '</span><strong>' + esc(value == null || value === "" ? "Not set" : value) + '</strong></div>';
    }

    function actionButton(icon, label, action, danger) {
        return '<button type="button" class="project-action' + (danger ? " is-danger" : "") + '" data-project-action="' + action + '">'
            + '<i class="fa-solid ' + icon + '" aria-hidden="true"></i>' + esc(label) + '</button>';
    }

    function renderDrawer(project) {
        var pct = progressPercent(project.progress);
        drawerId.textContent = project.projectId || "PROJECT";
        drawerTitle.textContent = project.clientName || project.projectId || "Project";

        var actions = "";
        if (Portal.canHere("Projects", "Edit Projects")) actions += actionButton("fa-pen", "Edit project", "edit");
        if (Portal.canHere("Projects", "Assign Projects")) actions += actionButton("fa-user-plus", project.assignedTo ? "Reassign" : "Assign", "assign");
        if (Portal.canHere("Projects", "Delete Projects") && text(project.status).toLowerCase() !== "completed") {
            actions += actionButton("fa-ban", "Cancel project", "cancel", true);
        }

        var deviceNote = "";
        if (!actions && (Portal.can("Projects", "Edit Projects") || Portal.can("Projects", "Assign Projects") || Portal.can("Projects", "Delete Projects"))) {
            deviceNote = '<p class="project-device-note"><i class="fa-solid fa-desktop" aria-hidden="true"></i>Project changes are available on desktop.</p>';
        }

        drawerBody.innerHTML = '<div class="project-detail-status">' + badge(project.status || "Not set", project.status) + badge(project.health || "No health", project.health) + '</div>'
            + '<div class="project-detail-progress"><div><span>Progress</span><strong>' + pct + '%</strong></div><span class="project-progress-track is-large"><span style="width:' + pct + '%"></span></span></div>'
            + '<div class="project-detail-grid">'
            + detailItem("Project type", project.projectType)
            + detailItem("Assigned to", project.assignedTo || "Unassigned")
            + detailItem("Start date", formatDate(project.startDate))
            + detailItem("Deadline", formatDate(project.deadline))
            + detailItem("Priority", project.priority)
            + detailItem("Budget", formatMoney(project.budget))
            + detailItem("Last updated", formatDate(project.lastUpdated))
            + '</div>'
            + '<section class="project-notes"><span>Notes</span><p>' + esc(project.notes || "No project notes yet.") + '</p></section>'
            + deviceNote
            + (actions ? '<div class="project-detail-actions">' + actions + '</div>' : '');

        Array.prototype.forEach.call(drawerBody.querySelectorAll("[data-project-action]"), function (btn) {
            btn.addEventListener("click", function () {
                var action = btn.getAttribute("data-project-action");
                if (action === "edit") openProjectForm("edit", project);
                if (action === "assign") openAssignForm(project);
                if (action === "cancel") cancelProject(project);
            });
        });
    }

    function openDrawer(project) {
        state.selected = project;
        renderDrawer(project);
        drawer.hidden = false;
        drawerBackdrop.hidden = false;
        syncScrollLock();
        drawerClose.focus();
    }

    function syncScrollLock() {
        document.body.classList.toggle("projects-lock-scroll", !drawer.hidden || !modal.hidden);
    }

    function closeDrawer() {
        drawer.hidden = true;
        drawerBackdrop.hidden = true;
        state.selected = null;
        syncScrollLock();
    }

    async function openProject(projectId) {
        var local = state.projects.find(function (p) { return p.projectId === projectId; });
        if (local) openDrawer(local);
        try {
            var res = await Portal.authedFetch("/staff/projects/" + encodeURIComponent(projectId));
            if (!res.ok) throw new Error("project_" + res.status);
            var data = await res.json();
            if (data.success && data.project) {
                state.selected = data.project;
                if (!drawer.hidden) renderDrawer(data.project);
            }
        } catch (err) {
            if (err.sessionExpired) return Portal.goToLogin();
            Portal.showNotice("Could not refresh that project right now.", "warning");
        }
    }

    function closeModal() {
        modal.hidden = true;
        modalBackdrop.hidden = true;
        modalBody.innerHTML = "";
        syncScrollLock();
    }

    function openModal(title, html) {
        modalTitle.textContent = title;
        modalBody.innerHTML = html;
        modal.hidden = false;
        modalBackdrop.hidden = false;
        syncScrollLock();
        modalClose.focus();
    }

    function statusOptions(current, allowBlank) {
        var values = (state.filters.statuses || []).slice();
        if (current && values.indexOf(current) === -1) values.push(current);
        return (allowBlank ? '<option value="">Use default</option>' : '') + values.map(function (v) {
            return '<option value="' + esc(v) + '"' + (v === current ? ' selected' : '') + '>' + esc(v) + '</option>';
        }).join("");
    }

    function priorityDatalist() {
        return '<datalist id="projectPriorityOptions">' + (state.filters.priorities || []).map(function (v) {
            return '<option value="' + esc(v) + '"></option>';
        }).join("") + '</datalist>';
    }

    function projectFormHtml(mode, project) {
        var p = project || {};
        return '<form class="project-form" id="projectForm">'
            + '<div class="project-form-grid">'
            + field("Client name", "clientName", "text", p.clientName, true)
            + field("Project type", "projectType", "text", p.projectType, true)
            + field("Start date", "startDate", "date", p.startDate)
            + field("Deadline", "deadline", "date", p.deadline)
            + '<label><span>Status</span><select name="status">' + statusOptions(mode === "edit" ? p.status : "", mode !== "edit" || !p.status) + '</select></label>'
            + '<label><span>Priority</span><input name="priority" type="text" list="projectPriorityOptions" value="' + esc(p.priority || "") + '" placeholder="Use an existing workbook value" />' + priorityDatalist() + '</label>'
            + field("Budget (ZAR)", "budget", "number", p.budget == null ? "" : p.budget, false, 'min="0" step="0.01"')
            + '</div>'
            + '<label class="project-form-wide"><span>Notes</span><textarea name="notes" rows="5">' + esc(p.notes || "") + '</textarea></label>'
            + '<p class="project-form-hint">Progress and project health are calculated by the workbook and cannot be edited here.</p>'
            + '<div class="project-form-actions"><button type="button" class="project-secondary" data-modal-cancel>Cancel</button><button type="submit" class="project-primary-btn">' + (mode === "edit" ? "Save changes" : "Create project") + '</button></div>'
            + '</form>';
    }

    function field(label, name, type, value, required, extra) {
        return '<label><span>' + esc(label) + '</span><input name="' + name + '" type="' + type + '" value="' + esc(value || "") + '" ' + (required ? "required " : "") + (extra || "") + ' /></label>';
    }

    function formData(form) {
        var out = {};
        new FormData(form).forEach(function (value, key) { out[key] = value; });
        return out;
    }

    function wireModalCancel() {
        var cancel = modalBody.querySelector("[data-modal-cancel]");
        if (cancel) cancel.addEventListener("click", closeModal);
    }

    function openProjectForm(mode, project) {
        openModal(mode === "edit" ? "Edit project" : "Create project", projectFormHtml(mode, project));
        wireModalCancel();
        var form = document.getElementById("projectForm");
        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            var body = formData(form);
            var isEdit = mode === "edit";
            try {
                var res = await Portal.authedFetch(isEdit ? "/staff/projects/" + encodeURIComponent(project.projectId) : "/staff/projects", {
                    method: isEdit ? "PATCH" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                var data = await res.json().catch(function () { return {}; });
                if (!res.ok) throw new Error(data.message || "Project could not be saved.");
                closeModal();
                closeDrawer();
                Portal.showNotice(isEdit ? "Project updated." : "Project created.");
                await loadProjects();
                if (!isEdit && data.projectId) openProject(data.projectId);
            } catch (err) {
                if (err.sessionExpired) return Portal.goToLogin();
                Portal.showNotice(err.message || "Project could not be saved.", "warning");
            }
        });
    }

    async function getStaffOptions() {
        if (state.staff) return state.staff;
        var res = await Portal.authedFetch("/staff/projects-assignees");
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error(data.message || "Assignment options are unavailable.");
        state.staff = data.staff || [];
        return state.staff;
    }

    async function openAssignForm(project) {
        try {
            var staff = await getStaffOptions();
            var options = '<option value="">Unassigned</option>' + staff.map(function (s) {
                var selected = s.name === project.assignedTo ? ' selected' : '';
                return '<option value="' + esc(s.staffId) + '"' + selected + '>' + esc(s.name) + ' — ' + esc(s.role || s.department || "Staff") + '</option>';
            }).join("");
            openModal("Assign project", '<form class="project-form" id="assignForm"><label class="project-form-wide"><span>Assigned staff member</span><select name="staffId">' + options + '</select></label><p class="project-form-hint">Only active Staff records can be assigned.</p><div class="project-form-actions"><button type="button" class="project-secondary" data-modal-cancel>Cancel</button><button type="submit" class="project-primary-btn">Save assignment</button></div></form>');
            wireModalCancel();
            document.getElementById("assignForm").addEventListener("submit", async function (event) {
                event.preventDefault();
                var body = formData(event.currentTarget);
                try {
                    var res = await Portal.authedFetch("/staff/projects/" + encodeURIComponent(project.projectId) + "/assign", {
                        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
                    });
                    var data = await res.json().catch(function () { return {}; });
                    if (!res.ok) throw new Error(data.message || "Assignment failed.");
                    closeModal(); closeDrawer(); Portal.showNotice("Project assignment updated.");
                    state.staff = null;
                    await loadProjects();
                    openProject(project.projectId);
                } catch (err) {
                    if (err.sessionExpired) return Portal.goToLogin();
                    Portal.showNotice(err.message || "Assignment failed.", "warning");
                }
            });
        } catch (err) {
            if (err.sessionExpired) return Portal.goToLogin();
            Portal.showNotice(err.message || "Assignment options are unavailable.", "warning");
        }
    }

    async function cancelProject(project) {
        if (!window.confirm("Cancel " + project.projectId + "? The project row and linked tasks will be preserved.")) return;
        try {
            var res = await Portal.authedFetch("/staff/projects/" + encodeURIComponent(project.projectId) + "?confirm=yes", { method: "DELETE" });
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok) throw new Error(data.message || "Project could not be cancelled.");
            closeDrawer();
            Portal.showNotice(data.message || "Project cancelled.");
            await loadProjects();
        } catch (err) {
            if (err.sessionExpired) return Portal.goToLogin();
            Portal.showNotice(err.message || "Project could not be cancelled.", "warning");
        }
    }

    function renderHeaderActions() {
        actionsEl.innerHTML = Portal.canHere("Projects", "Create Projects")
            ? '<button type="button" class="projects-create" id="createProjectBtn"><i class="fa-solid fa-plus" aria-hidden="true"></i>Create project</button>'
            : '';
        var button = document.getElementById("createProjectBtn");
        if (button) button.addEventListener("click", function () { openProjectForm("create"); });
    }

    async function loadProjects() {
        listEl.innerHTML = '<p class="projects-loading">Loading projects&hellip;</p>';
        try {
            var res = await Portal.authedFetch("/staff/projects");
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok || !data.success) throw new Error(data.message || "projects_failed");
            state.projects = data.projects || [];
            state.counts = data.counts || {};
            state.filters = data.filters || {};
            renderSummary();
            renderFilters();
            renderList();
            renderHeaderActions();

            var requested = new URLSearchParams(window.location.search).get("project");
            if (requested && state.projects.some(function (p) { return p.projectId === requested; })) openProject(requested);
        } catch (err) {
            if (err.sessionExpired) return Portal.goToLogin();
            console.error("Projects load failed:", err);
            listEl.innerHTML = '<div class="projects-empty"><strong>Projects are unavailable right now.</strong><span>Try refreshing in a moment.</span></div>';
            Portal.showNotice("Could not load the Projects workspace.", "warning");
        }
    }

    [searchEl, statusEl, priorityEl, assigneeEl].forEach(function (el) {
        el.addEventListener(el === searchEl ? "input" : "change", renderList);
    });
    clearEl.addEventListener("click", function () {
        searchEl.value = ""; statusEl.value = ""; priorityEl.value = ""; assigneeEl.value = ""; renderList();
    });

    drawerClose.addEventListener("click", closeDrawer);
    drawerBackdrop.addEventListener("click", closeDrawer);
    modalClose.addEventListener("click", closeModal);
    modalBackdrop.addEventListener("click", closeModal);
    document.addEventListener("keydown", function (event) {
        if (event.key !== "Escape") return;
        if (!modal.hidden) closeModal();
        else if (!drawer.hidden) closeDrawer();
    });

    Portal.onModeChange(function () {
        renderHeaderActions();
        if (state.selected && !drawer.hidden) renderDrawer(state.selected);
    });

    Portal.onReady(function () {
        if (!Portal.can("Projects", "View Projects")) {
            listEl.innerHTML = '<div class="projects-empty"><strong>No project access</strong><span>Your current role does not include View Projects.</span></div>';
            return;
        }
        loadProjects();
    });

    Portal.onFail(function () {
        listEl.innerHTML = '<div class="projects-empty"><strong>Portal unavailable</strong><span>Check your connection and refresh.</span></div>';
    });
})(window, document);
