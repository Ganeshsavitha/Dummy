// CLIENT-SIDE RECRUITMENT PROGRESSION ENGINE
import { state, API_BASE_URL, showToast, toggleAILoader } from "./app.js";

// Global cache for recruitment data
let recruitmentRoundsList = [];
let candidatesList = [];
let recruitmentSettingsObj = { autoShortlist: false };
let funnelChartInstance = null;

export function initRecruitment() {
    console.log("Recruitment module initialized.");

    // HR Controls Event Binding
    const autoShortlistToggle = document.getElementById("hr-auto-shortlist-toggle");
    if (autoShortlistToggle) {
        autoShortlistToggle.addEventListener("change", (e) => {
            toggleSettings(e.target.checked);
        });
    }

    const addRoundSubmit = document.getElementById("btn-add-round-submit");
    if (addRoundSubmit) {
        addRoundSubmit.addEventListener("click", () => saveRecruitmentRound());
    }

    const downloadCsvBtn = document.getElementById("btn-download-csv");
    if (downloadCsvBtn) {
        downloadCsvBtn.addEventListener("click", () => downloadExcelReport());
    }

    const downloadPdfBtn = document.getElementById("btn-download-pdf");
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener("click", () => downloadPdfReport());
    }

    // HR Round stats selector binding
    const statsRoundSelector = document.getElementById("hr-stats-round-selector");
    if (statsRoundSelector) {
        statsRoundSelector.addEventListener("change", () => {
            renderRoundShortlists(statsRoundSelector.value);
        });
    }
}

