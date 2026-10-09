# KGiSL - Institute of Information Management

## MCA – REVIEW 1 PROJECT REPORT

# HireGrad AI – Automated Campus Recruitment & Interview Analytics Portal

**Submitted by**
**Savitha G**
Reg. No: `[Your Registration Number]`

**Under the Guidance of**
**Mrs.Gomathi R**
MCA, M.Phil(PHD)
[Assistant Professor]

**Master of Computer Applications**
KGiSL-Institute of Information Management

---

# Abstract

**HireGrad AI – Automated Campus Recruitment & Interview Analytics Portal** is a web-based, AI-driven recruitment and assessment platform. It aims to unify student placement activities, remote coding and aptitude examinations, and real-time WebRTC HR interviews under a single integrated portal. 

Traditional campus recruitment involves fragmented stages—manual resume filtering, generic paper-based or external test-platform MCQ tests, separate coding sandboxes, and offline or third-party video call interviews. This causes communication gaps, proctoring challenges, and delays in gathering interview evaluations.

The proposed system, **HireGrad AI**, solves these challenges by providing role-specific dashboards for **Students**, **HR / Company Recruiters**, and **Administrators**:
*   **Student Portal:** Allows candidates to track daily skill streaks, build their academic and skill profile, register for eligible recruitment drives, take AI-generated MCQ/Coding/HR test rounds, receive interactive roadmaps, and view instant performance scores.
*   **Company / HR Portal:** Allows recruiters to build hiring campaigns (Placement Drives), configure passing eligibility, upload test papers via PDF or automatically generate high-quality tests using the **Gemini AI API**, monitor live candidate test progression in real-time, and schedule remote WebRTC video/audio interviews.
*   **Live Video & Interview Panel:** Integrated with **WebRTC** for peer-to-peer live video calls, live collaborative in-meeting text chat, waiting rooms, and real-time scorecard submission to automatically log HR feedback.
*   **Admin Dashboard:** Provides global oversight, allowing administrators to audit users, review placement statistics, manage database records, and monitor recruitment operations.

The application has been built using **React 19, TypeScript, and Vite** on the frontend, **Node.js with Express.js** on the backend, and **MongoDB with Mongoose** as the database layer. Real-time updates and live proctoring events are handled using **Socket.io**, while remote interview calls are powered by **WebRTC**. Technical question curation, AI-assisted static code review, candidate resume ATS scanning, and career guidance roadmaps are automated using the **Gemini AI API** (with a fail-safe fallback to Groq Llama API).

---

## 1. INTRODUCTION

During college placements, managing the recruitment workflow involves dealing with multiple separate entities: aptitude testers, compilers, scheduling platforms, video calling tools, and evaluation reports. This lack of integration leads to duplicate entries, data inconsistencies, and delays. 

**"HireGrad AI"** is a comprehensive solution designed to automate this lifecycle. By providing a centralized, proctored environment, it brings students, hiring organizations, and administrators onto a single dashboard. From resume screening to automated technical test evaluations and final live video interviews, the entire process is handled under one domain.

### 1.1 Salient Features of the System

The major features of the system are:

1.  **Role-Based Security & Dashboards**
    Provides custom workspaces for Students (candidates), HR (recruiters), and Administrators, ensuring strict access control and authorization.
2.  **Smart Placement Drive Campaign Builder**
    HR can create custom recruitment drives specifying job roles, CTC packages, eligibility criteria (CGPA and department limits), test duration, and custom rounds.
3.  **AI Test Round Generator**
    Recruiters can generate high-quality multiple-choice questions (MCQs) and coding challenges dynamically using Gemini AI, based on subjects and difficulty levels.
4.  **Interactive PDF Test Parser**
    HR can upload test papers in PDF format. The system automatically extracts text and parses the questions into structured online tests.
5.  **Automated Static Coding Sandbox**
    Students can write code in a web-based code IDE. The system evaluates submissions against hidden test cases using an AI execution engine, assessing space/time complexity.
