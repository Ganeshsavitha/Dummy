// DASHBOARD & ANALYTICS MODULE
import { state, API_BASE_URL } from "./app.js";

let dashChartInstance = null;

export function initDashboard() {
    console.log("Dashboard analytics module initialized.");
}

export async function loadDashboardData() {
    if (!state.currentUser) return;
    
    // Set user profile greetings
    document.getElementById("dash-user-name").textContent = state.currentUser.fullName;
    document.getElementById("dash-streak").textContent = `${state.currentUser.streak} Days`;
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/results/history/${state.currentUser.username}`);
        const data = await res.json();
        
        if (data.success) {
            const history = data.history;
            const total = history.length;
            
            // 1. Calculate Score averages
            let scoreSum = 0;
            let mcqAccuracySum = 0;
            let mcqCount = 0;
            
            history.forEach(item => {
                const percent = (item.score / (item.total || 10)) * 100;
                scoreSum += (item.score / (item.total || 10)) * 10; // Normalize score to out of 10
                if (item.type === "MCQ") {
                    mcqAccuracySum += percent;
                    mcqCount += 1;
                }
            });
            
            const avgScore = total > 0 ? (scoreSum / total).toFixed(1) : "0.0";
            const accuracyVal = mcqCount > 0 ? Math.round(mcqAccuracySum / mcqCount) : 0;
            
            // Render to DOM
            document.getElementById("dash-completed-count").textContent = total;
            document.getElementById("dash-avg-score").textContent = avgScore;
            document.getElementById("dash-accuracy").textContent = `${accuracyVal}%`;
            
            // 2. Render activity history table
            const tbody = document.getElementById("dashboard-history-table");
            if (tbody) {
                tbody.innerHTML = "";
                if (total === 0) {
                    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-light);">No attempts found. Start a practice round!</td></tr>`;
                } else {
                    // Sort descending by date
                    const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
                    sortedHistory.slice(0, 5).forEach(item => {
                        const tr = document.createElement("tr");
                        const dateStr = new Date(item.date).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
                        const typeClass = item.type === "MCQ" ? "background: var(--primary-light); color: var(--primary);" : "background: #eff6ff; color: #1e3a8a;";
                        tr.innerHTML = `
                            <td><strong>${item.subject}</strong></td>
                            <td><span class="badge-row" style="${typeClass}">${item.type}</span></td>
                            <td><span class="badge-row" style="background: rgba(16, 185, 129, 0.1); color: var(--success); font-weight: 700;">${item.score}/${item.total || 10}</span></td>
                            <td style="color: var(--text-muted); font-size: 0.9em;">${dateStr}</td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            }
            
            // 3. Render Chart.js visual data
            renderChart(history);
        }
    } catch (error) {
        console.error("Failed to load dashboard statistics", error);
    }
}

function renderChart(history) {
    const ctx = document.getElementById("dashboard-chart");
    if (!ctx) return;
    
    // Destroy existing instance to avoid canvas reuse issues
    if (dashChartInstance) {
        dashChartInstance.destroy();
    }
    
    // Prepare data (last 7 attempts)
    const recent = [...history].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-7);
    
    const labels = recent.map((item, index) => {
        const d = new Date(item.date);
        return `${d.getMonth() + 1}/${d.getDate()} (${item.type.slice(0, 3)})`;
    });
    
    const dataPoints = recent.map(item => {
        // Normalize score to percentage
        return Math.round((item.score / (item.total || 10)) * 100);
    });

    // Default mock placeholders if history is empty
    const finalLabels = labels.length > 0 ? labels : ["Mock 1", "Mock 2", "Mock 3", "Mock 4"];
    const finalData = dataPoints.length > 0 ? dataPoints : [70, 85, 60, 90];

    const isDark = document.body.classList.contains("dark");
    const gridColor = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
    const textColor = isDark ? "#94a3b8" : "#475569";

    dashChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: finalLabels,
            datasets: [{
                label: "Performance (Accuracy %)",
                data: finalData,
                borderColor: "#4f46e5",
                backgroundColor: "rgba(79, 70, 229, 0.1)",
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: "#4f46e5"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textColor,
                        font: { family: "Inter" }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: textColor,
                        font: { family: "Inter" }
                    }
                }
            }
        }
    });
}