const addDrawingButton = document.getElementById("add-drawing-button");
const exportButton = document.getElementById("export-button");
const importFile = document.getElementById("import-file");
const importPdfFile = document.getElementById("import-pdf-file");

let editingId = null;
let filterDraw = "all";
let filterDateFrom = "";
let filterDateTo = "";

addDrawingButton.addEventListener("click", handleAddDrawing);
exportButton.addEventListener("click", handleExport);
importFile.addEventListener("change", handleImport);
importPdfFile.addEventListener("change", handlePdfImport);

const filterButtons = document.querySelectorAll(".filter-button");
for (let i = 0; i < filterButtons.length; i++) {
    filterButtons[i].addEventListener("click", function() {
        handleFilterDraw(this.getAttribute("data-draw"));
    });
}

document.getElementById("filter-date-from").addEventListener("change", function() {
    filterDateFrom = this.value;
    renderDrawings(loadDrawings());
});

document.getElementById("filter-date-to").addEventListener("change", function() {
    filterDateTo = this.value;
    renderDrawings(loadDrawings());
});

function handleFilterDraw(draw) {
    filterDraw = draw;
    for (let i = 0; i < filterButtons.length; i++) {
        if (filterButtons[i].getAttribute("data-draw") === draw) {
            filterButtons[i].classList.add("active");
        } else {
            filterButtons[i].classList.remove("active");
        }
    }
    renderDrawings(loadDrawings());
}

function handleAddDrawing() {
    const numberInput = document.getElementById("drawing-number");
    const dateInput = document.getElementById("drawing-date");
    const drawSelect = document.getElementById("drawing-draw");
    const number = numberInput.value.trim();
    const date = dateInput.value;
    const draw = drawSelect.value;

    if (!isValidDrawingNumber(number)) {
        showError("Please enter a valid 3-digit number.");
        return;
    }

    if (!date) {
        showError("Please select a date.");
        return;
    }

    let drawings = loadDrawings();

    if (editingId !== null) {
        const otherDrawings = drawings.filter(function(d) { return d.id !== editingId; });
        if (isDuplicate(otherDrawings, date, draw)) {
            showError("A drawing for this date and draw time already exists.");
            return;
        }
        drawings = drawings.map(function(d) {
            if (d.id === editingId) {
                return { id: d.id, number: number, date: date, draw: draw };
            }
            return d;
        });
        exitEditMode();
    } else {
        if (isDuplicate(drawings, date, draw)) {
            showError("A drawing for this date and draw time already exists.");
            return;
        }
        drawings.push({ id: Date.now(), number: number, date: date, draw: draw });
    }

    clearError();
    saveDrawings(drawings);
    renderDrawings(drawings);
    numberInput.value = "";
    dateInput.value = "";
}

function exitEditMode() {
    editingId = null;
    addDrawingButton.textContent = "Add Drawing";
}

function isDuplicate(drawings, date, draw) {
    for (let i = 0; i < drawings.length; i++) {
        if (drawings[i].date === date && drawings[i].draw === draw) {
            return true;
        }
    }
    return false;
}

function handleDeleteDrawing(id) {
    let drawings = loadDrawings();
    drawings = drawings.filter(function(d) { return d.id !== id; });
    saveDrawings(drawings);
    renderDrawings(drawings);
}

function handleEditDrawing(id) {
    const drawings = loadDrawings();
    let drawing = null;
    for (let i = 0; i < drawings.length; i++) {
        if (drawings[i].id === id) {
            drawing = drawings[i];
            break;
        }
    }
    if (!drawing) return;

    document.getElementById("drawing-number").value = drawing.number;
    document.getElementById("drawing-date").value = drawing.date;
    document.getElementById("drawing-draw").value = drawing.draw || "evening";
    editingId = id;
    addDrawingButton.textContent = "Update Drawing";
    document.getElementById("drawing-number").focus();
    clearError();
}

