const addDrawingButton = document.getElementById("add-drawing-button");
const exportButton = document.getElementById("export-button");
const importFile = document.getElementById("import-file");
const importPdfFile = document.getElementById("import-pdf-file");

let editingId = null;
let filterDraw = "evening";
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
    // const drawSelect = document.getElementById("drawing-draw");
    const number = numberInput.value.trim();
    const date = dateInput.value;
    const draw = "evening"; // const draw = drawSelect.value;

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
    // document.getElementById("drawing-draw").value = drawing.draw || "evening";
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
            const parsed = parseCash3Pdf(pages);
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
            if (added === 0) {
                showSuccess("PDF parsed — all " + parsed.length + " drawing" + (parsed.length === 1 ? "" : "s") + " already exist.");
            } else {
                showSuccess(added + " drawing" + (added === 1 ? "" : "s") + " imported from PDF.");
            }
        }).catch(function() {
            showError("Failed to read PDF file.");
        });
        event.target.value = "";
    };
    reader.onerror = function() {
        showError("Failed to read file.");
        event.target.value = "";
    };
    reader.readAsArrayBuffer(file);
}

function parseCash3Pdf(pages) {
    // PDF y-coordinates are page-relative, so each page must be processed independently.
    // Mixing all pages into one array causes items from different pages at the same
    // y-coordinate to be grouped into the same row, breaking pattern matching.
    const Y_TOLERANCE = 5;
    const dateRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
    const drawRegex = /^(Midday|Evening|Night)$/i;
    const results = [];

    for (let p = 0; p < pages.length; p++) {
        // Collect text items with coordinates for this page only
        const pageItems = [];
        for (let j = 0; j < pages[p].items.length; j++) {
            const item = pages[p].items[j];
            const str = item.str.trim();
            if (str === "") continue;
            pageItems.push({
                str: str,
                x: item.transform[4],
                y: item.transform[5]
            });
        }

        // Group items into rows by y-coordinate within this page
        const rowMap = {};
        for (let i = 0; i < pageItems.length; i++) {
            const y = pageItems[i].y;
            let matched = null;
            const keys = Object.keys(rowMap);
            for (let k = 0; k < keys.length; k++) {
                if (Math.abs(parseFloat(keys[k]) - y) <= Y_TOLERANCE) {
                    matched = keys[k];
                    break;
                }
            }
            if (matched === null) {
                rowMap[y.toString()] = [];
                matched = y.toString();
            }
            rowMap[matched].push(pageItems[i]);
        }

        // Sort rows top-to-bottom (descending y = top of page first in PDF coords)
        const rowKeys = Object.keys(rowMap).sort(function(a, b) {
            return parseFloat(b) - parseFloat(a);
        });

        for (let r = 0; r < rowKeys.length; r++) {
            // Sort each row left-to-right by x-coordinate
            const row = rowMap[rowKeys[r]].sort(function(a, b) { return a.x - b.x; });

            if (row.length < 3) continue;

            // The GA Lottery PDF renders dates as three separate text items:
            //   '02/'  '25/'  '2026'
            // rather than one combined '02/25/2026' string.
            // Handle both the split form and any future combined form.
            const monthPartRe = /^\d{1,2}\/$/;
            const dayPartRe   = /^\d{1,2}\/$/;
            const yearPartRe  = /^\d{4}$/;

            let dateStr = null;
            let dateEndIndex = 0;

            if (dateRegex.test(row[0].str)) {
                // Combined form: '02/25/2026'
                dateStr = row[0].str;
                dateEndIndex = 0;
            } else if (
                row.length >= 3 &&
                monthPartRe.test(row[0].str) &&
                dayPartRe.test(row[1].str) &&
                yearPartRe.test(row[2].str)
            ) {
                // Split form: '02/' + '25/' + '2026'
                dateStr = row[0].str + row[1].str + row[2].str;
                dateEndIndex = 2;
            }

            if (!dateStr) continue;

            const date = formatDateFromMDY(dateStr);

            // Scan for draw time starting after the last date item.
            let drawIndex = -1;
            let draw = "";
            for (let j = dateEndIndex + 1; j < row.length; j++) {
                if (drawRegex.test(row[j].str)) {
                    drawIndex = j;
                    draw = normalizeDrawTime(row[j].str);
                    break;
                }
            }
            if (drawIndex === -1) continue;

            // Collect digits starting immediately after the draw time column.
            // Handles "2 1 3" as one combined item or as three separate single-digit items.
            const digits = [];
            for (let j = drawIndex + 1; j < row.length && digits.length < 3; j++) {
                const combinedMatch = row[j].str.match(/^(\d)\s*(\d)\s*(\d)$/);
                if (combinedMatch) {
                    digits.push(combinedMatch[1], combinedMatch[2], combinedMatch[3]);
                    break;
                } else if (/^\d$/.test(row[j].str)) {
                    digits.push(row[j].str);
                } else {
                    break;
                }
            }

            if (digits.length !== 3) continue;

            if (draw === "evening") {
                results.push({ number: digits.join(""), date: date, draw: draw });
            }
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
