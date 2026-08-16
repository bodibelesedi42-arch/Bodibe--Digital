const API_BASE_URL = "https://bodibedigital-backend.onrender.com";
const TOKEN_KEY = "bd_staff_token";

const token = sessionStorage.getItem(TOKEN_KEY);
if (!token) {
    window.location.href = "staff-login.html";
}

function authHeaders() {
    return { Authorization: `Bearer ${token}` };
}

function statusBadgeClass(status) {
    if (!status) return "status-default";
    const s = status.toLowerCase();
    if (s.includes("progress")) return "status-progress";
    if (s.includes("hold") || s.includes("risk")) return "status-hold";
    if (s.includes("overdue")) return "status-overdue";
    return "status-default";
}

function formatDate(value) {
    if (!value) return "No date set";
    const d = new Date(value);
    if (isNaN(d)) return value;
    return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function renderProjects(projects) {
    if (!projects.length) {
        return '<p class="dash-empty">No active projects assigned to you right now.</p>';
    }
    return projects.map((p) => `
        <div class="dash-item">
            <div class="dash-item-top">
                <span class="dash-item-name">${p.client || p.projectId}</span>
                <span class="dash-badge ${statusBadgeClass(p.status)}">${p.status || "—"}</span>
            </div>
            <div class="dash-item-meta">Due ${formatDate(p.deadline)} · ${p.health || ""}</div>
            <div class="dash-progress-track">
                <div class="dash-progress-fill" style="width:${Math.round((p.progress || 0) * 100)}%"></div>
            </div>
        </div>
    `).join("");
}

function renderTasks(tasks) {
    if (!tasks.length) {
        return '<p class="dash-empty">No open tasks. You\'re all caught up.</p>';
    }
    return tasks.map((t) => `
        <div class="dash-item">
            <div class="dash-item-top">
                <span class="dash-item-name">${t.name || t.taskId}</span>
                <span class="dash-badge ${statusBadgeClass(t.status)}">${t.status || "—"}</span>
            </div>
            <div class="dash-item-meta">Due ${formatDate(t.dueDate)}</div>
        </div>
    `).join("");
}

async function loadDashboard() {
    try {
        const meRes = await fetch(`${API_BASE_URL}/auth/me`, { headers: authHeaders() });
        if (!meRes.ok) throw new Error("session_invalid");
        const me = await meRes.json();

        document.getElementById("greetingName").textContent = `Welcome back, ${me.staff.name.split(" ")[0]}`;
        document.getElementById("roleLine").textContent = `${me.staff.role} · ${me.staff.department}`;

        const workRes = await fetch(`${API_BASE_URL}/staff/my-work`, { headers: authHeaders() });
        const work = await workRes.json();

        if (!work.success) throw new Error(work.message || "load_failed");

        document.getElementById("dashContent").innerHTML = `
            <div class="dash-stats">
                <div class="dash-stat"><strong>${work.activeProjects.length}</strong><span>ACTIVE PROJECTS</span></div>
                <div class="dash-stat"><strong>${work.openTasks.length}</strong><span>OPEN TASKS</span></div>
                <div class="dash-stat"><strong>${work.completedTaskCount}</strong><span>COMPLETED TASKS</span></div>
            </div>
            <div class="dash-grid">
                <div class="dash-card">
                    <h2><i class="fa-solid fa-diagram-project"></i> My Projects</h2>
                    ${renderProjects(work.activeProjects)}
                </div>
                <div class="dash-card">
                    <h2><i class="fa-solid fa-list-check"></i> My Tasks</h2>
                    ${renderTasks(work.openTasks)}
                </div>
            </div>
        `;
    } catch (err) {
        console.error("Dashboard load failed:", err);
        if (err.message === "session_invalid") {
            sessionStorage.removeItem(TOKEN_KEY);
            window.location.href = "staff-login.html";
            return;
        }
        document.getElementById("dashContent").innerHTML =
            '<p class="dash-empty">Couldn\'t load your dashboard right now. Try refreshing.</p>';
    }
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
    try {
        await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", headers: authHeaders() });
    } catch (err) {
        // Logout is stateless server-side — clearing the local token is what actually matters.
    }
    sessionStorage.removeItem(TOKEN_KEY);
    window.location.href = "staff-login.html";
});

loadDashboard();