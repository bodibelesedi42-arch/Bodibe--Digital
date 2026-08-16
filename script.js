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
  menuToggle.addEventListener("click", () => {
    navLinks.classList.toggle("active");
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("active");
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
   HERO DYNAMIC HEADING
========================== */

const heroWordSwap = document.getElementById("heroWordSwap");

if (heroWordSwap && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const heroWords = ["brand", "business", "vision", "reputation"];
  let heroWordIndex = 0;

  setInterval(() => {
    heroWordSwap.classList.add("swap-out");

    setTimeout(() => {
      heroWordIndex = (heroWordIndex + 1) % heroWords.length;
      heroWordSwap.textContent = heroWords[heroWordIndex];
      heroWordSwap.classList.remove("swap-out");
    }, 350);
  }, 2800);
}