// ==========================================
// 1. STUDENT TIMELINE & PROGRESSION
// ==========================================
export async function loadStudentRecruitment() {
    if (!state.currentUser) return;
    toggleAILoader(true);

    try {
        // Fetch rounds and candidates list
        const [roundsRes, candidatesRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/recruitment/rounds`).then(r => r.json()),
            fetch(`${API_BASE_URL}/api/recruitment/candidates`).then(r => r.json())
        ]);

        if (!roundsRes.success || !candidatesRes.success) {
            showToast("Failed to retrieve recruitment timeline.", "danger");
            return;
        }

        const rounds = roundsRes.rounds;
        const candidateInfo = candidatesRes.candidates.find(c => c.username === state.currentUser.username);
        const userStatuses = candidateInfo ? candidateInfo.roundsStatus : [];

        // Determine current status & lock state
        let activeIndex = 0;
        let isDisqualified = false;
        let pendingReview = false;

        // Check each round logic
        for (let i = 0; i < rounds.length; i++) {
            const statusEntry = userStatuses.find(s => s.roundId === rounds[i].id);
            if (statusEntry) {
                if (statusEntry.status === "Not Qualified") {
                    isDisqualified = true;
                    activeIndex = i;
                    break;
                } else if (statusEntry.status === "Pending") {
                    pendingReview = true;
                    activeIndex = i;
                    break;
                } else if (statusEntry.status === "Qualified") {
                    activeIndex = i + 1; // Unlocks next
                }
            } else {
                activeIndex = i;
                break;
            }
        }

        // 1. Render Top Status Banner
        const bannerContainer = document.getElementById("student-recruitment-banner");
        bannerContainer.innerHTML = "";
        bannerContainer.style.display = "none";

        if (isDisqualified) {
            bannerContainer.style.display = "block";
            bannerContainer.className = "recruitment-banner banner-danger glass-panel";
            bannerContainer.innerHTML = `
                <div class="banner-icon"><i data-feather="x-circle"></i></div>
                <div class="banner-text">
                    <h4>❌ Unfortunately, you did not meet the minimum qualifying criteria.</h4>
                    <p>Your progression has been locked. You will no longer receive access to subsequent recruitment rounds.</p>
                </div>
            `;
        } else if (pendingReview) {
            bannerContainer.style.display = "block";
            bannerContainer.className = "recruitment-banner banner-warning glass-panel";
            bannerContainer.innerHTML = `
                <div class="banner-icon"><i data-feather="clock"></i></div>
                <div class="banner-text">
                    <h4>⏳ Your result is under review.</h4>
                    <p>Company HR is evaluating your assessment. The next round will unlock once your qualification is published.</p>
                </div>
            `;
        } else if (activeIndex >= rounds.length) {
            bannerContainer.style.display = "block";
            bannerContainer.className = "recruitment-banner banner-success glass-panel";
            bannerContainer.innerHTML = `
                <div class="banner-icon"><i data-feather="award"></i></div>
                <div class="banner-text">
                    <h4>🎉 Congratulations! You have qualified all recruitment rounds.</h4>
                    <p>The company will declare final placements soon. You can download your report in the stats dashboard.</p>
                </div>
            `;
        } else if (activeIndex > 0) {
            bannerContainer.style.display = "block";
            bannerContainer.className = "recruitment-banner banner-success glass-panel";
            bannerContainer.innerHTML = `
                <div class="banner-icon"><i data-feather="check-circle"></i></div>
                <div class="banner-text">
                    <h4>✅ Congratulations! You have qualified for Round ${activeIndex + 1}.</h4>
                    <p>Prepare yourself and click "Start Round" when ready to proceed.</p>
                </div>
            `;
        }

        if (window.feather) feather.replace();

        // 2. Render Timeline Stepper
        const timelineList = document.getElementById("student-rounds-timeline");
        timelineList.innerHTML = "";

        rounds.forEach((round, index) => {
            const statusEntry = userStatuses.find(s => s.roundId === round.id);
            const isCompleted = !!statusEntry;
            
            let statusText = "Locked";
            let badgeClass = "badge-locked";
            let isLocked = index > activeIndex || isDisqualified;
            
            if (isCompleted) {
                statusText = statusEntry.status;
                badgeClass = statusText === "Qualified" ? "badge-success" : statusText === "Pending" ? "badge-warning" : "badge-danger";
            } else if (index === activeIndex && !isDisqualified && !pendingReview) {
                statusText = "Active";
                badgeClass = "badge-primary";
                isLocked = false;
            }

            const itemCard = document.createElement("div");
            itemCard.className = `timeline-card glass-panel ${isLocked ? "card-locked" : ""} ${index === activeIndex && !isLocked && !isCompleted ? "card-active" : ""}`;
            
            let actionBtnHtml = "";
            if (index === activeIndex && !isLocked && !isCompleted) {
                actionBtnHtml = `
                    <button class="btn-primary btn-start-round-action" data-id="${round.id}" data-type="${round.type}" data-subject="${round.subject}">
                        <i data-feather="play"></i><span>Start Round</span>
                    </button>
                `;
            } else if (isCompleted) {
                actionBtnHtml = `
                    <div class="completion-details">
                        <span>Score: <strong>${statusEntry.score}/10</strong> (${statusEntry.percentage}%)</span>
                    </div>
                `;
            }

            itemCard.innerHTML = `
                <div class="card-timeline-node">${index + 1}</div>
                <div class="card-main-info">
                    <div style="display:flex; align-items:center; gap: 10px; margin-bottom: 6px;">
                        <h3 class="round-title">${round.name}</h3>
                        <span class="badge-status ${badgeClass}">${statusText}</span>
                    </div>
                    <p class="round-meta">
                        <span>Type: <strong>${round.type.toUpperCase()} (${round.subject})</strong></span> |
                        <span>Passing Threshold: <strong>${round.passingPercentage}%</strong></span> |
                        <span>Time Limit: <strong>${round.timeLimit} Mins</strong></span>
                    </p>
                    <p class="round-details-notes" style="font-size:0.85em; color:var(--text-light); margin-top:4px;">
                        Weightage: ${round.weightage}% • Negative marking: ${round.negativeMarking ? "Enabled" : "Disabled"}
                    </p>
                </div>
                <div class="card-action-area">
                    ${actionBtnHtml}
                </div>
            `;
            timelineList.appendChild(itemCard);
        });

        if (window.feather) feather.replace();

        // Bind Timeline Action Buttons
        const startActionBtns = document.querySelectorAll(".btn-start-round-action");
        startActionBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const roundId = btn.getAttribute("data-id");
                const roundType = btn.getAttribute("data-type");
                const roundSubject = btn.getAttribute("data-subject");
                
                startCandidateRound(roundId, roundType, roundSubject);
            });
        });

    } catch (err) {
        console.error("Student recruitment timeline loading error", err);
        showToast("Error retrieving student round states.", "danger");
    } finally {
        toggleAILoader(false);
    }
}

// Redirect and trigger appropriate round practice module
function startCandidateRound(roundId, type, subject) {
    // Set global recruitment flow flags
    state.activeRecruitmentRound = { id: roundId, type, subject };
    
    showToast(`Initializing recruitment assessment for ${subject}...`, "success");

    // Route to appropriate view screen
    if (type === "mcq") {
        const viewItem = document.querySelector('.sidebar-menu [data-target="view-mcq"]');
        if (viewItem) viewItem.click();
        
        // Auto configure and trigger test start if dropdown is ready
        setTimeout(() => {
            const subjSelect = document.getElementById("mcq-subject");
            if (subjSelect) {
                // Find matching options or append if not present
                let found = false;
                for (let o of subjSelect.options) {
                    if (o.value.toLowerCase() === subject.toLowerCase()) {
                        subjSelect.value = o.value;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    const opt = document.createElement("option");
                    opt.value = subject;
                    opt.textContent = subject;
                    subjSelect.appendChild(opt);
                    subjSelect.value = subject;
                }
            }
            const startBtn = document.getElementById("btn-start-mcq");
            if (startBtn) startBtn.click();
        }, 300);
    } else if (type === "coding") {
        const viewItem = document.querySelector('.sidebar-menu [data-target="view-coding"]');
        if (viewItem) viewItem.click();
        
        setTimeout(() => {
            const subjSelect = document.getElementById("coding-subject");
            if (subjSelect) {
                let found = false;
                for (let o of subjSelect.options) {
                    if (o.value.toLowerCase() === subject.toLowerCase()) {
                        subjSelect.value = o.value;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    const opt = document.createElement("option");
                    opt.value = subject;
                    opt.textContent = subject;
                    subjSelect.appendChild(opt);
                    subjSelect.value = subject;
                }
            }
            const generateBtn = document.getElementById("btn-generate-code-challenge");
            if (generateBtn) generateBtn.click();
        }, 300);
    } else if (type === "hr") {
        const viewItem = document.querySelector('.sidebar-menu [data-target="view-interview"]');
        if (viewItem) viewItem.click();
        
        setTimeout(() => {
            const typeSelect = document.getElementById("interview-type");
            if (typeSelect) typeSelect.value = "hr";
            
            const startBtn = document.getElementById("btn-start-session");
            if (startBtn) startBtn.click();
        }, 300);
    }
}

// ==========================================
// 2. COMPANY HR DASHBOARD STATISTICS
// ==========================================
export async function loadHrRecruitment() {
    toggleAILoader(true);

    try {
        const [roundsRes, candidatesRes, settingsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/recruitment/rounds`).then(r => r.json()),
            fetch(`${API_BASE_URL}/api/recruitment/candidates`).then(r => r.json()),
            fetch(`${API_BASE_URL}/api/recruitment/settings`).then(r => r.json())
        ]);

        if (!roundsRes.success || !candidatesRes.success || !settingsRes.success) {
            showToast("Failed to retrieve dashboard records.", "danger");
            return;
        }

        recruitmentRoundsList = roundsRes.rounds;
        candidatesList = candidatesRes.candidates;
        recruitmentSettingsObj = settingsRes.settings;

        // Apply settings state to toggle
        const autoShortlistToggle = document.getElementById("hr-auto-shortlist-toggle");
        if (autoShortlistToggle) {
            autoShortlistToggle.checked = recruitmentSettingsObj.autoShortlist;
        }

        // Render rounds manager list
        renderRoundsManager();

        // Fill stats rounds filter dropdown
        const roundSelect = document.getElementById("hr-stats-round-selector");
        if (roundSelect) {
            const currentVal = roundSelect.value;
            roundSelect.innerHTML = "";
            recruitmentRoundsList.forEach(r => {
                const opt = document.createElement("option");
                opt.value = r.id;
                opt.textContent = r.name;
                roundSelect.appendChild(opt);
            });
            if (currentVal && recruitmentRoundsList.some(r => r.id === currentVal)) {
                roundSelect.value = currentVal;
            } else if (recruitmentRoundsList.length > 0) {
                roundSelect.value = recruitmentRoundsList[0].id;
            }
        }

        // Calculate Overview Statistics
        const totalRegistered = candidatesList.length;
        let appearedCount = 0;
        let selectedCount = 0;

        candidatesList.forEach(c => {
            const roundsStatus = c.roundsStatus;
            if (roundsStatus.length > 0) appearedCount++;
            
            // Check if they cleared all rounds (or the final round)
            const finalRound = recruitmentRoundsList[recruitmentRoundsList.length - 1];
            if (finalRound) {
                const finalStatus = roundsStatus.find(s => s.roundId === finalRound.id);
                if (finalStatus && finalStatus.status === "Qualified") {
                    selectedCount++;
                }
            }
        });

        const selectPct = appearedCount > 0 ? Math.round((selectedCount / appearedCount) * 100) : 0;

        document.getElementById("hr-stat-registered").textContent = totalRegistered;
        document.getElementById("hr-stat-appeared").textContent = appearedCount;
        document.getElementById("hr-stat-selected").textContent = selectedCount;
        document.getElementById("hr-stat-selection-rate").textContent = `${selectPct}%`;

        // Render Live Round-by-Round Shortlist lists
        if (roundSelect && roundSelect.value) {
            renderRoundShortlists(roundSelect.value);
        }

        // Render Final Selections grid
        renderFinalSelectionStatus();

        // Render Funnel Analytics Chart
        renderRecruitmentFunnelChart();

    } catch (err) {
        console.error("HR Recruitment dashboard loading error", err);
        showToast("Error retrieving recruitment database logs.", "danger");
    } finally {
        toggleAILoader(false);
    }
}

