// MCQ PRACTICE CABIN MODULE
import { state, API_BASE_URL, showToast, toggleAILoader } from "./app.js";

let mcqQuestions = [];
let userAnswers = []; // Size 10, stores selected indices (0-3) or null
let currentIndex = 0;
let mcqTimer = 0;
let timerInterval = null;
let currentSubject = "";
let currentDifficulty = "";

export function initMcq() {
    const startBtn = document.getElementById("btn-start-mcq");
    const prevBtn = document.getElementById("btn-mcq-prev");
    const nextBtn = document.getElementById("btn-mcq-next");
    const submitBtn = document.getElementById("btn-mcq-submit");
    const practiceAgainBtn = document.getElementById("btn-mcq-practice-again");
    const retryWrongBtn = document.getElementById("btn-mcq-retry-wrong");
    const reportBtn = document.getElementById("btn-mcq-report");

    if (startBtn) startBtn.addEventListener("click", () => startMcqPractice());
    if (prevBtn) prevBtn.addEventListener("click", () => navigateQuestion(-1));
    if (nextBtn) nextBtn.addEventListener("click", () => navigateQuestion(1));
    if (submitBtn) submitBtn.addEventListener("click", () => submitMcqQuiz());
    if (practiceAgainBtn) practiceAgainBtn.addEventListener("click", () => startMcqPractice());
    if (retryWrongBtn) retryWrongBtn.addEventListener("click", () => retryWrongQuestions());
    if (reportBtn) reportBtn.addEventListener("click", () => downloadPdfReport());
}

async function startMcqPractice() {
    currentSubject = document.getElementById("mcq-subject").value;
    currentDifficulty = document.getElementById("mcq-difficulty").value;

    // Reset state variables
    mcqQuestions = Array(10).fill(null);
    userAnswers = Array(10).fill(null);
    currentIndex = 0;
    mcqTimer = 0;

    // Reset layout containers
    document.getElementById("mcq-empty-state").style.display = "none";
    document.getElementById("mcq-session-area").style.display = "flex";
    document.getElementById("mcq-results-board").style.display = "none";
    document.getElementById("btn-mcq-submit").style.display = "none";
    document.getElementById("btn-mcq-next").style.display = "block";

    // Setup timer
    document.getElementById("mcq-timer-val").textContent = "00:00";
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        mcqTimer++;
        const mins = String(Math.floor(mcqTimer / 60)).padStart(2, "0");
        const secs = String(mcqTimer % 60).padStart(2, "0");
        document.getElementById("mcq-timer-val").textContent = `${mins}:${secs}`;
    }, 1000);

    // Fetch first question immediately
    await fetchMcqQuestion(0);
    renderQuestion(0);

    // Prefetch remaining questions asynchronously in the background
    prefetchRemainingQuestions();
}

