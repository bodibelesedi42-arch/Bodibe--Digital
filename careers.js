/* ==========================================
   BODIBE DIGITAL
   CAREERS APPLICATION FORM -> BACKEND
========================================== */

const API_BASE_URL = "https://bodibedigital-backend.onrender.com";

const careersForm = document.getElementById("careersForm");
const errorBox = document.getElementById("careersError");
const submitBtn = document.getElementById("careersSubmit");

function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.add("show");
}

function hideError() {
    errorBox.classList.remove("show");
}

if (careersForm) {
    careersForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        hideError();

        if (!careersForm.reportValidity()) {
            return;
        }

        const originalBtnHTML = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = "Submitting...";

        // Field names on every input/select/textarea match the backend's
        // expected keys exactly, so the FormData entries can go straight
        // across without manual field-by-field mapping.
        const payload = Object.fromEntries(new FormData(careersForm).entries());

        try {
            const response = await fetch(`${API_BASE_URL}/applications`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || "Could not submit your application.");
            }

            careersForm.reset();
            careersForm.style.display = "none";

            const thanks = document.createElement("div");
            thanks.className = "careers-section";
            thanks.style.textAlign = "center";
            thanks.innerHTML = `
                <h2><i class="fa-solid fa-circle-check"></i> Application received</h2>
                <p style="color:#94a3b8;">Thanks for applying — we'll be in touch if you're shortlisted.</p>
            `;
            careersForm.parentElement.appendChild(thanks);
        } catch (err) {
            console.error("Application submission error:", err);
            showError("We couldn't submit your application. Please check your connection and try again, or contact us directly on WhatsApp.");
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML;
        }
    });
}
