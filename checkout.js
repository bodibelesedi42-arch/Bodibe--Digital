const params = new URLSearchParams(window.location.search);

const selectedPlan = params.get("plan");

const plans = {
    starter: {
        name: "Starter Website",
        price: "R1,499.99"
    },

    business: {
        name: "Business Website",
        price: "R3,499.99"
    },

    premium: {
        name: "Premium Website",
        price: "R6,999.99"
    }
};


const plan = plans[selectedPlan] || plans.business;


const packageName = document.querySelector("#packageName");
const packagePrice = document.querySelector("#packagePrice");

const selectedPackage =
    document.querySelector("#selectedPackage");

const selectedPrice =
    document.querySelector("#selectedPrice");


if (packageName) {
    packageName.textContent = plan.name;
}


if (packagePrice) {

    const priceWithoutSymbol =
        plan.price.replace("R", "");

    const parts =
        priceWithoutSymbol.split(".");

    packagePrice.innerHTML =
        `${parts[0]}<small>.${parts[1]}</small>`;
}


if (selectedPackage) {
    selectedPackage.value = plan.name;
}


if (selectedPrice) {
    selectedPrice.value = plan.price;
}