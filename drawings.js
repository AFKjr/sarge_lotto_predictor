const addDrawingButton = document.getElementById("add-drawing-button");
const exportButton = document.getElementById("export-button");
const importFile = document.getElementById("import-file");

let editingId = null;

addDrawingButton.addEventListener("click", handleAddDrawing);
exportButton.addEventListener("click", handleExport);
importFile.addEventListener("change", handleImport);

function handleAddDrawing() {
    const numberInput = document.getElementById("drawing-number");
    const dateInput = document.getElementById("drawing-date");
    const number = numberInput.value.trim();
    const date = dateInput.value;

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
        drawings = drawings.map(function(d) {
            if (d.id === editingId) {
                return { id: d.id, number: number, date: date };
            }
            return d;
        });
        exitEditMode();
    } else {
        if (isDuplicate(drawings, number, date)) {
            showError("A drawing with this number and date already exists.");
            return;
        }
        drawings.push({ id: Date.now(), number: number, date: date });
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

function isDuplicate(drawings, number, date) {
    for (let i = 0; i < drawings.length; i++) {
        if (drawings[i].number === number && drawings[i].date === date) {
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

function loadDrawings() {
    const stored = localStorage.getItem("drawings");
    if (!stored) return [];
    const drawings = JSON.parse(stored);
    for (let i = 0; i < drawings.length; i++) {
        if (!drawings[i].id) {
            drawings[i].id = Date.now() + i;
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

    if (drawings.length === 0) {
        list.textContent = "No drawings recorded yet.";
        return;
    }

    const sorted = drawings.slice().sort(function(a, b) {
        return new Date(b.date) - new Date(a.date);
    });

    for (let i = 0; i < sorted.length; i++) {
        const drawing = sorted[i];

        const item = document.createElement("div");
        item.className = "drawing-item";

        const numberLink = document.createElement("a");
        numberLink.className = "drawing-number";
        numberLink.href = "index.html?number=" + drawing.number;
        numberLink.textContent = drawing.number;

        const dateSpan = document.createElement("span");
        dateSpan.className = "drawing-date";
        dateSpan.textContent = drawing.date;

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
        item.appendChild(dateSpan);
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
    document.getElementById("drawings-error").textContent = message;
}

function clearError() {
    document.getElementById("drawings-error").textContent = "";
}

renderDrawings(loadDrawings());
