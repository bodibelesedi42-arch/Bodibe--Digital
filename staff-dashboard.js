/* ==========================================================================
   BODIBE DIGITAL — STAFF DASHBOARD

   "My work": the projects and tasks assigned to the signed-in employee.

   The session, identity, permissions, navigation, the mobile drawer and
   sign-out all live in staff-portal-shell.js now, which this page loads
   first. They were moved there when the Leads page arrived so the drawer and
   the permission gate exist once instead of once per module.

   SECURITY NOTE
   -------------
   Everything here decides what to DRAW. It is not authorization. Any employee
   can read this file or call a module API directly with their token, so a
   module endpoint is only protected if the SERVER checks

       requireAuth  +  requirePermission("<Module>", "<Action>")

   using the module and action names exactly as the Permission Actions sheet
   spells them. Hiding a nav item or a button here stops nobody.
   ========================================================================== */

(function (window, document) {
    "use strict";

    var Portal = window.BodibePortal;
    if (!Portal) return;             // no session; the shell already redirected

    var esc = Portal.escapeHtml;

    function statusBadgeClass(status) {
        if (!status) return "status-default";
        var s = String(status).toLowerCase();
        if (s.indexOf("progress") !== -1) return "status-progress";
        if (s.indexOf("hold") !== -1 || s.indexOf("risk") !== -1) return "status-hold";
        if (s.indexOf("overdue") !== -1) return "status-overdue";
        return "status-default";
    }

    function formatDate(value) {
        if (!value) return "No date set";
        var d = new Date(value);
        if (isNaN(d.getTime())) return value;
        return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
    }

    function renderProjects(projects) {
        if (!projects.length) {
            return '<p class="dash-empty">No active projects assigned to you right now.</p>';
        }
        return projects.map(function (p) {
            return '<div class="dash-item">'
                + '<div class="dash-item-top">'
                + '<span class="dash-item-name">' + esc(p.client || p.projectId) + '</span>'
                + '<span class="dash-badge ' + statusBadgeClass(p.status) + '">'
                + esc(p.status || "—") + '</span>'
                + '</div>'
                + '<div class="dash-item-meta">Due ' + esc(formatDate(p.deadline)) + ' · '
                + esc(p.health || "") + '</div>'
                + '<div class="dash-progress-track">'
                + '<div class="dash-progress-fill" style="width:'
                + Math.round((p.progress || 0) * 100) + '%"></div>'
                + '</div></div>';
        }).join("");
    }

    function renderTasks(tasks) {
        if (!tasks.length) {
            return '<p class="dash-empty">No open tasks. You\'re all caught up.</p>';
        }
        return tasks.map(function (t) {
            return '<div class="dash-item">'
                + '<div class="dash-item-top">'
                + '<span class="dash-item-name">' + esc(t.name || t.taskId) + '</span>'
                + '<span class="dash-badge ' + statusBadgeClass(t.status) + '">'
                + esc(t.status || "—") + '</span>'
                + '</div>'
                + '<div class="dash-item-meta">Due ' + esc(formatDate(t.dueDate)) + '</div>'
                + '</div>';
        }).join("");
    }


    /* ======================================================================
       RING CHART — reusable, native SVG, no library

       Three concentric rings, each with its own track. Rings are scaled
       against the LARGEST value in the set, so they compare sizes against
       each other. They are NOT percentages of anything, and nothing on
       screen or in the accessible name claims they are: the centre shows a
       real total and the legend shows real counts.
       ====================================================================== */

    // Radii and stroke are chosen together: the innermost ring's inner edge
    // (r - width/2 = 46) has to leave room for the centre total and its
    // label, or the ring draws straight through the number it is summarising.
    var RING_GEOMETRY = [
        { r: 88, width: 12 },
        { r: 70, width: 12 },
        { r: 52, width: 12 },
    ];
    var SVG_NS = "http://www.w3.org/2000/svg";

    // A value may arrive as an array to count, a number, or not at all.
    // Anything unrecognisable counts as zero rather than breaking the card.
    function countOf(value) {
        if (Array.isArray(value)) return value.length;
        var n = Number(value);
        return isFinite(n) && n >= 0 ? Math.round(n) : 0;
    }

    function svgEl(name, attrs) {
        var node = document.createElementNS(SVG_NS, name);
        Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
        return node;
    }

    function createRingChart(options) {
        var opts = options || {};
        var host = document.getElementById(opts.chartId);
        var legendHost = document.getElementById(opts.legendId);
        if (!host) return null;

        var series = (Array.isArray(opts.data) ? opts.data : [])
            .slice(0, RING_GEOMETRY.length)
            .map(function (d, i) {
                return {
                    label: (d && d.label) || "Item " + (i + 1),
                    value: countOf(d && d.value),
                    colour: (d && d.colour) || "currentColor",
                };
            });

        var total = series.reduce(function (sum, d) { return sum + d.value; }, 0);
        var largest = series.reduce(function (max, d) { return Math.max(max, d.value); }, 0);

        var centreValue = opts.centerValue === undefined ? total : countOf(opts.centerValue);
        var centreLabel = opts.centerLabel || "Total";

        // The accessible name carries the real counts, so the chart is
        // readable without seeing a single colour.
        var spoken = series.map(function (d) { return d.value + " " + d.label.toLowerCase(); });
        host.setAttribute("role", "img");
        host.setAttribute(
            "aria-label",
            (opts.title ? opts.title + ": " : "")
            + centreValue + " " + centreLabel.toLowerCase() + " in total"
            + (spoken.length ? " — " + spoken.join(", ") : "") + "."
        );

        host.innerHTML = "";

        var svg = svgEl("svg", {
            viewBox: "0 0 200 200", class: "ring-svg",
            "aria-hidden": "true", focusable: "false",
        });

        // Tracks first, so every ring sits in a visible groove even at zero.
        series.forEach(function (d, i) {
            var g = RING_GEOMETRY[i];
            svg.appendChild(svgEl("circle", {
                class: "ring-track", cx: 100, cy: 100, r: g.r,
                "stroke-width": g.width, fill: "none",
            }));
        });

        var arcs = [];
        series.forEach(function (d, i) {
            var g = RING_GEOMETRY[i];
            var circumference = 2 * Math.PI * g.r;
            // Scaled against the largest value present — a visual comparison.
            var fraction = largest > 0 ? d.value / largest : 0;

            var arc = svgEl("circle", {
                class: "ring-arc", cx: 100, cy: 100, r: g.r,
                "stroke-width": g.width, fill: "none",
                stroke: d.colour, "stroke-linecap": "butt",
                "stroke-dasharray": circumference.toFixed(2),
                "stroke-dashoffset": circumference.toFixed(2),
            });
            svg.appendChild(arc);
            arcs.push({ node: arc, offset: (circumference * (1 - fraction)).toFixed(2) });
        });

        host.appendChild(svg);

        var centre = document.createElement("div");
        centre.className = "ring-centre";
        centre.setAttribute("aria-hidden", "true");
        centre.innerHTML = '<strong class="ring-centre-value">' + esc(String(centreValue)) + "</strong>"
            + '<span class="ring-centre-label">' + esc(centreLabel) + "</span>";
        host.appendChild(centre);

        // Reveal. Someone who has asked for less motion gets the finished
        // chart immediately rather than a slower version of the animation.
        var still = window.matchMedia
            && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (still) {
            arcs.forEach(function (a) { a.node.setAttribute("stroke-dashoffset", a.offset); });
        } else {
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    arcs.forEach(function (a, i) {
                        a.node.style.transitionDelay = (i * 110) + "ms";
                        a.node.setAttribute("stroke-dashoffset", a.offset);
                    });
                });
            });
        }

        if (legendHost) {
            legendHost.innerHTML = series.map(function (d) {
                return '<li class="ring-legend-item">'
                    + '<span class="ring-legend-dot" style="background:' + esc(d.colour) + '"'
                    + ' aria-hidden="true"></span>'
                    + '<span class="ring-legend-label">' + esc(d.label) + "</span>"
                    + '<span class="ring-legend-value">' + d.value + "</span>"
                    + "</li>";
            }).join("");
        }

        return { total: total, largest: largest, series: series };
    }

    // The workload card. Built from the /staff/my-work response the dashboard
    // has ALREADY fetched — this makes no request of its own.
    function workloadCardHtml() {
        return '<section class="dash-card ring-card" aria-labelledby="workloadTitle">'
            + '<div class="ring-card-head">'
            + '<span class="ring-eyebrow">THIS WEEK</span>'
            + '<h2 id="workloadTitle"><i class="fa-solid fa-chart-pie" aria-hidden="true"></i>'
            + ' Your Workload</h2>'
            + '<span class="ring-live"><span class="ring-live-dot" aria-hidden="true"></span>Live</span>'
            + '</div>'
            + '<div class="ring-body">'
            + '<div class="ring-chart" id="workloadRingChart"></div>'
            + '<ul class="ring-legend" id="workloadRingLegend"></ul>'
            + '</div>'
            + '</section>';
    }

    function drawWorkloadChart(work) {
        createRingChart({
            chartId: "workloadRingChart",
            legendId: "workloadRingLegend",
            title: "Your workload",
            centerLabel: "Work Items",
            data: [
                { label: "Active Projects", value: work.activeProjects,
                  colour: "var(--ring-projects, #3b82f6)" },
                { label: "Open Tasks", value: work.openTasks,
                  colour: "var(--ring-tasks, #38bdf8)" },
                { label: "Completed", value: work.completedTaskCount,
                  colour: "var(--ring-done, #8b5cf6)" },
            ],
        });
    }

    function renderWork(work) {
        var target = document.getElementById("dashContent");
        if (!target) return;
        // countOf() rather than .length: a field the API omits should leave a
        // zero on the tile, not throw and blank the whole dashboard.
        var projects = Array.isArray(work.activeProjects) ? work.activeProjects : [];
        var tasks = Array.isArray(work.openTasks) ? work.openTasks : [];

        target.innerHTML =
              '<div class="dash-stats">'
            + '<div class="dash-stat"><strong>' + countOf(work.activeProjects)
              + '</strong><span>ACTIVE PROJECTS</span></div>'
            + '<div class="dash-stat"><strong>' + countOf(work.openTasks)
              + '</strong><span>OPEN TASKS</span></div>'
            + '<div class="dash-stat"><strong>' + countOf(work.completedTaskCount)
              + '</strong><span>COMPLETED TASKS</span></div>'
            + '</div>'
            + workloadCardHtml()
            + '<div class="dash-grid">'
            + '<div class="dash-card">'
            + '<h2><i class="fa-solid fa-diagram-project" aria-hidden="true"></i> My Projects</h2>'
            + renderProjects(projects)
            + '</div>'
            + '<div class="dash-card">'
            + '<h2><i class="fa-solid fa-list-check" aria-hidden="true"></i> My Tasks</h2>'
            + renderTasks(tasks)
            + '</div></div>';

        // Drawn after the markup is in the document, from data already in hand.
        // A chart that fails must never take the rest of the dashboard with it.
        try {
            drawWorkloadChart(work);
        } catch (err) {
            console.error("Workload chart failed:", err);
            var card = document.querySelector(".ring-card");
            if (card) {
                card.innerHTML = '<p class="dash-empty">Workload chart unavailable.</p>';
            }
        }
    }

    function showWorkError() {
        var target = document.getElementById("dashContent");
        if (target) {
            target.innerHTML = '<p class="dash-empty">'
                + 'Couldn\'t load your work right now. Try refreshing.</p>';
        }
    }

    // A missing module menu must not hide your tasks, and vice versa — the
    // shell already loaded permissions independently of this.
    Portal.onReady(async function () {
        window.SystemModules?.dashboard();
        var currentStaff = Portal.getStaff();
        if (currentStaff && String(currentStaff.department).toLowerCase() === 'support' && ['Support Agent','Support Supervisor','Support Manager'].includes(currentStaff.role)) {
            window.location.replace('staff-support.html#dashboard'); return;
        }
        try {
            var res = await Portal.authedFetch("/staff/my-work");
            if (!res.ok) throw new Error("work_failed_" + res.status);
            var work = await res.json();
            if (!work.success) throw new Error(work.message || "work_failed");
            renderWork(work);
        } catch (err) {
            if (err.sessionExpired) return Portal.goToLogin();
            console.error("Work load failed:", err);
            showWorkError();
        }
    });

    // Identity itself failed. The shell has already put a notice on screen;
    // the dashboard body must not sit on "Loading…" forever.
    Portal.onFail(function () {
        var target = document.getElementById("dashContent");
        if (target) {
            target.innerHTML = '<p class="dash-empty">'
                + 'We can\'t reach the portal right now. Check your connection and refresh.</p>';
        }
    });
})(window, document);
