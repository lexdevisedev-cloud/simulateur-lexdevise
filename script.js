const REFERENCE_MONTH = "2025-07";

const form = document.getElementById("simulator-form");
const emptyState = document.getElementById("emptyState");
const resultState = document.getElementById("resultState");
const errorBox = document.getElementById("errorBox");

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);
}

function getMonthRange(startMonth, count) {
  const result = [];
  const [y, m] = startMonth.split("-").map(Number);
  const date = new Date(y, m - 1, 1);

  for (let i = 0; i < count; i += 1) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    result.push(`${year}-${month}`);
    date.setMonth(date.getMonth() + 1);
  }

  return result;
}

function minMonth(a, b) {
  return a <= b ? a : b;
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function roundToNiceNumber(value) {
  if (value < 10000) return Math.round(value / 500) * 500;
  if (value < 100000) return Math.round(value / 1000) * 1000;
  return Math.round(value / 5000) * 5000;
}

function computeSimulation(startDate, loanAmountEur, durationYears) {
  if (!window.EUR_CHF_RATES) {
    throw new Error("Le fichier rates.js n'est pas chargé.");
  }

  if (!window.EUR_CHF_RATES[startDate]) {
    throw new Error("Aucun taux EUR/CHF n'est disponible pour cette date de début.");
  }

  const totalMonths = Math.round(durationYears * 12);
  if (totalMonths <= 0) {
    throw new Error("La durée du crédit doit être supérieure à 0.");
  }

  const startRate = Number(window.EUR_CHF_RATES[startDate]);
  const loanAmountChf = loanAmountEur * startRate;
  const monthlyPrincipalChf = loanAmountChf / totalMonths;

  const scheduleMonths = getMonthRange(startDate, totalMonths);
  const contractualEndMonth = scheduleMonths[scheduleMonths.length - 1];
  const finalMonth = minMonth(contractualEndMonth, REFERENCE_MONTH);

  const monthsToCompare = scheduleMonths.filter((month) => month <= finalMonth);

  if (monthsToCompare.length === 0) {
    throw new Error("Aucune période n'est calculable.");
  }

  let prejudiceMensualites = 0;

  for (const month of monthsToCompare) {
    const currentRate = Number(window.EUR_CHF_RATES[month]);

    if (!currentRate) {
      throw new Error(`Le taux EUR/CHF du mois ${month} est introuvable.`);
    }

    const monthlyAtStartRateEur = monthlyPrincipalChf / startRate;
    const monthlyAtCurrentRateEur = monthlyPrincipalChf / currentRate;
    const monthlyPrejudice = monthlyAtCurrentRateEur - monthlyAtStartRateEur;

    prejudiceMensualites += monthlyPrejudice;
  }

  const monthsPaid = monthsToCompare.length;
  const remainingMonths = Math.max(totalMonths - monthsPaid, 0);
  const crdChf = monthlyPrincipalChf * remainingMonths;

  const finalRate = Number(window.EUR_CHF_RATES[finalMonth]);
  const crdEurAtFinalRate = crdChf / finalRate;
  const crdEurAtStartRate = crdChf / startRate;

  const crdPrejudice = crdEurAtFinalRate - crdEurAtStartRate;
  const prejudiceGlobal = prejudiceMensualites + Math.max(0, crdPrejudice);

  return { prejudiceGlobal };
}

async function sendLeadEmail(payload) {
  const response = await fetch("/api/send-estimation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Impossible d'envoyer les informations.");
  }

  return data;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();

  const fullName = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const startDate = document.getElementById("startDate").value;
  const loanAmount = Number(document.getElementById("loanAmount").value);
  const duration = Number(document.getElementById("loanDuration").value);

  if (!fullName || !email || !phone || !startDate || !loanAmount || !duration) {
    showError("Merci de renseigner toutes les informations demandées.");
    return;
  }

  try {
    const result = computeSimulation(startDate, loanAmount, duration);

    const base = Math.max(0, result.prejudiceGlobal);
    const minValue = roundToNiceNumber(base * 0.8);
    const maxValue = roundToNiceNumber(base * 1.1);
    const rangeText = `${formatCurrency(minValue)} à ${formatCurrency(maxValue)}`;

    emptyState.classList.add("hidden");
    resultState.classList.remove("hidden");
    document.getElementById("prejudiceRange").textContent = rangeText;

    await sendLeadEmail({
      fullName,
      email,
      phone,
      startDate,
      loanAmount,
      duration,
      estimationRange: rangeText
    });
  } catch (error) {
    showError(error.message);
  }
});