6.  **AI Behavioral HR Assessment**
    Evaluates students' textual HR answers on confidence levels, grammatical correctness, and structure, comparing them against the STAR method.
7.  **Resume ATS Suitability Scanner**
    Enables candidates to upload their resumes to calculate ATS match percentages against target roles, identify missing keywords, and get mock questions.
8.  **Automated Skill Roadmaps**
    Generates personalized 4-week learning roadmaps dynamically, complete with tasks and resources based on current skills and target companies.
9.  **Real-Time Live Proctoring & Activity Monitor**
    Uses Socket.io to broadcast live updates. HR can track candidate scores, active tests, and round qualification statuses in real-time.
10. **WebRTC Peer-to-Peer Interview Room**
    Features high-quality, zero-cost video and audio calling directly in the browser, with real-time text chat and a synchronized participant waiting room.
11. **Instant HR Scorecard Evaluation**
    Allows interviewers to score candidates in-meeting on communication, technical skills, confidence, and problem-solving, generating instant digital feedback.
12. **Student Performance Analytics**
    A consolidated student dashboard displaying average test scores, daily streaks, test histories, and bookmarked questions.

---

## 2. SYSTEM STUDY AND ANALYSIS

### 2.1 Problem Statement

Traditional university placement setups face several bottlenecks:
*   Manual validation of candidate eligibility (e.g., verifying CGPA, department constraints, and backlogs) is time-consuming.
*   Conducting coding and technical rounds requires third-party compiler platforms, which are costly and separate from student records.
*   Evaluating behavioral or HR responses is subjective and requires manual review.
*   Remote interviews rely on external applications (Zoom, Teams), leading to fragmented scheduling and delayed feedback entry.

Therefore, there is a clear requirement for **HireGrad AI**, a unified placement automation portal that combines AI-based test proctoring, remote WebRTC interview rooms, and real-time dashboard analytics.

### 2.2 Existing System

In the existing setup, recruitment stages are disconnected:
*   **Assessment:** Colleges use third-party test platforms (HackerRank, Cocubes) where student profiles are disconnected from university records.
*   **Scheduling:** Coordination is done via spreadsheets, emails, and calendar invites.
*   **Interviews:** Conducted over external video calling tools. Interview feedback forms are filled out manually or submitted via email templates.

#### 2.2.1 Drawbacks of the Existing System
*   Lack of database integration between student academic history, test scores, and final interview feedback.
*   Manual overhead in designing test question papers.
*   Absence of instant AI feedback to help students prepare (ATS checks, roadmap generation).
*   No real-time monitoring dashboard for placement cell coordinators to track test progress.

### 2.3 Proposed System

The proposed **HireGrad AI** platform offers a single integrated workspace for student preparation and company-driven recruitment. 

HR defines the drive parameters. The system automatically filters eligible students based on their profile data (CGPA, department). The tests are proctored and graded instantly by the integrated Gemini AI parser. Candidates who qualify advance to the live WebRTC interview, where the recruiter conducts the video session and submits the scorecard directly in the portal.

#### 2.3.1 Advantages of the Proposed System
*   **Single Unified Portal:** Combines user registration, eligibility checks, online tests, resume scoring, live video calls, and feedback logging in one system.
*   **AI-Powered Automation:** Automates test generation, code static verification, resume scanning, and behavioral scoring.
*   **WebRTC Integration:** Built-in remote video calling eliminates the need for external applications.
*   **Real-Time Status Feeds:** Uses WebSockets (Socket.io) to synchronize candidate progression, notifications, and monitoring dashboards.
*   **Managed MongoDB Database:** Indexed document storage for student credentials, drive logs, questions, progress, interviews, and feedback.

### 2.4 Feasibility Analysis

