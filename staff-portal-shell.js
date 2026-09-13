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
        var res = await fetch(API_BASE_URL + path, Object.assign({}, opts, { headers: headers }));
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

    // Presentation only. A module with no entry still renders with a default
    // icon, so the sheet can add a module without this file knowing first.
    var MODULE_PRESENTATION = {
        CRM:        { icon: "fa-address-book", href: "staff-leads.html", label: "Leads" },
        Projects:   { entries: [
            { icon: "fa-diagram-project", href: "staff-projects.html", label: "Projects" },
            { icon: "fa-list-check", href: "staff-tasks.html", label: "Tasks" },
        ] },
        Quotations: { icon: "fa-file-invoice", href: "staff-quotes.html", label: "Quotations" },
        Finance:    { icon: "fa-receipt", href: null },
        Staff:      { icon: "fa-users", href: null },
        Settings:   { icon: "fa-sliders", href: null },
    };
    var DEFAULT_ICON = "fa-folder";

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function currentPage() {
        var path = window.location.pathname.split("/").pop();
        return path || "staff-dashboard.html";
    }

    function renderNavigation() {
        var section = document.getElementById("navModulesSection");
        var list = document.getElementById("navModules");
        var note = document.getElementById("navModulesNote");
        var emptySection = document.getElementById("navEmptySection");
        var emptyNote = document.getElementById("navEmptyNote");
        if (!section || !list) return;

        var visible = Object.keys(permissions).filter(canViewModule);
        var here = currentPage();

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
                var icon = look.icon || DEFAULT_ICON;
                var label = escapeHtml(look.label || name);
                var safeName = escapeHtml(look.label || name);

                if (look.href) {
                    var isCurrent = look.href === here;
                    // Away from the desktop a shipped module is still reachable but
                    // read-only, because the device policy withholds every non-View
                    // action. Tasks deliberately inherit Projects -> View Projects.
                    var tag = fullWorkspace ? "" : '<span class="portal-nav-tag">View only</span>';
                    return '<li><a href="' + escapeHtml(look.href) + '" class="portal-nav-link'
                        + (isCurrent ? " is-current" : "") + '"'
                        + (isCurrent ? ' aria-current="page"' : "") + '>'
                        + '<span class="portal-nav-icon" aria-hidden="true"><i class="fa-solid ' + icon + '"></i></span>'
                        + '<span class="portal-nav-label">' + label + '</span>' + tag + '</a></li>';
                }
                return '<li><span class="portal-nav-static">'
                    + '<span class="portal-nav-icon" aria-hidden="true"><i class="fa-solid ' + icon + '"></i></span>'
                    + '<span class="portal-nav-label">' + safeName + '</span>'
                    + '<span class="portal-nav-tag">Soon</span></span></li>';
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

        // The Dashboard link is only "current" when no module page is.
        var dashLink = document.querySelector("#navPrimary .portal-nav-link");
        if (dashLink) {
            var onDash = here === "staff-dashboard.html";
            dashLink.classList.toggle("is-current", onDash);
            if (onDash) dashLink.setAttribute("aria-current", "page");
            else dashLink.removeAttribute("aria-current");
        }
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

    async function signOut() {
        try {
            await fetch(API_BASE_URL + "/auth/logout", {
                method: "POST", headers: { Authorization: "Bearer " + token },
            });
        } catch (err) {
            // Logout is stateless server-side — clearing the local token is
            // what actually ends the session.
        }
        goToLogin();
    }

    ["logoutBtn", "logoutBtnTop"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener("click", signOut);
    });

    /* ----------------------------------------------------------------- boot */

    var readyCallbacks = [];
    var failCallbacks = [];

    function onReady(fn) { if (typeof fn === "function") readyCallbacks.push(fn); }
    function onFail(fn) { if (typeof fn === "function") failCallbacks.push(fn); }

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

    boot();
})(window, document);
