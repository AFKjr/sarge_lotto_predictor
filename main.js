const calculateButton = document.getElementById("calculate-button");

calculateButton.addEventListener("click", handleCalculation);

function handleCalculation() {
    const betTypeSelect = document.getElementById("bet-type");
    const numberOfPlaysInput = document.getElementById("number-of-plays");
    const ticketCostInput = document.getElementById("ticket-cost");
    const singleDrawOddsDisplay = document.getElementById("single-draw-odds");
    const cumulativeProbabilityDisplay = document.getElementById("cumulative-probability");
    const playsToFiftyDisplay = document.getElementById("plays-to-fifty");
    const expectedLossDisplay = document.getElementById("expected-loss");

    const betType = betTypeSelect.value;
    const numberOfPlays = parseInt(numberOfPlaysInput.value);
    const ticketCost = parseFloat(ticketCostInput.value);
    const pickedNumber = document.getElementById("picked-number").value.trim();

    if (!isValidInput(numberOfPlays)) {
        clearResults(singleDrawOddsDisplay, cumulativeProbabilityDisplay, playsToFiftyDisplay, expectedLossDisplay);
        singleDrawOddsDisplay.textContent = "Please enter a valid number of plays (must be 1 or greater).";
        return;
    }

    if (pickedNumber && !isValidPickedNumber(pickedNumber)) {
        clearResults(singleDrawOddsDisplay, cumulativeProbabilityDisplay, playsToFiftyDisplay, expectedLossDisplay);
        singleDrawOddsDisplay.textContent = "Please enter a valid 3-digit number.";
        return;
    }

    if (!isValidTicketCost(ticketCost)) {
        clearResults(singleDrawOddsDisplay, cumulativeProbabilityDisplay, playsToFiftyDisplay, expectedLossDisplay);
        singleDrawOddsDisplay.textContent = "Please enter a valid ticket cost (must be greater than 0).";
        return;
    }

    const resolvedBetType = resolveBetType(betType, pickedNumber);

    if (resolvedBetType === "box-same") {
        clearResults(singleDrawOddsDisplay, cumulativeProbabilityDisplay, playsToFiftyDisplay, expectedLossDisplay);
        singleDrawOddsDisplay.textContent = "Triple digits cannot be boxed. Use Straight instead.";
        return;
    }

    const singleDrawOdds = getOddsBetType(resolvedBetType);
    const payout = getPayoutForBetType(resolvedBetType);
    const cumulativeProbability = calculateCumulativeProbability(singleDrawOdds, numberOfPlays);
    const playsToFifty = Math.ceil(Math.log(0.5) / Math.log(1 - singleDrawOdds));
    const expectedLoss = calculateExpectedLoss(numberOfPlays, ticketCost, singleDrawOdds, payout);

    singleDrawOddsDisplay.textContent = "Single draw odds: " + formatOddsAsRatio(singleDrawOdds);
    cumulativeProbabilityDisplay.textContent = "Cumulative probability after " + numberOfPlays + " plays: " + (cumulativeProbability * 100).toFixed(2) + "%";
    playsToFiftyDisplay.textContent = "Plays needed for 50% chance: " + playsToFifty;
    expectedLossDisplay.textContent = "Expected loss over " + numberOfPlays + " plays: $" + expectedLoss.toFixed(2);
}

function clearResults() {
    for (let i = 0; i < arguments.length; i++) {
        arguments[i].textContent = "";
    }
}

function formatOddsAsRatio(odds) {
    return "1 in " + Math.round(1 / odds).toLocaleString();
}

function isValidTicketCost(ticketCost) {
    if (isNaN(ticketCost)) return false;
    if (ticketCost <= 0) return false;
    return true;
}

function isValidInput(numberOfPlays) {
    if (isNaN(numberOfPlays)) return false;
    if (numberOfPlays < 1) return false;
    return true;
}

function getOddsBetType(betType) {
    let oddsType = {
        "straight": 0.001,
        "box-different": 0.005988,
        "box-pair": 0.003003
    }

    return oddsType[betType];
}

function getPayoutForBetType(betType) {
    let payouts = {
        "straight": 500,
        "box-different": 80,
        "box-pair": 160
    };

    return payouts[betType];
}

function calculateExpectedLoss(numberOfPlays, ticketCost, singleDrawOdds, payout) {
    const totalSpent = numberOfPlays * ticketCost;
    const expectedWinnings = singleDrawOdds * payout * ticketCost * numberOfPlays;
    return totalSpent - expectedWinnings;
}

function isBoxBetType(betType) {
    return betType === "box-different" || betType === "box-pair";
}

function isValidPickedNumber(pickedNumber) {
    return /^\d{3}$/.test(pickedNumber);
}

function resolveBetType(betType, pickedNumber) {
    if (!isValidPickedNumber(pickedNumber) || !isBoxBetType(betType)) return betType;
    return detectBoxType(pickedNumber);
}

function detectBoxType(number) {
    const digits = number.split("");
    const unique = new Set(digits).size;

    if (unique === 3) return "box-different";
    if (unique === 2) return "box-pair";
    return "box-same";
}

function calculateCumulativeProbability(singleDrawOdds, numberOfPlays) {
    return 1 - Math.pow(1 - singleDrawOdds, numberOfPlays);
}

function readQueryParams() {
    const search = window.location.search;
    if (!search) return;
    const match = search.match(/[?&]number=([^&]+)/);
    if (match) {
        document.getElementById("picked-number").value = match[1];
    }
}

readQueryParams();