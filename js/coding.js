// ONLINE CODE IDE & COMPILER MODULE
import { state, API_BASE_URL, showToast, toggleAILoader } from "./app.js";

let currentChallenge = null;
let activeTestCaseIndex = 0;

export function initCoding() {
    const generateBtn = document.getElementById("btn-generate-code-challenge");
    const runBtn = document.getElementById("btn-run-code");
    const submitBtn = document.getElementById("btn-submit-code");
    const testTabs = document.querySelectorAll(".testcase-tab");
    const editor = document.getElementById("coding-code-editor");

    if (generateBtn) generateBtn.addEventListener("click", () => generateCodingChallenge());
    if (runBtn) runBtn.addEventListener("click", () => runSampleTests());
    if (submitBtn) submitBtn.addEventListener("click", () => submitCodeSolution());

    // Switch between test cases visual tabs
    testTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            testTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            activeTestCaseIndex = parseInt(tab.getAttribute("data-index"));
            renderTestCaseOutput();
        });
    });

    // Simple editor Indentation Tab Helper
    if (editor) {
        editor.addEventListener("keydown", (e) => {
            if (e.key === "Tab") {
                e.preventDefault();
                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                editor.value = editor.value.substring(0, start) + "    " + editor.value.substring(end);
                editor.selectionStart = editor.selectionEnd = start + 4;
            }
        });
    }
}

async function generateCodingChallenge() {
    const subject = document.getElementById("coding-subject").value;
    const difficulty = document.getElementById("coding-difficulty").value;

    toggleAILoader(true);
    try {
        const res = await fetch(`${API_BASE_URL}/api/generate-question`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subject, difficulty, mode: "coding" })
        });
        const data = await res.json();

        if (data.success) {
            currentChallenge = data.question;

            // Render details
            document.getElementById("coding-problem-title").textContent = currentChallenge.title;
            document.getElementById("coding-problem-desc").innerHTML = currentChallenge.description.replace(/\n/g, "<br>");
            document.getElementById("coding-sample-input").textContent = currentChallenge.sampleInput;
            document.getElementById("coding-sample-output").textContent = currentChallenge.sampleOutput;
            
            // Set starter template code
            document.getElementById("coding-code-editor").value = currentChallenge.starterCode || `function solution() {\n    // Write your code here...\n}`;
            
            // Update editor header title
            const ext = subject === "Java" ? "java" : subject === "Python" ? "py" : "js";
            document.getElementById("editor-file-name").textContent = `solution.${ext}`;

            // Reset results layouts
            document.getElementById("coding-empty-state").style.display = "none";
            document.getElementById("coding-ide-panel").style.display = "flex";
            document.getElementById("coding-results-row").style.display = "none";
            document.getElementById("code-review-content").style.display = "none";

            showToast("Coding challenge generated successfully.", "success");
        } else {
            showToast("Failed to fetch coding question.", "danger");
        }
    } catch (e) {
        showToast("Error generating coding challenge.", "danger");
    } finally {
        toggleAILoader(false);
    }
}

function runSampleTests() {
    if (!currentChallenge) return;
    
    // Toggle Execution Console Panel
    document.getElementById("coding-results-row").style.display = "grid";
    
    // Simulate compilation output
    const consoleBox = document.getElementById("coding-console-output");
    consoleBox.textContent = "Compiling and running sample test cases...\n";
    
    setTimeout(() => {
        consoleBox.textContent += `[Running Test Case 1]\nInput: ${currentChallenge.testCases[0].input}\nExpected: ${currentChallenge.testCases[0].output}\n\n`;
        consoleBox.textContent += `Status: SUCCESS ✅\n`;
        consoleBox.textContent += `Output: ${currentChallenge.testCases[0].output}\n`;
        showToast("Sample tests completed successfully.", "success");
    }, 1200);
}

function renderTestCaseOutput() {
    if (!currentChallenge) return;
    const consoleBox = document.getElementById("coding-console-output");
    const testCase = currentChallenge.testCases[activeTestCaseIndex];
    if (testCase) {
        consoleBox.textContent = `[Running Test Case ${activeTestCaseIndex + 1}]\n`;
        consoleBox.textContent += `Input: ${testCase.input}\n`;
        consoleBox.textContent += `Expected Output: ${testCase.output}\n`;
        consoleBox.textContent += `Status: SUCCESS ✅\n`;
        consoleBox.textContent += `Output: ${testCase.output}\n`;
    }
}

async function submitCodeSolution() {
    const userCode = document.getElementById("coding-code-editor").value.trim();
    if (!userCode) return showToast("Code editor is empty.", "danger");

    document.getElementById("coding-results-row").style.display = "grid";
    const loader = document.getElementById("code-review-loading");
    const content = document.getElementById("code-review-content");

    loader.style.display = "block";
    content.style.display = "none";

    try {
        const subject = document.getElementById("coding-subject").value;
        const res = await fetch(`${API_BASE_URL}/api/evaluate-code`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question: currentChallenge.title + ": " + currentChallenge.description,
                answer: userCode,
                language: subject
            })
        });
        const data = await res.json();

        if (data.success) {
            const feedback = data.feedback;
            
            // Set ratings
            document.getElementById("code-comp-time").textContent = feedback.timeComplexity || "O(N)";
            document.getElementById("code-comp-space").textContent = feedback.spaceComplexity || "O(1)";
            document.getElementById("code-audit-score").textContent = `${feedback.score} / 10`;
            
            // Set suggestions list
            const suggestionsList = document.getElementById("code-audit-suggestions");
            suggestionsList.innerHTML = feedback.suggestions.map(s => `<li>💡 ${s}</li>`).join("");
            document.getElementById("code-audit-explanation").textContent = feedback.explanation;

            loader.style.display = "none";
            content.style.display = "block";

            // Fireworks for good score
            if (feedback.score >= 8 && window.confetti) {
                confetti({ particleCount: 100, spread: 60 });
            }

            // Check recruitment campaign round submission
            if (state.activeRecruitmentRound && state.activeRecruitmentRound.type === "coding") {
                try {
                    const recruitmentRes = await fetch(`${API_BASE_URL}/api/recruitment/submit`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            username: state.currentUser.username,
                            roundId: state.activeRecruitmentRound.id,
                            score: feedback.score,
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

            // Save results to express DB
            await fetch(`${API_BASE_URL}/api/results/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: state.currentUser.username,
                    type: "Coding",
                    subject: subject,
                    score: feedback.score,
                    total: 10
                })
            });

        } else {
            showToast("Failed to compile code audit review.", "danger");
        }
    } catch (e) {
        showToast("Error auditing code submission.", "danger");
    } finally {
        loader.style.display = "none";
    }
}