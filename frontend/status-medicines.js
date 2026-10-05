async function loadMedicinesByStatus(status) {
    try {
        const response = await apiFetch(`/medicines?status=${encodeURIComponent(status)}`);
        if (response.status === 401) { clearToken(); window.location.href = "login.html"; return []; }
        if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
        return await response.json();
    } catch (err) {
        console.error("[status-medicines] error:", err);
        showBanner("⚠️ Could not load medicines. (" + err.message + ")");
        return [];
    }
}

function groupByCategory(medicines) {
    const groups = {};
    medicines.forEach(med => {
        const cat = med.category || "Other";
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(med);
    });
    return groups;
}

function renderSections(groups, isAdmin) {
    const wrap = document.getElementById("sectionsWrap");
    wrap.innerHTML = "";

    const categories = Object.keys(groups);
    if (categories.length === 0) {
        wrap.innerHTML = `<div class="empty-state">No medicines found in this status.</div>`;
        return;
    }

    const ownerHeader = isAdmin ? "<th>Owner</th>" : "";

    categories.forEach(cat => {
        const meds = groups[cat];
        const section = document.createElement("div");
        section.className = "category-section";

        let rows = "";
        meds.forEach(med => {
            const statusClass = "status-" + med.status.toLowerCase().replace(/\s+/g, "-");
            const ownerCell = isAdmin
                ? `<td>${med.owner_pharmacist_id || "-"}<br><span style="font-size:11px;color:#94a3b8;">${med.owner_name || ""}</span></td>`
                : "";
            rows += `
                <tr>
                    <td>${med.medicine_name}</td>
                    <td>${med.batch_number}</td>
                    <td>${med.quantity}</td>
                    <td>${med.manufacturing_date}</td>
                    <td>${med.expiry_date}</td>
                    <td>${med.supplier || "-"}</td>
                    <td><span class="status ${statusClass}">${med.status}</span></td>
                    ${ownerCell}
                </tr>
            `;
        });

        section.innerHTML = `
            <div class="category-section-title">
                ${CATEGORY_ICONS[cat] || "📦"} ${cat}
                <span class="category-section-count">(${meds.length} item${meds.length === 1 ? "" : "s"})</span>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr><th>Name</th><th>Batch No</th><th>Quantity</th><th>Mfg Date</th><th>Expiry Date</th><th>Supplier</th><th>Status</th>${ownerHeader}</tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
        wrap.appendChild(section);
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const user = await requireAuth();
    if (!user) return;

    const status = new URLSearchParams(window.location.search).get("status") || "Safe";
    document.getElementById("pageTitle").textContent = `Medicines — ${status}`;

    const medicines = await loadMedicinesByStatus(status);
    hideBanner();
    renderSections(groupByCategory(medicines), user.role === "admin");
});
