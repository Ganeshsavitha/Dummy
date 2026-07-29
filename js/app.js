// MASTER FRONTEND CORE CONTROL MODULE
import { initDashboard, loadDashboardData } from "./dashboard.js";
import { initInterview } from "./interview.js";
import { initMcq } from "./mcq.js";
import { initCoding } from "./coding.js";
import { initResume } from "./resume.js";
import { initRoadmap } from "./roadmap.js";
import { initRecruitment, loadStudentRecruitment, loadHrRecruitment } from "./recruitment.js";
import { initPlacement, loadStudentPlacementTimeline, loadCompanyPortal } from "./placement.js";

// Global Platform State
export const state = {
    currentUser: null,
    theme: "dark",
    currentView: "view-home",
    activeRecruitmentRound: null // Holds { id, type, subject } during active test progression
};

// Global base URL
export const API_BASE_URL = window.location.origin;

// ==========================================
// 1. DYNAMIC TOAST ALERTS MANAGER
// ==========================================
export function showToast(message, type = "info") {
    const deck = document.getElementById("toast-deck");
    if (!deck) return;
    
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let icon = "info";
    if (type === "success") icon = "check-circle";
    if (type === "danger") icon = "alert-triangle";
    
    toast.innerHTML = `<i data-feather="${icon}"></i><span>${message}</span>`;
    deck.appendChild(toast);
    
    // Initialize icons for the dynamic toast
    if (window.feather) feather.replace();
    
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(50px)";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Show/Hide AI Thinking Loader
export function toggleAILoader(show) {
    const loader = document.getElementById("thinking-ai-loader");
    if (loader) {
        loader.style.display = show ? "block" : "none";
    }
}

// ==========================================
// 2. SPA ROUTER & NAVIGATOR
// ==========================================
function switchView(targetId) {
    // 1. Guard views for unauthenticated users
    if (targetId !== "view-home" && !state.currentUser) {
        showToast("Please sign in to access this preparation cabin.", "danger");
        toggleAuthModal(true);
        return;
    }

    // 2. Manage active view elements
    const sections = document.querySelectorAll(".view-section");
    sections.forEach(sec => sec.classList.remove("active"));
    
    const targetSec = document.getElementById(targetId);
    if (targetSec) {
        targetSec.classList.add("active");
        state.currentView = targetId;
    }
    
    // 3. Manage active menu highlights
    const menuItems = document.querySelectorAll(".sidebar-menu .menu-item");
    menuItems.forEach(item => {
        item.classList.remove("active");
        if (item.getAttribute("data-target") === targetId) {
            item.classList.add("active");
        }
    });

    // 4. Trigger specific view lifecycle loads
    if (targetId === "view-dashboard") {
        loadDashboardData();
    }
    if (targetId === "view-leaderboard") {
        loadLeaderboard();
    }
    if (targetId === "view-achievements") {
        updateAchievementsBadges();
    }
    if (targetId === "view-notes") {
        loadNotesAndBookmarks();
    }
    if (targetId === "view-recruitment-student") {
        loadStudentRecruitment();
    }
    if (targetId === "view-recruitment-hr") {
        loadHrRecruitment();
    }
    if (targetId === "view-placement-student") {
        loadStudentPlacementTimeline();
    }
    if (targetId === "view-company-dashboard") {
        loadCompanyPortal();
    }
    if (targetId === "view-admin") {
        loadAdminPanelData();
    }
}

function initRouter() {
    const menuItems = document.querySelectorAll(".sidebar-menu .menu-item");
    menuItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const target = item.getAttribute("data-target");
            switchView(target);
        });
    });

    // Start Free Trial CTA
    const heroBtn = document.getElementById("btn-hero-start");
    if (heroBtn) {
        heroBtn.addEventListener("click", () => {
            if (state.currentUser) {
                switchView("view-dashboard");
            } else {
                toggleAuthModal(true);
            }
        });
    }
}

// ==========================================
// 3. STUDENT AUTHENTICATION SYSTEM
// ==========================================
function toggleAuthModal(show) {
    const overlay = document.getElementById("auth-modal-overlay");
    if (overlay) {
        if (show) {
            overlay.classList.add("active");
        } else {
            overlay.classList.remove("active");
        }
    }
}

