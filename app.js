const $ = (id) => document.getElementById(id);

let confidenceChart = null;
let historyChart = null;
let currentPrediction = null;

const COLORS = {
  red: [0, 2, 4, 6, 8],
  green: [1, 3, 5, 7, 9],
  violet: [0, 5]
};

function getHistory() {
  const raw = $("history")?.value || "";
  return raw.split(/[\s,;|]+/)
    .map(Number)
  .filter(n => Number.isInteger(n) && n >= 0 && n <= 9).slice(-100);
}

function getScores(history) {
  const scores = Array(10).fill(1);

  // Recent frequency analysis
  history.forEach((n, i) => {
    const weight = 1 + (i / Math.max(history.length, 1)) * 2;
    scores[n] += weight;
  });

  // Previous-to-next transition analysis
  if (history.length >= 2) {
    const last = history[history.length - 1];
    let total = 0;

    history.slice(0, -1).forEach((n, i) => {
      if (n === last) {
        scores[history[i + 1]] += 2;
        total++;
      }
    });
  }

  const sum = scores.reduce((a, b) => a + b, 0);
  return scores.map(s => (s / sum) * 100);
}

function getColour(n) {
  if (n === 0 || n === 5) return "Violet";
  return n % 2 === 0 ? "Red" : "Green";
}

function getBigSmall(n) {
  return n >= 5 ? "Big" : "Small";
}

function getNextPeriod() {
  const input = $("last4");
  if (!input) return "----";

  const value = String(input.value).replace(/\D/g, "").slice(-4);
  if (!value) return "----";

  return String((Number(value) + 1) % 10000).padStart(4, "0");
}

function renderChart(probabilities) {
  if (typeof Chart === "undefined") return;

  const canvas = $("confidenceChart");
  if (!canvas) return;

  if (confidenceChart) confidenceChart.destroy();

  confidenceChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
      datasets: [{
        label: "Pattern score (%)",
        data: probabilities,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 30
        }
      }
    }
  });
}

function renderHistory(history) {
  if (typeof Chart === "undefined") return;

  const canvas = $("historyChart");
  if (!canvas) return;

  if (historyChart) historyChart.destroy();

  const recent = history.slice(-100);

  historyChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: recent.map((_, i) => i + 1),
      datasets: [{
        label: "Historical numbers",
        data: recent,
        tension: 0.25
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          min: 0,
          max: 9,
          ticks: { stepSize: 1 }
        }
      }
    }
  });
}

function showDetails(probabilities, history, top) {
  const details = $("details");
  if (!details) return;

  const rows = top.map((n, i) =>
    `<p><b>#${i + 1} Number ${n}</b> — ${probabilities[n].toFixed(1)}% pattern score | ${getBigSmall(n)} | ${getColour(n)}</p>`
  ).join("");

  const big = probabilities.reduce((s, p, n) => s + (n >= 5 ? p : 0), 0);
  const small = 100 - big;

  details.innerHTML = `
    <h3>Top 3 Number Analysis</h3>
    ${rows}
    <hr>
    <p><b>Big:</b> ${big.toFixed(1)}% pattern score</p>
    <p><b>Small:</b> ${small.toFixed(1)}% pattern score</p>
    <p><b>History samples:</b> ${history.length}</p>
    <p><b>Recent numbers:</b> ${history.slice(-10).join(", ") || "No history"}</p>
    <p><small>These are statistical pattern scores, not guaranteed winning probabilities.</small></p>
    <hr>
    <h3>Accuracy Tracker</h3>
    <label>Actual result (0–9): </label>
    <input id="actualResult" type="number" min="0" max="9" inputmode="numeric">
    <button id="saveActual">Save Result</button>
    <p id="accuracyStatus">Enter the actual result after the round.</p>
    <p id="accuracyStats"></p>
  `;

  $("saveActual")?.addEventListener("click", saveActualResult);
  updateAccuracy();
}

function getRecords() {
  try {
    return JSON.parse(localStorage.getItem("jalwaRecords") || "[]");
  } catch {
    return [];
  }
}

function saveActualResult() {
  const field = $("actualResult");
  const actual = Number(field?.value);

  if (!field || field.value === "" || !Number.isInteger(actual) || actual < 0 || actual > 9) {
    alert("Please enter a number from 0 to 9.");
    return;
  }

  if (!currentPrediction) {
    alert("Make a prediction first.");
    return;
  }

  const records = getRecords();
  records.push({
    predicted: currentPrediction.top[0],
    top3: currentPrediction.top,
    actual
  });

  try {
    localStorage.setItem("jalwaRecords", JSON.stringify(records.slice(-200)));
    $("accuracyStatus").textContent = "Actual result saved.";
    updateAccuracy();
  } catch {
    $("accuracyStatus").textContent = "Browser storage unavailable.";
  }
}

function updateAccuracy() {
  const records = getRecords();
  const stats = $("accuracyStats");
  if (!stats) return;

  if (!records.length) {
    stats.textContent = "No saved results yet.";
    return;
  }

  const top1 = records.filter(r => r.predicted === r.actual).length;
  const top3 = records.filter(r => r.top3.includes(r.actual)).length;

  stats.textContent =
    `Rounds: ${records.length} | Top 1 hits: ${top1} (${(top1 / records.length * 100).toFixed(1)}%) | Top 3 hits: ${top3} (${(top3 / records.length * 100).toFixed(1)}%)`;
}

function predict() {
  const history = getHistory();

  if (history.length < 5) {
    alert("Please enter at least 5 historical results (0–9).");
    return;
  }

  const probabilities = getScores(history);
  const top = probabilities
    .map((score, number) => ({ number, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.number);

  const best = top[0];

  currentPrediction = { top };

  if ($("nextPeriod")) $("nextPeriod").textContent = getNextPeriod();
  if ($("predNum")) $("predNum").textContent = best;
  if ($("predBigSmall")) $("predBigSmall").textContent = getBigSmall(best);
  if ($("predColour")) $("predColour").textContent = getColour(best);
  if ($("status")) $("status").textContent = "Pattern analysis complete";
  if ($("result")) $("result").classList.remove("hidden");
  
  renderChart(probabilities);
  renderHistory(history);
  showDetails(probabilities, history, top);
}

$("go")?.addEventListener("click", predict);

if ($("loader")) $("loader").style.display = "none";
