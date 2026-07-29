// ATS RESUME PARSER & ANALYSIS MODULE
import { state, API_BASE_URL, showToast, toggleAILoader } from "./app.js";

export function initResume() {
    const dropZone = document.getElementById("resume-drop-zone");
    const fileInput = document.getElementById("resume-file-input");
    const scanBtn = document.getElementById("btn-scan-resume");

    if (dropZone) {
        dropZone.addEventListener("click", () => fileInput.click());
        
        // Dragover/leave visual effect indicators
        dropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropZone.style.borderColor = "var(--primary)";
            dropZone.style.background = "var(--primary-light)";
        });
        dropZone.addEventListener("dragleave", () => {
            dropZone.style.borderColor = "var(--border-main)";
            dropZone.style.background = "var(--bg-glass)";
        });
        dropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropZone.style.borderColor = "var(--border-main)";
            dropZone.style.background = "var(--bg-glass)";
            
            const file = e.dataTransfer.files[0];
            if (file) handleResumeFile(file);
        });
    }

    if (fileInput) {
        fileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) handleResumeFile(file);
        });
    }

    if (scanBtn) {
        scanBtn.addEventListener("click", () => runResumeScan());
    }
}

function handleResumeFile(file) {
    if (file.type !== "text/plain" && !file.name.endsWith(".txt")) {
        return showToast("Only plain text (.txt) files are supported for instant parsing in this demo.", "danger");
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const textarea = document.getElementById("resume-text-input");
        if (textarea) {
            textarea.value = e.target.result;
            showToast(`Loaded ${file.name} successfully. Ready to scan!`, "success");
        }
    };
    reader.readAsText(file);
}

async function runResumeScan() {
    const textarea = document.getElementById("resume-text-input");
    let text = textarea.value.trim();
    
    // Default fallback text if empty to make placements demonstrations functional out of the box
    if (!text) {
        text = `Jane Doe
        Email: jane.doe@example.com
        Skills: JavaScript, HTML, CSS, React
        Experience: Junior Developer at Web Solutions (1 Year). Built responsive landing pages, worked with REST APIs.`;
        textarea.value = text;
        showToast("No resume text entered. Using sample candidate profile context.", "info");
    }

    toggleAILoader(true);
    try {
        const res = await fetch(`${API_BASE_URL}/api/analyze-resume`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resumeText: text })
        });
        const data = await res.json();

        if (data.success) {
            const audit = data.analysis;

            // Render stats
            document.getElementById("resume-ats-score").textContent = `${audit.atsScore}%`;
            
            // Render detected skills (badges)
            const detected = document.getElementById("resume-detected-skills");
            detected.innerHTML = audit.detectedSkills.map(s => `
                <span class="badge-row" style="background: var(--primary-light); color: var(--primary); margin-right: 6px; margin-bottom: 6px;">${s}</span>
            `).join("");

            // Render missing skills (badges)
            const missing = document.getElementById("resume-missing-skills");
            missing.innerHTML = audit.missingSkills.map(s => `
                <span class="badge-row" style="background: rgba(239, 68, 68, 0.1); color: var(--danger); margin-right: 6px; margin-bottom: 6px;">${s}</span>
            `).join("");

            // Render formatting and grammar checklists
            document.getElementById("resume-feedback-formatting").innerHTML = `
                <strong>Formatting feedback:</strong> ${audit.formattingFeedback}<br>
                <strong style="margin-top: 6px; display:inline-block;">Grammar check:</strong> ${audit.grammarFeedback}<br><br>
                <strong>Quick Tips:</strong><br>
                ${audit.suggestions.map(s => `• ${s}`).join("<br>")}
            `;

            // Render customized interview preparation queries
            const questionsList = document.getElementById("resume-feedback-questions");
            questionsList.innerHTML = audit.resumeQuestions.map(q => `<li>❓ ${q}</li>`).join("");

            // Show results pane
            document.getElementById("resume-empty-state").style.display = "none";
            document.getElementById("resume-analysis-results").style.display = "block";
            
            showToast("Resume scanned and verified successfully.", "success");
        } else {
            showToast("Failed to fetch resume audit analysis.", "danger");
        }
    } catch (e) {
        showToast("Error processing resume document.", "danger");
    } finally {
        toggleAILoader(false);
    }
}