// Render list of recruitment rounds with modification action triggers
function renderRoundsManager() {
    const listContainer = document.getElementById("hr-rounds-manager-list");
    if (!listContainer) return;

    listContainer.innerHTML = "";
    recruitmentRoundsList.forEach((round, index) => {
        const item = document.createElement("div");
        item.className = "glass-panel";
        item.style.padding = "14px 20px";
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";
        
        item.innerHTML = `
            <div>
                <strong style="color:var(--primary); font-size:1.05em;">Round ${index + 1}: ${round.name}</strong>
                <div style="font-size:0.82em; color:var(--text-light); margin-top:3px;">
                    Type: ${round.type.toUpperCase()} • Threshold: ${round.passingPercentage}% • Time: ${round.timeLimit}m • Weight: ${round.weightage}% • Neg: ${round.negativeMarking ? "Yes" : "No"}
                </div>
            </div>
            <button class="btn-secondary btn-edit-round" data-id="${round.id}" style="padding:6px 12px; font-size:0.85em;">
                Configure
            </button>
        `;
        listContainer.appendChild(item);
    });

    // Configure Round Button Events
    const editBtns = listContainer.querySelectorAll(".btn-edit-round");
    editBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const rId = btn.getAttribute("data-id");
            const roundObj = recruitmentRoundsList.find(r => r.id === rId);
            if (roundObj) {
                // Populate rounds creation form
                document.getElementById("round-config-id").value = roundObj.id;
                document.getElementById("round-name").value = roundObj.name;
                document.getElementById("round-type").value = roundObj.type;
                document.getElementById("round-subject").value = roundObj.subject;
                document.getElementById("round-percentage").value = roundObj.passingPercentage;
                document.getElementById("round-min-score").value = roundObj.minScore;
                document.getElementById("round-time-limit").value = roundObj.timeLimit;
                document.getElementById("round-weightage").value = roundObj.weightage;
                document.getElementById("round-negative-marking").checked = roundObj.negativeMarking;
                document.getElementById("round-mandatory").checked = roundObj.mandatory;

                // Move focus to form
                document.getElementById("round-name").focus();
                showToast(`Loaded ${roundObj.name} configurations.`, "info");
            }
        });
    });
}