function setupAuth() {
    const btnTrigger = document.getElementById("btn-login-trigger");
    const btnLogout = document.getElementById("btn-logout");
    const toggleRegister = document.getElementById("auth-toggle-register");
    const toggleLogin = document.getElementById("auth-toggle-login");
    const loginPanel = document.getElementById("auth-login-panel");
    const registerPanel = document.getElementById("auth-register-panel");
    
    const loginSubmit = document.getElementById("btn-login-submit");
    const registerSubmit = document.getElementById("btn-register-submit");

    // Modal click-out close
    const overlay = document.getElementById("auth-modal-overlay");
    if (overlay) {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) toggleAuthModal(false);
        });
    }

    if (btnTrigger) btnTrigger.addEventListener("click", () => toggleAuthModal(true));
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            // Logout sequence
            state.currentUser = null;
            localStorage.removeItem("userSession");
            btnLogout.style.display = "none";
            btnTrigger.style.display = "block";
            
            // Hide dashboard sections
            const protectedItems = document.querySelectorAll(".login-required, .admin-only, .hr-only, .company-only, #header-streak, #sidebar-user-panel");
            protectedItems.forEach(el => el.style.display = "none");
            
            showToast("Successfully logged out.", "info");
            switchView("view-home");
        });
    }

    if (toggleRegister) {
        toggleRegister.addEventListener("click", (e) => {
            e.preventDefault();
            loginPanel.style.display = "none";
            registerPanel.style.display = "block";
        });
    }
    if (toggleLogin) {
        toggleLogin.addEventListener("click", (e) => {
            e.preventDefault();
            registerPanel.style.display = "none";
            loginPanel.style.display = "block";
        });
    }

    // Login Submit
    loginSubmit.addEventListener("click", async () => {
        const u = document.getElementById("login-username").value.trim();
        const p = document.getElementById("login-password").value.trim();

        if (!u || !p) return showToast("Enter credentials.", "danger");

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: u, password: p })
            });
            const data = await res.json();
            if (data.success) {
                state.currentUser = data.user;
                localStorage.setItem("userSession", JSON.stringify(data.user));
                onLoginSuccess();
            } else {
                showToast(data.message, "danger");
            }
        } catch (err) {
            showToast("Login call failed.", "danger");
        }
    });

    // Register Submit
    registerSubmit.addEventListener("click", async () => {
        const u = document.getElementById("register-username").value.trim();
        const f = document.getElementById("register-fullname").value.trim();
        const r = document.getElementById("register-role").value.trim();
        const p = document.getElementById("register-password").value.trim();

        if (!u || !p || !f) return showToast("All asterisk fields required.", "danger");

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: u, password: p, fullName: f, targetRole: r })
            });
            const data = await res.json();
            if (data.success) {
                state.currentUser = data.user;
                localStorage.setItem("userSession", JSON.stringify(data.user));
                onLoginSuccess();
            } else {
                showToast(data.message, "danger");
            }
        } catch (err) {
            showToast("Registration call failed.", "danger");
        }
    });
}

function onLoginSuccess() {
    toggleAuthModal(false);
    showToast(`Welcome back, ${state.currentUser.fullName}!`, "success");
    
    // Render user details in sidebar
    const btnTrigger = document.getElementById("btn-login-trigger");
    const btnLogout = document.getElementById("btn-logout");
    const userPanel = document.getElementById("sidebar-user-panel");
    const userName = document.getElementById("user-display-name");
    const userRole = document.getElementById("user-display-role");
    const avatarLetters = document.getElementById("avatar-letters");
    
    if (btnTrigger) btnTrigger.style.display = "none";
    if (btnLogout) btnLogout.style.display = "block";
    if (userPanel) userPanel.style.display = "flex";
    if (userName) userName.textContent = state.currentUser.fullName;
    if (userRole) userRole.textContent = state.currentUser.targetRole;
    
    if (avatarLetters) {
        const initials = state.currentUser.fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
        avatarLetters.textContent = initials || "ST";
    }

    if (state.currentUser.role === "company") {
        const companyItems = document.querySelectorAll(".company-only");
        companyItems.forEach(el => el.style.display = "block");
        
        // Hide standard student options
        const studentRequired = document.querySelectorAll(".login-required");
        studentRequired.forEach(el => el.style.display = "none");

        switchView("view-company-dashboard");
        return;
    }

    // Reveal protected nav tabs
    const protectedItems = document.querySelectorAll(".login-required");
    protectedItems.forEach(el => el.style.display = "block");

    // Streak and Admin tags
    const streakBadge = document.getElementById("header-streak");
    const streakVal = document.getElementById("header-streak-val");
    if (streakBadge && streakVal) {
        streakBadge.style.display = "flex";
        streakVal.textContent = state.currentUser.streak;
    }

    if (state.currentUser.username === "admin") {
        const adminItems = document.querySelectorAll(".admin-only");
        adminItems.forEach(el => el.style.display = "block");
    }

    if (state.currentUser.username === "admin" || state.currentUser.username === "hr") {
        const hrItems = document.querySelectorAll(".hr-only");
        hrItems.forEach(el => el.style.display = "block");
    }

    switchView("view-dashboard");
}

