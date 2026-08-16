const params = new URLSearchParams(window.location.search);

const selectedPlan = params.get("plan");

const plans = {
  starter: {
    name: "Starter Website",
    price: "R1,499.99",
  },

  business: {
    name: "Business Website",
    price: "R3,499.99",
  },

  premium: {
    name: "Premium Website",
    price: "R6,999.99",
  },
};

const plan = plans[selectedPlan] || plans.business;

const packageName = document.querySelector("#packageName");
const packagePrice = document.querySelector("#packagePrice");

const selectedPackage = document.querySelector("#selectedPackage");
const selectedPrice = document.querySelector("#selectedPrice");

const formPackageName = document.querySelector("#formPackageName");
const formPackagePrice = document.querySelector("#formPackagePrice");

if (packageName) {
  packageName.textContent = plan.name;
}

if (packagePrice) {
  const priceWithoutSymbol = plan.price.replace("R", "");
  const parts = priceWithoutSymbol.split(".");
  packagePrice.innerHTML = `${parts[0]}<small>.${parts[1]}</small>`;
}

if (selectedPackage) {
  selectedPackage.value = plan.name;
}

if (selectedPrice) {
  selectedPrice.value = plan.price;
}

if (formPackageName) {
  formPackageName.textContent = plan.name;
}

if (formPackagePrice) {
  formPackagePrice.textContent = plan.price;
}

/* ==========================================
   CHECKOUT SUBMIT
   1. Fire the enquiry off to Google Sheets (fire-and-forget)
   2. Create a PayFast payment and redirect there
========================================== */

// TODO: change this to your real domain once the backend is deployed
// (e.g. "https://api.bodibedigital.co.za"). Sandbox testing only for now.
const API_BASE_URL = "https://bodibedigital-backend.onrender.com";

// TODO: switch to "https://www.payfast.co.za/eng/process" once you have
// live PayFast credentials and PAYFAST_MODE=live in the backend .env
const PAYFAST_PROCESS_URL = "https://sandbox.payfast.co.za/eng/process";

const checkoutForm = document.querySelector(".checkout-form");
const submitBtn = document.querySelector(".checkout-submit");

if (checkoutForm) {
  checkoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!checkoutForm.reportValidity()) {
      return;
    }

    const originalBtnHTML = submitBtn ? submitBtn.innerHTML : "";

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = "Processing...";
    }

    // One shared reference ID for this whole checkout — sent to both Google Sheets
    // (as the Reference ID column) and to PayFast (as m_payment_id), so a payment
    // notification can be matched back to the right Leads row later. This is
    // separate from Lead ID, which Apps Script generates on its own.
    const leadRef =
      "BD-" +
      Date.now() +
      "-" +
      Math.random().toString(36).substring(2, 7).toUpperCase();

    const formData = new FormData(checkoutForm);
    formData.append("reference", leadRef);
    const name = formData.get("name");
    const business = formData.get("business");
    const email = formData.get("email");
    const phone = formData.get("phone");
    const message = formData.get("message");

    try {
      await fetch(checkoutForm.action, {
        method: "POST",
        mode: "no-cors",
        body: formData,
      });
    } catch (err) {
      console.warn("Enquiry submission failed:", err);
    }

    const rawAmount = plan.price.replace(/[R,]/g, "");

    try {
      const response = await fetch(`${API_BASE_URL}/create-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          email: email,
          amount: rawAmount,
          itemName: plan.name,
          itemDescription:
            `${business ? business + " — " : ""}${message || ""}`.slice(0, 255),
          reference: leadRef,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Payment could not be created.");
      }

      const payfastForm = document.createElement("form");
      payfastForm.method = "POST";
      payfastForm.action = PAYFAST_PROCESS_URL;

      Object.entries(result.paymentData).forEach(([key, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        payfastForm.appendChild(input);
      });

      document.body.appendChild(payfastForm);
      payfastForm.submit();
    } catch (err) {
      console.error("Payment creation error:", err);
      alert(
        "We couldn't start the payment. Please check your connection and try again, or contact us directly.",
      );

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
      }
    }
  });
}
