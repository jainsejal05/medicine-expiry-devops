// API_BASE, apiFetch, getToken, setToken, clearToken all come from auth.js, loaded before this file

function showBanner(message) {
    const banner = document.getElementById("banner");
    if (!banner) return;
    banner.textContent = message;
    banner.style.display = "block";
}

async function redirectIfLoggedIn() {
    const token = getToken();
    if (!token) return;
    try {
        const response = await apiFetch("/auth/me");
        const data = await response.json();
        if (data.authenticated) window.location.href = "index.html";
    } catch (err) {
        console.error("[auth] session check failed:", err);
    }
}
redirectIfLoggedIn();

function setupLoginForm() {
    const form = document.getElementById("loginForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;

        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Login failed");

            setToken(data.token);
            window.location.href = "index.html";
        } catch (err) {
            console.error("[login] error:", err);
            showBanner("⚠️ " + err.message);
        }
    });
}

function setupRegisterForm() {
    const form = document.getElementById("registerForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const full_name = document.getElementById("fullName").value.trim();
        const username = document.getElementById("username").value.trim();
        const city = document.getElementById("city").value;
        const password = document.getElementById("password").value;

        try {
            const response = await fetch(`${API_BASE}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ full_name, username, city, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Registration failed");

            // Do NOT auto-login - account is pending admin approval
            alert("Registration submitted! Your account is pending admin approval. You'll be able to log in once approved.");
            window.location.href = "login.html";
        } catch (err) {
            console.error("[register] error:", err);
            showBanner("⚠️ " + err.message);
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    setupLoginForm();
    setupRegisterForm();
});
