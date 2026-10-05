const ALL_CATEGORIES = ["Tablet", "Syrup", "Capsule", "Injection", "Cream", "Drops", "Ointment", "Other"];
const LOW_STOCK_THRESHOLD = 10;

let pageCategory = null;       // fixed category for this page (from URL, optional)
let pageOwnerId = null;        // admin drill-down: viewing one specific pharmacist's stock
let readOnlyMode = false;      // true when admin is viewing someone else's stock
let isAdminUser = false;
let activeStatusFilter = "";   // "" = all
let selectedFormCategory = null;

function getParamFromURL(name) {
    return new URLSearchParams(window.location.search).get(name);
}

function renderCategoryPicker() {
    const wrap = document.getElementById("categoryPicker");
    if (!wrap) return;
    wrap.innerHTML = "";
    ALL_CATEGORIES.forEach(cat => {
        const btn = document.createElement("div");
        btn.className = "category-pick-btn" + (selectedFormCategory === cat ? " active" : "");
        btn.innerHTML = `<span class="icon">${CATEGORY_ICONS[cat] || "📦"}</span>${cat}`;
        btn.addEventListener("click", () => {
            selectedFormCategory = cat;
            document.getElementById("medCategory").value = cat;
            renderCategoryPicker();
        });
        wrap.appendChild(btn);
    });
}

function setupStatusPills() {
    const pills = document.querySelectorAll(".filter-pill");
    pills.forEach(pill => {
        pill.addEventListener("click", () => {
            pills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            activeStatusFilter = pill.dataset.status;
            renderTable(document.getElementById("searchBox").value);
        });
    });
}

async function fetchMedicines(searchText = "") {
    const params = new URLSearchParams();
    if (searchText) params.set("search", searchText);
    if (pageCategory) params.set("category", pageCategory);
    if (activeStatusFilter) params.set("status", activeStatusFilter);
    if (pageOwnerId) params.set("owner_id", pageOwnerId);

    const response = await apiFetch(`/medicines?${params.toString()}`);
    if (response.status === 401) { clearToken(); window.location.href = "login.html"; throw new Error("Not authenticated"); }
    if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
    return await response.json();
}

async function renderTable(filterText = "") {
    const tbody = document.getElementById("medicineTableBody");
    if (!tbody) return;

    try {
        const medicines = await fetchMedicines(filterText);
        hideBanner();
        tbody.innerHTML = "";

        if (medicines.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No medicines found</td></tr>`;
            return;
        }

        medicines.forEach(med => {
            const statusClass = "status-" + med.status.toLowerCase().replace(/\s+/g, "-");
            const isLowStock = med.quantity < LOW_STOCK_THRESHOLD;
            const ownerCell = (isAdminUser && !pageOwnerId)
                ? `<td>${med.owner_pharmacist_id || "-"}<br><span style="font-size:11px;color:#94a3b8;">${med.owner_name || ""}</span></td>`
                : "";
            const actionsCell = readOnlyMode
                ? `<td><span style="color:#94a3b8; font-size:12px;">View only</span></td>`
                : `<td>
                    <button class="btn btn-sm btn-edit" onclick="openEditForm(${med.id})">Edit</button>
                    <button class="btn btn-sm btn-delete" onclick="deleteMedicine(${med.id})">Delete</button>
                   </td>`;

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${med.medicine_name}</td>
                <td>${med.batch_number}</td>
                <td class="${isLowStock ? 'low-stock' : ''}">${med.quantity}${isLowStock ? ' ⚠️' : ''}</td>
                <td>${med.manufacturing_date}</td>
                <td>${med.expiry_date}</td>
                <td>${med.supplier || "-"}</td>
                <td><span class="status ${statusClass}">${med.status}</span></td>
                ${ownerCell}
                ${actionsCell}
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error("[category-medicines] error loading table:", err);
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Could not load medicines.</td></tr>`;
        showBanner("⚠️ Could not load medicines. (" + err.message + ")");
    }
}

function setupSearch() {
    const searchBox = document.getElementById("searchBox");
    if (!searchBox) return;
    let debounceTimer;
    searchBox.addEventListener("input", (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => renderTable(e.target.value), 250);
    });
}

function openAddForm() {
    document.getElementById("formTitle").innerText = "Add Medicine";
    document.getElementById("medicineForm").reset();
    document.getElementById("medId").value = "";
    selectedFormCategory = pageCategory;
    document.getElementById("medCategory").value = pageCategory || "";
    renderCategoryPicker();
    document.getElementById("formOverlay").style.display = "flex";
}

