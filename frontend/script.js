// API_BASE, requireAuth(), apiFetch() come from auth.js, loaded before this file

const CATEGORY_ICONS = {
    "Tablet": "💊", "Syrup": "🍯", "Capsule": "💊", "Injection": "💉",
    "Cream": "🧴", "Drops": "💧", "Ointment": "🧪", "Other": "📦"
};

function showBanner(message, type = "error") {
    const banner = document.getElementById("banner");
    if (!banner) return;
    banner.textContent = message;
    banner.className = "banner banner-" + type;
    banner.style.display = "block";
}
function hideBanner() {
    const banner = document.getElementById("banner");
    if (banner) banner.style.display = "none";
}

function goToStatus(status) {
    window.location.href = `status-medicines.html?status=${encodeURIComponent(status)}`;
}

async function loadDashboard(user) {
    const totalEl = document.getElementById("totalMedicines");
    if (!totalEl) return;

    // Show pharmacist ID tag (non-admin only)
    const idWrap = document.getElementById("pharmacistIdWrap");
    if (idWrap && user && user.role !== "admin" && user.pharmacist_id) {
        idWrap.innerHTML = `<div class="pharmacist-id-tag">Your Pharmacist ID: <strong>${user.pharmacist_id}</strong> — share this so others can send you stock requests</div>`;
    }

    // Route the "Request" action card differently depending on role:
    // Admin -> registration approval requests. Pharmacist -> stock requests between pharmacists.
    const requestCard = document.getElementById("requestActionCard");
    const requestLabel = document.getElementById("requestActionLabel");
    const requestDesc = document.getElementById("requestActionDesc");
    if (requestCard && user) {
        if (user.role === "admin") {
            requestCard.setAttribute("onclick", "window.location.href='admin-approvals.html'");
            if (requestLabel) requestLabel.textContent = "Registration Requests";
            if (requestDesc) requestDesc.textContent = "Approve or reject new pharmacists";
        } else {
            requestCard.setAttribute("onclick", "window.location.href='request.html'");
            if (requestLabel) requestLabel.textContent = "Request";
            if (requestDesc) requestDesc.textContent = "Request stock from other pharmacists";
        }
    }

    // Show "Stock by User" card for admin only
    const stockByUserCard = document.getElementById("stockByUserCard");
    if (stockByUserCard && user && user.role === "admin") {
        stockByUserCard.style.display = "block";
    }

    // Admin: show pending-approvals banner if any
    if (user && user.role === "admin") {
        try {
            const pendingResp = await apiFetch("/admin/pending-users");
            if (pendingResp.ok) {
                const pending = await pendingResp.json();
                if (pending.length > 0) {
                    document.getElementById("pendingAlertText").textContent =
                        `⏳ ${pending.length} pharmacist registration${pending.length === 1 ? "" : "s"} awaiting your approval.`;
                    document.getElementById("pendingAlert").style.display = "flex";
                }
            }
        } catch (err) {
            console.error("[dashboard] could not check pending users:", err);
        }
    }

    try {
        const response = await apiFetch("/dashboard");
        if (response.status === 401) { clearToken(); window.location.href = "login.html"; return; }
        if (!response.ok) throw new Error(`Server responded with status ${response.status}`);

        const stats = await response.json();
        hideBanner();

        document.getElementById("totalMedicines").innerText = stats.total_medicines;
        document.getElementById("totalQuantity").innerText = stats.total_quantity;
        document.getElementById("safeCount").innerText = stats.safe;
        document.getElementById("soonCount").innerText = stats.expiring_soon;
        document.getElementById("urgentCount").innerText = stats.urgent;
        document.getElementById("expiredCount").innerText = stats.expired;
    } catch (err) {
        console.error("[dashboard] error:", err);
        showBanner("⚠️ Could not load dashboard data. Is the Flask server running at " + API_BASE + "? (" + err.message + ")");
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const user = await requireAuth();
    if (user) loadDashboard(user);
});