// Toggle manual vs automatic publish configuration
async function toggleSettings(autoShortlist) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/recruitment/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ autoShortlist })
        });
        const data = await res.json();
        if (data.success) {
            recruitmentSettingsObj = data.settings;
            showToast(`progression settings toggled to ${autoShortlist ? "Automatic Shortlist" : "Manual Review"}.`, "success");
            loadHrRecruitment();
        }
    } catch (err) {
        showToast("Failed to toggle settings.", "danger");
    }
}

// Create or update round configuration payload
async function saveRecruitmentRound() {
    const id = document.getElementById("round-config-id").value;
    const name = document.getElementById("round-name").value.trim();
    const type = document.getElementById("round-type").value;
    const subject = document.getElementById("round-subject").value.trim();
    const passingPercentage = document.getElementById("round-percentage").value;
    const minScore = document.getElementById("round-min-score").value;
    const timeLimit = document.getElementById("round-time-limit").value;
    const weightage = document.getElementById("round-weightage").value;
    const negativeMarking = document.getElementById("round-negative-marking").checked;
    const mandatory = document.getElementById("round-mandatory").checked;

    if (!name || !subject) {
        return showToast("Name and Subject fields are required.", "danger");
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/recruitment/rounds`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: id || undefined,
                name,
                type,
                subject,
                passingPercentage,
                minScore,
                negativeMarking,
                timeLimit,
                mandatory,
                weightage
            })
        });
        const data = await res.json();
        if (data.success) {
            showToast("Recruitment round saved successfully.", "success");
            
            // Clear form
            document.getElementById("round-config-id").value = "";
            document.getElementById("round-name").value = "";
            document.getElementById("round-subject").value = "";
            document.getElementById("round-percentage").value = "70";
            document.getElementById("round-min-score").value = "7.0";
            document.getElementById("round-time-limit").value = "30";
            document.getElementById("round-weightage").value = "20";
            document.getElementById("round-negative-marking").checked = false;
            document.getElementById("round-mandatory").checked = true;

            loadHrRecruitment();
        }
    } catch (err) {
        showToast("Error updating round configs.", "danger");
    }
}

// Render student listings by filter status for selected round
function renderRoundShortlists(roundId) {
    const roundObj = recruitmentRoundsList.find(r => r.id === roundId);
    if (!roundObj) return;

    // Filter categories
    const qualified = [];
    const disqualified = [];
    const pending = [];
    const absent = [];

    candidatesList.forEach(c => {
        const statuses = c.roundsStatus;
        const entry = statuses.find(s => s.roundId === roundId);
        
        // Find if they failed a previous round. If they failed earlier, they aren't 'absent' for this round, they are already locked/disqualified.
        let failedEarlier = false;
        const roundIndex = recruitmentRoundsList.findIndex(r => r.id === roundId);
        for (let i = 0; i < roundIndex; i++) {
            const prevEntry = statuses.find(s => s.roundId === recruitmentRoundsList[i].id);
            if (prevEntry && prevEntry.status === "Not Qualified") {
                failedEarlier = true;
                break;
            }
        }

        if (entry) {
            if (entry.status === "Qualified") {
                qualified.push({ username: c.username, fullName: c.fullName, score: entry.score, percent: entry.percentage });
            } else if (entry.status === "Not Qualified") {
                disqualified.push({ username: c.username, fullName: c.fullName, score: entry.score, percent: entry.percentage });
            } else if (entry.status === "Pending") {
                pending.push({ username: c.username, fullName: c.fullName, score: entry.score, percent: entry.percentage });
            }
        } else {
            // Absent means they qualified all previous rounds but haven't started this one
            if (!failedEarlier) {
                absent.push({ username: c.username, fullName: c.fullName });
            } else {
                disqualified.push({ username: c.username, fullName: c.fullName, score: 0, percent: 0, reason: "Failed Previous Round" });
            }
        }
    });

    // Populate Lists counts
    document.getElementById("hr-stat-qualified").textContent = qualified.length;
    document.getElementById("hr-stat-disqualified").textContent = disqualified.length;
    document.getElementById("hr-stat-pending").textContent = pending.length;
    document.getElementById("hr-stat-absent").textContent = absent.length;

    // Show/hide manual publish button
    const publishContainer = document.getElementById("hr-publish-controls-container");
    if (publishContainer) {
        if (!recruitmentSettingsObj.autoShortlist && pending.length > 0) {
            publishContainer.style.display = "flex";
            publishContainer.innerHTML = `
                <div class="glass-panel" style="padding:14px; width:100%; display:flex; justify-content:space-between; align-items:center; border: 1px solid var(--warning);">
                    <span>There are <strong>${pending.length}</strong> candidates waiting for manual results publication in ${roundObj.name}.</span>
                    <button class="btn-primary" id="btn-publish-candidates" style="background:var(--warning); color:white;">
                        Publish Qualified Candidates
                    </button>
                </div>
            `;
            document.getElementById("btn-publish-candidates").addEventListener("click", () => {
                publishCandidatesList(roundId);
            });
        } else {
            publishContainer.style.display = "none";
        }
    }

    // Populate Detailed Listings Lists HTML
    const renderTable = (list, elementId, showScore = true) => {
        const tableBody = document.getElementById(elementId);
        if (!tableBody) return;
        tableBody.innerHTML = "";
        
        if (list.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-light);">No candidates found.</td></tr>`;
            return;
        }

        list.forEach(c => {
            const tr = document.createElement("tr");
            let scoreCol = "";
            if (showScore) {
                const scoreVal = c.score !== undefined ? `${c.score}/10 (${c.percent}%)` : "N/A";
                scoreCol = `<td><span class="badge-row" style="background:var(--primary-light); color:var(--primary); font-weight:700;">${scoreVal}</span></td>`;
            }
            tr.innerHTML = `
                <td><strong>${c.fullName}</strong></td>
                <td>@${c.username}</td>
                ${scoreCol}
            `;
            tableBody.appendChild(tr);
        });
    };

    renderTable(qualified, "hr-list-qualified-body");
    renderTable(disqualified, "hr-list-disqualified-body");
    renderTable(pending, "hr-list-pending-body");
    renderTable(absent, "hr-list-absent-body", false);
}