async function openEditForm(id) {
    try {
        const response = await apiFetch(`/medicines/${id}`);
        if (response.status === 401) { clearToken(); window.location.href = "login.html"; return; }
        if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
        const med = await response.json();

        document.getElementById("formTitle").innerText = "Edit Medicine";
        document.getElementById("medId").value = med.id;
        document.getElementById("medName").value = med.medicine_name;
        document.getElementById("medBatch").value = med.batch_number;
        document.getElementById("medQuantity").value = med.quantity;
        document.getElementById("medMfgDate").value = med.manufacturing_date;
        document.getElementById("medExpiryDate").value = med.expiry_date;
        document.getElementById("medSupplier").value = med.supplier || "";

        selectedFormCategory = med.category;
        document.getElementById("medCategory").value = med.category;
        renderCategoryPicker();

        document.getElementById("formOverlay").style.display = "flex";
    } catch (err) {
        console.error("[category-medicines] error loading medicine for edit:", err);
        showBanner("⚠️ Could not load medicine details. (" + err.message + ")");
    }
}

function closeForm() {
    document.getElementById("formOverlay").style.display = "none";
}

async function deleteMedicine(id) {
    if (!confirm("Are you sure you want to delete this medicine?")) return;
    try {
        const response = await apiFetch(`/medicines/${id}`, { method: "DELETE" });
        if (response.status === 401) { clearToken(); window.location.href = "login.html"; return; }
        if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
        renderTable(document.getElementById("searchBox").value);
    } catch (err) {
        console.error("[category-medicines] error deleting:", err);
        showBanner("⚠️ Could not delete medicine. (" + err.message + ")");
    }
}

function setupFormSubmit() {
    const form = document.getElementById("medicineForm");
    if (!form) return;

    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        if (!selectedFormCategory) {
            showBanner("⚠️ Please select a category before saving.");
            return;
        }

        const id = document.getElementById("medId").value;
        const medData = {
            medicine_name: document.getElementById("medName").value.trim(),
            batch_number: document.getElementById("medBatch").value.trim(),
            category: selectedFormCategory,
            quantity: parseInt(document.getElementById("medQuantity").value),
            manufacturing_date: document.getElementById("medMfgDate").value,
            expiry_date: document.getElementById("medExpiryDate").value,
            supplier: document.getElementById("medSupplier").value.trim()
        };

        try {
            let response;
            if (id) {
                response = await apiFetch(`/medicines/${id}`, {
                    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(medData)
                });
            } else {
                response = await apiFetch(`/medicines`, {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(medData)
                });
            }

            if (response.status === 401) { clearToken(); window.location.href = "login.html"; return; }
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server responded with status ${response.status}`);
            }

            closeForm();
            hideBanner();
            renderTable(document.getElementById("searchBox").value);
        } catch (err) {
            console.error("[category-medicines] error saving:", err);
            showBanner("⚠️ Could not save medicine. (" + err.message + ")");
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const user = await requireAuth();
    if (!user) return;

    isAdminUser = user.role === "admin";
    pageCategory = getParamFromURL("category");
    pageOwnerId = getParamFromURL("owner_id");
    const ownerLabel = getParamFromURL("owner_label");

    // Read-only when admin is viewing a DIFFERENT pharmacist's stock
    readOnlyMode = !!(pageOwnerId && isAdminUser);

    if (pageOwnerId) {
        document.getElementById("pageTitle").textContent =
            `📦 ${ownerLabel || "Pharmacist"}'s Medicines` + (pageCategory ? ` — ${pageCategory}` : "");
    } else {
        document.getElementById("pageTitle").textContent =
            (CATEGORY_ICONS[pageCategory] || "📦") + " " + (pageCategory || "All Medicines");
    }

    // Hide "Add Medicine" button in read-only mode
    if (readOnlyMode) {
        const addBtn = document.querySelector('.page-header button[onclick="openAddForm()"]');
        if (addBtn) addBtn.style.display = "none";
    }

    // Add "Owner" column header when admin views combined (non-drilldown) data
    if (isAdminUser && !pageOwnerId) {
        const headerRow = document.querySelector("thead tr");
        if (headerRow) {
            const th = document.createElement("th");
            th.textContent = "Owner";
            headerRow.insertBefore(th, headerRow.lastElementChild);
        }
    }

    setupStatusPills();
    renderTable();
    setupSearch();
    setupFormSubmit();
});
