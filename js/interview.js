// AI MOCK INTERVIEW CABIN MODULE
import { state, API_BASE_URL, showToast, toggleAILoader } from "./app.js";

let sessionTimer = 0;
let timerInterval = null;
let currentQuestionText = "";
let currentType = "normal"; // "normal" or "hr"
let currentSubject = "";

// Web Speech Synthesis (Text to Speech)
function speakText(text) {
    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel(); // Cancel any ongoing speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    } else {
        showToast("Voice reading is not supported in this browser.", "info");
    }
}

// Web Speech Recognition (Speech to Text)
let recognition = null;
let isRecording = false;

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onstart = () => {
            isRecording = true;
            const icon = document.getElementById("voice-input-icon");
            if (icon) {
                icon.setAttribute("data-feather", "circle");
                icon.style.color = "var(--danger)";
                if (window.feather) feather.replace();
            }
            showToast("Recording speech... Speak clearly into your mic.", "info");
        };

        recognition.onresult = (event) => {
            const resultText = event.results[0][0].transcript;
            const textarea = document.getElementById("interview-answer-input");
            if (textarea) {
                textarea.value += (textarea.value ? " " : "") + resultText;
            }
            showToast("Speech captured successfully.", "success");
        };

        recognition.onerror = () => {
            showToast("Speech recognition error occurred.", "danger");
            stopRecordingState();
        };

        recognition.onend = () => {
            stopRecordingState();
        };
    }
}

function stopRecordingState() {
    isRecording = false;
    const icon = document.getElementById("voice-input-icon");
    if (icon) {
        icon.setAttribute("data-feather", "mic");
        icon.style.color = "white";
        if (window.feather) feather.replace();
    }
}

export function initInterview() {
    initSpeechRecognition();
    
    const startBtn = document.getElementById("btn-start-session");
    const submitBtn = document.getElementById("btn-submit-answer");
    const nextBtn = document.getElementById("btn-next-question");
    const skipBtn = document.getElementById("btn-skip-question");
    const bookmarkBtn = document.getElementById("btn-bookmark-question");
    const speakBtn = document.getElementById("btn-speak-question");
    const micBtn = document.getElementById("btn-voice-input");

    if (startBtn) {
        startBtn.addEventListener("click", () => startInterviewSession());
    }
    if (submitBtn) {
        submitBtn.addEventListener("click", () => submitInterviewAnswer());
    }
    if (nextBtn) {
        nextBtn.addEventListener("click", () => fetchNextQuestion());
    }
    if (skipBtn) {
        skipBtn.addEventListener("click", () => fetchNextQuestion());
    }
    if (bookmarkBtn) {
        bookmarkBtn.addEventListener("click", () => saveBookmark());
    }
    if (speakBtn) {
        speakBtn.addEventListener("click", () => speakText(currentQuestionText));
    }
    
    if (micBtn) {
        micBtn.addEventListener("click", () => {
            if (!recognition) {
                return showToast("Speech recognition is not supported in this browser.", "danger");
            }
            if (isRecording) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });
    }
}

async function startInterviewSession() {
    const subject = document.getElementById("interview-subject").value;
    const difficulty = document.getElementById("interview-difficulty").value;
    const role = document.getElementById("interview-role").value.trim();
    const type = document.getElementById("interview-type").value;

    currentType = type;
    currentSubject = subject;

    // Reset layouts
    document.getElementById("interview-empty-state").style.display = "none";
    document.getElementById("interview-chat-area").style.display = "flex";
    document.getElementById("interview-feedback-box").style.display = "none";
    document.getElementById("btn-submit-answer").style.display = "block";
    document.getElementById("interview-answer-input").value = "";

    // Reset and start timer
    sessionTimer = 0;
    document.getElementById("interview-timer-val").textContent = "00:00";
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        sessionTimer++;
        const mins = String(Math.floor(sessionTimer / 60)).padStart(2, "0");
        const secs = String(sessionTimer % 60).padStart(2, "0");
        document.getElementById("interview-timer-val").textContent = `${mins}:${secs}`;
    }, 1000);

    await getNextAIQuestion(subject, difficulty, role, type);
}

