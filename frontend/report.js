const STATUS_COLORS = {
    "Safe": "#22c55e",
    "Expiring Soon": "#eab308",
    "Urgent": "#f97316",
    "Expired": "#ef4444"
};

const CATEGORY_COLORS = ["#3b82f6", "#0f766e", "#8b5cf6", "#f97316", "#ec4899", "#14b8a6", "#a855f7", "#64748b"];

function renderStatCards(stats) {
    const wrap = document.getElementById("reportStats");
    const items = [
        { label: "Total Medicines", value: stats.total_medicines, cls: "stat-total" },
        { label: "Total Quantity", value: stats.total_quantity, cls: "stat-total" },
        { label: "Safe", value: stats.safe, cls: "stat-safe" },
        { label: "Expiring Soon", value: stats.expiring_soon, cls: "stat-soon" },
        { label: "Urgent", value: stats.urgent, cls: "stat-urgent" },
        { label: "Expired", value: stats.expired, cls: "stat-expired" },
    ];
    wrap.innerHTML = items.map(i => `
        <div class="stat-card ${i.cls}">
            <h3>${i.label}</h3>
            <p>${i.value}</p>
        </div>
    `).join("");
}

function renderCharts(stats) {
    // Status pie chart
    new Chart(document.getElementById("statusPieChart"), {
        type: "pie",
        data: {
            labels: ["Safe", "Expiring Soon", "Urgent", "Expired"],
            datasets: [{
                data: [stats.safe, stats.expiring_soon, stats.urgent, stats.expired],
                backgroundColor: ["Safe", "Expiring Soon", "Urgent", "Expired"].map(s => STATUS_COLORS[s])
            }]
        },
        options: {
            plugins: { legend: { position: "bottom", labels: { color: "#000000" } } }
        }
    });

    // Category pie chart
    const catLabels = Object.keys(stats.by_category || {});
    const catValues = catLabels.map(c => stats.by_category[c]);
    new Chart(document.getElementById("categoryPieChart"), {
        type: "pie",
        data: {
            labels: catLabels,
            datasets: [{ data: catValues, backgroundColor: CATEGORY_COLORS }]
        },
        options: {
            plugins: { legend: { position: "bottom", labels: { color: "#000000" } } }
        }
    });

    // Category bar chart
    new Chart(document.getElementById("categoryBarChart"), {
        type: "bar",
        data: {
            labels: catLabels,
            datasets: [{ label: "Medicines", data: catValues, backgroundColor: "#0f766e" }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: "#000000" } },
                y: { beginAtZero: true, ticks: { color: "#000000", stepSize: 1 } }
            }
        }
    });

    // Expired medicines - pie chart by category (only expired items)
    const expiredList = stats.expired_medicines || [];
    const expiredByCategory = {};
    expiredList.forEach(m => {
        const cat = m.category || "Other";
        expiredByCategory[cat] = (expiredByCategory[cat] || 0) + 1;
    });
    const expiredCatLabels = Object.keys(expiredByCategory);
    const expiredCatValues = expiredCatLabels.map(c => expiredByCategory[c]);

    if (expiredCatLabels.length > 0) {
        new Chart(document.getElementById("expiredPieChart"), {
            type: "pie",
            data: {
                labels: expiredCatLabels,
                datasets: [{ data: expiredCatValues, backgroundColor: CATEGORY_COLORS }]
            },
            options: {
                plugins: { legend: { position: "bottom", labels: { color: "#000000" } } }
            }
        });
    } else {
        document.getElementById("expiredPieChart").outerHTML = '<p style="color:#94a3b8; font-size:13px;">No expired medicines — nothing to chart 🎉</p>';
    }

    // Expired medicines - detail table (which exact medicines are expired)
    const tableWrap = document.getElementById("expiredTableWrap");
    if (expiredList.length === 0) {
        tableWrap.innerHTML = '<p style="color:#94a3b8; font-size:13px; padding:10px;">No expired medicines right now.</p>';
    } else {
        tableWrap.innerHTML = `
            <table>
                <thead><tr><th>Medicine</th><th>Category</th><th>Qty</th><th>Expired On</th></tr></thead>
                <tbody>
                    ${expiredList.map(m => `
                        <tr>
                            <td>${m.medicine_name}</td>
                            <td>${m.category}</td>
                            <td>${m.quantity}</td>
                            <td>${m.expiry_date}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    }
}

async function loadReport() {
    try {
        const response = await apiFetch("/dashboard");
        if (response.status === 401) { clearToken(); window.location.href = "login.html"; return; }
        if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
        const stats = await response.json();
        hideBanner();
        renderStatCards(stats);
        renderCharts(stats);
    } catch (err) {
        console.error("[report] error:", err);
        showBanner("⚠️ Could not load report data. (" + err.message + ")");
    }
}

function setupPdfDownload() {
    const btn = document.getElementById("downloadPdfBtn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "Generating PDF...";
        try {
            const element = document.getElementById("reportContent");
            const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#ffffff" });
            const imgData = canvas.toDataURL("image/png");

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF("p", "mm", "a4");
            const pageWidth = pdf.internal.pageSize.getWidth();
            const imgWidth = pageWidth - 20;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.setFontSize(16);
            pdf.text("Medicine Inventory Report", 10, 12);
            pdf.addImage(imgData, "PNG", 10, 18, imgWidth, imgHeight);
            pdf.save(`medicine-report-${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (err) {
            console.error("[report] PDF generation failed:", err);
            alert("Could not generate PDF: " + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = "⬇ Download as PDF";
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const user = await requireAuth();
    if (!user) return;
    setupPdfDownload();
    loadReport();
});
