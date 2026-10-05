let selectedCity = null;

async function loadCities() {
    try {
        const response = await apiFetch("/cities");
        if (response.status === 401) { clearToken(); window.location.href = "login.html"; return []; }
        if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
        return await response.json();
    } catch (err) {
        console.error("[request] error loading cities:", err);
        showBanner("⚠️ Could not load cities. (" + err.message + ")");
        return [];
    }
}

function renderCities(cities) {
    const wrap = document.getElementById("cityGrid");
    wrap.innerHTML = "";
    cities.forEach(city => {
        const card = document.createElement("div");
        card.className = "city-card" + (selectedCity === city ? " selected" : "");
        card.textContent = city;
        card.addEventListener("click", () => {
            selectedCity = city;
            renderCities(cities);
            loadPharmacists(city);
        });
        wrap.appendChild(card);
    });
}

async function loadPharmacists(city) {
    const section = document.getElementById("pharmacistSection");
    section.style.display = "block";
    const tbody = document.getElementById("pharmacistTableBody");
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Loading...</td></tr>`;

    try {
        const response = await apiFetch(`/pharmacists?city=${encodeURIComponent(city)}`);
        if (response.status === 401) { clearToken(); window.location.href = "login.html"; return; }
        if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
        const pharmacists = await response.json();

        if (pharmacists.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No approved pharmacists in ${city} yet</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        pharmacists.forEach(p => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong>${p.pharmacist_id}</strong></td>
                <td>${p.full_name || p.username}</td>
                <td>${p.city}</td>
                <td><button class="btn btn-sm" onclick="openRequestForm('${p.pharmacist_id}', '${(p.full_name || p.username).replace(/'/g, "")}')">Send Request</button></td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error("[request] error loading pharmacists:", err);
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Could not load pharmacists</td></tr>`;
    }
}

function openRequestForm(pharmacistId, name) {
    document.getElementById("targetPharmacistId").value = pharmacistId;
    document.getElementById("targetPharmacistLabel").textContent = `${name} (${pharmacistId})`;
    document.getElementById("requestForm").reset();
    document.getElementById("formOverlay").style.display = "flex";
}

function closeRequestForm() {
    document.getElementById("formOverlay").style.display = "none";
}

function setupRequestForm() {
    const form = document.getElementById("requestForm");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const payload = {
            to_pharmacist_id: document.getElementById("targetPharmacistId").value,
            medicine_name: document.getElementById("reqMedicineName").value.trim(),
            quantity: parseInt(document.getElementById("reqQuantity").value)
        };

        try {
            const response = await apiFetch("/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to send request");

            closeRequestForm();
            hideBanner();
            loadSentRequests();
        } catch (err) {
            console.error("[request] error sending:", err);
            showBanner("⚠️ " + err.message);
        }
    });
}

function statusBadge(status) {
    if (status === "pending") return '<span class="badge-pending">Pending</span>';
    if (status === "available") return '<span class="badge-approved">Available</span>';
    return '<span class="badge-rejected">Not Available</span>';
}

async function loadSentRequests() {
    const wrap = document.getElementById("sentRequestsWrap");
    try {
        const response = await apiFetch("/requests/sent");
        if (!response.ok) throw new Error(`Status ${response.status}`);
        const requests = await response.json();

        if (requests.length === 0) {
            wrap.innerHTML = `<div class="empty-state">You haven't sent any requests yet.</div>`;
            return;
        }

        wrap.innerHTML = requests.map(r => `
            <div class="item-card">
                <div class="item-info">
                    <h4>${r.medicine_name} × ${r.quantity}</h4>
                    <p>To: ${r.to_name} (${r.to_pharmacist_id}) — ${r.created_at}</p>
                </div>
                <div class="item-actions">${statusBadge(r.status)}</div>
            </div>
        `).join("");
    } catch (err) {
        console.error("[request] error loading sent:", err);
        wrap.innerHTML = `<div class="empty-state">Could not load sent requests.</div>`;
    }
}

async function loadReceivedRequests() {
    const wrap = document.getElementById("receivedRequestsWrap");
    try {
        const response = await apiFetch("/requests/received");
        if (!response.ok) throw new Error(`Status ${response.status}`);
        const requests = await response.json();

        if (requests.length === 0) {
            wrap.innerHTML = `<div class="empty-state">No requests received yet.</div>`;
            return;
        }

        wrap.innerHTML = requests.map(r => `
            <div class="item-card">
                <div class="item-info">
                    <h4>${r.medicine_name} × ${r.quantity}</h4>
                    <p>From: ${r.from_name} (${r.from_pharmacist_id}) — ${r.created_at}</p>
                </div>
                <div class="item-actions">
                    ${r.status === "pending"
                        ? `<button class="btn btn-sm btn-approve" onclick="respondRequest(${r.id}, 'available')">Available</button>
                           <button class="btn btn-sm btn-reject" onclick="respondRequest(${r.id}, 'not_available')">Not Available</button>`
                        : statusBadge(r.status)}
                </div>
            </div>
        `).join("");
    } catch (err) {
        console.error("[request] error loading received:", err);
        wrap.innerHTML = `<div class="empty-state">Could not load received requests.</div>`;
    }
}

async function respondRequest(id, status) {
    try {
        const response = await apiFetch(`/requests/${id}/respond`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status })
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || "Failed to respond");
        }
        loadReceivedRequests();
    } catch (err) {
        console.error("[request] error responding:", err);
        showBanner("⚠️ " + err.message);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const user = await requireAuth();
    if (!user) return;

    if (user.role === "admin") {
        window.location.href = "admin-approvals.html";
        return;
    }

    setupRequestForm();
    const cities = await loadCities();
    renderCities(cities);
    loadSentRequests();
    loadReceivedRequests();
});
