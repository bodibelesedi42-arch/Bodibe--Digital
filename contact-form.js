/* ==========================================
   BODIBE DIGITAL
   CONTACT FORM -> LEADS SHEET
   Sends the homepage enquiry form to the
   backend, which writes it directly into
   the Leads sheet (same connection checkout
   already uses).
========================================== */

const API_BASE_URL = "https://bodibedigital-backend.onrender.com";

const contactForm = document.querySelector(".contact-form");

if (contactForm) {
  const submitBtn = contactForm.querySelector('button[type="submit"]');

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!contactForm.reportValidity()) {
      return;
    }

    const originalBtnHTML = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = "Sending...";
    }

    const formData = new FormData(contactForm);

    // Keep sending to the existing Google Apps Script too — it may still be
    // doing something like email notifications. Fire-and-forget, same as
    // the native form submission this replaces.
    try {
      await fetch(contactForm.action, {
        method: "POST",
        mode: "no-cors",
        body: formData,
      });
    } catch (err) {
      console.warn("Legacy enquiry submission failed:", err);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name") || "",
          email: formData.get("email") || "",
          phone: formData.get("phone") || "",
          projectType: formData.get("project_type") || "",
          message: formData.get("message") || "",
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Could not send your enquiry.");
      }

      contactForm.reset();
      if (submitBtn) {
        submitBtn.innerHTML = "Sent — we'll be in touch";
      }
      setTimeout(() => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHTML;
        }
      }, 4000);
    } catch (err) {
      console.error("Contact form submission error:", err);
      alert("We couldn't send your enquiry. Please check your connection and try again, or contact us directly on WhatsApp.");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
      }
    }
  });
}
