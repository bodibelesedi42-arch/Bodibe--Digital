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

// ---------- Multi-step wizard ----------
// Purely presentational: the form is still one single element with the same
// field names it always had, and still submits everything in one request on
// the final step — this just shows one group of questions at a time instead
// of one long scroll, so the backend contract (POST /applications) and the
// Talent-sheet field mapping are completely unaffected.
const careersSteps = Array.from(document.querySelectorAll(".careers-step"));
const progressBar = document.getElementById("careersProgressBar");
const stepLabel = document.getElementById("careersStepLabel");
const backBtn = document.getElementById("careersBack");
const nextBtn = document.getElementById("careersNext");
let currentStep = 0;
let submissionId = crypto.randomUUID();

function renderStep(scroll = true) {
    careersSteps.forEach((step, i) => {
        step.classList.toggle("active", i === currentStep);
    });

    if (progressBar) {
        progressBar.style.width = `${((currentStep + 1) / careersSteps.length) * 100}%`;
    }
    if (stepLabel) {
        const title = careersSteps[currentStep]?.dataset.stepTitle || "";
        stepLabel.textContent = `Step ${currentStep + 1} of ${careersSteps.length} — ${title}`;
    }
    if (backBtn) {
        backBtn.disabled = currentStep === 0;
    }

    const isLastStep = currentStep === careersSteps.length - 1;
    if (nextBtn) nextBtn.style.display = isLastStep ? "none" : "";
    if (submitBtn) submitBtn.style.display = isLastStep ? "" : "none";

    hideError();
    if (scroll) {
        careersForm.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

function currentStepIsValid() {
    const fields = careersSteps[currentStep].querySelectorAll("input, select, textarea");
    for (const field of fields) {
        if (!field.checkValidity()) {
            field.reportValidity();
            return false;
        }
    }
    return true;
}

if (nextBtn) {
    nextBtn.addEventListener("click", () => {
        if (!currentStepIsValid()) return;
        if (currentStep < careersSteps.length - 1) {
            currentStep += 1;
            renderStep();
        }
    });
}

if (backBtn) {
    backBtn.addEventListener("click", () => {
        if (currentStep > 0) {
            currentStep -= 1;
            renderStep();
        }
    });
}

if (careersSteps.length) {
    renderStep(false);
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
            payload.submissionId=submissionId;
            const cv=document.getElementById('applicantCV')?.files[0];
            if(cv){if(cv.size>1048576||!cv.name.toLowerCase().endsWith('.pdf'))throw Error('Choose a PDF CV up to 1 MB.');const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(cv);});payload.cv={name:cv.name,mime:'application/pdf',data};}
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
            showError(err.message || "Unable to submit. Please try again.");
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML;
        }
    });
}

(async function(){const container=document.getElementById('careersVacancies'),choice=document.getElementById('vacancyId');if(!container||!choice)return;try{const r=await fetch(API_BASE_URL+'/careers/vacancies'),data=await r.json();if(!r.ok||!data.success)throw Error();container.replaceChildren();const heading=document.createElement('h2');heading.textContent='Current vacancies';container.appendChild(heading);if(!data.vacancies.length){const p=document.createElement('p');p.textContent='No advertised vacancies right now. You can still send a general application.';container.appendChild(p);}for(const j of data.vacancies){const card=document.createElement('article');card.className='careers-section';for(const [tag,value]of [['h3',j.title],['p',j.department+' · '+j.location+' · '+j.employmentType],['p',j.description],['p','Requirements: '+j.requirements],['p','Closing: '+(j.closingDate||'No fixed date')]]){const el=document.createElement(tag);el.textContent=value;card.appendChild(el);}const b=document.createElement('button');b.type='button';b.className='checkout-submit';b.textContent='Apply for this role';b.addEventListener('click',()=>{choice.value=j.id;currentStep=0;renderStep();});card.appendChild(b);container.appendChild(card);const opt=document.createElement('option');opt.value=j.id;opt.textContent=j.title;choice.appendChild(opt);}}catch(e){container.textContent='Vacancies could not load. General applications remain available below.';}})();