// Call manual publish API endpoint
async function publishCandidatesList(roundId) {
    toggleAILoader(true);
    try {
        const res = await fetch(`${API_BASE_URL}/api/recruitment/publish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roundId })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, "success");
            loadHrRecruitment();
        }
    } catch (err) {
        showToast("Publish call failed.", "danger");
    } finally {
        toggleAILoader(false);
    }
}

// Render final selected, waiting list and rejected grids
function renderFinalSelectionStatus() {
    const selectedList = [];
    const waitingList = [];
    const rejectedList = [];
    const rankings = [];

    candidatesList.forEach(c => {
        const statuses = c.roundsStatus;
        
        let scoreSum = 0;
        let completedCount = 0;
        let isRejected = false;

        recruitmentRoundsList.forEach(r => {
            const entry = statuses.find(s => s.roundId === r.id);
            if (entry) {
                scoreSum += entry.score;
                completedCount++;
                if (entry.status === "Not Qualified") {
                    isRejected = true;
                }
            }
        });

        // Overall Selection logic
        const finalRound = recruitmentRoundsList[recruitmentRoundsList.length - 1];
        const finalStatusEntry = finalRound ? statuses.find(s => s.roundId === finalRound.id) : null;
        const clearedAll = finalStatusEntry && finalStatusEntry.status === "Qualified";

        if (clearedAll) {
            rankings.push({ fullName: c.fullName, username: c.username, scoreSum, role: c.targetRole, roundsCleared: completedCount });
        } else if (isRejected) {
            rejectedList.push({ fullName: c.fullName, username: c.username, scoreSum, role: c.targetRole, roundsCleared: completedCount });
        } else if (completedCount > 0) {
            // Under review / currently progressing
            waitingList.push({ fullName: c.fullName, username: c.username, scoreSum, role: c.targetRole, roundsCleared: completedCount });
        }
    });

    // Sort rankings by total score descending
    rankings.sort((a, b) => b.scoreSum - a.scoreSum);
    
    // Split rankings into Selected vs Waiting list (e.g. top 2 selected, rest on waiting list)
    const selectedCutoff = 2;
    const finalSelected = rankings.slice(0, selectedCutoff);
    const overflowWaiting = rankings.slice(selectedCutoff);
    const combinedWaitingList = [...waitingList, ...overflowWaiting].sort((a, b) => b.scoreSum - a.scoreSum);

    // Render lists to DOM
    const renderCards = (list, elementId, icon, colorClass) => {
        const container = document.getElementById(elementId);
        if (!container) return;
        container.innerHTML = "";

        if (list.length === 0) {
            container.innerHTML = `<p style="grid-column: span 3; text-align:center; color:var(--text-light); padding:10px;">No candidates in this list.</p>`;
            return;
        }

        list.forEach((c, idx) => {
            const card = document.createElement("div");
            card.className = "feature-card glass-panel";
            card.style.padding = "16px";
            card.style.borderLeft = `5px solid ${colorClass}`;
            
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <strong style="font-size:1.05em;">${c.fullName}</strong>
                        <div style="font-size:0.8em; color:var(--text-muted); margin-top:2px;">@${c.username} • ${c.role}</div>
                    </div>
                    <div class="user-avatar" style="width:30px; height:30px; font-size:0.75em; background:${colorClass}; color:white;">
                        ${idx + 1}
                    </div>
                </div>
                <div style="margin-top:12px; display:flex; justify-content:space-between; font-size:0.82em; color:var(--text-light);">
                    <span>Rounds Cleared: <strong>${c.roundsCleared}/${recruitmentRoundsList.length}</strong></span>
                    <span>Total Score: <strong>${c.scoreSum.toFixed(1)}/40</strong></span>
                </div>
            `;
            container.appendChild(card);
        });
    };

    renderCards(finalSelected, "hr-final-selected-list", "check-circle", "var(--success)");
    renderCards(combinedWaitingList, "hr-final-waiting-list", "clock", "var(--warning)");
    renderCards(rejectedList, "hr-final-rejected-list", "x-circle", "var(--danger)");
}