async function fetchMcqQuestion(index) {
    if (mcqQuestions[index] !== null) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/generate-question`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subject: currentSubject, difficulty: currentDifficulty, mode: "mcq" })
        });
        const data = await res.json();
        if (data.success) {
            mcqQuestions[index] = data.question;
        }
    } catch (e) {
        console.error(`Failed to prefetch MCQ question ${index}`, e);
    }
}

async function prefetchRemainingQuestions() {
    for (let i = 1; i < 10; i++) {
        await fetchMcqQuestion(i);
    }
}

function renderQuestion(index) {
    const questionObj = mcqQuestions[index];
    if (!questionObj) {
        // If not loaded yet, render loader skeletal inside options list
        document.getElementById("mcq-question-text").textContent = "Recruiting questions from AI...";
        document.getElementById("mcq-options-list").innerHTML = `<div class="spinner" style="margin: 30px auto;"></div>`;
        return;
    }

    document.getElementById("mcq-current-num").textContent = index + 1;
    document.getElementById("mcq-question-text").textContent = questionObj.question;

    // Render options list
    const list = document.getElementById("mcq-options-list");
    list.innerHTML = "";
    
    questionObj.options.forEach((opt, optIndex) => {
        const optionEl = document.createElement("div");
        optionEl.className = "mcq-option";
        if (userAnswers[index] === optIndex) {
            optionEl.classList.add("selected");
        }

        const prefix = String.fromCharCode(65 + optIndex); // A, B, C, D
        optionEl.innerHTML = `
            <span class="mcq-option-prefix">${prefix}</span>
            <span class="mcq-option-text"></span>
        `;
        optionEl.querySelector(".mcq-option-text").textContent = opt;

        optionEl.addEventListener("click", () => {
            userAnswers[index] = optIndex;
            
            // Toggle active classes
            const allOpts = list.querySelectorAll(".mcq-option");
            allOpts.forEach(o => o.classList.remove("selected"));
            optionEl.classList.add("selected");
        });

        list.appendChild(optionEl);
    });

    // Update Progress bar width
    const pct = ((index + 1) / 10) * 100;
    document.getElementById("mcq-progress-fill").style.width = `${pct}%`;

    // Manage Next/Submit buttons visibility
    if (index === 9) {
        document.getElementById("btn-mcq-next").style.display = "none";
        document.getElementById("btn-mcq-submit").style.display = "block";
    } else {
        document.getElementById("btn-mcq-next").style.display = "block";
        document.getElementById("btn-mcq-submit").style.display = "none";
    }
}

async function navigateQuestion(direction) {
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex > 9) return;
    
    currentIndex = nextIndex;
    
    // Check if question is loaded, otherwise wait or fetch
    if (!mcqQuestions[currentIndex]) {
        renderQuestion(currentIndex);
        await fetchMcqQuestion(currentIndex);
    }
    renderQuestion(currentIndex);
}

async function submitMcqQuiz() {
    // Check if user missed answering any questions
    const unansweredCount = userAnswers.filter(a => a === null).length;
    if (unansweredCount > 0) {
        if (!confirm(`You have left ${unansweredCount} questions unanswered. Do you want to submit anyway?`)) {
            return;
        }
    }

    if (timerInterval) clearInterval(timerInterval);

    // Calculate score
    let score = 0;
    mcqQuestions.forEach((q, i) => {
        if (q && Number(userAnswers[i]) === Number(q.correctIndex)) {
            score++;
        }
    });

    // Check recruitment campaign round submission
    if (state.activeRecruitmentRound && state.activeRecruitmentRound.type === "mcq") {
        try {
            const recruitmentRes = await fetch(`${API_BASE_URL}/api/recruitment/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: state.currentUser.username,
                    roundId: state.activeRecruitmentRound.id,
                    score: score,
                    total: 10
                })
            });
            const recruitmentData = await recruitmentRes.json();
            if (recruitmentData.success) {
                if (recruitmentData.status === "Qualified") {
                    showToast("✅ Congratulations! You have qualified for the next round.", "success");
                } else if (recruitmentData.status === "Pending") {
                    showToast("⏳ Your result is under review.", "warning");
                } else {
                    showToast("❌ Unfortunately, you did not meet the minimum qualifying criteria.", "danger");
                }
            }
        } catch (err) {
            console.error("Recruitment round submission failed", err);
        }

        // Clear active round
        state.activeRecruitmentRound = null;

        // Redirect back to recruitment timeline
        setTimeout(() => {
            const myRoundsTab = document.querySelector('.sidebar-menu [data-target="view-recruitment-student"]');
            if (myRoundsTab) myRoundsTab.click();
        }, 1500);
        return;
    }

    // Save results to Express DB
    try {
        await fetch(`${API_BASE_URL}/api/results/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: state.currentUser.username,
                type: "MCQ",
                subject: currentSubject,
                score: score,
                total: 10
            })
        });
    } catch (e) {
        console.error("Results save failed", e);
    }

    // Toggle Summary Layout
    document.getElementById("mcq-session-area").style.display = "none";
    document.getElementById("mcq-results-board").style.display = "flex";

    // Set summary parameters
    document.getElementById("mcq-score-val").textContent = score;
    
    const mins = String(Math.floor(mcqTimer / 60)).padStart(2, "0");
    const secs = String(mcqTimer % 60).padStart(2, "0");
    document.getElementById("mcq-time-elapsed").textContent = `${mins}:${secs}`;

    let badgeText = "Keep Practicing!";
    if (score === 10) {
        badgeText = "Perfect score! 🏆";
    } else if (score >= 8) {
        badgeText = "Excellent! 🌟";
    } else if (score >= 5) {
        badgeText = "Good Job! 👍";
    }
    document.getElementById("mcq-badge-val").textContent = badgeText;

    // Fireworks
    if (score >= 8 && window.confetti) {
        confetti({ particleCount: 120, spread: 80 });
    }

    // Render detailed review card list
    renderReviewList();
}

function renderReviewList() {
    const list = document.getElementById("mcq-review-list");
    list.innerHTML = "";

    mcqQuestions.forEach((q, index) => {
        if (!q) return;
        const isCorrect = Number(userAnswers[index]) === Number(q.correctIndex);
        const card = document.createElement("div");
        card.className = `summary-card ${isCorrect ? 'card-correct' : 'card-incorrect'}`;

        let optionsHtml = "";
        q.options.forEach((opt, optIndex) => {
            const prefix = String.fromCharCode(65 + optIndex);
            let optClass = "neutral";
            let icon = "";

            if (Number(optIndex) === Number(q.correctIndex)) {
                optClass = "correct-answer";
                icon = " ✅";
            } else if (Number(optIndex) === Number(userAnswers[index])) {
                optClass = "selected-wrong";
                icon = " ❌";
            }

            optionsHtml += `
                <div class="summary-option-item ${optClass}">
                    <strong>${prefix}:</strong> ${opt} ${icon}
                </div>
            `;
        });

        card.innerHTML = `
            <div class="summary-card-header">
                <h3>Question ${index + 1}</h3>
                <span class="summary-card-badge">${isCorrect ? 'Correct' : 'Incorrect'}</span>
            </div>
            <div class="summary-question-text">${q.question}</div>
            <div class="summary-options">${optionsHtml}</div>
            <div class="summary-explanation">
                <strong>Explanation:</strong> ${q.explanation}
            </div>
        `;
        list.appendChild(card);
    });
}

function retryWrongQuestions() {
    const wrongIndices = [];
    mcqQuestions.forEach((q, i) => {
        if (q && Number(userAnswers[i]) !== Number(q.correctIndex)) {
            wrongIndices.push(i);
        }
    });

    if (wrongIndices.length === 0) {
        return showToast("No wrong questions to retry! You got a perfect score.", "success");
    }

    // Prepare wrong questions list
    const newQuestions = [];
    wrongIndices.forEach(idx => {
        newQuestions.push(mcqQuestions[idx]);
    });

    // Refill to 10 with new questions if needed, or just practice the wrong ones
    mcqQuestions = newQuestions;
    userAnswers = Array(newQuestions.length).fill(null);
    currentIndex = 0;
    mcqTimer = 0;

    // Reset layout containers
    document.getElementById("mcq-session-area").style.display = "flex";
    document.getElementById("mcq-results-board").style.display = "none";
    document.getElementById("btn-mcq-submit").style.display = "none";

    // Setup timer
    document.getElementById("mcq-timer-val").textContent = "00:00";
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        mcqTimer++;
        const mins = String(Math.floor(mcqTimer / 60)).padStart(2, "0");
        const secs = String(mcqTimer % 60).padStart(2, "0");
        document.getElementById("mcq-timer-val").textContent = `${mins}:${secs}`;
    }, 1000);

    renderQuestion(0);
}

function downloadPdfReport() {
    if (!window.jspdf) return showToast("PDF library load failed.", "danger");
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Set Theme colors
    doc.setTextColor(79, 70, 229);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("INTERVUE AI - ACCURACY REPORT", 20, 25);
    
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(1);
    doc.line(20, 32, 190, 32);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    
    // Details
    const username = state.currentUser ? state.currentUser.fullName : "Student";
    const scoreVal = document.getElementById("mcq-score-val").textContent;
    const timeVal = document.getElementById("mcq-time-elapsed").textContent;
    
    doc.text(`Candidate Name: ${username}`, 20, 45);
    doc.text(`Category Subject: ${currentSubject}`, 20, 53);
    doc.text(`Difficulty: ${currentDifficulty}`, 20, 61);
    doc.text(`Practice Accuracy Score: ${scoreVal} / 10`, 20, 69);
    doc.text(`Total Time Elapsed: ${timeVal}`, 20, 77);

    // List reviews
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Question Performance Summary:", 20, 95);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    let y = 105;
    
    mcqQuestions.forEach((q, idx) => {
        if (!q || y > 270) return; // Basic page boundary safety check
        const isCorrect = Number(userAnswers[idx]) === Number(q.correctIndex);
        const mark = isCorrect ? "[PASS]" : "[FAIL]";
        doc.text(`${idx + 1}. ${mark} ${q.question.slice(0, 70)}...`, 20, y);
        y += 10;
    });

    doc.save(`intervue_mcq_${currentSubject.toLowerCase()}_report.pdf`);
    showToast("PDF report downloaded successfully.", "success");
}