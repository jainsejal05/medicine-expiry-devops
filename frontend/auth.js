// ===== API base URL - your AWS backend =====
const API_BASE = "http://65.1.56.149:5000/api";

// ===== Token storage helpers =====
function getToken() {
    return sessionStorage.getItem("authToken");
}
function setToken(token) {
    sessionStorage.setItem("authToken", token);
}
function clearToken() {
    sessionStorage.removeItem("authToken");
}

// ===== Shared fetch wrapper - automatically attaches the Authorization header =====
async function apiFetch(path, options = {}) {
    const token = getToken();
    const headers = Object.assign({}, options.headers || {});
    if (token) headers["Authorization"] = "Bearer " + token;
    return fetch(`${API_BASE}${path}`, Object.assign({}, options, { headers }));
}

// ===== Guard: redirect to login if not authenticated. Call at the top of every protected page. =====
async function requireAuth() {
    const token = getToken();
    if (!token) { window.location.href = "login.html"; return null; }

    try {
        const response = await apiFetch("/auth/me");
        const data = await response.json();

        if (!data.authenticated) {
            clearToken();
            window.location.href = "login.html";
            return null;
        }

        const el = document.getElementById("navUsername");
        if (el) {
            const roleTag = data.user.role === "admin" ? " (Admin)" : (data.user.pharmacist_id ? ` (${data.user.pharmacist_id})` : "");
            el.textContent = data.user.username + roleTag;
        }

        return data.user;
    } catch (err) {
        console.error("[auth] could not verify session:", err);
        window.location.href = "login.html";
        return null;
    }
}

// ===== Logout handler =====
function setupLogout() {
    const btn = document.getElementById("logoutBtn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
        try { await apiFetch("/auth/logout", { method: "POST" }); } catch (err) { console.error(err); }
        clearToken();
        window.location.href = "login.html";
    });
}

// ===== Back button handler - goes to dashboard by default, or history back if specified =====
function setupBackButton() {
    const btn = document.getElementById("backBtn");
    if (!btn) return;
    btn.addEventListener("click", () => {
        window.location.href = "index.html";
    });
}

document.addEventListener("DOMContentLoaded", () => {
    setupLogout();
    setupBackButton();
});