// Render Funnel Chart using Chart.js
function renderRecruitmentFunnelChart() {
    const ctx = document.getElementById("recruitment-funnel-chart");
    if (!ctx) return;

    if (funnelChartInstance) {
        funnelChartInstance.destroy();
    }

    // Process data points: count candidates who qualified at each round
    const labels = ["Registered"];
    const counts = [candidatesList.length];

    recruitmentRoundsList.forEach(r => {
        labels.push(r.name);
        const qualifiedCount = candidatesList.filter(c => 
            c.roundsStatus.some(s => s.roundId === r.id && s.status === "Qualified")
        ).length;
        counts.push(qualifiedCount);
    });

    const isDark = document.body.classList.contains("dark");
    const gridColor = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
    const textColor = isDark ? "#94a3b8" : "#475569";

    funnelChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Candidates Progressing",
                data: counts,
                backgroundColor: [
                    "rgba(79, 70, 229, 0.65)", // Registered
                    "rgba(6, 182, 212, 0.65)",  // Round 1
                    "rgba(16, 185, 129, 0.65)", // Round 2
                    "rgba(245, 158, 11, 0.65)", // Round 3
                    "rgba(239, 68, 68, 0.65)"   // Round 4
                ],
                borderColor: [
                    "#4f46e5",
                    "#06b6d4",
                    "#10b981",
                    "#f59e0b",
                    "#ef4444"
                ],
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            indexAxis: "y", // Horizonal bar chart for funnel visual
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textColor,
                        font: { family: "Inter" }
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: textColor,
                        font: { family: "Inter", weight: "bold" }
                    }
                }
            }
        }
    });
}

