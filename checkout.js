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

const maintenanceId=params.get('maintenance');
const billing=params.get('billing')||'monthly';
const carePlans={essential:['Essential Care',299],business:['Business Care',599],priority:['Priority Care',999]};
const invalidMaintenance=params.has('maintenance')&&(!Object.hasOwn(carePlans,maintenanceId)||!['monthly','yearly'].includes(billing));
const care=Object.hasOwn(carePlans,maintenanceId)?carePlans[maintenanceId]:null;
const maintenanceAmount=care?(billing==='yearly'?Math.round(care[1]*12*90)/100:care[1]):0;
const plan=maintenanceId&&care?{name:care[0]+' — '+billing,price:'R'+maintenanceAmount.toFixed(2)}:(plans[selectedPlan]||plans.business);

const packageName = document.querySelector("#packageName");
const packagePrice = document.querySelector("#packagePrice");

const selectedPackage = document.querySelector("#selectedPackage");
const selectedPrice = document.querySelector("#selectedPrice");

const formPackageName = document.querySelector("#formPackageName");
const formPackagePrice = document.querySelector("#formPackagePrice");
const submitAmount = document.querySelector("#submitAmount");

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

// Total due on the submit button, e.g. "Continue to Payment \u2014 R1,499.99".
// Same package price shown in the summary above; the backend re-derives this
// amount from its own price table and that is what actually gets charged.
if (submitAmount) {
  submitAmount.textContent = `\u2014 ${plan.price}`;
}

// "R1,499.99" / "1499.99" -> 1499.99. Returns NaN (never 0) for empty input so
// callers can tell "no value" apart from "zero".
function parseAmount(value) {
  const cleaned = String(value == null ? "" : value).replace(/[^\d.]/g, "");
  return cleaned === "" ? NaN : Number(cleaned);
}

/* ==========================================
   CHECKOUT SUBMIT
   1. Fire the enquiry off to Google Sheets (fire-and-forget)
   2. Create a PayFast payment and redirect there
========================================== */

// TODO: change this to your real domain once the backend is deployed
// (e.g. "https://api.bodibedigital.co.za"). Sandbox testing only for now.
const API_BASE_URL = "https://bodibedigital-backend.onrender.com";

// The server supplies the PayFast destination for its configured environment.

const checkoutForm = document.querySelector(".checkout-form");
const submitBtn = document.querySelector(".checkout-submit");

if (checkoutForm && params.has('maintenance')) {
  const note=document.createElement('section');note.className='maintenance-checkout-note';
  if(invalidMaintenance){note.textContent='This maintenance selection is invalid. Please return to pricing and choose a package.';if(submitBtn)submitBtn.disabled=true;}
  else{
  document.querySelector('.checkout-summary h1').textContent='Let’s care for your website.';
  document.querySelector('.checkout-intro').textContent='Tell us about your existing website and the updates you need.';
  document.querySelector('.payment-type').textContent='Automatic '+billing+' billing';
  var inclusions={essential:['Monthly website and form checks','30 minutes of content edits per month','Monthly backup/export where supported'],business:['Fortnightly website and form checks','1 hour of content edits per month','Monthly performance review'],priority:['Weekly website and form checks','2 hours of content edits per month','Priority support queue']};
  document.querySelector('.checkout-features').innerHTML=inclusions[maintenanceId].map(function(text){return '<li><i class="fa-solid fa-check"></i>'+text+'</li>';}).join('');
  document.querySelector('.form-heading span').textContent='WEBSITE MAINTENANCE';
  document.querySelector('.form-heading p').textContent='Confirm your contact details and website care needs.';
  document.querySelector('.checkout-note span').textContent='One existing website. New pages, redesigns, hosting, domains and paid licences are excluded unless separately quoted.';
  ['branding','content'].forEach(function(id){var el=document.getElementById(id);if(el)el.closest('.form-group').hidden=true;});
  var site=document.getElementById('reference_website');if(site){site.required=true;document.querySelector('label[for="reference_website"]').textContent='Your existing website address *';}
  var feature=document.getElementById('features');if(feature)feature.placeholder='For example: contact details, opening hours, photos or text updates.';
  note.innerHTML='<h2>Your website care subscription</h2><p>'+plan.price+' today, then the same amount every '+(billing==='yearly'?'year':'month')+' until cancelled. '+(billing==='yearly'?'Annual billing includes a 10% discount. ':'')+'Contact Bodibe to cancel future renewals.</p><label class="terms"><input id="recurringConsent" type="checkbox" required><span>I agree to automatic '+billing+' payments and the <a href="terms.html#maintenance-billing" target="_blank" rel="noopener">maintenance billing terms</a>. The existing <a href="refund-policy.html" target="_blank" rel="noopener">refund policy</a> applies.</span></label>';
  const goal=document.querySelector('label[for="website_goal"]');if(goal)goal.textContent='Your website address and maintenance needs *';
  const websiteType=document.getElementById('website_type');if(websiteType){websiteType.add(new Option('Maintenance of existing website','Maintenance',true,true));websiteType.closest('.form-group').hidden=true;}
  }
  checkoutForm.insertBefore(note,checkoutForm.firstChild);
}
if (checkoutForm) {
  checkoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if(invalidMaintenance)return;

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
      if(!maintenanceId)await fetch(checkoutForm.action, {
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
          ...(maintenanceId?{maintenancePackage:maintenanceId,billingPeriod:billing,maintenanceNotes:['Website: '+formData.get('reference_website'),'Needs: '+formData.get('website_goal'),'Business: '+formData.get('business_description'),'Updates: '+formData.get('features'),'Notes: '+(message||'')].join('\n'),recurringConsent:document.getElementById('recurringConsent').checked}:{}),
          name: name,
          email: email,
          amount: rawAmount,
          itemName: plan.name,
          itemDescription:
            `${business ? business + " — " : ""}${message || ""}`.slice(0, 255),
          reference: leadRef,
          business: business || "",
          phone: phone || "",
          message: message || "",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Payment could not be created.");
      }

      // The backend is the authority on package prices -- it re-derives the
      // amount from PACKAGE_PRICES and ignores whatever this page sent. Now that
      // the button states a total, don't hand the customer to PayFast for a
      // different amount than they agreed to. Fail-open: this only blocks when
      // both values parse and genuinely differ, so a missing or odd value from
      // the server can never stop a legitimate checkout.
      const shownAmount = parseAmount(plan.price);
      const chargeAmount = parseAmount(result.paymentData && result.paymentData.amount);

      if (
        Number.isFinite(shownAmount) &&
        Number.isFinite(chargeAmount) &&
        Math.abs(shownAmount - chargeAmount) > 0.005
      ) {
        console.error(
          `Checkout halted: page shows ${shownAmount}, server would charge ${chargeAmount}.`,
        );

        alert(
          "This package's price has changed since you opened this page. " +
            "Please refresh so you're charged the amount shown. If this keeps " +
            "happening, contact us and we'll help you directly.",
        );

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHTML;
        }

        return;
      }

      const payfastForm = document.createElement("form");
      payfastForm.method = "POST";
      if(!['https://sandbox.payfast.co.za/eng/process','https://www.payfast.co.za/eng/process'].includes(result.processUrl))throw Error('Payment destination unavailable.');
      payfastForm.action = result.processUrl;

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
