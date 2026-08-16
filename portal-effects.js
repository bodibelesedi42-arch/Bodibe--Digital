/* ==========================================
   BODIBE DIGITAL — BUSINESS PORTAL
   Shared 3D depth/tilt effects for staff-login
   and staff-dashboard. Presentation only — no
   auth/data logic lives here.
========================================== */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- LOGIN: full card tilt + cursor-tracked sheen ---------- */

(function initStageTilt() {
    const stage = document.getElementById("staffStage");
    const card = document.getElementById("staffCard");
    if (!stage || !card || reduceMotion) return;

    const orbs = stage.querySelectorAll(".stage-orb");
    let frameId = null;

    function apply(event) {
        const rect = stage.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;   // 0..1
        const py = (event.clientY - rect.top) / rect.height;   // 0..1
        const nx = px * 2 - 1;                                  // -1..1
        const ny = py * 2 - 1;

        if (frameId) cancelAnimationFrame(frameId);
        frameId = requestAnimationFrame(() => {
            const maxTilt = 9;
            card.style.transform =
                `rotateX(${(-ny * maxTilt).toFixed(2)}deg) rotateY(${(nx * maxTilt).toFixed(2)}deg)`;
            card.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
            card.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);

            orbs.forEach((orb, i) => {
                const depth = i === 0 ? 26 : -18;
                orb.style.transform = `translate3d(${nx * depth}px, ${ny * depth}px, 0)`;
            });
        });
    }

    function reset() {
        card.style.transform = "rotateX(0deg) rotateY(0deg)";
        orbs.forEach((orb) => (orb.style.transform = "translate3d(0,0,0)"));
    }

    stage.addEventListener("mousemove", apply);
    stage.addEventListener("mouseleave", reset);
    stage.addEventListener("touchmove", (event) => {
        if (event.touches[0]) apply(event.touches[0]);
    }, { passive: true });
})();

/* ---------- DASHBOARD: restrained hover-lift on cards/tiles ----------
   .dash-card / .dash-stat are rendered later by staff-dashboard.js once
   the API responds, so this delegates from the static .dash-page
   container instead of binding to elements that don't exist yet. */

(function initHoverLift() {
    if (reduceMotion) return;

    const container = document.querySelector(".dash-page");
    if (!container) return;

    let liftedEl = null;

    function resetLifted() {
        if (!liftedEl) return;
        liftedEl.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0)";
        liftedEl = null;
    }

    container.addEventListener("mousemove", (event) => {
        const el = event.target.closest(".dash-card, .dash-stat");

        if (!el) {
            resetLifted();
            return;
        }

        if (el !== liftedEl) {
            resetLifted();
            liftedEl = el;
        }

        const rect = el.getBoundingClientRect();
        const nx = (event.clientX - rect.left) / rect.width - 0.5;
        const ny = (event.clientY - rect.top) / rect.height - 0.5;
        el.style.transform =
            `perspective(900px) rotateX(${(-ny * 4).toFixed(2)}deg) rotateY(${(nx * 4).toFixed(2)}deg) translateY(-2px)`;
    });

    container.addEventListener("mouseleave", resetLifted);
})();
