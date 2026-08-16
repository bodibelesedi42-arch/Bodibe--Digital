# Bodibe Digital — Website

The public marketing site for Bodibe Digital, plus an internal staff/business portal. Static HTML/CSS/JS, no build step. Pushed to [github.com/bodibelesedi42-arch/Bodibe--Digital](https://github.com/bodibelesedi42-arch/Bodibe--Digital).

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Home — hero, services, portfolio, about, contact form |
| `pricing.html` | Package pricing (Starter / Business / Premium) |
| `checkout.html` + `checkout.js` | Package checkout — reads `?plan=starter\|business\|premium`, submits to the backend's `/create-payment` |
| `kanyo-project.html` | Portfolio case study: Kanyo 24hrs Response |
| `818-project.html` | Portfolio case study: 818 Khangeziwe Services |
| `staff-login.html` + `staff-login.js` | Staff/business portal sign-in — posts to the backend's `/auth/login` |
| `staff-dashboard.html` + `staff-dashboard.js` | Post-login landing page — shows "My Work" (active projects, open tasks) via `/staff/my-work` |
| `portal-effects.js` | Shared 3D tilt/depth presentation layer for the staff portal (login card tilt, dashboard card hover-lift). Purely visual — no auth or data logic lives here |

`style.css` is the shared site stylesheet (also defines the `.portal-chip` badge shared by the two staff pages). `checkout.css`, `pricing.css`, `staff-login.css`, `staff-dashboard.css` layer on page-specific styles. `script.js` powers the shared header/scroll/menu behaviour on the public pages.

## Structure

```
index.html, pricing.html, checkout.html, kanyo-project.html, 818-project.html
staff-login.html, staff-dashboard.html
style.css, pricing.css, checkout.css, staff-login.css, staff-dashboard.css
script.js, checkout.js, staff-login.js, staff-dashboard.js, portal-effects.js
assets/images/          Images actually shipped with the site
dev/reference-screenshots/   Design reference screenshots — not linked from any page, not deployed
```

## Staff portal

The staff/business side (`staff-login.html` → `staff-dashboard.html`) authenticates against the backend's JWT-based `/auth/*` API and stores the token in `sessionStorage` (cleared when the tab closes). There's no separate frontend build — it's the same static site, just two more pages, guarded client-side by checking for a token before rendering dashboard data.

## Package prices

The three package prices (Starter R1,499.99 / Business R3,499.99 / Premium R6,999.99) are duplicated in `checkout.js` and `pricing.html`, and enforced server-side in the backend's `src/services/payfast.js` (`PACKAGE_PRICES`) — the server never trusts a price sent from the browser. If a price ever changes, update it in all three places.

## Deployment

Static site — deploy as-is (e.g. GitHub Pages, Netlify, or any static host). No build step, no dependencies.

The contact and checkout forms post to a Google Apps Script Web App endpoint (see the `action` attribute on each `<form>`); checkout and the staff portal both call the backend at `https://bodibedigital-backend.onrender.com`.
