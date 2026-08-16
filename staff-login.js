// TODO: update this if your backend URL changes (same value used in checkout.js)
const API_BASE_URL = "https://bodibedigital-backend.onrender.com";

// sessionStorage rather than localStorage: the token disappears when the tab closes,
// which limits how long a stolen/leftover token stays usable on a shared computer.
const TOKEN_KEY = "bd_staff_token";

// If already logged in with a valid session, skip straight to the dashboard.
(async function checkExistingSession() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
            window.location.href = "staff-dashboard.html";
        } else {
            sessionStorage.removeItem(TOKEN_KEY);
        }
    } catch (err) {
        // Network error — let them try logging in manually rather than silently failing.
    }
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
    hideError();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in...";

    try {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const result = await res.json();

        if (!result.success) {
            showError(result.message || "Incorrect email or password.");
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Sign In <i class="fa-solid fa-arrow-right"></i>';
            return;
        }

        sessionStorage.setItem(TOKEN_KEY, result.token);
        window.location.href = "staff-dashboard.html";
    } catch (err) {
        console.error("Login request failed:", err);
        showError("Couldn't reach the server. Check your connection and try again.");
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Sign In <i class="fa-solid fa-arrow-right"></i>';
    }
});