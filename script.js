const progressBar = document.querySelector(".progress-bar");

if (progressBar) {
  window.addEventListener("scroll", () => {
    const scrollTop = window.scrollY;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const percentage = (scrollTop / height) * 100;

    progressBar.style.width = percentage + "%";
  });
}
const elements = document.querySelectorAll(
  ".services,.portfolio,.about,.contact",
);

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("show");
    }
  });
});

elements.forEach((el) => {
  el.classList.add("fade-up");

  observer.observe(el);
});
const header = document.querySelector("header");

window.addEventListener("scroll", () => {
  if (window.scrollY > 50) {
    header.classList.add("scrolled");
  } else {
    header.classList.remove("scrolled");
  }
});
const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");

if (menuToggle && navLinks) {
  const toggleMenu = () => {
    const isOpen = navLinks.classList.toggle("active");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  };

  // menuToggle is now a native <button>, so Enter/Space activation and
  // focusability come from the browser for free — no manual keydown shim
  // needed (and adding one back would double-fire the toggle).
  menuToggle.addEventListener("click", toggleMenu);

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("active");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}

const loader = document.querySelector(".loader");

if (loader) {
  window.addEventListener("load", () => {
    setTimeout(() => {
      loader.classList.add("hide");
    }, 1800);
  });
}

const backgroundLayer = document.querySelector(".background-animation");

if (backgroundLayer) {
  let frameId;

  const updateBackgroundMotion = (event) => {
    if (frameId) cancelAnimationFrame(frameId);

    frameId = requestAnimationFrame(() => {
      const x = (event.clientX / window.innerWidth - 0.5) * 18;
      const y = (event.clientY / window.innerHeight - 0.5) * 18;

      backgroundLayer.style.setProperty("--bg-x", `${x}px`);
      backgroundLayer.style.setProperty("--bg-y", `${y}px`);
    });
  };

  window.addEventListener("mousemove", updateBackgroundMotion);
  window.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches[0]) {
        updateBackgroundMotion(event.touches[0]);
      }
    },
    { passive: true },
  );
  window.addEventListener("mouseleave", () => {
    backgroundLayer.style.setProperty("--bg-x", "0px");
    backgroundLayer.style.setProperty("--bg-y", "0px");
  });
}
/* ==========================
   LIVE BACKGROUND MOUSE LIGHT
========================== */

const liveBackground = document.querySelector(".background-animation");

if (liveBackground) {

    window.addEventListener("mousemove", (event) => {

        const x = (event.clientX / window.innerWidth) * 100;
        const y = (event.clientY / window.innerHeight) * 100;

        liveBackground.style.setProperty(
            "--mouse-x",
            `${x}%`
        );

        liveBackground.style.setProperty(
            "--mouse-y",
            `${y}%`
        );

    });

}