#### 2.4.1 Technical Feasibility
The platform is built using modern, stable web technologies:
*   **Frontend:** React 19, TypeScript, and Vite provide a responsive, fast-loading user interface.
*   **Backend:** Node.js and Express.js handle API routing and heavy operations efficiently.
*   **Database:** MongoDB provides managed, scalable document storage through Mongoose schemas and indexes.
*   **Real-time Communication:** Socket.io handles event broadcasts, while WebRTC provides peer-to-peer browser video streaming.
*   **AI Integrations:** Google Gemini SDK and Groq SDK enable advanced language model evaluations.
These technologies are widely adopted and can be run on standard hardware and environments.

#### 2.4.2 Economic Feasibility
The project uses open-source libraries and frameworks (React, Express, MongoDB Community/Atlas, and Mongoose). The developer tools (VS Code, Node.js, Git) are free, while MongoDB Atlas offers managed deployment options. The video-calling functionality runs directly peer-to-peer via WebRTC without requiring paid cloud streaming endpoints, making the platform cost-effective.

#### 2.4.3 Operational Feasibility
The portal is designed for ease of use. Interactive waiting rooms guide students through the interview flow, and straightforward dashboards allow HR to generate tests and schedule meetings. Relational database rules ensure that only authorized users can access specific pages.

---

## 3. DEVELOPMENT ENVIRONMENT

### 3.1 Hardware Requirements

| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **Processor** | Intel Core i3 / AMD Ryzen 3 or higher | Intel Core i5 / AMD Ryzen 5 or higher |
| **RAM** | 4 GB | 8 GB or higher |
| **Storage** | 10 GB free space | SSD with 20 GB free space |
| **Client Camera** | Integrated web camera (for WebRTC) | 720p HD webcam |
| **Network** | Broad-band internet connection | Stable high-speed connection (>= 10 Mbps) |

### 3.2 Software Requirements

| Component | Specification |
| :--- | :--- |
| **Operating System** | Windows 10/11 or macOS / Linux |
| **Client-Side Framework** | React 19, Vite, TypeScript |
| **Server-Side Runtime** | Node.js (v20.x or higher), Express.js |
| **Database Engine** | MongoDB (via Mongoose ODM) |
| **Real-time Engine** | Socket.io (Client & Server) |
| **Signaling Protocols** | WebRTC (RTCPeerConnection, ICE Candidate exchange) |
| **Integrated AI Engine** | Google Gemini API (fallback to Groq API) |
| **Development Tooling** | Visual Studio Code, Git |
| **Web Browser** | Google Chrome, Microsoft Edge, Safari, or Mozilla Firefox |

---

### 3.2.1 About React and Node.js

#### React
React is a declarative, component-based frontend JavaScript library used for building interactive user interfaces. By using a virtual DOM, React optimizes updates, rendering changes quickly. In **HireGrad AI**, React coordinates the state of candidate panels, live proctoring timelines, waiting rooms, and local WebRTC video elements.

#### Node.js & Express
Node.js is an open-source, cross-platform JavaScript runtime environment that executes JavaScript code on the server side. Express.js is a minimal, flexible Node.js web application framework that provides features for web and mobile applications. In this system, Express handles API endpoints for authentication, profile updates, and database actions.

---

### 3.2.2 About MongoDB and Gemini AI

#### MongoDB Database
MongoDB is a document database that stores structured application records as BSON documents. In **HireGrad AI**, Mongoose schemas, validation rules, unique compound indexes, and references model user profiles, scores, placement drives, registrations, progress, scheduled interviews, chat, and interview feedback. A managed MongoDB Atlas deployment provides persistence independently of the application server filesystem.

#### Google Gemini AI Integration
The Google Gemini API provides access to Google's generative models. In this project, the `gemini-2.0-flash` model handles:
*   Generating test questions and options.
*   Evaluating coding test submissions against test cases.
*   Analyzing candidate resumes for ATS compliance.
*   Providing behavioral evaluations and model STAR answers for candidate feedback.