async function getNextAIQuestion(subject, difficulty, role, type) {
    toggleAILoader(true);
    try {
        const res = await fetch(`${API_BASE_URL}/api/generate-question`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subject, difficulty, role, mode: type })
        });
        const data = await res.json();
        
        if (data.success) {
            currentQuestionText = data.question;
            document.getElementById("interview-question-text").textContent = currentQuestionText;
            
            // Read question aloud dynamically
            speakText(currentQuestionText);
        } else {
            showToast("Failed to fetch next question.", "danger");
        }
    } catch (e) {
        showToast("Error communicating with server.", "danger");
    } finally {
        toggleAILoader(false);
    }
}

async function submitInterviewAnswer() {
    const textarea = document.getElementById("interview-answer-input");
    const answer = textarea.value.trim();
    if (!answer) return showToast("Type your answer or speak before submitting.", "danger");

    toggleAILoader(true);
    try {
        const res = await fetch(`${API_BASE_URL}/api/evaluate-answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: currentQuestionText, answer: answer, type: currentType })
        });
        const data = await res.json();

        if (data.success) {
            const feedback = data.feedback;
            
            // Render evaluation metrics
            document.getElementById("interview-score-badge").textContent = `Score: ${feedback.score} / 10`;
            
            const strengthsList = document.getElementById("interview-feedback-strengths");
            const improvementsList = document.getElementById("interview-feedback-improvements");
            
            strengthsList.innerHTML = feedback.strengths.map(s => `<li>✅ ${s}</li>`).join("");
            improvementsList.innerHTML = feedback.improvements.map(i => `<li>💡 ${i}</li>`).join("");
            document.getElementById("interview-feedback-model").textContent = feedback.modelAnswer;

            // Render HR ratings if HR Focus
            const hrContainer = document.getElementById("hr-ratings-container");
            if (currentType === "hr") {
                hrContainer.style.display = "grid";
                document.getElementById("hr-rating-confidence").textContent = feedback.confidenceRating || "High";
                document.getElementById("hr-rating-grammar").textContent = feedback.grammarRating || "Excellent";
                document.getElementById("hr-rating-comm").textContent = feedback.communicationRating || "Clear";
            } else {
                hrContainer.style.display = "none";
            }

            document.getElementById("interview-feedback-box").style.display = "block";
            document.getElementById("btn-submit-answer").style.display = "none";

            // Fireworks confetti for high scores!
            if (feedback.score >= 8 && window.confetti) {
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            }

            // Check recruitment campaign round submission
            if (state.activeRecruitmentRound && state.activeRecruitmentRound.type === "hr") {
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
                
                // Stop session timer
                if (timerInterval) clearInterval(timerInterval);

                // Redirect back to recruitment timeline
                setTimeout(() => {
                    const myRoundsTab = document.querySelector('.sidebar-menu [data-target="view-recruitment-student"]');
                    if (myRoundsTab) myRoundsTab.click();
                }, 1500);
                return;
            }

            // Save result to server database
            await fetch(`${API_BASE_URL}/api/results/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: state.currentUser.username,
                    type: currentType === "hr" ? "HR" : "Technical",
                    subject: currentSubject,
                    score: feedback.score,
                    total: 10
                })
            });

        } else {
            showToast("Failed to compile evaluation.", "danger");
        }
    } catch (err) {
        showToast("Error evaluating answer.", "danger");
    } finally {
        toggleAILoader(false);
    }
}

async function fetchNextQuestion() {
    document.getElementById("interview-feedback-box").style.display = "none";
    document.getElementById("btn-submit-answer").style.display = "block";
    document.getElementById("interview-answer-input").value = "";
    
    const difficulty = document.getElementById("interview-difficulty").value;
    const role = document.getElementById("interview-role").value.trim();

    await getNextAIQuestion(currentSubject, difficulty, role, currentType);
}

async function saveBookmark() {
    if (!currentQuestionText) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/bookmarks/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: state.currentUser.username,
                question: currentQuestionText,
                subject: currentSubject,
                type: currentType === "hr" ? "HR" : "Technical"
            })
        });
        const data = await res.json();
        if (data.success) {
            showToast("Question bookmarked successfully!", "success");
        }
    } catch (e) {
        showToast("Failed to bookmark question.", "danger");
    }
}