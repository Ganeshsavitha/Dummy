// CAREER ROADMAP GENERATOR MODULE
import { state, API_BASE_URL, showToast, toggleAILoader } from "./app.js";

export function initRoadmap() {
    const generateBtn = document.getElementById("btn-generate-roadmap");
    if (generateBtn) {
        generateBtn.addEventListener("click", () => buildCareerRoadmap());
    }
}

async function buildCareerRoadmap() {
    const currentSkill = document.getElementById("roadmap-skill").value.trim();
    const targetCompany = document.getElementById("roadmap-company").value.trim();
    const targetRole = document.getElementById("roadmap-role").value.trim();
    const hours = document.getElementById("roadmap-hours").value;

    if (!currentSkill || !targetCompany || !targetRole) {
        return showToast("Please configure all study target options.", "danger");
    }

    toggleAILoader(true);
    try {
        const res = await fetch(`${API_BASE_URL}/api/generate-roadmap`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentSkill, targetCompany, targetRole, hours })
        });
        const data = await res.json();

        if (data.success) {
            const plan = data.roadmap;

            // Render details
            document.getElementById("roadmap-title").textContent = plan.title;
            document.getElementById("roadmap-overview").textContent = plan.overview;

            // Render weekly steps list
            const nodesContainer = document.getElementById("roadmap-weekly-nodes");
            nodesContainer.innerHTML = "";

            plan.weeklyPlan.forEach(week => {
                const node = document.createElement("div");
                node.className = "feature-card glass-panel";
                node.style.padding = "20px";
                node.style.position = "relative";
                node.style.borderLeft = "5px solid var(--primary)";

                let topicsHtml = week.topics.map(t => `<span class="badge-row" style="background: var(--primary-light); color: var(--primary); margin-right: 6px; margin-bottom: 6px;">${t}</span>`).join("");
                let tasksHtml = week.tasks.map(task => `<li>✔️ ${task}</li>`).join("");
                let resourcesHtml = week.resources.map(res => `<a href="#" style="color: var(--primary); font-size: 0.9em; text-decoration: none; margin-right: 12px;">🔗 ${res}</a>`).join("");

                node.innerHTML = `
                    <div style="font-weight: 700; font-size: 1.1em; color: var(--primary); margin-bottom: 8px;">Week ${week.week} Goal Schedule</div>
                    <div style="margin-bottom: 12px;">${topicsHtml}</div>
                    <ul style="margin-left: 20px; font-size: 0.9em; line-height: 1.5; color: var(--text-muted); margin-bottom: 12px;">
                        ${tasksHtml}
                    </ul>
                    <div>
                        <strong>Study Materials:</strong>
                        <div style="margin-top: 6px;">${resourcesHtml}</div>
                    </div>
                `;
                nodesContainer.appendChild(node);
            });

            // Render practice questions
            const questionsList = document.getElementById("roadmap-questions-list");
            questionsList.innerHTML = plan.practiceQuestions.map(q => `<li>⭐ ${q}</li>`).join("");

            // Toggle view state
            document.getElementById("roadmap-empty-state").style.display = "none";
            document.getElementById("roadmap-results").style.display = "block";

            showToast("Career roadmap created successfully.", "success");
        } else {
            showToast("Failed to fetch personalized roadmap data.", "danger");
        }
    } catch (e) {
        showToast("Error generating career guide.", "danger");
    } finally {
        toggleAILoader(false);
    }
}