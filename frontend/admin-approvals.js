async function loadPendingUsers() {
    const wrap = document.getElementById("pendingWrap");
    try {
        const response = await apiFetch("/admin/pending-users");
        if (response.status === 401) { clearToken(); window.location.href = "login.html"; return; }
        if (response.status === 403) {
            showBanner("⚠️ Admin access required for this page.");
            wrap.innerHTML = "";
            return;
        }
        if (!response.ok) throw new Error(`Server responded with status ${response.status}`);

        const users = await response.json();
        hideBanner();

        if (users.length === 0) {
            wrap.innerHTML = `<div class="empty-state">No pending registration requests right now.</div>`;
            return;
        }

        wrap.innerHTML = users.map(u => `
            <div class="item-card">
                <div class="item-info">
                    <h4>${u.full_name || u.username} <span class="badge-pending">Pending</span></h4>
                    <p>Username: ${u.username} · City: ${u.city || "-"} · Requested: ${u.created_at}</p>
                </div>
                <div class="item-actions">
                    <button class="btn btn-sm btn-approve" onclick="approveUser(${u.id})">Approve</button>
                    <button class="btn btn-sm btn-reject" onclick="rejectUser(${u.id})">Reject</button>
                </div>
            </div>
        `).join("");
    } catch (err) {
        console.error("[admin-approvals] error:", err);
        showBanner("⚠️ Could not load pending users. (" + err.message + ")");
    }
}

async function approveUser(id) {
    if (!confirm("Approve this pharmacist? A unique Pharmacist ID will be generated.")) return;
    try {
        const response = await apiFetch(`/admin/users/${id}/approve`, { method: "POST" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to approve");
        alert(`Approved! Assigned Pharmacist ID: ${data.pharmacist_id}`);
        loadPendingUsers();
    } catch (err) {
        console.error("[admin-approvals] error approving:", err);
        showBanner("⚠️ " + err.message);
    }
}

async function rejectUser(id) {
    if (!confirm("Reject this registration request?")) return;
    try {
        const response = await apiFetch(`/admin/users/${id}/reject`, { method: "POST" });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || "Failed to reject");
        }
        loadPendingUsers();
    } catch (err) {
        console.error("[admin-approvals] error rejecting:", err);
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
    loadPendingUsers();
});
