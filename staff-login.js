// TODO: update this if your backend URL changes (same value used in checkout.js)
const API_BASE_URL = "https://bodibedigital-backend.onrender.com";

// sessionStorage rather than localStorage: the token disappears when the tab closes,
// which limits how long a stolen/leftover token stays usable on a shared computer.
const TOKEN_KEY = "bd_staff_token";
let signingIn = false;
async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
        const response = await fetch(API_BASE_URL + path, { ...options, signal: controller.signal });
        const result = await response.json();
        return { response, result };
    } finally { clearTimeout(timeout); }
}

// If already logged in with a valid session, skip straight to the dashboard.
(async function checkExistingSession() {
    try {
        const token = sessionStorage.getItem(TOKEN_KEY);
        if (!token) return;
        const { response, result } = await request('/auth/me', { headers: { Authorization: 'Bearer ' + token } });
        if (signingIn || sessionStorage.getItem(TOKEN_KEY) !== token) return;
        if (response.ok && result.success && result.staff) window.location.href = 'staff-dashboard.html';
        else if (response.status === 401) sessionStorage.removeItem(TOKEN_KEY);
    } catch (err) { /* Keep the form available when the session check fails. */ }

})();

const loginForm = document.getElementById("loginForm");
const errorBox = document.getElementById("loginError");
const submitBtn = document.getElementById("submitBtn");

function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.add("show");
}

function hideError() {
    errorBox.classList.remove("show");
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (signingIn) return;
    signingIn = true;
    hideError();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in...";

    try {
        const { response: res, result } = await request("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });


        if (!res.ok || !result.success || !result.token) {
            signingIn = false;
            showError(result.message || "Incorrect email or password.");
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Sign In <i class="fa-solid fa-arrow-right"></i>';
            return;
        }

        sessionStorage.setItem(TOKEN_KEY, result.token);
        const me = await request('/auth/me', { headers: { Authorization: 'Bearer ' + result.token } });
        if (!me.response.ok || !me.result.success || !me.result.staff) {
            if (me.response.status === 401) sessionStorage.removeItem(TOKEN_KEY);
            throw new Error('Session verification failed');
        }
        window.location.href = "staff-dashboard.html";
    } catch (err) {
        signingIn = false;
        console.error("Login request failed:", err);
        showError("Couldn't reach the server. Check your connection and try again.");
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Sign In <i class="fa-solid fa-arrow-right"></i>';
    }
});