/* ==========================
   PORTFOLIO CARD 3D TILT
   Layers a cursor-tracked perspective tilt on top of
   the existing lift/scale hover — restrained (max 6deg),
   resets to the plain CSS hover state on mouseleave.
========================== */

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.querySelectorAll(".portfolio-card").forEach((card) => {
    card.addEventListener("mousemove", (event) => {
      const rect = card.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;

      card.style.transform =
        `perspective(1000px) rotateX(${(-ny * 6).toFixed(2)}deg) rotateY(${(nx * 6).toFixed(2)}deg) translateY(-10px) scale(1.02)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}

/* ==========================================================
   HOMEPAGE FEATURED WORK -- one-project-at-a-time showcase
   Homepage-only (guarded by the [data-work-showcase] lookup
   below, so this is a no-op on every other page, including
   our-work.html which keeps the original grid). Vanilla JS,
   no carousel library -- see 02_WEBSITE_ENGINEERING.md.
   ========================================================== */

(function () {
  "use strict";

  var root = document.querySelector("[data-work-showcase]");
  if (!root) return;

  var slides = Array.prototype.slice.call(root.querySelectorAll(".work-slide"));
  var indicators = Array.prototype.slice.call(root.querySelectorAll("[data-work-index]"));
  var progressFill = root.querySelector("[data-work-progress]");
  var counterCurrentEls = Array.prototype.slice.call(root.querySelectorAll(".work-counter-current"));
  var total = slides.length;
  if (total < 2) return;

  var AUTOPLAY_MS = 7000;
  var TICK_MS = 100;
  var TRANSITION_MS = 650;
  var SWIPE_THRESHOLD = 40;

  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var current = 0;
  slides.forEach(function (slide, i) {
    if (slide.classList.contains("is-active")) current = i;
  });

  var isAnimating = false;
  var elapsed = 0;
  var pausedByHover = false;
  var pausedByFocus = false;
  var pausedByVisibility = document.hidden === true;
  var tickTimer = null;

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function isPaused() {
    return pausedByHover || pausedByFocus || pausedByVisibility;
  }

  function updateIndicators() {
    indicators.forEach(function (btn, i) {
      var active = i === current;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function updateCounter() {
    counterCurrentEls.forEach(function (el, i) {
      if (i === current) el.textContent = pad2(current + 1);
    });
    // Only the active slide's counter is visible (others are behind
    // pointer-events:none / opacity:0), but keep every copy correct
    // in case a screen reader walks the DOM directly.
    slides.forEach(function (slide, i) {
      var el = slide.querySelector(".work-counter-current");
      if (el) el.textContent = pad2(i + 1);
    });
  }

  function resetProgress() {
    elapsed = 0;
    if (progressFill) progressFill.style.width = "0%";
  }

  function goTo(newIndex, direction) {
    if (isAnimating || newIndex === current) return;

    var prevSlide = slides[current];
    var nextSlide = slides[newIndex];
    isAnimating = true;

    prevSlide.classList.remove("is-active");
    prevSlide.classList.add(direction === "next" ? "is-exit-left" : "is-exit-right");
    prevSlide.setAttribute("aria-hidden", "true");

    nextSlide.style.setProperty("--work-enter-x", direction === "next" ? "40px" : "-40px");
    nextSlide.classList.add("is-prep");
    // Force a reflow so the browser registers the off-screen starting
    // position before the transition-enabling class is added below.
    void nextSlide.offsetWidth;

    var finish = function () {
      nextSlide.classList.remove("is-prep");
      nextSlide.classList.add("is-active");
      nextSlide.setAttribute("aria-hidden", "false");
    };

    if (reduceMotion) {
      finish();
    } else {
      window.requestAnimationFrame(finish);
    }

    current = newIndex;
    updateIndicators();
    updateCounter();

    var cleanupDelay = reduceMotion ? 0 : TRANSITION_MS;
    window.setTimeout(function () {
      prevSlide.classList.remove("is-exit-left", "is-exit-right");
      nextSlide.style.removeProperty("--work-enter-x");
      isAnimating = false;
    }, cleanupDelay);
  }

  function goNext(manual) {
    goTo((current + 1) % total, "next");
    if (manual) resetProgress();
  }

  function goPrev(manual) {
    goTo((current - 1 + total) % total, "prev");
    if (manual) resetProgress();
  }

  root.addEventListener("click", function (e) {
    var target = e.target;
    if (!target || !target.closest) return;

    if (target.closest("[data-work-next]")) {
      goNext(true);
      return;
    }
    if (target.closest("[data-work-prev]")) {
      goPrev(true);
      return;
    }
    var indicatorBtn = target.closest("[data-work-index]");
    if (indicatorBtn) {
      var index = parseInt(indicatorBtn.getAttribute("data-work-index"), 10);
      if (!isNaN(index) && index !== current) {
        goTo(index, index > current ? "next" : "prev");
        resetProgress();
      }
    }
  });

  /* ---- Autoplay: pause on hover, keyboard focus, or a hidden tab ---- */
  if (!reduceMotion) {
    root.addEventListener("mouseenter", function () {
      pausedByHover = true;
    });
    root.addEventListener("mouseleave", function () {
      pausedByHover = false;
    });
    root.addEventListener("focusin", function () {
      pausedByFocus = true;
    });
    root.addEventListener("focusout", function () {
      // Only resume once focus has actually left the showcase.
      window.setTimeout(function () {
        pausedByFocus = root.contains(document.activeElement);
      }, 0);
    });
    document.addEventListener("visibilitychange", function () {
      pausedByVisibility = document.hidden;
    });

    tickTimer = window.setInterval(function () {
      if (isPaused() || isAnimating) return;
      elapsed += TICK_MS;
      if (progressFill) {
        progressFill.style.width = Math.min(100, (elapsed / AUTOPLAY_MS) * 100) + "%";
      }
      if (elapsed >= AUTOPLAY_MS) {
        goNext(false);
        elapsed = 0;
      }
    }, TICK_MS);
  }

  /* ---- Swipe on mobile: horizontal only, never blocks vertical scroll ---- */
  var touchStartX = 0;
  var touchStartY = 0;
  var slidesEl = root.querySelector(".work-slides");

  if (slidesEl) {
    slidesEl.addEventListener(
      "touchstart",
      function (e) {
        if (!e.touches || !e.touches[0]) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      },
      { passive: true },
    );

    slidesEl.addEventListener(
      "touchend",
      function (e) {
        if (!e.changedTouches || !e.changedTouches[0]) return;
        var dx = e.changedTouches[0].clientX - touchStartX;
        var dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        if (dx < 0) {
          goNext(true);
        } else {
          goPrev(true);
        }
      },
      { passive: true },
    );
  }

  updateIndicators();
  updateCounter();
})();
