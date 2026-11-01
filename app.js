
const $ = id => document.getElementById(id);

let confidenceChart = null;
let historyChart = null;

const colours = {
  0: "Red + Violet",
  1: "Green",
  2: "Red",
  3: "Green",
  4: "Red",
  5: "Green + Violet",
  6: "Red",
  7: "Green",
  8: "Red",
  9: "Green"
};

function getProbabilities(history) {
  const frequency = Array(10).fill(1);
  const transitions = Array(10).fill(1);

  history.forEach((n, i) => {
    const weight = 0.5 + i / Math.max(1, history.length - 1);
    frequency[n] += weight;
  });

  const last = history[history.length - 1];
  let transitionCount = 0;

  for (let i = 0; i < history.length - 1; i++) {
    if (history[i] === last) {
      transitions[history[i + 1]]++;
      transitionCount++;
    }
  }

  const totalF = frequency.reduce((a,b) => a+b, 0);
  const totalT = transitions.reduce((a,b) => a+b, 0);

  return frequency.map((v,i) => {
    const base = v / totalF;
    const trans = transitions[i] / totalT;
    const w = transitionCount >= 3 ? 0.55 : 0.15;
    return (base * (1-w) + trans*w) * 100;
  });
}

function getBigSmall(p) {
  const big = p.slice(5).reduce((a,b) => a+b, 0);
  const small = p.slice(0,5).reduce((a,b) => a+b, 0);

  return {
    result: big >= small ? "BIG" : "SMALL",
    big,
    small
  };
}

function getColours(p) {
  let red = 0, green = 0, violet = 0;

  p.forEach((v,n) => {
    if ([0,2,4,6,8].includes(n)) red += v;
    if ([1,3,5,7,9].includes(n)) green += v;
    if ([0,5].includes(n)) violet += v;
  });

  return {red,green,violet};
}

function updateCharts(history,p) {
  if (confidenceChart) confidenceChart.destroy();
  if (historyChart) historyChart.destroy();

  confidenceChart = new Chart($("confidenceChart"), {
    type: "bar",
    data: {
      labels: ["0","1","2","3","4","5","6","7","8","9"],
      datasets: [{
        label: "Estimated probability %",
        data: p,
        backgroundColor: "#9d65ff"
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {beginAtZero:true, max:100}
      }
    }
  });

  historyChart = new Chart($("historyChart"), {
    type: "line",
    data: {
      labels: history.map((_,i) => i+1),
      datasets: [{
        label: "Historical results",
        data: history,
        borderColor: "#35d6ff",
        tension: 0.25
      }]
    },
    options: {
      responsive:true,
      scales: {
        y: {min:0,max:9,ticks:{stepSize:1}}
      }
    }
  });
}

function predict() {
  const period = $("last4").value.trim();
  const raw = $("history").value.trim();

  if (!/^\d{4}$/.test(period)) {
    alert("Enter valid 4 digit period");
    return;
  }

  const history = raw.split(/[\s,]+/).filter(Boolean).map(Number);

  if (history.length < 5 ||
      history.some(n => !Number.isInteger(n) || n < 0 || n > 9)) {
    alert("Enter at least 5 valid results from 0 to 9");
    return;
  }

  $("go").disabled = true;
  $("loader").classList.remove("hidden");
  $("result").classList.add("hidden");

  setTimeout(() => {
    try {
      const p = getProbabilities(history);
      const best = p.indexOf(Math.max(...p));
      const bs = getBigSmall(p);
      const cp = getColours(p);

      const next = String((Number(period)+1)%10000).padStart(4,"0");

      $("nextPeriod").textContent = next;
      $("predNum").textContent = best;

      $("predBigSmall").textContent =
        bs.result + " (" + Math.max(bs.big,bs.small).toFixed(1) + "% estimated)";

      $("predColour").textContent =
        "Most likely colour: " +
        Object.entries(cp).sort((a,b) => b[1]-a[1])[0][0].toUpperCase();

      $("details").textContent =
        "Number probability: " + p[best].toFixed(2) +
        "% | Red: " + cp.red.toFixed(2) +
        "% | Green: " + cp.green.toFixed(2) +
        "% | Violet occurrence: " + cp.violet.toFixed(2) +
        "% | Samples: " + history.length;

      updateCharts(history,p);

      $("result").classList.remove("hidden");
      $("status").textContent = "Analysis completed.";
    } catch(e) {
      $("status").textContent = "Error: " + e.message;
    } finally {
      $("loader").classList.add("hidden");
      $("go").disabled = false;
    }
  },300);
}

$("go").addEventListener("click",predict);