function autoLoginSession() {
    const saved = localStorage.getItem("userSession");
    if (saved) {
        state.currentUser = JSON.parse(saved);
        onLoginSuccess();
    }
}

// ==========================================
// 4. NOTES & BOOKMARKS PANEL
// ==========================================
async function loadNotesAndBookmarks() {
    if (!state.currentUser) return;
    
    // 1. Fetch Notes
    try {
        const res = await fetch(`${API_BASE_URL}/api/notes/${state.currentUser.username}`);
        const data = await res.json();
        const container = document.getElementById("notes-results-list");
        if (container && data.success) {
            container.innerHTML = "";
            if (data.notes.length === 0) {
                container.innerHTML = `<p style="grid-column: span 2; color: var(--text-light); text-align: center;">No revisions jotted down yet.</p>`;
            }
            data.notes.forEach(note => {
                const card = document.createElement("div");
                card.className = "feature-card glass-panel";
                card.style.padding = "20px";
                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                      <h4 style="margin:0;">${note.title}</h4>
                      <i data-feather="edit-3" style="width:16px; height:16px; color: var(--primary);"></i>
                    </div>
                    <p style="font-size:0.85em; color:var(--text-muted); line-height:1.4;">${note.content}</p>
                `;
                container.appendChild(card);
            });
            if (window.feather) feather.replace();
        }
    } catch (e) {
        console.error("Notes load failed", e);
    }
}

function setupNotes() {
    const saveBtn = document.getElementById("btn-save-note");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const title = document.getElementById("note-title").value.trim();
            const content = document.getElementById("note-content").value.trim();
            if (!title || !content) return showToast("Title and content are required.", "danger");

            try {
                const res = await fetch(`${API_BASE_URL}/api/notes/save`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: state.currentUser.username, title, content })
                });
                const data = await res.json();
                if (data.success) {
                    showToast("Takeaway jotted successfully!", "success");
                    document.getElementById("note-title").value = "";
                    document.getElementById("note-content").value = "";
                    loadNotesAndBookmarks();
                }
            } catch (err) {
                showToast("Failed to save note.", "danger");
            }
        });
    }
}

// ==========================================
// 5. LEADERBOARD LOADER
// ==========================================
async function loadLeaderboard() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/leaderboard`);
        const data = await res.json();
        const tbody = document.getElementById("leaderboard-table-body");
        if (tbody && data.success) {
            tbody.innerHTML = "";
            if (data.leaderboard.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No activity posted on rankings scoreboard yet.</td></tr>`;
            }
            data.leaderboard.forEach((user, index) => {
                const tr = document.createElement("tr");
                const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}`;
                tr.innerHTML = `
                    <td><strong>${medal}</strong></td>
                    <td>${user.fullName}</td>
                    <td><i data-feather="zap" style="color:var(--warning); fill:var(--warning); width:14px; height:14px;"></i> ${user.streak}</td>
                    <td>${user.totalInterviews}</td>
                    <td>${user.accuracy}%</td>
                    <td><span class="badge-row" style="background:var(--primary-light); color:var(--primary);">${user.averageScore}</span></td>
                `;
                tbody.appendChild(tr);
            });
            if (window.feather) feather.replace();
        }
    } catch (e) {
        console.error("Leaderboard load failed", e);
    }
}

// ==========================================
// 6. MILESTONES & ACHIEVEMENTS TRACKER
// ==========================================
async function updateAchievementsBadges() {
    if (!state.currentUser) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/results/history/${state.currentUser.username}`);
        const data = await res.json();
        if (data.success) {
            const count = data.history.length;
            const hasPerfect = data.history.some(r => r.score >= (r.total || 10));
            const hasStreak = state.currentUser.streak >= 7;
            const hasIDE = data.history.filter(r => r.type === "Coding").length >= 5;

            if (count >= 1) document.getElementById("badge-first").style.opacity = "1";
            if (hasStreak) document.getElementById("badge-streak").style.opacity = "1";
            if (hasPerfect) document.getElementById("badge-perfect").style.opacity = "1";
            if (hasIDE) document.getElementById("badge-coding").style.opacity = "1";
        }
    } catch (e) {
        console.error("Badge update failure", e);
    }
}

// ==========================================
// 7. ADMIN PORTAL LOGS
// ==========================================
async function loadAdminPanelData() {
    try {
        const resUsers = await fetch(`${API_BASE_URL}/api/leaderboard`);
        const dataUsers = await resUsers.json();
        const tbodyUsers = document.getElementById("admin-users-table");
        if (tbodyUsers && dataUsers.success) {
            tbodyUsers.innerHTML = "";
            dataUsers.leaderboard.forEach(u => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><strong>@${u.username}</strong></td>
                    <td>${u.fullName}</td>
                    <td>${state.currentUser.targetRole}</td>
                `;
                tbodyUsers.appendChild(tr);
            });
        }
        
        // Mock results load
        const tbodyResults = document.getElementById("admin-results-table");
        if (tbodyResults) {
            tbodyResults.innerHTML = `
                <tr>
                    <td><strong>student</strong></td>
                    <td>MCQ Practice</td>
                    <td><span class="badge-row" style="background:#ecfdf5; color:#065f46;">8.0</span></td>
                    <td>JavaScript</td>
                </tr>
                <tr>
                    <td><strong>student</strong></td>
                    <td>AI Interview</td>
                    <td><span class="badge-row" style="background:#eff6ff; color:#1e3a8a;">9.0</span></td>
                    <td>HR General</td>
                </tr>
            `;
        }
    } catch (e) {
        console.error("Admin panels fetch failed", e);
    }
}