function handleExport() {
    const drawings = loadDrawings();
    const json = JSON.stringify(drawings, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "drawings.json";
    a.click();
    URL.revokeObjectURL(url);
}

function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!window.confirm("This will replace all existing drawings. Continue?")) {
        event.target.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (!Array.isArray(imported)) {
                showError("Invalid format: expected a JSON array.");
                return;
            }
            for (let i = 0; i < imported.length; i++) {
                if (!imported[i].id) {
                    imported[i].id = Date.now() + i;
                }
                if (!imported[i].draw) {
                    imported[i].draw = "evening";
                }
            }
            clearError();
            saveDrawings(imported);
            renderDrawings(imported);
        } catch (err) {
            showError("Failed to parse JSON file.");
        }
        event.target.value = "";
    };
    reader.readAsText(file);
}

function handlePdfImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const typedArray = new Uint8Array(e.target.result);
        pdfjsLib.getDocument({ data: typedArray }).promise.then(function(pdf) {
            const pagePromises = [];
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                pagePromises.push(
                    pdf.getPage(pageNum).then(function(page) {
                        return page.getTextContent();
                    })
                );
            }
            return Promise.all(pagePromises);
        }).then(function(pages) {
            const textItems = [];
            for (let i = 0; i < pages.length; i++) {
                for (let j = 0; j < pages[i].items.length; j++) {
                    textItems.push(pages[i].items[j].str);
                }
            }
            const parsed = parseCash3Pdf(textItems);
            if (parsed.length === 0) {
                showError("No drawings found in PDF. Make sure it is a GA Lottery Cash 3 results PDF.");
                return;
            }
            let drawings = loadDrawings();
            let added = 0;
            for (let i = 0; i < parsed.length; i++) {
                if (!isDuplicate(drawings, parsed[i].date, parsed[i].draw)) {
                    parsed[i].id = Date.now() + added;
                    drawings.push(parsed[i]);
                    added++;
                }
            }
            saveDrawings(drawings);
            renderDrawings(drawings);
            clearError();
            showSuccess(added + " drawing" + (added === 1 ? "" : "s") + " imported from PDF.");
        }).catch(function() {
            showError("Failed to read PDF file.");
        });
        event.target.value = "";
    };
    reader.readAsArrayBuffer(file);
}

function parseCash3Pdf(textItems) {
    const results = [];
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    const drawRegex = /^(Midday|Evening|Night)$/i;

    let i = 0;
    while (i < textItems.length) {
        const item = textItems[i].trim();

        if (!dateRegex.test(item)) {
            i++;
            continue;
        }

        const date = formatDateFromMDY(item);

        // Find next non-empty item — should be draw type
        let j = i + 1;
        while (j < textItems.length && textItems[j].trim() === "") {
            j++;
        }
        if (j >= textItems.length || !drawRegex.test(textItems[j].trim())) {
            i++;
            continue;
        }
        const draw = normalizeDrawTime(textItems[j].trim());

        // Find the winning number — "2 1 3" as one item, or "2","1","3" as separate items
        let k = j + 1;
        while (k < textItems.length && textItems[k].trim() === "") {
            k++;
        }
        if (k >= textItems.length) {
            i++;
            continue;
        }

        let number = "";
        const nextItem = textItems[k].trim();
        const combinedMatch = nextItem.match(/^(\d)\s+(\d)\s+(\d)$/);

        if (combinedMatch) {
            number = combinedMatch[1] + combinedMatch[2] + combinedMatch[3];
            i = k + 1;
        } else if (/^\d$/.test(nextItem)) {
            const digits = [nextItem];
            let m = k + 1;
            while (m < textItems.length && digits.length < 3) {
                const d = textItems[m].trim();
                if (/^\d$/.test(d)) {
                    digits.push(d);
                } else if (d !== "") {
                    break;
                }
                m++;
            }
            if (digits.length === 3) {
                number = digits.join("");
                i = m;
            } else {
                i++;
                continue;
            }
        } else {
            i++;
            continue;
        }

        if (draw === "evening") {
            results.push({ number: number, date: date, draw: draw });
        }
    }

    return results;
}

