const addTicketButton = document.getElementById("add-ticket-button");
const exportTicketsButton = document.getElementById("export-tickets-button");
const importTicketsFile = document.getElementById("import-tickets-file");

let currentPage = 1;
const PAGE_SIZE = 20;

// GA Cash 3 prize per $1 played. A $0.50 play wins half.
const PAYOUT_PER_DOLLAR = {
    "straight": 500,
    "box-6": 80,
    "box-3": 160
};

const WIN_ODDS = {
    "straight": 0.001,
    "box-6": 0.006,
    "box-3": 0.003
};

addTicketButton.addEventListener("click", handleAddTicket);
exportTicketsButton.addEventListener("click", handleExportTickets);
importTicketsFile.addEventListener("change", handleImportTickets);

document.getElementById("ticket-date").value = getTodayString();

function handleAddTicket() {
    const numberInput = document.getElementById("ticket-number");
    const number = numberInput.value.trim();
    const bet = document.getElementById("ticket-bet").value;
    const cost = parseFloat(document.getElementById("ticket-cost").value);
    const date = document.getElementById("ticket-date").value;
    const draw = document.getElementById("ticket-draw").value;

    if (!/^\d{3}$/.test(number)) {
        showError("Please enter a valid 3-digit number.");
        return;
    }

    if (bet === "box" && getPrizeType(bet, number) === null) {
        showError("Triple digits cannot be boxed. Use Straight instead.");
        return;
    }

    if (!date) {
        showError("Please select a date.");
        return;
    }

    const tickets = loadTickets();
    tickets.push({ id: Date.now(), number: number, bet: bet, cost: cost, date: date, draw: draw });

    clearError();
    storeTickets(tickets);
    renderTickets();
    numberInput.value = "";
    numberInput.focus();
}

function handleDeleteTicket(id) {
    const tickets = loadTickets().filter(function(t) { return t.id !== id; });
    storeTickets(tickets);
    renderTickets();
}

function handleExportTickets() {
    const json = JSON.stringify(loadTickets(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tickets.json";
    a.click();
    URL.revokeObjectURL(url);
}

function handleImportTickets(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!window.confirm("This will replace all existing tickets. Continue?")) {
        event.target.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (!Array.isArray(imported) || !imported.every(isValidTicket)) {
                showError("Invalid file: this doesn't look like a tickets export.");
                return;
            }
            clearError();
            storeTickets(imported);
            renderTickets();
        } catch (err) {
            showError("Failed to parse JSON file.");
        }
        event.target.value = "";
    };
    reader.readAsText(file);
}

function isValidTicket(t) {
    return t && t.id && /^\d{3}$/.test(t.number) && (t.bet === "straight" || t.bet === "box") &&
        t.cost > 0 && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && getDrawOrder(t.draw) !== -1;
}

function storeTickets(tickets) {
    saveTickets(tickets).catch(function(err) {
        console.error(err);
        showError("Could not save tickets. Export a backup and try reloading the page.");
    });
}

// Returns "straight", "box-6" (all digits different) or "box-3" (one pair).
// Returns null for a boxed triple, which can't be played.
function getPrizeType(bet, number) {
    if (bet === "straight") return "straight";
    const unique = new Set(number.split("")).size;
    if (unique === 3) return "box-6";
    if (unique === 2) return "box-3";
    return null;
}

function sortDigits(number) {
    return number.split("").sort().join("");
}

// Matches a ticket against the recorded drawings.
// Returns { status: "pending" } or { status: "won" | "lost", drawn, prize }.
function getTicketResult(ticket, drawingsByKey) {
    const drawing = drawingsByKey[ticket.date + "|" + ticket.draw];
    if (!drawing) return { status: "pending" };

    const prizeType = getPrizeType(ticket.bet, ticket.number);
    const won = ticket.bet === "straight"
        ? drawing.number === ticket.number
        : sortDigits(drawing.number) === sortDigits(ticket.number);

    return {
        status: won ? "won" : "lost",
        drawn: drawing.number,
        prize: won ? PAYOUT_PER_DOLLAR[prizeType] * ticket.cost : 0
    };
}

function indexDrawings(drawings) {
    const byKey = {};
    for (let i = 0; i < drawings.length; i++) {
        byKey[drawings[i].date + "|" + drawings[i].draw] = drawings[i];
    }
    return byKey;
}

function calculateSummary(tickets, drawingsByKey) {
    const summary = { settled: 0, wins: 0, spent: 0, won: 0, expectedReturn: 0, pending: 0, pendingCost: 0 };

    for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const result = getTicketResult(ticket, drawingsByKey);
        if (result.status === "pending") {
            summary.pending++;
            summary.pendingCost += ticket.cost;
            continue;
        }
        const prizeType = getPrizeType(ticket.bet, ticket.number);
        summary.settled++;
        summary.spent += ticket.cost;
        summary.won += result.prize;
        summary.expectedReturn += ticket.cost * WIN_ODDS[prizeType] * PAYOUT_PER_DOLLAR[prizeType];
        if (result.status === "won") summary.wins++;
    }

    return summary;
}

function renderTickets() {
    const tickets = loadTickets();
    const drawingsByKey = indexDrawings(loadDrawings());
    renderSummary(calculateSummary(tickets, drawingsByKey));
    renderTicketList(tickets, drawingsByKey);
}