// ==========================================
// 8. THEME TOGGLING & SETTINGS ENGINE
// ==========================================
function setupSettings() {
    const themeBtn = document.getElementById("theme-toggle");
    const themeIcon = document.getElementById("theme-icon");
    const btnLight = document.getElementById("btn-theme-light");
    const btnDark = document.getElementById("btn-theme-dark");
    const resetBtn = document.getElementById("btn-reset-progress");

    function applyTheme(newTheme) {
        state.theme = newTheme;
        if (newTheme === "dark") {
            document.body.classList.add("dark");
            if (themeIcon) themeIcon.setAttribute("data-feather", "sun");
        } else {
            document.body.classList.remove("dark");
            if (themeIcon) themeIcon.setAttribute("data-feather", "moon");
        }
        if (window.feather) feather.replace();
    }

    if (themeBtn) {
        themeBtn.addEventListener("click", () => {
            const current = document.body.classList.contains("dark") ? "light" : "dark";
            applyTheme(current);
        });
    }
    if (btnLight) btnLight.addEventListener("click", () => applyTheme("light"));
    if (btnDark) btnDark.addEventListener("click", () => applyTheme("dark"));

    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            if (confirm("Are you absolute sure you want to clear your data metrics? This cannot be undone.")) {
                localStorage.clear();
                showToast("Data progress reset completed successfully.", "success");
                window.location.reload();
            }
        });
    }
}

// Global search mock
function setupSearch() {
    const globalSearch = document.getElementById("global-search");
    if (globalSearch) {
        globalSearch.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                const q = globalSearch.value.trim();
                if (!q) return;
                showToast(`Search for "${q}" returned 0 hits on revision datasets.`, "info");
                globalSearch.value = "";
            }
        });
    }
}

// ==========================================
// 9. PLATFORM INITIALIZATION ENTRYPOINT
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Feather icons replacement
    if (window.feather) feather.replace();
    
    // 2. Initialize Routing, Auth & Core features
    initRouter();
    setupAuth();
    autoLoginSession();
    setupNotes();
    setupSettings();
    setupSearch();

    // 3. Initialize Child View Modules
    initDashboard();
    initInterview();
    initMcq();
    initCoding();
    initResume();
    initRoadmap();
    initRecruitment();
    initPlacement();
    
    showToast("Intervue AI platform loaded successfully.", "success");
});