function formatDateFromMDY(mdy) {
    const parts = mdy.split("/");
    return parts[2] + "-" + parts[0].padStart(2, "0") + "-" + parts[1].padStart(2, "0");
}

function normalizeDrawTime(draw) {
    const lower = draw.toLowerCase();
    if (lower === "midday") return "midday";
    if (lower === "night") return "night";
    return "evening";
}

function getDrawOrder(draw) {
    if (draw === "night") return 2;
    if (draw === "evening") return 1;
    return 0;
}

function capitalizeDrawTime(draw) {
    if (draw === "midday") return "Midday";
    if (draw === "night") return "Night";
    return "Evening";
}

function getFilteredDrawings(drawings) {
    return drawings.filter(function(d) {
        if (filterDraw !== "all" && d.draw !== filterDraw) return false;
        if (filterDateFrom && d.date < filterDateFrom) return false;
        if (filterDateTo && d.date > filterDateTo) return false;
        return true;
    });
}

function loadDrawings() {
    const stored = localStorage.getItem("drawings");
    if (!stored) return [];
    const drawings = JSON.parse(stored);
    for (let i = 0; i < drawings.length; i++) {
        if (!drawings[i].id) {
            drawings[i].id = Date.now() + i;
        }
        if (!drawings[i].draw) {
            drawings[i].draw = "evening";
        }
    }
    return drawings;
}

function saveDrawings(drawings) {
    localStorage.setItem("drawings", JSON.stringify(drawings));
}

function renderDrawings(drawings) {
    const list = document.getElementById("drawings-list");
    list.innerHTML = "";

    const filtered = getFilteredDrawings(drawings);

    if (filtered.length === 0) {
        list.textContent = drawings.length === 0
            ? "No drawings recorded yet."
            : "No drawings match the current filter.";
        return;
    }

    const sorted = filtered.slice().sort(function(a, b) {
        const dateDiff = new Date(b.date) - new Date(a.date);
        if (dateDiff !== 0) return dateDiff;
        return getDrawOrder(b.draw) - getDrawOrder(a.draw);
    });

    for (let i = 0; i < sorted.length; i++) {
        const drawing = sorted[i];

        const item = document.createElement("div");
        item.className = "drawing-item";

        const numberLink = document.createElement("a");
        numberLink.className = "drawing-number";
        numberLink.href = "index.html?number=" + drawing.number;
        numberLink.textContent = drawing.number;

        const meta = document.createElement("div");
        meta.className = "drawing-meta";

        const dateSpan = document.createElement("span");
        dateSpan.className = "drawing-date";
        dateSpan.textContent = drawing.date;

        const drawSpan = document.createElement("span");
        drawSpan.className = "drawing-draw";
        drawSpan.textContent = capitalizeDrawTime(drawing.draw);

        meta.appendChild(dateSpan);
        meta.appendChild(drawSpan);

        const actions = document.createElement("div");
        actions.className = "drawing-item-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "drawing-edit-button";
        editButton.textContent = "Edit";
        editButton.onclick = createEditHandler(drawing.id);

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "drawing-delete-button";
        deleteButton.textContent = "×";
        deleteButton.onclick = createDeleteHandler(drawing.id);

        actions.appendChild(editButton);
        actions.appendChild(deleteButton);
        item.appendChild(numberLink);
        item.appendChild(meta);
        item.appendChild(actions);
        list.appendChild(item);
    }
}

function createEditHandler(id) {
    return function() { handleEditDrawing(id); };
}

function createDeleteHandler(id) {
    return function() { handleDeleteDrawing(id); };
}

function isValidDrawingNumber(number) {
    return /^\d{3}$/.test(number);
}

function showError(message) {
    const el = document.getElementById("drawings-error");
    el.textContent = message;
    el.className = "drawings-error-text";
}

function showSuccess(message) {
    const el = document.getElementById("drawings-error");
    el.textContent = message;
    el.className = "drawings-success-text";
}

function clearError() {
    const el = document.getElementById("drawings-error");
    el.textContent = "";
    el.className = "";
}

renderDrawings(loadDrawings());
