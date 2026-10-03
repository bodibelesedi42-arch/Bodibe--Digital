/* ==========================================================================
   BODIBE DIGITAL — STAFF PORTAL SHELL

   Everything every portal page needs: the session, identity, the permission
   set, the sidebar, the mobile drawer, and sign-out. Module pages
   (staff-dashboard.js, staff-leads.js, ...) load this first and then only
   worry about their own content.

   Extracted from staff-dashboard.js when the second page arrived, so the
   drawer, the inert handling and the permission gate exist once instead of
   once per module.

   SECURITY NOTE
   -------------
   can() / canHere() decide what to DRAW. They are not authorization. Any
   employee can read this file or call an API directly with their token, so
   every module endpoint must enforce server-side:

       requireAuth + requirePermission("<Module>", "<Action>")

   with the module and action spelled exactly as the Permission Actions sheet
   spells them.
   ========================================================================== */

(function (window, document) {
    "use strict";

    var API_BASE_URL = "https://bodibedigital-backend.onrender.com";
    var TOKEN_KEY = "bd_staff_token";

    var token = null;
    try { token = sessionStorage.getItem(TOKEN_KEY); } catch (e) { token = null; }

    function goToLogin() {
        try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
        window.location.href = "staff-login.html";
    }

    if (!token) {
        goToLogin();
        return;
    }

    /* ---------------------------------------------------------------- fetch */

    // A 401 anywhere means the session is over. Rather than leaving a
    // half-loaded portal on screen, clear it and go to login.
    async function authedFetch(path, options) {
        var opts = options || {};
        var headers = Object.assign({ Authorization: "Bearer " + token }, opts.headers || {});
        var controller = new AbortController();
        var timer = window.setTimeout(function () { controller.abort(); }, 60000);
        var res;
        try {
            res = await fetch(API_BASE_URL + path, Object.assign({}, opts, { headers: headers, signal: controller.signal }));
            // Consume the body inside the deadline as well as the response headers.
            var body = await res.text();
            res = new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
        } catch (err) {
            if (err.name === "AbortError") throw new Error("The request timed out. Please retry. For a save, refresh first to check whether it completed.");
            throw err;
        } finally { window.clearTimeout(timer); }
        if (res.status === 401) {
            var expired = new Error("session_expired");
            expired.sessionExpired = true;
            throw expired;
        }
        return res;
    }

    /* ---------------------------------------------------------- permissions */

    var permissions = {};
    var permissionsLoaded = false;
    var recruitmentAllowed = false;
    var staff = null;

    function findKey(object, wanted) {
        if (!object) return undefined;
        if (Object.prototype.hasOwnProperty.call(object, wanted)) return wanted;
        var target = String(wanted == null ? "" : wanted).trim().toLowerCase();
        return Object.keys(object).find(function (k) {
            return k.trim().toLowerCase() === target;
        });
    }

    // Is this employee AUTHORISED? (RBAC only.)
    function can(moduleName, action) {
        var mKey = findKey(permissions, moduleName);
        if (!mKey) return false;
        var aKey = findKey(permissions[mKey], action);
        if (!aKey) return false;
        return permissions[mKey][aKey] === true;
    }

    // Authorised AND offered on this device -> draw the control.
    function canHere(moduleName, action) {
        if (!can(moduleName, action)) return false;
        return window.BodibeAccess ? window.BodibeAccess.allowsHere(moduleName, action) : true;
    }

    // Wording when the employee IS authorised but the device withholds it.
    function whyNotHere(moduleName, action) {
        if (!can(moduleName, action)) return null;
        if (!window.BodibeAccess) return null;
        return window.BodibeAccess.allowsHere(moduleName, action)
            ? null
            : window.BodibeAccess.NOTICES.action;
    }

    function canViewModule(moduleName) {
        var mKey = findKey(permissions, moduleName);
        if (!mKey) return false;
        var actions = permissions[mKey];
        var viewKeys = Object.keys(actions).filter(function (a) { return /^view\b/i.test(a.trim()); });
        if (viewKeys.length) {
            return viewKeys.some(function (a) { return actions[a] === true; });
        }
        return Object.keys(actions).some(function (a) { return actions[a] === true; });
    }

    /* ----------------------------------------------------------------- nav */

    // Sidebar profiles are intentionally opinionated. The business asked for
    // two stable workspaces:
    //   1) Sales / Sales Partner -> a focused selling workspace.
    //   2) Owner / Director      -> the full management workspace.
    // Everyone else keeps the permission-derived fallback so future roles do
    // not accidentally inherit owner navigation.
    //
    // This remains PRESENTATION ONLY. Backend requirePermission() checks are
    // still the security boundary for every action and data request.
    var MODULE_PRESENTATION = {
        CRM:        { entries: [
            { icon: "fa-chart-line", href: "staff-sales.html", label: "Sales" },
            { icon: "fa-address-book", href: "staff-leads.html", label: "Leads" },
        ] },
        Projects:   { entries: [
            { icon: "fa-address-card", href: "staff-clients.html", label: "Clients" },
            { icon: "fa-diagram-project", href: "staff-projects.html", label: "Projects" },
            { icon: "fa-list-check", href: "staff-tasks.html", label: "Tasks" },
        ] },
        Quotations: { icon: "fa-file-invoice", href: "staff-quotes.html", label: "Quotations" },
        Finance:    { icon: "fa-receipt", href: "staff-finance.html", label: "Finance" },
        Staff:      { icon: "fa-users", href: "staff-team.html", label: "Team" },
        Settings:   { icon: "fa-sliders", href: null },
    };
    var DEFAULT_ICON = "fa-folder";

    var SALES_NAV = [
        { heading: "SALES", items: [
            { icon: "fa-chart-line", href: "staff-sales.html", label: "Sales Workspace" },
            { icon: "fa-address-book", href: "staff-leads.html", label: "My Leads" },
            {icon:"fa-people-arrows",href:"staff-allocation.html",label:"Available / Allocation"},
            { icon: "fa-clock-rotate-left", href: "staff-sales.html#follow-ups", label: "Follow-Ups" },
            { icon: "fa-file-invoice", href: "staff-quotes.html", label: "Quotes" },
            { icon: "fa-user-group", href: "staff-clients.html", label: "My Clients" },
            { icon: "fa-list-check", href: "staff-tasks.html", label: "My Tasks" },
            { icon: "fa-coins", href: "staff-commission.html", label: "Commission" },
            { icon: "fa-book-open", href: "staff-resources.html", label: "Sales Resources" },
        ] },
        { heading: "ACCOUNT", items: [
            { icon: "fa-user", href: "staff-profile.html", label: "Profile" },
            { icon: "fa-arrow-right-from-bracket", action: "logout", label: "Logout" },
        ] },
    ];

    var managementAccess = null;
    var OWNER_NAV = [
        { heading: "SALES", items: [
            { icon: "fa-chart-line", href: "staff-sales.html", label: "Sales Workspace" },
            { icon: "fa-address-book", href: "staff-leads.html", label: "Leads / CRM" },
            {icon:"fa-people-arrows",href:"staff-allocation.html",label:"Lead Allocation"},
            { icon: "fa-clock-rotate-left", href: "staff-sales.html#follow-ups", label: "Follow-Ups" },
            { icon: "fa-file-invoice", href: "staff-quotes.html", label: "Quotes" },
            { icon: "fa-user-group", href: "staff-clients.html", label: "Clients" },
            { icon: "fa-book-open", href: "staff-resources.html", label: "Sales Resources" },
        ] },
        { heading: "OPERATIONS", items: [
            { icon: "fa-diagram-project", href: "staff-projects.html", label: "Projects" },
            { icon: "fa-list-check", href: "staff-tasks.html", label: "Tasks" },
            { icon: "fa-headset", href: "staff-support.html#dashboard", label: "Support" },
        ] },
        { heading: "FINANCE", items: [
            { icon: "fa-file-invoice-dollar", href: "staff-finance.html#invoices", label: "Invoices" },
            { icon: "fa-credit-card", href: "staff-finance.html#payments", label: "Payments" },
            { icon: "fa-receipt", href: "staff-expenses.html", label: "Expenses" },
            { icon: "fa-coins", href: "staff-commission.html", label: "Commission" },
        ] },
        { heading: "TEAM", items: [
            { icon: "fa-users", href: "staff-team.html", label: "Staff" },
            { icon: "fa-user-shield", href: "staff-team.html#roles-permissions", label: "Roles & Permissions" },
            { icon: "fa-user-plus", href: "staff-recruitment.html", label: "Recruitment" },
            { icon: "fa-chart-simple", href: "staff-performance.html", label: "Performance" },
        ] },
        { heading: "MANAGEMENT", items: [
            { icon: "fa-chart-pie", href: "staff-reports.html", label: "Reports / KPIs" },
            { icon: "fa-clock-rotate-left", href: "staff-activity.html", label: "Activity Log" },
            { icon: "fa-circle-check", href: "staff-approvals.html", label: "Approvals" },
            { icon: "fa-gears", href: "staff-automations.html", label: "Automations" },
        ] },
        { heading: "ACCOUNT", items: [
            { icon: "fa-sliders", href: "staff-coming-soon.html?feature=Settings", label: "Settings" },
            { icon: "fa-user", href: "staff-profile.html", label: "Profile" },
            { icon: "fa-arrow-right-from-bracket", action: "logout", label: "Logout" },
        ] },
    ];

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function currentPage() {
        var path = window.location.pathname.split("/").pop();
        return path || "staff-dashboard.html";
    }

    function currentDestination() {
        return currentPage() + (window.location.search || "") + (window.location.hash || "");
    }


    function supportNavigation() {
        var role = String(staff.role || '');
        var groups;
        if (role === 'Support Agent') groups = [
            ['SUPPORT', [['My Tickets','tickets'],['Client Requests','requests'],['Maintenance Tasks','maintenance'],['My Clients','clients'],['Knowledge Base','knowledge'],['Files','files']]],
            ['WORK', [['My Tasks','tasks'],['Notifications','notifications']]]
        ];
        else if (role === 'Support Supervisor') groups = [
            ['SUPPORT TEAM', [['Team Tickets','tickets'],['Client Requests','requests'],['Maintenance','maintenance'],['Agent Activity','activity'],['Escalations','escalations'],['SLA / Deadlines','deadlines']]],
            ['PERFORMANCE', [['Agent Performance','performance'],['Resolution Times','resolution'],['Ticket Backlog','backlog'],['Client Satisfaction','satisfaction']]],
            ['MANAGEMENT', [['Ticket Assignment','assignment'],['Team Workload','workload'],['Knowledge Base','knowledge'],['Reports','reports']]]
        ];
        else groups = [
            ['SUPPORT', [['All Tickets','tickets'],['Client Requests','requests'],['Maintenance','maintenance'],['Escalations','escalations'],['Support Team','team'],['Supervisors','supervisors'],['Knowledge Base','knowledge']]],
            ['PERFORMANCE', [['Support Targets','targets'],['Resolution Times','resolution'],['Ticket Backlog','backlog'],['Agent Performance','performance'],['Supervisor Performance','workload'],['Client Satisfaction','satisfaction']]],
            ['MANAGEMENT', [['Assignments','assignment'],['Support Reports','reports'],['Approvals','approvals'],['Activity Log','activity'],['Support Policies','policies']]]
        ];
        var result = can('Support','View Tickets') ? groups.map(function (g) {
            return {heading:g[0],items:g[1].filter(function (i) {
                if (['performance','resolution','reports','workload','satisfaction'].indexOf(i[1]) >= 0) return can('Support','View Reports');
                if (i[1] === 'assignment') return can('Support','Assign Ticket');
                return true;
            }).map(function(i){return {icon:'fa-headset',label:i[0],href:'staff-support.html#'+i[1]};})};
        }) : [];
        result.push({heading:'ACCOUNT',items:[{icon:'fa-user',label:'Profile',href:'staff-profile.html'},{icon:'fa-arrow-right-from-bracket',label:'Logout',action:'logout'}]});
        return result;
    }

    function financeNavigation() {
        var items=[];
        if(can('Finance','View Invoices'))items.push({icon:'fa-file-invoice',label:'Invoices',href:'staff-finance.html#invoices'},{icon:'fa-credit-card',label:'Payments',href:'staff-finance.html#payments'});
        if(can('Expenses','View Expenses'))items.push({icon:'fa-receipt',label:'Expenses',href:'staff-expenses.html'});
        if(can('Finance','View Financial Reports'))items.push({icon:'fa-chart-pie',label:'Financial Reports',href:'staff-finance.html#reports'});
        return [{heading:'FINANCE',items:items},{heading:'ACCOUNT',items:[{icon:'fa-user',label:'Profile',href:'staff-profile.html'},{icon:'fa-arrow-right-from-bracket',label:'Logout',action:'logout'}]}];
    }
    function navProfile() {
        var role = String((staff && staff.role) || "").trim().toLowerCase();
        var department = String((staff && staff.department) || "").trim().toLowerCase();

        if (department === 'finance' && ['finance manager','finance staff','finance officer','accountant'].indexOf(role)>=0) return 'finance';
        if (department === 'support' && ['support agent','support supervisor','support manager'].indexOf(role) >= 0) return 'support';
        if (/owner|director|super\s*admin|administrator|manager/.test(role)) return "owner";
        if (/sales/.test(role) || /sales/.test(department)) return "sales";
        return "permissions";
    }

    function navItemHtml(item, here, fullWorkspace) {
        var icon = escapeHtml(item.icon || DEFAULT_ICON);
        var label = escapeHtml(item.label || "Module");

        if (item.action === "logout") {
            return '<li><button type="button" class="portal-nav-link portal-nav-button" data-portal-action="logout">'
                + '<span class="portal-nav-icon" aria-hidden="true"><i class="fa-solid ' + icon + '"></i></span>'
                + '<span class="portal-nav-label">' + label + '</span></button></li>';
        }

        if (!item.href) {
            return '<li><span class="portal-nav-static">'
                + '<span class="portal-nav-icon" aria-hidden="true"><i class="fa-solid ' + icon + '"></i></span>'
                + '<span class="portal-nav-label">' + label + '</span></span></li>';
        }

        var exact = item.href === here;
        var itemPage = item.href.split(/[?#]/)[0];
        var herePage = here.split(/[?#]/)[0];
        var itemHasHash = item.href.indexOf("#") !== -1;
        var itemHasQuery = item.href.indexOf("?") !== -1;
        var isCurrent = exact || (!itemHasHash && !itemHasQuery && itemPage === herePage
            && window.location.hash === "" && window.location.search === "");
        var viewOnlyTag = fullWorkspace ? "" : '<span class="portal-nav-tag">View only</span>';
        return '<li><a href="' + escapeHtml(item.href) + '" class="portal-nav-link'
            + (isCurrent ? " is-current" : "") + '"'
            + (isCurrent ? ' aria-current="page"' : "") + '>'
            + '<span class="portal-nav-icon" aria-hidden="true"><i class="fa-solid ' + icon + '"></i></span>'
            + '<span class="portal-nav-label">' + label + '</span>' + viewOnlyTag + '</a></li>';
    }

    function bindNavigationActions() {
        Array.prototype.forEach.call(document.querySelectorAll('[data-portal-action="logout"]'), function (button) {
            button.addEventListener("click", signOut);
        });
    }

    function renderRoleNavigation(groups) {
        var section = document.getElementById("navModulesSection");
        var list = document.getElementById("navModules");
        var heading = document.getElementById("navModulesHeading");
        var note = document.getElementById("navModulesNote");
        var emptySection = document.getElementById("navEmptySection");
        if (!section || !list) return;

        if (heading) heading.hidden = true;
        if (note) note.textContent = "";
        if (emptySection) emptySection.hidden = true;
        section.hidden = false;

        var fullWorkspace = !window.BodibeAccess || window.BodibeAccess.isFullWorkspace();
        var here = currentDestination();
        list.innerHTML = groups.map(function (group) {
            var title = '<li class="portal-nav-group-heading" aria-hidden="true">' + escapeHtml(group.heading) + '</li>';
            var managementOwner = /^(owner|director|owner\s*\/\s*director)$/i.test(String(staff.role || '').trim());
            var visibleItems = group.heading === 'MANAGEMENT' ? group.items.filter(function(item){ var modules={'Reports / KPIs':'Reports','Activity Log':'Activity Log','Approvals':'Approvals','Automations':'Automations'}; var module=modules[item.label]; return managementOwner || (managementAccess ? Boolean(managementAccess.modules[module] && (managementAccess.modules[module].view || managementAccess.modules[module].manage)) : can(module,'View '+module) || can(module,'Manage '+module)); }) : group.items;
            if (!visibleItems.length) return '';
            var items = visibleItems.map(function (item) { return navItemHtml(item, here, fullWorkspace); }).join("");
            return title + items;
        }).join("");

        bindNavigationActions();
    }

    function renderPermissionNavigation() {
        var section = document.getElementById("navModulesSection");
        var list = document.getElementById("navModules");
        var heading = document.getElementById("navModulesHeading");
        var note = document.getElementById("navModulesNote");
        var emptySection = document.getElementById("navEmptySection");
        var emptyNote = document.getElementById("navEmptyNote");
        if (!section || !list) return;

        if (heading) { heading.hidden = false; heading.textContent = "Your modules"; }
        var visible = Object.keys(permissions).filter(canViewModule);
        var here = currentDestination();

        if (!permissionsLoaded) {
            section.hidden = true;
            if (emptySection) {
                emptySection.hidden = false;
                emptyNote.textContent = "Your module list couldn't be loaded. Try refreshing in a moment.";
            }
            return;
        }

        if (!visible.length) {
            section.hidden = true;
            if (emptySection) {
                emptySection.hidden = false;
                emptyNote.textContent = "You don't currently have access to any additional modules. "
                    + "If you think that's wrong, speak to your manager.";
            }
            return;
        }

        if (emptySection) emptySection.hidden = true;
        section.hidden = false;
        var fullWorkspace = !window.BodibeAccess || window.BodibeAccess.isFullWorkspace();

        function entriesFor(name) {
            var look = MODULE_PRESENTATION[name] || {};
            return Array.isArray(look.entries) && look.entries.length ? look.entries : [look];
        }

        list.innerHTML = visible.map(function (name) {
            return entriesFor(name).map(function (look) {
                return navItemHtml({
                    icon: look.icon || DEFAULT_ICON,
                    href: look.href || null,
                    label: look.label || name,
                }, here, fullWorkspace);
            }).join("");
        }).join("");

        var built = visible.filter(function (n) {
            return entriesFor(n).some(function (entry) { return Boolean(entry.href); });
        }).length;
        var pending = visible.length - built;
        if (note) {
            note.textContent = fullWorkspace
                ? (pending
                    ? pending + " more module" + (pending === 1 ? "" : "s") + " assigned to your role "
                      + (pending === 1 ? "is" : "are") + " still being built."
                    : "")
                : "On this device your modules are read-only — sign in on desktop for the full workspace.";
        }
    }

    function renderNavigation() {
        var profile = navProfile();
        if (profile === "finance") renderRoleNavigation(financeNavigation());
        else if (profile === "support") renderRoleNavigation(supportNavigation());
        else if (profile === "owner") renderRoleNavigation(OWNER_NAV);
        else if (profile === "sales") renderRoleNavigation(SALES_NAV);
        else renderPermissionNavigation();

        // Reimbursements require an explicit role grant plus the server policy.
        if(profile!=='owner' && managementAccess){var managementList=document.getElementById('navModules');if(managementList){var managementItems=[['Reports','reports','Reports / KPIs'],['Activity Log','activity','Activity Log'],['Approvals','approvals','My Requests / Approvals'],['Automations','automations','Automations']].filter(function(x){return x[0]==='Approvals'||managementAccess.modules[x[0]]?.view||managementAccess.modules[x[0]]?.manage;});if(managementItems.length){document.getElementById('navModulesSection').hidden=false;managementList.insertAdjacentHTML('beforeend','<li class="portal-nav-group-heading">MANAGEMENT</li>'+managementItems.map(function(x){return navItemHtml({icon:'fa-layer-group',label:x[2],href:'staff-'+x[1]+'.html'},currentDestination(),true);}).join(''));}}}
        if(profile!=='owner' && profile!=='finance' && can('Expenses','Submit Expense')){
            var list=document.getElementById('navModules');
            if(list)list.insertAdjacentHTML('beforeend',navItemHtml({icon:'fa-receipt',label:'My reimbursements',href:'staff-expenses.html'},currentDestination(),true));
        }
        if(profile!=='owner'&&recruitmentAllowed){var recruitmentList=document.getElementById('navModules');if(recruitmentList){var recruitmentSection=document.getElementById('navModulesSection');if(recruitmentSection)recruitmentSection.hidden=false;recruitmentList.insertAdjacentHTML('beforeend','<li class="portal-nav-group-heading">STAFF</li>'+navItemHtml({icon:'fa-user-plus',label:'Recruitment',href:'staff-recruitment.html'},currentDestination(),!window.BodibeAccess||window.BodibeAccess.isFullWorkspace()));}}
        if(profile!=='owner' && staff){var performanceList=document.getElementById('navModules');if(performanceList){var performanceSection=document.getElementById('navModulesSection');if(performanceSection)performanceSection.hidden=false;performanceList.insertAdjacentHTML('beforeend',navItemHtml({icon:'fa-chart-simple',label:'My Performance',href:'staff-performance.html'},currentDestination(),!window.BodibeAccess||window.BodibeAccess.isFullWorkspace()));}}
        // Dashboard always sits above the role sections.
        var dashLink = document.querySelector("#navPrimary .portal-nav-link");
        if (dashLink) {
            var supportRole = profile === 'support';
            dashLink.href = supportRole ? 'staff-support.html#dashboard' : 'staff-dashboard.html';
            var onDash = currentPage() === "staff-dashboard.html" || (supportRole && currentPage() === 'staff-support.html' && (!window.location.hash || window.location.hash === '#dashboard'));
            dashLink.classList.toggle("is-current", onDash);
            if (onDash) dashLink.setAttribute("aria-current", "page");
            else dashLink.removeAttribute("aria-current");
        }

        // Logout now lives under ACCOUNT exactly as specified. Keep the
        // legacy footer button in the markup for compatibility, but do not
        // duplicate it visually.
        var legacyLogout = document.getElementById("logoutBtn");
        if (legacyLogout) legacyLogout.hidden = true;
    }

    /* -------------------------------------------------------------- notices */

    function showNotice(message, kind) {
        var el = document.getElementById("portalNotice");
        if (!el) return;
        el.textContent = message;
        el.classList.toggle("is-warning", kind === "warning");
        el.hidden = false;
    }

    function clearNotice() {
        var el = document.getElementById("portalNotice");
        if (el) el.hidden = true;
    }

    function renderModeNotice() {
        var el = document.getElementById("modeNotice");
        var text = document.getElementById("modeNoticeText");
        if (!el || !text || !window.BodibeAccess) return;
        var message = window.BodibeAccess.modeNotice();
        if (!message) { el.hidden = true; return; }
        text.textContent = message;
        el.hidden = false;
    }

    function setIdentity(record) {
        staff = record;
        var first = (record.name || "").trim().split(/\s+/)[0] || "there";

        var greeting = document.getElementById("greetingName");
        if (greeting) greeting.textContent = "Welcome back, " + first;
        var roleLine = document.getElementById("roleLine");
        if (roleLine) roleLine.textContent = [record.role, record.department].filter(Boolean).join(" · ");

        var whoName = document.getElementById("whoName");
        if (whoName) whoName.textContent = record.name || "—";
        var whoRole = document.getElementById("whoRole");
        if (whoRole) whoRole.textContent = record.role || "";

        var avatar = document.getElementById("whoAvatar");
        if (avatar) {
            var initials = (record.name || "").trim().split(/\s+/).slice(0, 2)
                .map(function (w) { return w[0] || ""; }).join("").toUpperCase();
            avatar.textContent = initials || "—";
        }
    }

    /* --------------------------------------------------------------- drawer */

    var sidebar = document.getElementById("portalSidebar");
    var backdrop = document.getElementById("navBackdrop");
    var navToggle = document.getElementById("navToggle");
    var navClose = document.getElementById("navClose");

    // offsetParent, not getComputedStyle: the button is always display:grid and
    // it is its hidden PARENT that the media query removes.
    function isDrawerMode() {
        return navToggle && navToggle.offsetParent !== null;
    }

    // A closed drawer is off-screen but still in the DOM, so without this its
    // links stay in the tab order and focus walks off the side of the screen.
    function syncDrawerInertness() {
        if (!sidebar) return;
        sidebar.inert = isDrawerMode() && !sidebar.classList.contains("is-open");
    }

    function openDrawer() {
        sidebar.classList.add("is-open");
        syncDrawerInertness();
        if (backdrop) backdrop.hidden = false;
        navToggle.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
        if (navClose) navClose.focus();
    }

    function closeDrawer(options) {
        var returnFocus = !options || options.returnFocus !== false;
        sidebar.classList.remove("is-open");
        syncDrawerInertness();
        if (backdrop) backdrop.hidden = true;
        navToggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
        if (returnFocus && isDrawerMode()) navToggle.focus();
    }

    if (navToggle && sidebar) {
        navToggle.addEventListener("click", function () {
            if (sidebar.classList.contains("is-open")) closeDrawer();
            else openDrawer();
        });
        if (navClose) navClose.addEventListener("click", function () { closeDrawer(); });
        if (backdrop) backdrop.addEventListener("click", function () { closeDrawer(); });
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && sidebar.classList.contains("is-open")) closeDrawer();
        });
        window.addEventListener("resize", function () {
            if (!isDrawerMode() && sidebar.classList.contains("is-open")) {
                closeDrawer({ returnFocus: false });
            }
            syncDrawerInertness();
        });
        syncDrawerInertness();
    }

    /* ------------------------------------------------------------- sign out */

    function signOut() {
        // Tokens are stateless; clearing the session must not wait on the network.
        goToLogin();
    }

    ["logoutBtn", "logoutBtnTop"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener("click", signOut);
    });

    /* ----------------------------------------------------------------- boot */

    var readyCallbacks = [];
    var failCallbacks = [];

    var bootState = "loading", bootError = null;
    function readyValue() { return { staff: staff, permissions: permissions, permissionsLoaded: permissionsLoaded }; }
    function onReady(fn) {
        if (typeof fn !== "function") return;
        if (bootState === "ready") Promise.resolve().then(function () { fn(readyValue()); }).catch(console.error);
        else readyCallbacks.push(fn);
    }
    function onFail(fn) {
        if (typeof fn !== "function") return;
        if (bootState === "failed") Promise.resolve().then(function () { fn(bootError); }).catch(console.error);
        else failCallbacks.push(fn);
    }

    async function boot() {
        renderModeNotice();

        // 1. Identity. Without this there is no portal.
        try {
            var meRes = await authedFetch("/auth/me");
            if (!meRes.ok) throw new Error("me_failed_" + meRes.status);
            var me = await meRes.json();
            if (!me.success || !me.staff) throw new Error("me_malformed");
            setIdentity(me.staff);
        } catch (err) {
            if (err.sessionExpired) return goToLogin();
            console.error("Portal identity load failed:", err);
            showNotice("The portal is temporarily unavailable. Please try again shortly.", "warning");
            renderNavigation();
            bootState = "failed"; bootError = err;
            failCallbacks.forEach(function (fn) { try { fn(err); } catch (e) { console.error(e); } });
            return;
        }

        // 2. Permissions.
        try {
            var permRes = await authedFetch("/staff/my-permissions");
            if (permRes.ok) {
                var data = await permRes.json();
                if (data.success && data.permissions) {
                    permissions = data.permissions;
                    permissionsLoaded = true;
                    // The server re-reads the Staff sheet, so this is fresher
                    // than the token.
                    if (data.staff) setIdentity(data.staff);
                    if (data.roleFound === false) {
                        showNotice("Your role isn't set up with any module access yet. "
                            + "Ask your manager to check your role.");
                    }
                }
            } else {
                showNotice("Your module list couldn't be loaded.", "warning");
            }
        } catch (err) {
            if (err.sessionExpired) return goToLogin();
            console.error("Permissions load failed:", err);
            showNotice("Your module list couldn't be loaded.", "warning");
        }

        renderNavigation();

        if (window.BodibeAccess) {
            window.BodibeAccess.onModeChange(function () {
                renderModeNotice();
                renderNavigation();
            });
        }

        // Optional access lookup must never block working modules or the ready event.
        authedFetch('/staff/management/access').then(function(r){return r.ok?r.json():null;}).then(function(d){if(d&&d.success){managementAccess=d;renderNavigation();}}).catch(function(){});
        authedFetch('/staff/recruitment/access').then(function(r){return r.ok?r.json():null;}).then(function(d){recruitmentAllowed=Boolean(d&&d.allowed);if(recruitmentAllowed)renderNavigation();}).catch(function(){});
        bootState = "ready";
        readyCallbacks.forEach(function (fn) {
            try { fn({ staff: staff, permissions: permissions, permissionsLoaded: permissionsLoaded }); }
            catch (e) { console.error("Portal ready handler failed:", e); }
        });
    }

    window.BodibePortal = {
        API_BASE_URL: API_BASE_URL,

        // RBAC
        can: can,
        canViewModule: canViewModule,
        // RBAC + device policy — use this to decide whether to draw a control
        canHere: canHere,
        whyNotHere: whyNotHere,
        getPermissions: function () { return permissions; },
        getStaff: function () { return staff; },

        // plumbing for module pages
        authedFetch: authedFetch,
        showNotice: showNotice,
        clearNotice: clearNotice,
        escapeHtml: escapeHtml,
        goToLogin: goToLogin,
        onReady: onReady,
        onFail: onFail,
        renderNavigation: renderNavigation,
        onModeChange: function (fn) {
            if (window.BodibeAccess) window.BodibeAccess.onModeChange(fn);
        },
    };

    window.addEventListener("hashchange", renderNavigation);
    boot();
})(window, document);
