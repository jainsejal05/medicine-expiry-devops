async function loadStockByUser() {
    const tbody = document.getElementById("userStockTableBody");
    try {
        const response = await apiFetch("/admin/stock-by-user");
        if (response.status === 401) { clearToken(); window.location.href = "login.html"; return; }
        if (response.status === 403) {
            showBanner("⚠️ Admin access required for this page.");
            tbody.innerHTML = "";
            return;
        }
        if (!response.ok) throw new Error(`Server responded with status ${response.status}`);

        const users = await response.json();
        hideBanner();

        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="empty-state">No approved pharmacists yet</td></tr>`;
            return;
        }

        tbody.innerHTML = users.map(u => `
            <tr style="cursor:pointer;" onclick="window.location.href='category-medicines.html?owner_id=${u.user_id}&owner_label=${encodeURIComponent(u.full_name || u.username)}'">
                <td><strong>${u.pharmacist_id}</strong></td>
                <td>${u.full_name || u.username}</td>
                <td>${u.city || "-"}</td>
                <td>${u.total_medicines}</td>
                <td>${u.total_quantity}</td>
                <td>${u.safe}</td>
                <td>${u.expiring_soon}</td>
                <td>${u.urgent}</td>
                <td>${u.expired}</td>
            </tr>
        `).join("");
    } catch (err) {
        console.error("[admin-stock-by-user] error:", err);
        tbody.innerHTML = `<tr><td colspan="9" class="empty-state">Could not load data.</td></tr>`;
        showBanner("⚠️ " + err.message);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const user = await requireAuth();
    if (!user) return;
    if (user.role !== "admin") {
        alert("Admin access required.");
        window.location.href = "index.html";
        return;
    }
    loadStockByUser();
});
