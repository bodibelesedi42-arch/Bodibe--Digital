const params = new URLSearchParams(window.location.search);
const selectedTier = params.get("tier");

const tiers = {
    starter: {
        name: "Ops Platform — Starter",
        price: "249.00",
        features: [
            "Lead capture & CRM",
            "Status pipeline tracking",
            "Follow-up reminders",
        ],
    },
    growth: {
        name: "Ops Platform — Growth",
        price: "499.00",
        features: [
            "Everything in Starter",
            "Quote generation",
            "Invoicing & payment tracking",
        ],
    },
    pro: {
        name: "Ops Platform — Pro",
        price: "899.00",
        features: [
            "Everything in Growth",
            "Staff accounts & permissions",
            "Projects & task tracking",
            "Multi-user dashboard",
        ],
    },
};

const tier = tiers[selectedTier] || tiers.growth;

const tierNameEl = document.querySelector("#tierName");
const tierPriceEl = document.querySelector("#tierPrice");
const tierFeaturesEl = document.querySelector("#tierFeatures");

if (tierNameEl) tierNameEl.textContent = tier.name;

if (tierPriceEl) {
    const [whole, cents] = tier.price.split(".");
    tierPriceEl.innerHTML = `${whole}<small>.${cents}</small>`;
}

if (tierFeaturesEl) {
    tierFeaturesEl.innerHTML = tier.features
        .map((f) => `<li><i class="fa-solid fa-check"></i>${f}</li>`)
        .join("");
}

// TODO: update this if your backend URL changes (same value used in checkout.js)
const API_BASE_URL = "https://bodibedigital-backend.onrender.com";

const PAYFAST_PROCESS_URL = "https://sandbox.payfast.co.za/eng/process";

const subscribeForm = document.querySelector("#subscribeForm");
const submitBtn = document.querySelector(".checkout-submit");

if (subscribeForm) {
    subscribeForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!subscribeForm.reportValidity()) {
            return;
        }

        const originalBtnHTML = submitBtn ? submitBtn.innerHTML : "";
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = "Processing...";
        }

        const formData = new FormData(subscribeForm);
        const name = formData.get("name");
        const email = formData.get("email");

        const reference =
            "BD-SUB-" +
            Date.now() +
            "-" +
            Math.random().toString(36).substring(2, 7).toUpperCase();

        try {
            const response = await fetch(`${API_BASE_URL}/create-subscription`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    email,
                    tierName: tier.name,
                    reference,
                }),
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || "Subscription could not be created.");
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
            console.error("Subscription creation error:", err);
            alert(
                "We couldn't start your subscription. Please check your connection and try again, or contact us directly."
            );
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHTML;
            }
        }
    });
}