function renderSummary(summary) {
    const container = document.getElementById("ticket-summary");
    container.innerHTML = "";

    if (summary.settled === 0 && summary.pending === 0) {
        container.style.display = "none";
        return;
    }
    container.style.display = "";

    const net = summary.won - summary.spent;
    const expectedNet = summary.expectedReturn - summary.spent;

    container.appendChild(createSummaryStat("Spent", formatMoney(summary.spent), ""));
    container.appendChild(createSummaryStat("Won", formatMoney(summary.won), ""));
    container.appendChild(createSummaryStat("Net", formatSignedMoney(net), net >= 0 ? "summary-positive" : "summary-negative"));
    container.appendChild(createSummaryStat("Winning tickets", summary.wins + " of " + summary.settled, ""));

    const note = document.createElement("p");
    note.className = "summary-note";
    let text = "";
    if (summary.settled > 0) {
        text = "By the odds, these tickets would be expected to net about " + formatSignedMoney(expectedNet) + ".";
    }
    if (summary.pending > 0) {
        text += (text ? " " : "") + summary.pending + " ticket" + (summary.pending === 1 ? "" : "s") +
            " (" + formatMoney(summary.pendingCost) + ") waiting for results — add the drawing on the Drawings page.";
    }
    note.textContent = text;
    container.appendChild(note);
}

function createSummaryStat(label, value, valueClass) {
    const stat = document.createElement("div");
    stat.className = "summary-stat";

    const labelSpan = document.createElement("span");
    labelSpan.className = "summary-label";
    labelSpan.textContent = label;

    const valueSpan = document.createElement("span");
    valueSpan.className = "summary-value " + valueClass;
    valueSpan.textContent = value;

    stat.appendChild(labelSpan);
    stat.appendChild(valueSpan);
    return stat;
}

function renderTicketList(tickets, drawingsByKey) {
    const list = document.getElementById("tickets-list");
    list.innerHTML = "";

    if (tickets.length === 0) {
        list.textContent = "No tickets recorded yet.";
        renderPagination(0);
        return;
    }

    const sorted = tickets.slice().sort(function(a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        const drawDiff = getDrawOrder(b.draw) - getDrawOrder(a.draw);
        if (drawDiff !== 0) return drawDiff;
        return b.id - a.id;
    });

    const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
    if (currentPage > totalPages) { currentPage = totalPages; }
    if (currentPage < 1) { currentPage = 1; }
    const pageStart = (currentPage - 1) * PAGE_SIZE;
    const paginated = sorted.slice(pageStart, pageStart + PAGE_SIZE);

    renderPagination(sorted.length);

    for (let i = 0; i < paginated.length; i++) {
        list.appendChild(createTicketItem(paginated[i], getTicketResult(paginated[i], drawingsByKey)));
    }
}

function createTicketItem(ticket, result) {
    const item = document.createElement("div");
    item.className = "drawing-item ticket-" + result.status;

    const main = document.createElement("div");
    main.className = "ticket-main";

    const numberSpan = document.createElement("span");
    numberSpan.className = "drawing-number";
    numberSpan.textContent = ticket.number;

    const betSpan = document.createElement("span");
    betSpan.className = "drawing-draw";
    betSpan.textContent = (ticket.bet === "straight" ? "Straight" : "Box") + " · " + formatMoney(ticket.cost);

    main.appendChild(numberSpan);
    main.appendChild(betSpan);

    const meta = document.createElement("div");
    meta.className = "drawing-meta";

    const dateSpan = document.createElement("span");
    dateSpan.className = "drawing-date";
    dateSpan.textContent = ticket.date + " · " + capitalizeDrawTime(ticket.draw);

    const statusSpan = document.createElement("span");
    statusSpan.className = "ticket-status";
    if (result.status === "won") {
        statusSpan.textContent = "Won " + formatMoney(result.prize) + " (drew " + result.drawn + ")";
    } else if (result.status === "lost") {
        statusSpan.textContent = "No win (drew " + result.drawn + ")";
    } else {
        statusSpan.textContent = "Waiting for result";
    }

    meta.appendChild(dateSpan);
    meta.appendChild(statusSpan);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "drawing-delete-button";
    deleteButton.textContent = "×";
    deleteButton.title = "Delete ticket";
    deleteButton.onclick = createDeleteHandler(ticket.id);

    item.appendChild(main);
    item.appendChild(meta);
    item.appendChild(deleteButton);
    return item;
}

function createDeleteHandler(id) {
    return function() {
        if (window.confirm("Delete this ticket?")) {
            handleDeleteTicket(id);
        }
    };
}

function renderPagination(total) {
    const controls = document.getElementById("pagination-controls");
    controls.innerHTML = "";

    if (total <= PAGE_SIZE) { return; }

    const totalPages = Math.ceil(total / PAGE_SIZE);

    const prevButton = document.createElement("button");
    prevButton.type = "button";
    prevButton.className = "filter-button";
    prevButton.textContent = "← Prev";
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener("click", function() {
        currentPage--;
        renderTickets();
    });

    const label = document.createElement("span");
    label.className = "page-label";
    label.textContent = "Page " + currentPage + " of " + totalPages;

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "filter-button";
    nextButton.textContent = "Next →";
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener("click", function() {
        currentPage++;
        renderTickets();
    });

    controls.appendChild(prevButton);
    controls.appendChild(label);
    controls.appendChild(nextButton);
}

function getDrawOrder(draw) {
    if (draw === "night") return 2;
    if (draw === "evening") return 1;
    if (draw === "midday") return 0;
    return -1;
}

function capitalizeDrawTime(draw) {
    if (draw === "midday") return "Midday";
    if (draw === "night") return "Night";
    return "Evening";
}

function formatMoney(amount) {
    return "$" + amount.toFixed(2);
}

function formatSignedMoney(amount) {
    return (amount < 0 ? "-" : "+") + formatMoney(Math.abs(amount));
}

function getTodayString() {
    const now = new Date();
    return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
}

function showError(message) {
    const el = document.getElementById("tickets-error");
    el.textContent = message;
}

function clearError() {
    document.getElementById("tickets-error").textContent = "";
}

initStore().then(renderTickets);
