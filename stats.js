let filterDraw = "all";

function loadDrawings() {
    const stored = localStorage.getItem("drawings");
    if (!stored) return [];
    return JSON.parse(stored);
}

function getFilteredDrawings(drawings) {
    if (filterDraw === "all") return drawings;
    return drawings.filter(function(d) { return d.draw === filterDraw; });
}

function handleFilterDraw(draw) {
    filterDraw = draw;
    const filterButtons = document.querySelectorAll(".filter-button");
    for (let i = 0; i < filterButtons.length; i++) {
        if (filterButtons[i].getAttribute("data-draw") === draw) {
            filterButtons[i].classList.add("active");
        } else {
            filterButtons[i].classList.remove("active");
        }
    }
    renderStats();
}

function calculateDigitFrequency(drawings) {
    let counts = {};
    for (let d = 0; d <= 9; d++) {
        counts[d] = 0;
    }
    for (let i = 0; i < drawings.length; i++) {
        const number = drawings[i].number;
        for (let j = 0; j < number.length; j++) {
            const digit = parseInt(number[j]);
            counts[digit]++;
        }
    }
    return counts;
}

function calculateStraightFrequency(drawings) {
    let counts = {};
    for (let i = 0; i < drawings.length; i++) {
        const number = drawings[i].number;
        counts[number] = (counts[number] || 0) + 1;
    }
    return counts;
}

function calculateBoxFrequency(drawings) {
    let counts = {};
    for (let i = 0; i < drawings.length; i++) {
        const normalized = drawings[i].number.split("").sort().join("");
        counts[normalized] = (counts[normalized] || 0) + 1;
    }
    return counts;
}

function getHotDigits(digitFrequency, n) {
    const digits = Object.keys(digitFrequency);
    digits.sort(function(a, b) { return digitFrequency[b] - digitFrequency[a]; });
    return digits.slice(0, n).map(Number);
}

function getColdDigits(digitFrequency, n) {
    const digits = Object.keys(digitFrequency);
    digits.sort(function(a, b) { return digitFrequency[a] - digitFrequency[b]; });
    return digits.slice(0, n).map(Number);
}

function sortByFrequency(freqMap) {
    const entries = Object.keys(freqMap).map(function(key) {
        return { number: key, count: freqMap[key] };
    });
    entries.sort(function(a, b) { return b.count - a.count; });
    return entries;
}

function renderStats() {
    const drawings = getFilteredDrawings(loadDrawings());
    const statsEmpty = document.getElementById("stats-empty");
    const digitFrequencySection = document.getElementById("digit-frequency");
    const topStraightSection = document.getElementById("top-straight");
    const topBoxSection = document.getElementById("top-box");

    if (drawings.length === 0) {
        statsEmpty.textContent = "No drawings recorded yet. Add drawings on the Drawings page to see statistics.";
        digitFrequencySection.style.display = "none";
        topStraightSection.style.display = "none";
        topBoxSection.style.display = "none";
        return;
    }

    statsEmpty.textContent = "";
    digitFrequencySection.style.display = "block";
    topStraightSection.style.display = "block";
    topBoxSection.style.display = "block";

    const digitFreq = calculateDigitFrequency(drawings);
    const hot = getHotDigits(digitFreq, 3);
    const cold = getColdDigits(digitFreq, 3);

    const digitGrid = document.getElementById("digit-grid");
    digitGrid.innerHTML = "";
    for (let d = 0; d <= 9; d++) {
        const cell = document.createElement("div");
        cell.className = "digit-cell";
        if (hot.indexOf(d) !== -1) {
            cell.classList.add("digit-hot");
        } else if (cold.indexOf(d) !== -1) {
            cell.classList.add("digit-cold");
        }

        const digitLabel = document.createElement("span");
        digitLabel.className = "digit-label";
        digitLabel.textContent = d;

        const digitCount = document.createElement("span");
        digitCount.className = "digit-count";
        digitCount.textContent = digitFreq[d];

        cell.appendChild(digitLabel);
        cell.appendChild(digitCount);
        digitGrid.appendChild(cell);
    }

    const straightFreq = calculateStraightFrequency(drawings);
    const straightSorted = sortByFrequency(straightFreq).slice(0, 10);
    const straightList = document.getElementById("straight-list");
    straightList.innerHTML = "";
    for (let i = 0; i < straightSorted.length; i++) {
        straightList.appendChild(createFreqItem(straightSorted[i].number, straightSorted[i].count));
    }

    const boxFreq = calculateBoxFrequency(drawings);
    const boxSorted = sortByFrequency(boxFreq).slice(0, 10);
    const boxList = document.getElementById("box-list");
    boxList.innerHTML = "";
    for (let i = 0; i < boxSorted.length; i++) {
        boxList.appendChild(createFreqItem(boxSorted[i].number, boxSorted[i].count));
    }
}

function createFreqItem(number, count) {
    const item = document.createElement("div");
    item.className = "freq-item";

    const numSpan = document.createElement("span");
    numSpan.className = "freq-number";
    numSpan.textContent = number;

    const countSpan = document.createElement("span");
    countSpan.className = "freq-count";
    countSpan.textContent = count + "x";

    item.appendChild(numSpan);
    item.appendChild(countSpan);
    return item;
}

const filterButtons = document.querySelectorAll(".filter-button");
for (let i = 0; i < filterButtons.length; i++) {
    filterButtons[i].addEventListener("click", function() {
        handleFilterDraw(this.getAttribute("data-draw"));
    });
}

renderStats();