// ==========================================
// 3. REPORTS EXPORTING ENGINE
// ==========================================
function downloadExcelReport() {
    if (candidatesList.length === 0) {
        showToast("No data available to download.", "danger");
        return;
    }

    // Build CSV Content
    let csv = "Rank,Student Name,Username,Target Role,Streak,Rounds Completed,Total Score,Final Selection Status\n";

    // Sort rankings by total score descending
    const rankedList = candidatesList.map(c => {
        let scoreSum = 0;
        let completed = 0;
        let isRejected = false;
        let isSelected = false;

        c.roundsStatus.forEach(s => {
            scoreSum += s.score;
            completed++;
            if (s.status === "Not Qualified") isRejected = true;
        });

        const finalRound = recruitmentRoundsList[recruitmentRoundsList.length - 1];
        if (finalRound) {
            const finalEntry = c.roundsStatus.find(s => s.roundId === finalRound.id);
            if (finalEntry && finalEntry.status === "Qualified") {
                isSelected = true;
            }
        }

        let selectionStatus = "In Progress";
        if (isSelected) selectionStatus = "Selected";
        else if (isRejected) selectionStatus = "Rejected";
        else if (completed > 0) selectionStatus = "Waiting List";

        return {
            fullName: c.fullName,
            username: c.username,
            role: c.targetRole,
            streak: c.streak,
            scoreSum,
            completed,
            selectionStatus
        };
    }).sort((a, b) => b.scoreSum - a.scoreSum);

    rankedList.forEach((c, idx) => {
        csv += `"${idx + 1}","${c.fullName}","@${c.username}","${c.role}","${c.streak}","${c.completed}/${recruitmentRoundsList.length}","${c.scoreSum.toFixed(1)}","${c.selectionStatus}"\n`;
    });

    // Trigger download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "recruitment_shortlist_report.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Excel spreadsheet report generated successfully.", "success");
}

