const ALL_CATEGORIES = ["Tablet", "Syrup", "Capsule", "Injection", "Cream", "Drops", "Ointment", "Other"];

async function loadCategoryCounts() {
    try {
        const response = await apiFetch("/dashboard");
        if (response.status === 401) { clearToken(); window.location.href = "login.html"; return {}; }
        if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
        const stats = await response.json();
        return stats.by_category || {};
    } catch (err) {
        console.error("[view-medicines] error loading counts:", err);
        showBanner("⚠️ Could not load category data. (" + err.message + ")");
        return {};
    }
}

function renderCategoryGrid(counts) {
    const wrap = document.getElementById("categoryGrid");
    wrap.innerHTML = "";
    ALL_CATEGORIES.forEach(cat => {
        const count = counts[cat] || 0;
        const card = document.createElement("div");
        card.className = "category-card";
        card.innerHTML = `
            <div class="category-icon">${CATEGORY_ICONS[cat] || "📦"}</div>
            <div class="category-name">${cat}</div>
            <div class="category-count">${count} item${count === 1 ? "" : "s"}</div>
        `;
        card.addEventListener("click", () => {
            window.location.href = `category-medicines.html?category=${encodeURIComponent(cat)}`;
        });
        wrap.appendChild(card);
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const user = await requireAuth();
    if (!user) return;
    const counts = await loadCategoryCounts();
    renderCategoryGrid(counts);
});