function downloadPdfReport() {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        showToast("PDF generator library is not ready.", "danger");
        return;
    }

    const doc = new jsPDF();
    
    // PDF Styling colors
    const primaryColor = [79, 70, 229]; // Indigo
    const textColor = [15, 23, 42]; // Slate 900

    // Title Section
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 40, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("INTERVUE AI - RECRUITMENT REPORT", 20, 26);
    
    // Document Meta
    doc.setTextColor(...textColor);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 140, 50);
    
    // Settings Summary
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Recruitment Campaign Configuration", 20, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Campaign Status: Active`, 20, 68);
    doc.text(`Progression Settings: ${recruitmentSettingsObj.autoShortlist ? "Automatic Shortlist" : "Manual Review"}`, 20, 74);
    doc.text(`Total Configured Rounds: ${recruitmentRoundsList.length}`, 20, 80);

    // Campaign Stats Grid
    let appearedCount = 0;
    let selectedCount = 0;
    candidatesList.forEach(c => {
        if (c.roundsStatus.length > 0) appearedCount++;
        const finalRound = recruitmentRoundsList[recruitmentRoundsList.length - 1];
        if (finalRound) {
            const finalStatus = c.roundsStatus.find(s => s.roundId === finalRound.id);
            if (finalStatus && finalStatus.status === "Qualified") {
                selectedCount++;
            }
        }
    });
    
    doc.setFillColor(248, 250, 252);
    doc.rect(20, 88, 170, 24, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(20, 88, 170, 24);
    
    doc.setFont("helvetica", "bold");
    doc.text("Registered", 35, 96);
    doc.text("Appeared", 75, 96);
    doc.text("Selected", 115, 96);
    doc.text("Selection Rate", 155, 96);
    
    doc.setFont("helvetica", "normal");
    doc.text(`${candidatesList.length}`, 42, 104);
    doc.text(`${appearedCount}`, 82, 104);
    doc.text(`${selectedCount}`, 122, 104);
    doc.text(`${appearedCount > 0 ? Math.round((selectedCount/appearedCount)*100) : 0}%`, 164, 104);

    // List out Selected Candidates
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Final Selected Candidates", 20, 126);
    doc.line(20, 129, 190, 129);

    let yOffset = 138;
    const finalSelectedList = [];
    candidatesList.forEach(c => {
        const finalRound = recruitmentRoundsList[recruitmentRoundsList.length - 1];
        const finalStatus = finalRound ? c.roundsStatus.find(s => s.roundId === finalRound.id) : null;
        if (finalStatus && finalStatus.status === "Qualified") {
            const scoreSum = c.roundsStatus.reduce((acc, curr) => acc + curr.score, 0);
            finalSelectedList.push({ name: c.fullName, role: c.targetRole, score: scoreSum });
        }
    });

    finalSelectedList.sort((a,b) => b.score - a.score);

    if (finalSelectedList.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.text("No candidates have qualified all rounds yet.", 20, yOffset);
    } else {
        finalSelectedList.forEach((c, idx) => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text(`${idx + 1}. ${c.name} (${c.role})`, 20, yOffset);
            doc.setFont("helvetica", "normal");
            doc.text(`Aggregate Assessment Score: ${c.score.toFixed(1)} / 40.0`, 25, yOffset + 6);
            yOffset += 16;
        });
    }

    // Save report
    doc.save("recruitment_campaign_report.pdf");
    showToast("PDF campaign report downloaded successfully.", "success");
}
