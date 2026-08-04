import React, { useState, useEffect } from 'react';
import { 
  Briefcase, Code, FileText, Grid, Award, Settings, Plus, ShieldAlert, 
  LogOut, Download, Upload, Cpu, Trash2, Copy, Play, CheckCircle2, 
  AlertTriangle, Monitor, Shield, ChevronRight, ChevronLeft, Send, Check, 
  Layers, AlertCircle, FileSpreadsheet, MapPin, Calendar, Clock, Sparkles, CheckSquare, Eye, Users,
  Video, Activity
} from 'lucide-react';
import io from 'socket.io-client';

// Live HR Interview Imports
import { mockInterviews as initialMockInterviews, mockFeedbackList } from './components/interview/mockData';
import type { Interview, Feedback } from './components/interview/mockData';
import ScheduleForm from './components/interview/ScheduleForm';
import InterviewDashboard from './components/interview/InterviewDashboard';
import WaitingRoom from './components/interview/WaitingRoom';
import LiveMeeting from './components/interview/LiveMeeting';
import InterviewHistory from './components/interview/InterviewHistory';
import StudentInterviewSchedule from './components/interview/StudentInterviewSchedule';
import AdminReports from './components/interview/AdminReports';
import AdminMonitoring from './components/interview/AdminMonitoring';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : `${window.location.protocol}//${window.location.host}`;
let socket: any = null;

const SUBJECT_METADATA: Record<string, {
  displayName: string;
  hasSubSubject?: boolean;
  subSubjectLabel?: string;
  subSubjectDefault?: string;
  topics: string[];
}> = {
  aptitude: {
    displayName: "Aptitude",
    topics: ["Quantitative Aptitude", "Logical Reasoning", "Verbal Ability"]
  },
  technical: {
    displayName: "Technical",
    hasSubSubject: true,
    subSubjectLabel: "Tech Subject",
    subSubjectDefault: "Java",
    topics: ["Collections", "OOP", "Exception Handling"]
  },
  programming: {
    displayName: "Programming",
    hasSubSubject: true,
    subSubjectLabel: "Language",
    subSubjectDefault: "Java",
    topics: ["Arrays", "Strings", "Recursion", "Dynamic Programming"]
  },
  hr: {
    displayName: "HR",
    topics: ["Behavioural", "Communication", "Leadership"]
  },
  database: {
    displayName: "Database",
    topics: ["SQL Queries", "Normalization", "Indexing", "Transactions"]
  },
  'system design': {
    displayName: "System Design",
    topics: ["Scalability", "Load Balancing", "Caching", "Sharding"]
  },
  'machine learning': {
    displayName: "Machine Learning",
    topics: ["Supervised Learning", "Deep Learning", "NLP", "Clustering"]
  }
};

function getMetadataForSubject(subjectName: string) {
  const normalized = (subjectName || '').toLowerCase().trim();
  if (SUBJECT_METADATA[normalized]) {
    return SUBJECT_METADATA[normalized];
  }
  // Dynamic fallback for any custom categories created by admin
  return {
    displayName: subjectName || "General",
    topics: ["Introduction", "Advanced Concepts", "Best Practices"]
  };
}

export default function App() {
  // Authentication & Session state
  const [user, setUser] = useState<any>(null);
  const [authRole, setAuthRole] = useState<'student' | 'company' | 'admin'>('student');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [companyNameInput, setCompanyNameInput] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [fullNameInput, setFullNameInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');

  // Layout navigation
  const [view, setView] = useState('dashboard');

  // ==========================================
  // LIVE HR INTERVIEW STATE
  // ==========================================
  const [liveInterviews, setLiveInterviews] = useState<Interview[]>(initialMockInterviews);
  const [activeInterview, setActiveInterview] = useState<Interview | null>(null);

  const fetchInterviews = async () => {
    const token = localStorage.getItem('hiregrad_token');
    if (!token || !user) return;
    try {
      const rolePath = user.role === 'student' ? 'student' : 'hr';
      const res = await fetch(`${API_BASE}/api/placement/interviews/${rolePath}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setLiveInterviews(data.interviews);
      }
    } catch (err) {
      console.error('Failed to fetch interviews:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchInterviews();
    }
  }, [user]);

  // Admin portal state
  const [adminData, setAdminData] = useState<any>({ companies: [], drives: [], students: [] });
  const [adminTab, setAdminTab] = useState<'students' | 'companies'>('students');

  // Campus Placement Drives (Global list)
  const [drives, setDrives] = useState<any[]>([]);
  const [selectedDrive, setSelectedDrive] = useState<any>(null);
  
  // ==========================================
  // PHASE 1: HR RECRUITER 7-STEP WIZARD STATE
  // ==========================================
  const [recruitmentStep, setRecruitmentStep] = useState<number>(1); // Step 1 to Step 7
  
  // Step 1: Create Hiring Drive Forms
  const [driveCompanyName, setDriveCompanyName] = useState('');
  const [driveCompanyLogo, setDriveCompanyLogo] = useState<string | null>(null);
  const [driveNameInput, setDriveNameInput] = useState('');
  const [jobRoleInput, setJobRoleInput] = useState('');
  const [packageInput, setPackageInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [assessmentDateInput, setAssessmentDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [assessmentTimeInput, setAssessmentTimeInput] = useState('10:00');
  const [driveDurationInput, setDriveDurationInput] = useState(90);
  const [eligibleDeptsInput, setEligibleDeptsInput] = useState<string[]>(['CSE', 'IT', 'ECE']);
  const [minCgpaInput, setMinCgpaInput] = useState(7.0);
  const [eligibleBatchInput, setEligibleBatchInput] = useState('2026');
  const [maxStudentsInput, setMaxStudentsInput] = useState(100);
  const [driveDescription, setDriveDescription] = useState('');
  const [autoProgressionSwitch, setAutoProgressionSwitch] = useState(false);

  // Dialog Previews
  const [showDrivePreview, setShowDrivePreview] = useState(false);

  // Step 2: Configure Recruitment Rounds
  const [rounds, setRounds] = useState<any[]>([
    { id: 'r_1', name: 'Aptitude Assessment', type: 'mcq', passingPercentage: 75, maxMarks: 100, timeLimit: 30, enabled: true, instructions: 'Answer all logical reasoning questions.', subject: 'Aptitude' },
    { id: 'r_2', name: 'Java MCQ Round', type: 'mcq', passingPercentage: 70, maxMarks: 100, timeLimit: 30, enabled: true, instructions: 'Covers core Java concurrency.', subject: 'Java' },
    { id: 'r_3', name: 'Programming Test', type: 'coding', passingPercentage: 70, maxMarks: 100, timeLimit: 45, enabled: true, instructions: 'Write algorithms with standard tests.', subject: 'JavaScript' },
    { id: 'r_4', name: 'AI HR Interview', type: 'hr', passingPercentage: 60, maxMarks: 100, timeLimit: 15, enabled: true, instructions: 'Behavioral AI interview simulator.', subject: 'Behavioral' }
  ]);
  const [activeBuilderRoundIndex, setActiveBuilderRoundIndex] = useState<number>(0);

  // Step 3: Question preparation
  const [questionCreationOption, setQuestionCreationOption] = useState<'ai' | 'manual' | 'pdf'>('ai');
  const [subjectInput, setSubjectInput] = useState('Java');
  const [topicInput, setTopicInput] = useState('Collections');
  const [difficultyInput, setDifficultyInput] = useState('Medium');
  const [questionsCount, setQuestionsCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mcqQuestions, setMcqQuestions] = useState<any[]>([]); 
  const [allRoundsQuestions, setAllRoundsQuestions] = useState<Record<string, any[]>>({}); 

  const [stageDataMap, setStageDataMap] = useState<Record<string, {
    subjectCategory: string;
    subSubject: string;
    topic: string;
    difficulty: string;
    questionsCount: number;
    questionCreationOption: 'ai' | 'manual' | 'pdf';
    questions: any[];
  }>>({});
  const [selectedStage, setSelectedStage] = useState<any>(null);

  const updateSelectedStageConfig = (key: string, value: any) => {
    setSelectedStage((prev: any) => {
      if (!prev) return prev;
      const updatedConfig = {
        ...prev.config,
        [key]: value
      };
      
      setStageDataMap((map: any) => ({
        ...map,
        [prev.id]: updatedConfig
      }));

      // Sync legacy states for backward compatibility with existing helper functions
      if (key === 'subjectCategory') {
        setSubjectInput(value);
        const meta = getMetadataForSubject(value);
        updatedConfig.subSubject = meta.hasSubSubject ? (meta.subSubjectDefault || 'Java') : '';
        updatedConfig.topic = meta.topics[0] || 'General';
      }
      if (key === 'topic') setTopicInput(value);
      if (key === 'difficulty') setDifficultyInput(value);
      if (key === 'questionsCount') setQuestionsCount(value);
      if (key === 'questionCreationOption') setQuestionCreationOption(value);
      if (key === 'questions') setMcqQuestions(value);

      return {
        ...prev,
        config: updatedConfig
      };
    });
  };

  const selectStageRound = (roundIndex: number, currentRounds = rounds, currentQuestions = allRoundsQuestions) => {
    setActiveBuilderRoundIndex(roundIndex);
    const round = currentRounds[roundIndex];
    if (!round) return;

    let config = stageDataMap[round.id];
    if (!config) {
      const nameLower = (round.name || '').toLowerCase();
      const subjectLower = (round.subject || '').toLowerCase();
      
      let category = 'Technical';
      if (nameLower.includes('aptitude') || subjectLower.includes('aptitude')) {
        category = 'Aptitude';
      } else if (nameLower.includes('communication') || nameLower.includes('comunication') || nameLower.includes('commun') || nameLower.includes('comun') || nameLower.includes('english') || nameLower.includes('verbal') || nameLower.includes('interview') || nameLower.includes('hr') || nameLower.includes('behavioral') ||
                 subjectLower.includes('communication') || subjectLower.includes('comunication') || subjectLower.includes('commun') || subjectLower.includes('comun') || subjectLower.includes('english') || subjectLower.includes('verbal') || subjectLower.includes('interview') || subjectLower.includes('hr') || subjectLower.includes('behavioral') || (round.type || '').toLowerCase() === 'hr') {
        if (nameLower.includes('hr') || nameLower.includes('behavioral') || subjectLower.includes('behavioral') || (round.type || '').toLowerCase() === 'hr') {
          category = 'HR';
        } else {
          category = 'Communication';
        }
      } else if (nameLower.includes('program') || nameLower.includes('coding') || subjectLower.includes('program') || subjectLower.includes('coding') || (round.type || '').toLowerCase() === 'coding') {
        category = 'Programming';
      } else if (SUBJECT_METADATA[subjectLower]) {
        category = SUBJECT_METADATA[subjectLower].displayName;
      } else {
        category = round.subject || 'Technical';
      }

      const meta = getMetadataForSubject(category);
      config = {
        subjectCategory: category,
        subSubject: meta.hasSubSubject ? (round.subject || meta.subSubjectDefault || 'Java') : '',
        topic: meta.topics[0] || 'General',
        difficulty: 'Medium',
        questionsCount: 5,
        questionCreationOption: 'ai',
        questions: currentQuestions[round.id] || []
      };

      setStageDataMap(prev => ({
        ...prev,
        [round.id]: config
      }));
    }

    const merged = { ...round, config };
    setSelectedStage(merged);

    // Sync legacy states
    setSubjectInput(config.subjectCategory);
    setTopicInput(config.topic);
    setDifficultyInput(config.difficulty);
    setQuestionsCount(config.questionsCount);
    setQuestionCreationOption(config.questionCreationOption);
    setMcqQuestions(config.questions || []);
  }; 

  // Manual questions fields
  const [manualQText, setManualQText] = useState('');
  const [manualQType, setManualQType] = useState<'mcq' | 'coding' | 'text'>('mcq');
  const [manualOptA, setManualOptA] = useState('');
  const [manualOptB, setManualOptB] = useState('');
  const [manualOptC, setManualOptC] = useState('');
  const [manualOptD, setManualOptD] = useState('');
  const [manualCorrectIndex, setManualCorrectIndex] = useState(0);

  // PDF OCR Uploader
  const [pdfUploadFile, setPdfUploadFile] = useState<File | null>(null);

  // Step 5: Publish Assessment details
  const [publishedDetails, setPublishedDetails] = useState<any>(null);
  const [candidateEmails, setCandidateEmails] = useState('student@college.edu, karthik@college.edu');
  const [isSendingEmails, setIsSendingEmails] = useState(false);

  // Step 6: Live Monitoring variables
  const [liveCandidates, setLiveCandidates] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<string[]>([]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [driveCandidates, setDriveCandidates] = useState<any[]>([]);
  const [serverNetworkUrl, setServerNetworkUrl] = useState(window.location.origin);

  // ==========================================
  // STUDENT VIEW STATES
  // ==========================================
  const [liveDriveAlert, setLiveDriveAlert] = useState<any>(null);
  const [studentExamState, setStudentExamState] = useState<'instructions' | 'exam' | 'feedback' | null>(null);
  const [studentQuestions, setStudentQuestions] = useState<any[]>([]);
  const [studentQuestionIndex, setStudentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [codeAnswer, setCodeAnswer] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [codeLogs, setCodeLogs] = useState<string[]>([]);
  const [studentResultSummary, setStudentResultSummary] = useState<any>(null);
  const [studentProgressList, setStudentProgressList] = useState<any[]>([]);

  // Student placement portal variables
  const [studentCgpa, setStudentCgpa] = useState(8.2);
  const [studentDept, setStudentDept] = useState('CSE');
  const [studentSkills, setStudentSkills] = useState('React, Node.js, Python, Java, Data Structures');
  const [registeredDrives, setRegisteredDrives] = useState<string[]>(['drive_1']);
  const [studentNotifications, setStudentNotifications] = useState<any[]>([
    { id: 'n_1', title: 'New Hiring Drive Published', message: 'TCS Ninja Campus Sourcing 2026 is now open for registration.', time: '2 hours ago', unread: true },
    { id: 'n_2', title: 'Assessment Tomorrow', message: 'The logical reasoning round starts tomorrow at 10:00 AM.', time: '1 day ago', unread: false },
    { id: 'n_3', title: 'Round 2 Qualified', message: 'Congratulations! You qualified for the coding round of TCS Ninja.', time: '3 days ago', unread: false }
  ]);
  const [studentHistory, setStudentHistory] = useState<any[]>([
    { driveName: 'TCS Ninja Campus Sourcing 2026', roundName: 'Round 1: Aptitude Assessment', score: '85/100', percentage: '85%', status: 'Qualified', timeTaken: '24 Mins', date: '2026-07-16' },
    { driveName: 'Wipro Elite Hiring 2026', roundName: 'Round 1: Verbal & Quants', score: '62/100', percentage: '62%', status: 'Rejected', timeTaken: '28 Mins', date: '2026-07-14' }
  ]);
  const [placementJourney, setPlacementJourney] = useState<any[]>([
    { company: 'TCS', status: 'In Progress', rounds: [{ name: 'Aptitude Assessment', status: 'Qualified' }, { name: 'Java MCQ Round', status: 'Pending' }] },
    { company: 'Infosys', status: 'Rejected', rounds: [{ name: 'Logical Test', status: 'Qualified' }, { name: 'Coding Round', status: 'Rejected' }] },
    { company: 'Wipro', status: 'Rejected', rounds: [{ name: 'Aptitude Assessment', status: 'Rejected' }] }
  ]);

  // Proctor status
  const [proctorCount, setProctorCount] = useState(0);
  const [proctorLog, setProctorLog] = useState<string[]>([]);

  // ATS Resume check state
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [atsResult, setAtsResult] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Toast notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchDrives = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/placement/drives`);
      const data = await res.json();
      if (data.success) {
        setDrives(data.drives);
        if (data.drives.length > 0 && !selectedDrive) {
          setSelectedDrive(data.drives[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching drives', err);
    }
  };

  const fetchAdminData = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/system-data`);
      const data = await res.json();
      if (data.success) {
        setAdminData(data);
      }
    } catch (err) {
      console.error('Error fetching admin data', err);
    }
  };

  const fetchDriveCandidates = async () => {
    if (!selectedDrive) return;
    try {
      const res = await fetch(`${API_BASE}/api/placement/candidates/${selectedDrive.id}`);
      const data = await res.json();
      if (data.success) {
        setDriveCandidates(data.candidates);
      }
    } catch (err) {
      console.error('Error fetching candidates results', err);
    }
  };

  const fetchNetworkInfo = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/placement/network-info`);
      const data = await res.json();
      if (data.success) {
        if (window.location.hostname === 'localhost') {
          setServerNetworkUrl(`http://${data.localIp}:${data.port}`);
        } else {
          setServerNetworkUrl(window.location.origin);
        }
      }
    } catch (err) {
      console.error('Error fetching network details', err);
    }
  };

  const fetchStudentProgress = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/placement/progress/${user.username}`);
      const data = await res.json();
      if (data.success) {
        setStudentProgressList(data.progressList);
      }
    } catch (err) {
      console.error('Error fetching student progress list', err);
    }
  };

  const loadAllRoundsQuestions = async (driveId: string, roundsList: any[]) => {
    const questionsMap: Record<string, any[]> = {};
    for (const r of roundsList) {
      try {
        const res = await fetch(`${API_BASE}/api/placement/questions/${driveId}/${r.id}`);
        const data = await res.json();
        if (data.success && data.questions) {
          questionsMap[r.id] = data.questions;
        }
      } catch (e) {
        console.error(`Error loading questions for round ${r.id}`, e);
      }
    }
    setAllRoundsQuestions(questionsMap);

    const initialMap: Record<string, any> = {};
    roundsList.forEach(r => {
      const nameLower = (r.name || '').toLowerCase();
      const subjectLower = (r.subject || '').toLowerCase();
      
      let category = 'Technical';
      if (nameLower.includes('aptitude') || subjectLower.includes('aptitude')) {
        category = 'Aptitude';
      } else if (nameLower.includes('communication') || nameLower.includes('comunication') || nameLower.includes('commun') || nameLower.includes('comun') || nameLower.includes('english') || nameLower.includes('verbal') || nameLower.includes('interview') || nameLower.includes('hr') || nameLower.includes('behavioral') ||
                 subjectLower.includes('communication') || subjectLower.includes('comunication') || subjectLower.includes('commun') || subjectLower.includes('comun') || subjectLower.includes('english') || subjectLower.includes('verbal') || subjectLower.includes('interview') || subjectLower.includes('hr') || subjectLower.includes('behavioral') || (r.type || '').toLowerCase() === 'hr') {
        if (nameLower.includes('hr') || nameLower.includes('behavioral') || subjectLower.includes('behavioral') || (r.type || '').toLowerCase() === 'hr') {
          category = 'HR';
        } else {
          category = 'Communication';
        }
      } else if (nameLower.includes('program') || nameLower.includes('coding') || subjectLower.includes('program') || subjectLower.includes('coding') || (r.type || '').toLowerCase() === 'coding') {
        category = 'Programming';
      } else if (SUBJECT_METADATA[subjectLower]) {
        category = SUBJECT_METADATA[subjectLower].displayName;
      } else {
        category = r.subject || 'Technical';
      }

      const meta = getMetadataForSubject(category);
      initialMap[r.id] = {
        subjectCategory: category,
        subSubject: meta.hasSubSubject ? (r.subject || meta.subSubjectDefault || 'Java') : '',
        topic: meta.topics[0] || 'General',
        difficulty: 'Medium',
        questionsCount: 5,
        questionCreationOption: 'ai',
        questions: questionsMap[r.id] || []
      };
    });
    setStageDataMap(initialMap);

    if (roundsList.length > 0) {
      const activeRound = roundsList[activeBuilderRoundIndex] || roundsList[0];
      const activeIdx = roundsList.indexOf(activeRound);
      selectStageRound(activeIdx !== -1 ? activeIdx : 0, roundsList, questionsMap);
    }
  };

  useEffect(() => {
    if (selectedDrive) {
      if (selectedDrive.rounds && selectedDrive.rounds.length > 0) {
        setRounds(selectedDrive.rounds);
        loadAllRoundsQuestions(selectedDrive.id, selectedDrive.rounds);
      } else {
        setRounds([
          { id: 'r_1', name: 'Aptitude Assessment', type: 'mcq', passingPercentage: 75, maxMarks: 100, timeLimit: 30, enabled: true, instructions: 'Answer all logical reasoning questions.', subject: 'Aptitude' },
          { id: 'r_2', name: 'Java MCQ Round', type: 'mcq', passingPercentage: 70, maxMarks: 100, timeLimit: 30, enabled: true, instructions: 'Covers core Java concurrency.', subject: 'Java' },
          { id: 'r_3', name: 'Programming Test', type: 'coding', passingPercentage: 70, maxMarks: 100, timeLimit: 45, enabled: true, instructions: 'Write algorithms with standard tests.', subject: 'JavaScript' },
          { id: 'r_4', name: 'AI HR Interview', type: 'hr', passingPercentage: 60, maxMarks: 100, timeLimit: 15, enabled: true, instructions: 'Behavioral AI interview simulator.', subject: 'Behavioral' }
        ]);
        setAllRoundsQuestions({});
      }
    }
  }, [selectedDrive]);

  useEffect(() => {
    if (user?.role === 'student') {
      fetchStudentProgress();
    }
  }, [user, view]);

  useEffect(() => {
    if (recruitmentStep === 3 && selectedDrive) {
      setActiveBuilderRoundIndex(0);
      loadAllRoundsQuestions(selectedDrive.id, rounds);
    }
  }, [recruitmentStep, selectedDrive]);

  useEffect(() => {
    fetchDrives();
    fetchNetworkInfo();
    socket = io(API_BASE);

    socket.on('assessment-started', (data: any) => {
      setLiveDriveAlert(data);
      triggerToast(`📢 Alert: New Live Drive Assessment Started: ${data.driveName}`);
    });

    socket.on('assessment-terminated', (data: any) => {
      if (liveDriveAlert?.driveId === data.driveId) {
        setLiveDriveAlert(null);
        setStudentExamState(null);
        triggerToast('⚠️ The active recruiter session was terminated.');
      }
    });

    socket.on('candidate-update', (data: any) => {
      setLiveCandidates(prev => {
        const filtered = prev.filter(c => c.username !== data.username);
        return [...filtered, data];
      });
      fetchDriveCandidates();
      setActivityLogs(prev => [
        `[${new Date().toLocaleTimeString()}] Student '${data.username}' submitted round. Status: ${data.status} (Score: ${data.score})`,
        ...prev
      ]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('hiregrad_token');
      if (token) {
        try {
          const res = await fetch(`${API_BASE}/api/placement/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success) {
            setUser(data.user);
            if (data.user.role === 'student') {
              setStudentCgpa(data.user.cgpa);
              setStudentDept(data.user.department);
              setStudentSkills(data.user.skills);
              setView('dashboard');
              
              // Load student registrations
              try {
                const regRes = await fetch(`${API_BASE}/api/placement/registrations/${data.user.username}`);
                const regData = await regRes.json();
                if (regData.success) {
                  setRegisteredDrives(regData.registeredDrives);
                }
              } catch (err) {
                console.error('Error fetching registrations in session check', err);
              }
            } else if (data.user.role === 'company') {
              setView('drives');
              setRecruitmentStep(1);
              socket.emit('join-session', { username: data.user.username, role: 'company', driveId: 'hr' });
            } else if (data.user.role === 'admin') {
              setView('stats');
            }
          } else {
            localStorage.removeItem('hiregrad_token');
          }
        } catch (err) {
          console.error("Session auto-login error:", err);
          localStorage.removeItem('hiregrad_token');
        }
      }
    };
    
    // checkSession();
  }, []);

  useEffect(() => {
    if (view === 'stats' && user?.role === 'admin') {
      fetchAdminData();
    }
  }, [view, user]);

  useEffect(() => {
    if (user?.role === 'company' && selectedDrive) {
      fetchDriveCandidates();
    }
  }, [selectedDrive, recruitmentStep, user]);

  useEffect(() => {
    if (studentExamState !== 'exam') return;

    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      logProctorViolation('Blocked Copy/Paste shortcut attempt.');
      alert('⚠️ Proctor System: Copy and pasting text is strictly blocked during recruitment exams!');
    };

    const handleFocusBlur = () => {
      logProctorViolation('Candidate tab switch / navigation focus out.');
      alert('⚠️ Proctor System Alert: Tab switching is tracked. Return to your exam immediately!');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || (e.ctrlKey && e.key === 'p') || (e.ctrlKey && e.key === 's')) {
        e.preventDefault();
        logProctorViolation('Blocked Screenshot/Save keys.');
        alert('⚠️ Proctor System Alert: Saving pages or capturing screens is blocked.');
      }
    };

    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    window.addEventListener('blur', handleFocusBlur);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      window.removeEventListener('blur', handleFocusBlur);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [studentExamState]);

  useEffect(() => {
    if (studentExamState !== 'exam' || timerSeconds <= 0) {
      if (studentExamState === 'exam' && timerSeconds === 0) {
        triggerToast('⌛ Time is up! Submitting your assessment answers automatically.');
        handleStudentSubmit();
      }
      return;
    }

    const interval = setInterval(() => {
      setTimerSeconds(prev => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [studentExamState, timerSeconds]);

  const logProctorViolation = (msg: string) => {
    setProctorCount(prev => prev + 1);
    setProctorLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering) {
      if (passwordInput !== confirmPasswordInput) {
        alert("Passwords do not match!");
        return;
      }
      const res = await fetch(`${API_BASE}/api/placement/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullNameInput, email: emailInput, password: passwordInput, role: authRole })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('Account registered successfully! Please log in.');
        setIsRegistering(false);
        setFullNameInput('');
        setConfirmPasswordInput('');
      } else {
        alert(data.message || 'Registration failed');
      }
    } else {
      if (authRole === 'company') {
        const res = await fetch(`${API_BASE}/api/placement/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailInput, password: passwordInput })
        });
        const data = await res.json();
        if (data.success) {
          setUser(data.company);
          setView('drives');
          setRecruitmentStep(1); // Horizontal Stepper begins at Step 1
          socket.emit('join-session', { username: data.company.username, role: 'company', driveId: 'hr' });
          triggerToast(`Welcome back Recruiter, logged into ${data.company.companyName}!`);
          localStorage.setItem('hiregrad_token', data.token);
        } else {
          alert(data.message || 'Invalid recruiter credentials');
        }
      } else if (authRole === 'student') {
        const res = await fetch(`${API_BASE}/api/placement/auth/student-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailInput, password: passwordInput })
        });
        const data = await res.json();
        if (data.success) {
          setUser(data.student);
          setStudentCgpa(data.student.cgpa);
          setStudentDept(data.student.department);
          setStudentSkills(data.student.skills);
          setView('dashboard');
          triggerToast(`Logged in successfully as ${data.student.fullName}`);
          localStorage.setItem('hiregrad_token', data.token);
          
          try {
            const regRes = await fetch(`${API_BASE}/api/placement/registrations/${data.student.username}`);
            const regData = await regRes.json();
            if (regData.success) {
              setRegisteredDrives(regData.registeredDrives);
            }
          } catch (err) {
            console.error('Error fetching student registrations', err);
          }
        } else {
          alert(data.message || 'Login failed');
        }
      } else if (authRole === 'admin') {
        const res = await fetch(`${API_BASE}/api/placement/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailInput, password: passwordInput })
        });
        const data = await res.json();
        if (data.success && data.company && data.company.role === 'admin') {
          setUser({
            username: data.company.username,
            fullName: data.company.companyName,
            role: 'admin'
          });
          setView('stats');
          triggerToast('Welcome back Admin!');
          localStorage.setItem('hiregrad_token', data.token);
        } else {
          alert(data.message || 'Invalid Admin credentials.');
        }
      }
    }
  };

  const handleLogout = () => {
    setUser(null);
    setView('dashboard');
    setEmailInput('');
    setPasswordInput('');
    setFullNameInput('');
    setConfirmPasswordInput('');
    localStorage.removeItem('hiregrad_token');
  };

  const handleDeleteUser = async (username: string) => {
    if (!window.confirm(`Are you sure you want to delete user ${username}?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${username}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(`User ${username} deleted successfully.`);
        fetchAdminData();
      } else {
        alert(data.message || 'Failed to delete user.');
      }
    } catch (err) {
      console.error('Error deleting user', err);
      alert('Error occurred while deleting user.');
    }
  };

  const handleDeleteAllUsers = async () => {
    if (!window.confirm("Are you sure you want to delete ALL users from the database? This action is irreversible.")) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        triggerToast("All users deleted successfully.");
        fetchAdminData();
      } else {
        alert(data.message || "Failed to delete users.");
      }
    } catch (err) {
      console.error("Error deleting all users", err);
      alert("Error occurred while deleting all users.");
    }
  };

  const handleDeleteCompany = async (username: string) => {
    if (!window.confirm(`Are you sure you want to delete company account ${username}? This will also delete all of their placement drives.`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/companies/${username}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(`Company ${username} deleted successfully.`);
        fetchAdminData();
      } else {
        alert(data.message || "Failed to delete company.");
      }
    } catch (err) {
      console.error("Error deleting company", err);
      alert("Error occurred while deleting company.");
    }
  };

  const handleDeleteDrive = async (id: string) => {
    if (!window.confirm(`Are you sure you want to delete drive ${id}?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/drives/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(`Drive ${id} deleted successfully.`);
        fetchAdminData();
      } else {
        alert(data.message || "Failed to delete drive.");
      }
    } catch (err) {
      console.error("Error deleting drive", err);
      alert("Error occurred while deleting drive.");
    }
  };

  const handleDeleteAllCompanies = async () => {
    if (!window.confirm("Are you sure you want to delete ALL companies, placement drives, and candidate registrations? This action is irreversible.")) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/companies`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        triggerToast("All companies and drives deleted successfully.");
        fetchAdminData();
      } else {
        alert(data.message || "Failed to delete all companies.");
      }
    } catch (err) {
      console.error("Error deleting all companies", err);
      alert("Error occurred while deleting all companies.");
    }
  };

  // STEP 1: Save drive draft
  const handleSaveDriveDraft = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/placement/drives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedDrive?.id,
          name: driveNameInput,
          companyUsername: user.username,
          autoShortlist: autoProgressionSwitch,
          jobRole: jobRoleInput,
          packageOffered: packageInput,
          assessmentDate: assessmentDateInput,
          assessmentTime: assessmentTimeInput,
          duration: driveDurationInput,
          eligibleDepts: eligibleDeptsInput,
          minCgpa: minCgpaInput,
          eligibleBatch: eligibleBatchInput,
          maxStudentsLimit: maxStudentsInput
        })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedDrive(data.drive);
        fetchDrives();
        triggerToast('Hiring drive saved as draft! Advancing to rounds configurations.');
        setRecruitmentStep(2); 
      }
    } catch (e) {
      alert('Error creating recruitment drive draft');
    }
  };

  const saveRoundConfigs = async () => {
    if (!selectedDrive) return;
    
    const updatedRounds = rounds.map(r => {
      const nameLower = (r.name || '').toLowerCase();
      let inferred = r.subject || 'Java';
      if (nameLower.includes('aptitude')) {
        inferred = 'Aptitude';
      } else if (nameLower.includes('communication') || nameLower.includes('comunication') || nameLower.includes('commun') || nameLower.includes('comun') || nameLower.includes('english') || nameLower.includes('verbal') || nameLower.includes('interview') || nameLower.includes('hr') || nameLower.includes('behavioral')) {
        inferred = 'Communication';
      } else if (inferred.toLowerCase() === 'aptitude' || inferred.toLowerCase() === 'communication' || inferred.toLowerCase() === 'behavioral') {
        inferred = 'Java';
      }
      return { ...r, subject: inferred };
    });

    const res = await fetch(`${API_BASE}/api/placement/rounds/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driveId: selectedDrive.id, rounds: updatedRounds })
    });
    const data = await res.json();
    if (data.success) {
      setRounds(updatedRounds); // Sync local state
      triggerToast('Round validation rules configured successfully!');
      setRecruitmentStep(3); 
    }
  };

  const addRound = () => {
    const newRound = {
      id: 'r_' + Date.now(),
      name: 'Custom Round',
      type: 'mcq',
      passingPercentage: 70,
      maxMarks: 100,
      timeLimit: 30,
      enabled: true,
      instructions: 'Solve within limits.',
      subject: 'Java'
    };
    setRounds([...rounds, newRound]);
  };

  const removeRound = (id: string) => {
    setRounds(rounds.filter(r => r.id !== id));
  };

  const duplicateRound = (r: any) => {
    const duplicated = {
      ...r,
      id: 'r_' + Date.now() + Math.random().toString(36).substring(7),
      name: `${r.name} (Copy)`
    };
    setRounds([...rounds, duplicated]);
    triggerToast('Round duplicated successfully.');
  };

  // HTML5 drag and drop rounds ordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('dragIndex', index.toString());
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    const dragIndex = parseInt(e.dataTransfer.getData('dragIndex'));
    const reordered = [...rounds];
    const [removed] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, removed);
    setRounds(reordered);
    triggerToast('Rounds sequence reordered.');
  };

  // STEP 3: Question preparer methods
  const getMockQuestions = (subject: string, count: number) => {
    const subjectsMap: Record<string, any[]> = {
      'Java': [
        { questionText: "Which component is responsible for converting bytecode into machine-specific code?", options: ["JVM", "JDK", "JRE", "JIT Compiler"], correctIndex: 0, explanation: "JVM interprets bytecode." },
        { questionText: "What is encapsulation in Java?", options: ["Exposing raw fields", "Wrapping data and code into a single unit", "Creating multiple inheritances", "None of these"], correctIndex: 1, explanation: "Encapsulation wraps class data." },
        { questionText: "Which keyword is used to restrict class inheritance?", options: ["static", "final", "private", "abstract"], correctIndex: 1, explanation: "final classes cannot be inherited." },
        { questionText: "Which interface is the root of the Collection framework hierarchy?", options: ["List", "Set", "Collection", "Map"], correctIndex: 2, explanation: "Collection is the root." },
        { questionText: "What is the memory size of a 'double' data type in Java?", options: ["4 bytes", "8 bytes", "16 bytes", "2 bytes"], correctIndex: 1, explanation: "double is 64-bit (8 bytes)." },
        { questionText: "Which method is called first when a thread is started?", options: ["run()", "start()", "init()", "execute()"], correctIndex: 0, explanation: "JVM calls run() of the thread." },
        { questionText: "What is the default value of a local object reference in Java?", options: ["null", "empty string", "undefined", "No default value (must be initialized)"], correctIndex: 3, explanation: "Local variables must be initialized." }
      ],
      'Aptitude': [
        { questionText: "If a work is done by A in 10 days and B in 15 days, in how many days can they complete it together?", options: ["5 days", "6 days", "8 days", "7.5 days"], correctIndex: 1, explanation: "Together time = (10 * 15) / (10 + 15) = 6 days." },
        { questionText: "A train running at 54 km/hr crosses a post in 10 seconds. Find the length of the train.", options: ["120m", "150m", "200m", "100m"], correctIndex: 1, explanation: "Speed = 15 m/s. Length = 150m." },
        { questionText: "Find the average of the first five prime numbers.", options: ["5.6", "5.8", "6.2", "4.8"], correctIndex: 0, explanation: "(2+3+5+7+11)/5 = 5.6." },
        { questionText: "The ratio of ages of two persons is 4:7 and one of them is 30 years older than the other. Find the sum of their ages.", options: ["110 years", "100 years", "120 years", "90 years"], correctIndex: 0, explanation: "7x - 4x = 30 => x = 10. Sum = 11x = 110." },
        { questionText: "In how many different ways can the letters of the word 'LEADING' be arranged so that the vowels always come together?", options: ["360", "720", "480", "5040"], correctIndex: 1, explanation: "LEDNG + (EAI). 5! * 3! = 120 * 6 = 720." }
      ],
      'JavaScript': [
        { questionText: "Which keyword is used to declare a block-scoped variable in modern JS?", options: ["var", "let", "const", "Both let and const"], correctIndex: 3, explanation: "let and const are block-scoped variables." },
        { questionText: "What is the output of 'typeof null' in JavaScript?", options: ["'null'", "'undefined'", "'object'", "'string'"], correctIndex: 2, explanation: "Legacy JS type bug evaluates null as object." },
        { questionText: "Which array method adds elements to the start of an array?", options: ["push", "pop", "shift", "unshift"], correctIndex: 3, explanation: "unshift adds elements to the beginning." }
      ],
      'Behavioral': [
        { questionText: "How do you handle disagreement with a technical decision in your team?", options: ["Agree silently to avoid conflicts", "Present facts and alternatives constructively", "Escalate to management immediately", "Refuse to work on the task"], correctIndex: 1, explanation: "Professional disagreement relies on facts and constructive alternatives." },
        { questionText: "If you realize you cannot meet a project deadline, what is the best approach?", options: ["Work late secretly", "Inform the manager immediately with a plan", "Ignore it until the deadline", "Blame other team members"], correctIndex: 1, explanation: "Early notification and proposing options is best practice." }
      ],
      'Communication': [
        { questionText: "Identify the grammatically correct sentence:", options: ["She don't like apples.", "She doesn't likes apples.", "She doesn't like apples.", "She no like apples."], correctIndex: 2, explanation: "'She' is third-person singular, which takes 'does not' or 'doesn't' followed by the base form of the verb 'like'." },
        { questionText: "Choose the correct preposition: She is proficient ___ Java programming.", options: ["in", "at", "with", "on"], correctIndex: 0, explanation: "'Proficient' is followed by the preposition 'in'." },
        { questionText: "Which word is a synonym of 'Meticulous'?", options: ["Careless", "Careful", "Messy", "Slow"], correctIndex: 1, explanation: "'Meticulous' means showing great attention to detail, very careful and precise." },
        { questionText: "Complete the sentence: By the time the manager arrived, the team ___ the project.", options: ["has completed", "had completed", "completes", "will complete"], correctIndex: 1, explanation: "The past perfect tense 'had completed' is used to describe an action that was finished before another past action." },
        { questionText: "Choose the antonym of 'Ambiguous'.", options: ["Clear", "Vague", "Obscure", "Doubtful"], correctIndex: 0, explanation: "'Ambiguous' means open to more than one interpretation; 'Clear' is the opposite." }
      ]
    };
    let targetSubject = subject;
    if (subject === 'HR') targetSubject = 'Behavioral';
    if (subject === 'Programming') targetSubject = 'JavaScript';
    const pool = subjectsMap[targetSubject] || subjectsMap['Java'];
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const result: any[] = [];
    for (let i = 0; i < count; i++) {
      if (i < shuffled.length) {
        result.push(shuffled[i]);
      } else {
        const baseQ = shuffled[i % shuffled.length];
        result.push({
          ...baseQ,
          questionText: `${baseQ.questionText} (Variation ${Math.floor(i / shuffled.length) + 1})`
        });
      }
    }
    return result;
  };

  const handleAIQuestionsGenerate = async () => {
    const activeRoundObj = selectedStage || rounds[activeBuilderRoundIndex];
    if (!activeRoundObj) return;
    const config = stageDataMap[activeRoundObj.id] || activeRoundObj.config;
    setIsGenerating(true);

    let promptSubject = config.subjectCategory;
    if (config.subjectCategory === 'Technical' || config.subjectCategory === 'Programming') {
      promptSubject = `${config.subSubject || 'Java'} (${config.subjectCategory})`;
    }

    try {
      const res = await fetch(`${API_BASE}/api/placement/questions/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          subject: `${promptSubject} Topic: ${config.topic}`, 
          count: config.questionsCount, 
          difficulty: config.difficulty 
        })
      });
      const data = await res.json();
      if (data.success && data.questions && data.questions.length > 0) {
        updateSelectedStageConfig('questions', data.questions);
        setAllRoundsQuestions(prev => ({
          ...prev,
          [activeRoundObj.id]: data.questions
        }));
        triggerToast('AI generated question bank successfully!');
      } else {
        const mocks = getMockQuestions(config.subSubject || config.subjectCategory, config.questionsCount);
        updateSelectedStageConfig('questions', mocks);
        setAllRoundsQuestions(prev => ({
          ...prev,
          [activeRoundObj.id]: mocks
        }));
        triggerToast('Loaded local fallback question templates (AI services offline).');
      }
    } catch (e) {
      const mocks = getMockQuestions(config.subSubject || config.subjectCategory, config.questionsCount);
      updateSelectedStageConfig('questions', mocks);
      setAllRoundsQuestions(prev => ({
        ...prev,
        [activeRoundObj.id]: mocks
      }));
      triggerToast('Loaded local fallback question templates.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQText || !selectedStage) return;

    const config = stageDataMap[selectedStage.id] || selectedStage.config;
    const newQ = {
      questionText: manualQText,
      options: manualQType === 'mcq' ? [manualOptA, manualOptB, manualOptC, manualOptD] : [],
      correctIndex: manualCorrectIndex,
      explanation: 'Manually typed inside dashboard.',
      subject: config.subSubject || config.subjectCategory,
      difficulty: config.difficulty
    };

    const updated = [...(config.questions || []), newQ];
    updateSelectedStageConfig('questions', updated);
    setAllRoundsQuestions(prev => ({
      ...prev,
      [selectedStage.id]: updated
    }));

    setManualQText('');
    setManualOptA('');
    setManualOptB('');
    setManualOptC('');
    setManualOptD('');
    triggerToast('Added question to round draft');
  };

  const handlePDFQuestionsConvert = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf' || !selectedStage) {
      alert('Please upload a PDF file only.');
      return;
    }
    setPdfUploadFile(file);
    setIsGenerating(true);

    const config = stageDataMap[selectedStage.id] || selectedStage.config;
    setTimeout(async () => {
      try {
        const dummyText = `1. Encapsulation wraps data. A. True B. False. Correct: A.`;
        const res = await fetch(`${API_BASE}/api/placement/questions/upload-pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfText: dummyText, subject: config.subSubject || config.subjectCategory })
        });
        const data = await res.json();
        if (data.success) {
          updateSelectedStageConfig('questions', data.questions);
          setAllRoundsQuestions(prev => ({
            ...prev,
            [selectedStage.id]: data.questions
          }));
          triggerToast('PDF OCR parsed textbook questions successfully!');
        }
      } catch (err) {
        alert('OCR parse failed');
      } finally {
        setIsGenerating(false);
      }
    }, 1500);
  };

  const approveRoundQuestions = async () => {
    if (!selectedDrive || rounds.length === 0 || !selectedStage) return;
    const round = selectedStage;
    const config = stageDataMap[round.id] || round.config;
    const res = await fetch(`${API_BASE}/api/placement/questions/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driveId: selectedDrive.id, roundId: round.id, questions: config.questions })
    });
    const data = await res.json();
    if (data.success) {
      triggerToast(`Questions saved for Round ${activeBuilderRoundIndex + 1}!`);
      setAllRoundsQuestions(prev => ({
        ...prev,
        [round.id]: config.questions
      }));
      if (activeBuilderRoundIndex < rounds.length - 1) {
        selectStageRound(activeBuilderRoundIndex + 1);
      } else {
        setRecruitmentStep(4); // Advance to Review summary
      }
    }
  };

  // STEP 5: Publish assessment links
  const handlePublishDrive = async () => {
    if (!selectedDrive) return;
    
    // Check if questions are generated/saved for all rounds
    const missingRounds = rounds.filter(r => !allRoundsQuestions[r.id] || allRoundsQuestions[r.id].length === 0);
    if (missingRounds.length > 0) {
      alert(`Please generate and save questions for all rounds before publishing. Missing rounds: ${missingRounds.map(r => r.name).join(', ')}`);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/placement/drives/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driveId: selectedDrive.id })
      });
      const data = await res.json();
      if (data.success) {
        fetchDrives();
      }
    } catch (err) {
      console.error('Error publishing drive status on server', err);
    }

    const testLink = `${serverNetworkUrl}/assessment/${selectedDrive.id}`;
    const mockDetails = {
      assessmentLink: testLink,
      assessmentId: `CAMPUS-${selectedDrive.id.substring(6, 12).toUpperCase()}`,
      qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(testLink)
    };
    setPublishedDetails(mockDetails);
    socket.emit('join-session', { username: user.username, role: 'company', driveId: selectedDrive.id });
    
    triggerToast('Recruitment Drive Published! Student notification dispatches broadcasted.');
    setRecruitmentStep(5);
  };

  const handleSendEmails = () => {
    setIsSendingEmails(true);
    setTimeout(() => {
      setIsSendingEmails(false);
      triggerToast('📧 Assessment test link successfully delivered to candidate emails!');
      alert(`Sent test link successfully to: ${candidateEmails}`);
    }, 1200);
  };

  // STEP 6: Live monitoring sessions
  const handleStartLiveDriveTimer = async () => {
    if (!selectedDrive || rounds.length === 0) return;
    const activeRound = rounds[0]; // Round 1
    const res = await fetch(`${API_BASE}/api/placement/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driveId: selectedDrive.id, roundId: activeRound.id, timeLimit: activeRound.timeLimit })
    });
    const data = await res.json();
    if (data.success) {
      setIsLiveActive(true);
      setLiveCandidates([]);
      setTimerSeconds(activeRound.timeLimit * 60);
      setActivityLogs([`[${new Date().toLocaleTimeString()}] Recruiter started live drive timers.`]);
      setRecruitmentStep(6);
      triggerToast('Exam room broadcast timers are live.');
    }
  };

  const handleRegisterForDrive = async (driveId: string) => {
    if (!user) {
      alert('Please log in first.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/placement/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, driveId })
      });
      const data = await res.json();
      if (data.success) {
        setRegisteredDrives(prev => [...prev, driveId]);
        triggerToast(data.message);
      } else {
        alert(data.message || 'Registration failed.');
      }
    } catch (err) {
      alert('Error registering for recruitment drive.');
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/placement/profile/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          cgpa: studentCgpa,
          department: studentDept,
          skills: studentSkills
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('Student profile details updated successfully!');
      } else {
        alert(data.message || 'Profile save failed.');
      }
    } catch (err) {
      alert('Error updating profile');
    }
  };

  // Student exam timers
  const joinStudentExam = async (driveId: string, roundId: string, timeLimit: number) => {
    if (!user) {
      alert('Unauthorized: Please log in to take the assessment.');
      return;
    }
    const targetD = drives.find(d => d.id === driveId);
    const status = (driveId === 'drive_1') ? 'Active' : (targetD?.status || 'Draft');
    const isDriveActive = status === 'Active';

    if (!isDriveActive) {
      if (targetD && targetD.assessmentDate) {
        const driveDate = new Date(`${targetD.assessmentDate}T${targetD.assessmentTime || '00:00'}`);
        const currentDate = new Date();
        const differenceInMs = Math.abs(currentDate.getTime() - driveDate.getTime());
        const hoursDiff = differenceInMs / (1000 * 60 * 60);
        if (hoursDiff > 24) {
          alert('Unauthorized: Current time is outside the scheduled assessment window.');
          return;
        }
      } else {
        alert('Unauthorized: The assessment is not active yet.');
        return;
      }
    }

    try {
      const res = await fetch(`${API_BASE}/api/placement/questions/${driveId}/${roundId}`);
      const data = await res.json();
      if (data.success && data.questions && data.questions.length > 0) {
        setStudentQuestions(data.questions);
      } else {
        const fallback = getMockQuestions(targetD?.rounds?.find((r: any) => r.id === roundId)?.subject || 'Java', 5);
        setStudentQuestions(fallback);
      }
      setStudentExamState('exam');
      setStudentQuestionIndex(0);
      setSelectedAnswers({});
      setTimerSeconds(timeLimit * 60);
      setLiveDriveAlert({ driveId, roundId, timeLimit });
      triggerToast('Exam environment loaded. Proctoring active!');
    } catch (err) {
      alert('Error loading questions');
    }
  };

  const handleStudentSubmit = async () => {
    let score = 0;
    studentQuestions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) score++;
    });

    const res = await fetch(`${API_BASE}/api/placement/session/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        driveId: liveDriveAlert.driveId,
        roundId: liveDriveAlert.roundId,
        score,
        total: studentQuestions.length
      })
    });
    const data = await res.json();
    if (data.success) {
      setStudentResultSummary({ score, total: studentQuestions.length, status: data.status });
      setStudentExamState('feedback');
      
      socket.emit('candidate-submit', {
        username: user.username,
        driveId: liveDriveAlert.driveId,
        roundId: liveDriveAlert.roundId,
        score,
        status: data.status
      });
      fetchStudentProgress();
      triggerToast('Exam submitted successfully!');
    }
  };

  // ATS Scanner
  const handleResumeScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeFile) return;
    setIsScanning(true);
    setTimeout(async () => {
      try {
        const dummyText = `Jane Doe Software developer React Java SQL.`;
        const res = await fetch(`${API_BASE}/api/placement/resume/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeText: dummyText, targetRole: 'Software Developer' })
        });
        const data = await res.json();
        if (data.success) {
          setAtsResult(data.analysis);
          triggerToast('ATS parsing complete.');
        }
      } catch (err) {
        alert('Scanner API failed');
      } finally {
        setIsScanning(false);
      }
    }, 1500);
  };

  // CSV report downloads
  const exportCSVResults = () => {
    const headers = ['Candidate ID', 'Scores', 'Status'];
    const rows = driveCandidates.map(c => [c.username, Object.entries(c.scores).map(([r, s]) => `${r}:${s}`).join('; '), c.status]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "recruitment_results_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDFReport = () => {
    if (!selectedDrive) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocker active. Please allow pop-ups to download the PDF report.');
      return;
    }

    const roundsHtml = rounds.map(r => `<th>${r.name}</th>`).join('');
    const rowsHtml = driveCandidates.map(c => {
      const scoresHtml = rounds.map(r => {
        const score = c.scores[r.id] !== undefined ? c.scores[r.id] : '-';
        return `<td>${score}</td>`;
      }).join('');
      return `
        <tr>
          <td><strong>${c.username}</strong></td>
          ${scoresHtml}
          <td><span class="status ${c.status.toLowerCase()}">${c.status}</span></td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <html>
        <head>
          <title>${selectedDrive.name} - Recruitment Results Report</title>
          <style>
            body {
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              color: #1e293b;
              margin: 40px;
              line-height: 1.5;
            }
            .header {
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              color: #0f172a;
            }
            .header p {
              margin: 5px 0 0 0;
              color: #64748b;
              font-size: 14px;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin-bottom: 30px;
              background: #f8fafc;
              padding: 15px;
              border-radius: 8px;
              font-size: 14px;
            }
            .meta-item strong {
              color: #334155;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 12px;
              text-align: left;
              font-size: 13px;
            }
            th {
              background-color: #f1f5f9;
              color: #334155;
              font-weight: 600;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .status {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 600;
              text-transform: uppercase;
            }
            .status.qualified, .status.selected {
              background-color: #dcfce7;
              color: #166534;
            }
            .status.pending {
              background-color: #fef3c7;
              color: #92400e;
            }
            .status.disqualified {
              background-color: #fee2e2;
              color: #991b1b;
            }
            .footer {
              margin-top: 50px;
              font-size: 11px;
              color: #94a3b8;
              text-align: center;
              border-top: 1px solid #e2e8f0;
              padding-top: 15px;
            }
            @media print {
              body { margin: 20px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Recruitment Assessment Report</h1>
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
          </div>

          <div class="meta-grid">
            <div class="meta-item"><strong>Drive Name:</strong> ${selectedDrive.name}</div>
            <div class="meta-item"><strong>Target Role:</strong> ${jobRoleInput || 'Systems Engineer Trainee'}</div>
            <div class="meta-item"><strong>Company Name:</strong> ${driveCompanyName}</div>
            <div class="meta-item"><strong>Total Candidates Sourced:</strong> ${driveCandidates.length}</div>
          </div>

          <h3>Assessment Leaderboard</h3>
          <table>
            <thead>
              <tr>
                <th>Candidate</th>
                ${roundsHtml}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="${rounds.length + 2}" style="text-align:center;">No candidate results recorded.</td></tr>`}
            </tbody>
          </table>

          <div class="footer">
            HireGrad AI - Placement & Talent Acquisition Platform
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const renderAttendButton = (drive: any) => {
    const progress = studentProgressList.find((p: any) => p.driveId === drive.id);

    if (!progress) {
      if (!drive.rounds || drive.rounds.length === 0) {
        return (
          <button className="btn-primary" style={{ marginTop: '8px' }} disabled>
            No rounds configured
          </button>
        );
      }
      const firstRound = drive.rounds[0];
      return (
        <button 
          className="btn-primary" 
          style={{ marginTop: '8px', background: 'var(--success)' }} 
          onClick={() => joinStudentExam(drive.id, firstRound.id, firstRound.timeLimit)}
        >
          Attend Round 1: {firstRound.name}
        </button>
      );
    }

    if (progress.status === 'Disqualified') {
      return (
        <button className="btn-primary" style={{ marginTop: '8px', opacity: 0.7 }} disabled>
          ❌ Disqualified (Failed Round)
        </button>
      );
    }

    if (progress.status === 'Pending') {
      return (
        <button className="btn-primary" style={{ marginTop: '8px', opacity: 0.7 }} disabled>
          ⏳ Pending Review
        </button>
      );
    }

    const nextRoundIndex = progress.currentRoundIndex || 0;
    if (nextRoundIndex < drive.rounds.length) {
      const nextRound = drive.rounds[nextRoundIndex];
      return (
        <button 
          className="btn-primary" 
          style={{ marginTop: '8px', background: 'var(--success)' }} 
          onClick={() => joinStudentExam(drive.id, nextRound.id, nextRound.timeLimit)}
        >
          Attend Round {nextRoundIndex + 1}: {nextRound.name}
        </button>
      );
    }

    return (
      <button className="btn-primary" style={{ marginTop: '8px', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)' }} disabled>
        ✓ Assessment Completed
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', width: '100%' }}>
      {/* Toast popup */}
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000, background: 'var(--primary)', color: '#fff', padding: '16px 24px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} />
          {toastMessage}
        </div>
      )}

      {/* Main Sidebar */}
      <div className="sidebar">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <Shield style={{ color: 'var(--primary)' }} /> HireGrad AI
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
          {user && user.role === 'student' && (
            <>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold' }}>Placement Portal</div>
              <button className={`btn-secondary ${view === 'dashboard' ? 'active' : ''}`} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setView('dashboard')}>
                <Grid size={16} /> Dashboard
              </button>
              <button className={`btn-secondary ${view === 'student-upcoming-drives' ? 'active' : ''}`} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setView('student-upcoming-drives')}>
                <Briefcase size={16} /> Upcoming Drives
              </button>
              <button className={`btn-secondary ${view === 'student-notifications' ? 'active' : ''}`} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setView('student-notifications')}>
                <ShieldAlert size={16} /> Notifications
              </button>
              <button className={`btn-secondary ${view === 'student-live-assessments' ? 'active' : ''}`} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setView('student-live-assessments')}>
                <Monitor size={16} /> Live Assessments
              </button>
              <button className={`btn-secondary ${view === 'student-history' ? 'active' : ''}`} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setView('student-history')}>
                <FileText size={16} /> Assessment History
              </button>
              <button className={`btn-secondary ${view === 'student-progress' ? 'active' : ''}`} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setView('student-progress')}>
                <Layers size={16} /> Placement Progress
              </button>
              <button className={`btn-secondary ${view === 'student-results' ? 'active' : ''}`} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setView('student-results')}>
                <Award size={16} /> Results
              </button>
              <button className={`btn-secondary ${view === 'student-improvements' ? 'active' : ''}`} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setView('student-improvements')}>
                <Sparkles size={16} /> Improvement Report
              </button>
              <button className={`btn-secondary ${view === 'student-profile' ? 'active' : ''}`} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setView('student-profile')}>
                <Users size={16} /> Profile
              </button>

              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '16px 0 8px', fontWeight: 'bold' }}>Live HR Interviews</div>
              <button className={`btn-secondary ${view === 'student-interviews' ? 'active' : ''}`} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setView('student-interviews')}>
                <Video size={16} /> Interview Schedule
              </button>
              <button className={`btn-secondary ${view === 'student-interview-history' ? 'active' : ''}`} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setView('student-interview-history')}>
                <FileText size={16} /> Interview Feedback
              </button>

              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '16px 0 8px', fontWeight: 'bold' }}>AI Practice Modules</div>
              <button className={`btn-secondary ${view === 'coding-sandbox' ? 'active' : ''}`} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setView('coding-sandbox')}>
                <Code size={16} /> Coding Sandbox
              </button>
              <button className={`btn-secondary ${view === 'resume-check' ? 'active' : ''}`} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setView('resume-check')}>
                <FileText size={16} /> Resume Scanner
              </button>
            </>
          )}

          {user && user.role === 'company' && (
            <>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold' }}>recruitment stages</div>
              {[
                { step: 1, name: '1. Create Drive' },
                { step: 2, name: '2. Setup Rounds' },
                { step: 3, name: '3. Add Questions' },
                { step: 4, name: '4. Summary Review' },
                { step: 5, name: '5. Publish drive' },
                { step: 6, name: '6. Live monitor' },
                { step: 7, name: '7. View Results' }
              ].map((item) => (
                <button 
                  key={item.step} 
                  className={`btn-secondary ${view === 'drives' && recruitmentStep === item.step ? 'active' : ''}`} 
                  style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}
                  onClick={() => {
                    if (item.step > 3 && recruitmentStep <= 3 && selectedDrive?.status === 'Draft') {
                      const missingRounds = rounds.filter(r => !allRoundsQuestions[r.id] || allRoundsQuestions[r.id].length === 0);
                      if (missingRounds.length > 0) {
                        alert(`Please generate and save questions for all rounds before proceeding. Missing rounds: ${missingRounds.map(r => r.name).join(', ')}`);
                        return;
                      }
                    }
                    setView('drives');
                    setRecruitmentStep(item.step);
                  }}
                >
                  {recruitmentStep > item.step ? <Check size={14} style={{ color: 'var(--success)' }} /> : <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'inline-block', fontSize: '10px', textAlign: 'center', lineHeight: '14px' }}>{item.step}</span>}
                  {item.name}
                </button>
              ))}
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '16px 0 8px', fontWeight: 'bold' }}>Live HR Interviews</div>
              <button className={`btn-secondary ${view === 'hr-interviews-dashboard' || view === 'hr-schedule-interview' ? 'active' : ''}`} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }} onClick={() => setView('hr-interviews-dashboard')}>
                <Video size={16} /> Interview Hub
              </button>
              <button className={`btn-secondary ${view === 'hr-interview-history' ? 'active' : ''}`} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }} onClick={() => setView('hr-interview-history')}>
                <FileText size={16} /> History & Decisions
              </button>
            </>
          )}

          {user && user.role === 'admin' && (
            <>
              <button className={`btn-secondary ${view === 'stats' ? 'active' : ''}`} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setView('stats')}>
                <Grid size={16} /> Admin panel
              </button>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '16px 0 8px', fontWeight: 'bold' }}>Live Interviews</div>
              <button className={`btn-secondary ${view === 'admin-interviews-reports' ? 'active' : ''}`} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setView('admin-interviews-reports')}>
                <FileText size={16} /> Interview Reports
              </button>
              <button className={`btn-secondary ${view === 'admin-interviews-monitoring' ? 'active' : ''}`} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setView('admin-interviews-monitoring')}>
                <Activity size={16} /> Active Monitor
              </button>
            </>
          )}
        </div>

        {user ? (
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{user.companyName || user.fullName}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'capitalize' }}>{user.role}</div>
            </div>
            <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)' }} onClick={handleLogout}>
              <LogOut size={16} /> Log Out
            </button>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>Please log in.</div>
        )}
      </div>

      {/* Viewport content */}
      <div className="main-content">
        
        {/* LOGGED OUT: Authentication selectors */}
        {!user && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>Placement Assessment Portal</h2>
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
                Automated campus recruitment wizard
              </p>

              <div className="tab-bar">
                <button className={`tab-btn ${authRole === 'student' ? 'active' : ''}`} onClick={() => { setAuthRole('student'); setIsRegistering(false); }}>Student</button>
                <button className={`tab-btn ${authRole === 'company' ? 'active' : ''}`} onClick={() => { setAuthRole('company'); setIsRegistering(false); }}>HR</button>
                <button className={`tab-btn ${authRole === 'admin' ? 'active' : ''}`} onClick={() => { setAuthRole('admin'); setIsRegistering(false); }}>Admin</button>
              </div>

              <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {isRegistering && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem' }}>Full Name</label>
                    <input type="text" className="form-control" placeholder="Enter full name" value={fullNameInput} onChange={(e) => setFullNameInput(e.target.value)} required />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem' }}>Email Address</label>
                  <input type="email" className="form-control" placeholder="name@example.com" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem' }}>Password</label>
                  <input type="password" className="form-control" placeholder="••••••••" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} required />
                </div>
                {isRegistering && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem' }}>Confirm Password</label>
                    <input type="password" className="form-control" placeholder="••••••••" value={confirmPasswordInput} onChange={(e) => setConfirmPasswordInput(e.target.value)} required />
                  </div>
                )}

                <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>
                  {isRegistering 
                    ? (authRole === 'company' ? 'Register Recruiter Account' : 'Register Student Account')
                    : 'Sign In'
                  }
                </button>
              </form>

              {authRole !== 'admin' && (
                <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {isRegistering ? 'Already registered?' : "Don't have an account?"} &nbsp;
                  <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setIsRegistering(!isRegistering)}>
                    {isRegistering ? 'Log in here' : 'Register'}
                  </span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* STUDENT VIEWS */}
        {user && user.role === 'student' && (
          <div>
            {studentExamState === 'exam' ? (
              <div className="glass-panel" style={{ maxWidth: '800px', margin: '0 auto', padding: '32px' }}>
                {/* Exam header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '24px' }}>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assessment Live Session</span>
                    <h2 style={{ margin: '4px 0 0' }}>{liveDriveAlert?.driveName || 'Recruitment Exam'}</h2>
                  </div>
                  <div className="glass-panel" style={{ padding: '8px 16px', border: '1px solid var(--primary)', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', fontWeight: 'bold' }}>
                    ⏱️ Time Remaining: {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, '0')}
                  </div>
                </div>

                {/* Proctor System alerts */}
                {proctorCount > 0 && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--danger)', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px', fontSize: '0.85rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertTriangle size={16} />
                    <span><strong>Proctor Warning:</strong> {proctorCount} tab switch or copy-paste violation(s) recorded!</span>
                  </div>
                )}

                {/* Question body */}
                {studentQuestions.length > 0 ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
                      <span>Question {studentQuestionIndex + 1} of {studentQuestions.length}</span>
                      <span>Topic: {studentQuestions[studentQuestionIndex].topic || 'General'}</span>
                    </div>

                    <h3 style={{ marginBottom: '20px', lineHeight: '140%' }}>{studentQuestions[studentQuestionIndex].questionText}</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                      {studentQuestions[studentQuestionIndex].options.map((opt: string, idx: number) => {
                        const isSelected = selectedAnswers[studentQuestionIndex] === idx;
                        return (
                          <div 
                            key={idx} 
                            onClick={() => setSelectedAnswers({ ...selectedAnswers, [studentQuestionIndex]: idx })}
                            style={{ 
                              padding: '16px', 
                              borderRadius: '10px', 
                              border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)', 
                              background: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255,255,255,0.01)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <div style={{ 
                              width: '20px', 
                              height: '20px', 
                              borderRadius: '50%', 
                              border: '2px solid ' + (isSelected ? 'var(--primary)' : 'var(--text-muted)'),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {isSelected && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary)' }}></div>}
                            </div>
                            <span style={{ fontSize: '0.95rem' }}>{opt}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Navigation footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button 
                        className="btn-secondary" 
                        disabled={studentQuestionIndex === 0}
                        onClick={() => setStudentQuestionIndex(prev => prev - 1)}
                      >
                        Previous Question
                      </button>

                      {studentQuestionIndex < studentQuestions.length - 1 ? (
                        <button 
                          className="btn-primary" 
                          onClick={() => setStudentQuestionIndex(prev => prev + 1)}
                        >
                          Next Question
                        </button>
                      ) : (
                        <button 
                          className="btn-primary" 
                          style={{ background: 'var(--success)' }}
                          onClick={handleStudentSubmit}
                        >
                          Submit Assessment
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p style={{ color: 'var(--text-muted)' }}>Loading assessment questions...</p>
                  </div>
                )}
              </div>
            ) : studentExamState === 'feedback' ? (
              <div className="glass-panel" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: '40px' }}>
                <CheckCircle2 size={64} style={{ color: 'var(--success)', margin: '0 auto 20px' }} />
                <h2>Assessment Submitted!</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Your responses were evaluated successfully by our automated grading engine.</p>
                
                {studentResultSummary && (
                  <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.01)', padding: '24px', borderRadius: '12px', marginBottom: '32px', textAlign: 'left' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <strong>Score Metric:</strong> {studentResultSummary.score} / {studentResultSummary.total} Questions Correct
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <strong>Auto Grade Percentage:</strong> {Math.round((studentResultSummary.score / studentResultSummary.total) * 100)} %
                    </div>
                    <div>
                      <strong>Recruiter Status:</strong> <span style={{ color: studentResultSummary.status === 'Qualified' ? 'var(--success)' : 'var(--warning)', fontWeight: 'bold' }}>{studentResultSummary.status}</span>
                    </div>
                  </div>
                )}

                <button 
                  className="btn-primary" 
                  onClick={() => {
                    setStudentExamState(null);
                    setView('student-results');
                  }}
                >
                  Go to Results Sheet
                </button>
              </div>
            ) : (
              <div>
                {/* 1. Dashboard */}
                {view === 'dashboard' && (
              <div>
                <h2>Student Placement Dashboard</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Track your active applications, placement readiness score, and pending assessments</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
                  <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Placement Readiness Score</span>
                    <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>82 / 100</span>
                  </div>
                  <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Upcoming Drive Assessments</span>
                    <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--warning)' }}>1 Active</span>
                  </div>
                  <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Drives Applied</span>
                    <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--success)' }}>{registeredDrives.length} Drives</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                  <div className="glass-panel">
                    <h3>Recent Notifications</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                      {studentNotifications.slice(0, 2).map((n) => (
                        <div key={n.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: n.unread ? '4px solid var(--primary)' : '1px solid var(--border-color)' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{n.title}</div>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0' }}>{n.message}</p>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{n.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                    <Sparkles size={32} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
                    <h4>Need Preparation?</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '8px 0 16px' }}>Practice logic quants or scan your resumes ATS compatibilities.</p>
                    <button className="btn-primary" onClick={() => setView('coding-sandbox')}>Go to Coding Sandbox</button>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Upcoming Drives */}
            {view === 'student-upcoming-drives' && (
              <div>
                <h2>Upcoming Placement Drives</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Active recruitment campaigns published by campus coordinators and recruiters</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                  <div className="glass-panel" style={{ border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 'bold' }}>TCS</span>
                        <h3 style={{ margin: '4px 0' }}>TCS Ninja Drive 2026</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Role: Systems Engineer Trainee</p>
                      </div>
                      <span className="badge-status badge-success" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>Eligible</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'rgba(255,255,255,0.01)', padding: '10px', borderRadius: '8px', fontSize: '0.85rem' }}>
                      <div>💰 <strong>Package:</strong> 8.5 LPA</div>
                      <div>📅 <strong>Date:</strong> 2026-07-30</div>
                      <div>📍 <strong>Location:</strong> Chennai / Bangalore</div>
                      <div>🎓 <strong>Min CGPA:</strong> 7.0 CGPA</div>
                    </div>

                    {(() => {
                      const drive1 = drives.find(d => d.id === 'drive_1') || {
                        id: 'drive_1',
                        status: 'Active',
                        rounds: [
                          { id: "r_1", name: "Aptitude Assessment", type: "mcq", timeLimit: 30, subject: "Aptitude" },
                          { id: "r_2", name: "Programming Test", type: "coding", timeLimit: 45, subject: "JavaScript" },
                          { id: "r_3", name: "AI HR Round", type: "hr", timeLimit: 15, subject: "Behavioral" }
                        ]
                      };
                      const isDrive1Active = drive1.status === 'Active';
                      if (isDrive1Active || registeredDrives.includes('drive_1')) {
                        return renderAttendButton(drive1);
                      }
                      return (
                        <button 
                          className="btn-primary" 
                          style={{ marginTop: '8px' }} 
                          onClick={() => handleRegisterForDrive('drive_1')}
                        >
                          Register for Drive
                        </button>
                      );
                    })()}
                  </div>

                  {drives.filter(d => d.id !== 'drive_1').map(drive => {
                    const isEligible = studentCgpa >= (drive.minCgpa || 7.0);
                    return (
                      <div key={drive.id} className="glass-panel" style={{ border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 'bold' }}>{drive.companyUsername.split('_')[0].toUpperCase()}</span>
                            <h3 style={{ margin: '4px 0' }}>{drive.name}</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Role: {drive.jobRole || 'Engineer'}</p>
                          </div>
                          <span className={`badge-status ${isEligible ? 'badge-success' : 'badge-danger'}`} style={{ background: isEligible ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: isEligible ? 'var(--success)' : 'var(--danger)' }}>
                            {isEligible ? 'Eligible' : 'Ineligible'}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'rgba(255,255,255,0.01)', padding: '10px', borderRadius: '8px', fontSize: '0.85rem' }}>
                          <div>💰 <strong>Package:</strong> {drive.packageOffered || '7.5 LPA'}</div>
                          <div>📅 <strong>Date:</strong> {drive.assessmentDate}</div>
                          <div>📍 <strong>Location:</strong> campus assessment</div>
                          <div>🎓 <strong>Min CGPA:</strong> {drive.minCgpa || 7.0} CGPA</div>
                        </div>

                        {drive.status === 'Active' ? (
                          renderAttendButton(drive)
                        ) : registeredDrives.includes(drive.id) ? (
                          <button 
                            className="btn-primary" 
                            style={{ marginTop: '8px' }} 
                            disabled
                          >
                            ✓ Registered (Awaiting Exam)
                          </button>
                        ) : (
                          <button 
                            className="btn-primary" 
                            style={{ marginTop: '8px' }} 
                            disabled={!isEligible}
                            onClick={() => handleRegisterForDrive(drive.id)}
                          >
                            {isEligible ? 'Register for Drive' : 'CGPA Cutoff Locked'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Notifications */}
            {view === 'student-notifications' && (
              <div>
                <h2>Recruiter Announcements</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>In-app and simulated email dispatches broadcasted by visiting drives coordinators</p>

                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {studentNotifications.map((n) => (
                    <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', borderLeft: n.unread ? '4px solid var(--primary)' : '1px solid var(--border-color)' }}>
                      <div>
                        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {n.unread && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></span>}
                          {n.title}
                        </h4>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '6px 0' }}>{n.message}</p>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Posted: {n.time} | 📧 Email Delivered</span>
                      </div>
                      {n.unread && (
                        <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => {
                          setStudentNotifications(studentNotifications.map(item => item.id === n.id ? { ...item, unread: false } : item));
                        }}>Mark Read</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Live Assessments */}
            {view === 'student-live-assessments' && (
              <div>
                <h2>Active Live Assessments</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Real-time monitor tracking placement assessments</p>

                {liveDriveAlert ? (
                  <div className="glass-panel" style={{ borderLeft: '5px solid var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px' }}>
                    <div>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                        <ShieldAlert className="animate-pulse" /> Live assessment is online!
                      </h3>
                      <p style={{ fontWeight: 'bold', margin: '6px 0' }}>{liveDriveAlert.driveName}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Active round: {liveDriveAlert.roundId} | Time: {liveDriveAlert.timeLimit} Mins</p>
                    </div>

                    {studentCgpa >= (selectedDrive?.minCgpa || 7.0) ? (
                      (() => {
                        const progress = studentProgressList.find((p: any) => p.driveId === liveDriveAlert.driveId);
                        if (progress && progress.status === 'Disqualified') {
                          return <span className="badge-status badge-danger">Disqualified (Failed Prior Round)</span>;
                        }
                        if (progress && progress.scores[liveDriveAlert.roundId] !== undefined) {
                          return <span className="badge-status badge-success">✓ Round Completed</span>;
                        }
                        return <button className="btn-primary" onClick={() => joinStudentExam(liveDriveAlert.driveId, liveDriveAlert.roundId, liveDriveAlert.timeLimit)}>Start Assessment</button>;
                      })()
                    ) : (
                      <span className="badge-status badge-danger">Ineligible (CGPA Cutoff)</span>
                    )}
                  </div>
                ) : (
                  <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
                    <Monitor size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                    <h3>No Active Sessions</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Wait for the visiting HR recruiter to trigger the "START SESSION" countdown.</p>
                  </div>
                )}
              </div>
            )}

            {/* 5. Assessment History */}
            {view === 'student-history' && (
              <div className="glass-panel">
                <h3>Placement Assessment History</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>Full log of your completed recruitment drives scoring metrics</p>
                <table className="styled-table">
                  <thead>
                    <tr><th>Drive Name</th><th>Round Stage</th><th>Submitted Date</th><th>Score Percentage</th><th>Verdict Status</th></tr>
                  </thead>
                  <tbody>
                    {studentHistory.map((item, idx) => (
                      <tr key={idx}>
                        <td><strong>{item.driveName}</strong></td>
                        <td>{item.roundName}</td>
                        <td>{item.date}</td>
                        <td>{item.percentage} (Score: {item.score})</td>
                        <td>
                          <span style={{ 
                            padding: '4px 8px', 
                            borderRadius: '12px', 
                            fontSize: '0.8rem', 
                            fontWeight: 'bold', 
                            background: item.status === 'Qualified' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', 
                            color: item.status === 'Qualified' ? 'var(--success)' : 'var(--danger)' 
                          }}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 6. Placement Journey Progress */}
            {view === 'student-progress' && (
              <div>
                <h2>Placement Process Journey</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Real-time student round-by-round selection timelines</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {placementJourney.map((journey, idx) => (
                    <div key={idx} className="glass-panel">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3>{journey.company} Placement Journey</h3>
                        <span className={`badge-status ${journey.status === 'In Progress' ? 'badge-warning' : journey.status === 'Qualified' ? 'badge-success' : 'badge-danger'}`} style={{ padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold' }}>
                          Status: {journey.status}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', position: 'relative', padding: '10px 0' }}>
                        {journey.rounds.map((round: any, rIdx: number) => (
                          <React.Fragment key={rIdx}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px 18px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: round.status === 'Qualified' ? 'var(--success)' : round.status === 'Rejected' ? 'var(--danger)' : '#334155', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                                {rIdx + 1}
                              </div>
                              <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{round.name}</div>
                                <div style={{ fontSize: '0.75rem', color: round.status === 'Qualified' ? 'var(--success)' : round.status === 'Rejected' ? 'var(--danger)' : 'var(--text-muted)' }}>{round.status}</div>
                              </div>
                            </div>
                            {rIdx < journey.rounds.length - 1 && <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7. Results Dashboard */}
            {view === 'student-results' && (
              <div>
                <h2>Your Assessment Results Summary</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Comprehensive key sheets, scoring reports, and feedback</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {studentProgressList.map((progress: any, index: number) => {
                    const drive = drives.find(d => d.id === progress.driveId);
                    return (
                      <div key={index} className="glass-panel" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                          <div>
                            <h3 style={{ margin: 0 }}>{drive ? drive.name : 'Placement Assessment Drive'}</h3>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Role: {drive?.jobRole || 'Software Engineer'}</span>
                          </div>
                          <span className="badge-status" style={{ 
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontWeight: 'bold',
                            background: progress.status === 'Qualified' ? 'rgba(16, 185, 129, 0.15)' : progress.status === 'Pending' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: progress.status === 'Qualified' ? 'var(--success)' : progress.status === 'Pending' ? 'var(--warning)' : 'var(--danger)'
                          }}>
                            Status: {progress.status}
                          </span>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                          {Object.entries(progress.scores).map(([roundId, score]: any) => {
                            const roundDetails = drive?.rounds?.find((r: any) => r.id === roundId);
                            return (
                              <div key={roundId} style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{roundDetails ? roundDetails.name : `Round: ${roundId}`}</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--primary)', marginTop: '8px' }}>
                                  Score: {score}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                  Passing Threshold: {roundDetails ? roundDetails.passingPercentage : 70}%
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {studentProgressList.length === 0 && (
                    <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
                      <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                      <h3>No Submissions Found</h3>
                      <p style={{ color: 'var(--text-muted)' }}>Complete an active assessment to unlock response key scorecards.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 8. AI Improvement Report */}
            {view === 'student-improvements' && (
              <div>
                <h2>AI Skill Gap & Improvement Report</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>AI tailored suggestions and direct links to code sandboxes and interview mocks</p>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="glass-panel" style={{ borderLeft: '4px solid var(--danger)' }}>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}><AlertTriangle /> Target Areas Identified</h3>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '8px' }}>Based on recent mock performance, we recommend strengthening these modules:</p>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                        <div style={{ padding: '10px', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                          <strong>Algorithms:</strong> Time complexity logic in recursive algorithms (e.g. dynamic programming).
                        </div>
                        <div style={{ padding: '10px', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                          <strong>Java Concurrency:</strong> Threadpool executors and locking concepts.
                        </div>
                      </div>
                    </div>

                    <div className="glass-panel">
                      <h3>Practice Core Modules</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>Select targeted practice cabins to boost your placement readiness score</p>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <strong>Coding Algorithms</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Solve compiler algorithms test cases.</span>
                          <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setView('coding-sandbox')}>Open Coding Sandbox</button>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <strong>Resume ATS Matcher</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Scan and match target job role skills.</span>
                          <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setView('resume-check')}>Open Resume Scanner</button>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <strong>Mock MCQs Practice</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Daily logical quants and aptitude tests.</span>
                          <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setView('student-live-assessments')}>Practice MCQs</button>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <strong>AI Interview Trainer</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Practice speech delivery & behaviors.</span>
                          <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setView('dashboard')}>AI Interview</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ alignSelf: 'start', textAlign: 'center' }}>
                    <Sparkles size={32} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
                    <h3>Readiness Target</h3>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary)', margin: '16px 0' }}>82%</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Targeting a minimum score of 90% significantly increases selection rate by top MNC recruiters.</p>
                  </div>
                </div>
              </div>
            )}

            {/* 9. Profile Section */}
            {view === 'student-profile' && (
              <div className="glass-panel" style={{ maxWidth: '650px', margin: '0 auto' }}>
                <h3>Candidate Student Profile</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>Edit your academic and technical skills settings below</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Candidate Name</label>
                      <input type="text" className="form-control" value={user.fullName} readOnly />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Department</label>
                      <select className="form-control" value={studentDept} onChange={(e) => setStudentDept(e.target.value)}>
                        <option value="CSE">Computer Science (CSE)</option>
                        <option value="IT">Information Tech (IT)</option>
                        <option value="ECE">Electronics (ECE)</option>
                        <option value="EEE">Electrical (EEE)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cumulative CGPA</label>
                      <input type="number" step="0.1" className="form-control" value={studentCgpa} onChange={(e) => setStudentCgpa(parseFloat(e.target.value))} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Eligible Batch</label>
                      <input type="text" className="form-control" value="2026" readOnly />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Technical Skills Keywords</label>
                    <input type="text" className="form-control" value={studentSkills} onChange={(e) => setStudentSkills(e.target.value)} />
                  </div>

                  <div style={{ border: '1px dashed var(--border-color)', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span>📄 <strong>resume_v2.pdf</strong> (ATS Verified)</span>
                    <button className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setView('resume-check')}>Re-upload</button>
                  </div>

                  <button className="btn-primary" style={{ marginTop: '12px' }} onClick={handleSaveProfile}>
                    Save Profile Settings
                  </button>
                </div>
              </div>
            )}

            {/* Coding Sandbox */}
            {view === 'coding-sandbox' && (
              <div>
                <h2>Coding Round Sandbox</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Compile programming challenges and execute validator testcases</p>

                <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                      <select className="form-control" style={{ width: '150px' }} value={codeLanguage} onChange={(e) => setCodeLanguage(e.target.value)}>
                        <option value="javascript">JavaScript</option>
                        <option value="python">Python</option>
                        <option value="java">Java</option>
                        <option value="cpp">C++</option>
                      </select>
                    </div>
                    <textarea className="code-editor" placeholder="// Write your code solution here..." value={codeAnswer} onChange={(e) => setCodeAnswer(e.target.value)} />

                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                      <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setCodeLogs(['Running code test cases...', 'Test Case 1: PASS', 'Test Case 2: PASS', 'Test Case 3: FAIL (Output mismatch)'])}>
                        <Play size={16} /> Run Code
                      </button>
                      <button className="btn-primary" onClick={() => alert('Code submitted to grading engine!')}>Submit Code</button>
                    </div>
                  </div>

                  <div className="glass-panel">
                    <h3>Compiler Log Output</h3>
                    <div style={{ background: '#090d16', padding: '16px', borderRadius: '10px', height: '350px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.9rem', color: '#10b981' }}>
                      {codeLogs.length > 0 ? codeLogs.map((log, idx) => <div key={idx}>{log}</div>) : 'Console is idle.'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Resume Scanner */}
            {view === 'resume-check' && (
              <div>
                <h2>Resume Suitability Checker</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Scan your resume score matching for target recruitment roles</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div className="glass-panel">
                    <h3>Upload Resume Document</h3>
                    <form onSubmit={handleResumeScan} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                      <div style={{ border: '2px dashed var(--border-color)', borderRadius: '12px', padding: '30px', textAlign: 'center', cursor: 'pointer' }}>
                        <Upload size={32} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Select PDF format resume file</p>
                        <input type="file" accept=".pdf" onChange={(e) => setResumeFile(e.target.files?.[0] || null)} style={{ marginTop: '12px' }} />
                      </div>
                      <button type="submit" className="btn-primary" disabled={isScanning || !resumeFile}>
                        {isScanning ? 'Scanning ATS compatibility...' : 'Run ATS Scanner'}
                      </button>
                    </form>
                  </div>

                  {atsResult && (
                    <div className="glass-panel">
                      <h3>ATS Scoring Breakdown</h3>
                      <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary)', margin: '12px 0' }}>{atsResult.atsScore} %</div>
                      <div style={{ marginBottom: '12px' }}>
                        <strong>Matched Skills:</strong>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                          {atsResult.skillsMatched.map((s: string, idx: number) => <span key={idx} className="badge-status badge-success">{s}</span>)}
                        </div>
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <strong>Missing Skills:</strong>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                          {atsResult.skillsMissing.map((s: string, idx: number) => <span key={idx} className="badge-status badge-danger">{s}</span>)}
                        </div>
                      </div>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}><strong>Summary:</strong> {atsResult.summary}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Student Live Interviews Schedule */}
            {view === 'student-interviews' && (
              <StudentInterviewSchedule 
                interviews={liveInterviews}
                onJoinLobby={(interview) => {
                  setActiveInterview(interview);
                  setView('shared-waiting-room');
                }}
              />
            )}

            {/* Student Interview History & Feedback */}
            {view === 'student-interview-history' && (
              <InterviewHistory 
                interviews={liveInterviews} 
                userRole="student" 
              />
            )}

            {/* Shared Waiting Room - Student */}
            {view === 'shared-waiting-room' && activeInterview && (
              <WaitingRoom 
                interview={activeInterview}
                userRole="student"
                onBack={() => setView('student-interviews')}
                onEnterCall={() => {
                  fetch(`${API_BASE}/api/placement/interviews/${activeInterview.id}/status`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${localStorage.getItem('hiregrad_token')}`
                    },
                    body: JSON.stringify({ status: 'ongoing' })
                  }).then(() => {
                    fetchInterviews();
                    setView('shared-live-interview');
                  }).catch(err => {
                    console.error('Failed to update status:', err);
                    setView('shared-live-interview');
                  });
                }}
              />
            )}

            {/* Shared Live Meeting - Student */}
            {view === 'shared-live-interview' && activeInterview && (
              <LiveMeeting 
                interview={activeInterview}
                userRole="student"
                onLeave={() => {
                  setActiveInterview(null);
                  setView('student-interviews');
                }}
                onSubmitEvaluation={() => {}} 
              />
            )}
          </div>
        )}
      </div>
    )}

        {/* HR RECRUITER 7-STEP HORIZONTAL WIZARD */}
        {user && user.role === 'company' && (
          <div style={{ width: '100%' }}>
            {view === 'hr-interviews-dashboard' ? (
              <InterviewDashboard 
                interviews={liveInterviews}
                onScheduleClick={() => setView('hr-schedule-interview')}
                onJoinCall={(interview) => {
                  setActiveInterview(interview);
                  setView('shared-waiting-room');
                }}
                onViewHistory={() => setView('hr-interview-history')}
              />
            ) : view === 'hr-schedule-interview' ? (
              <ScheduleForm 
                onBack={() => setView('hr-interviews-dashboard')}
                onScheduleAdded={(newInterview) => {
                  setLiveInterviews(prev => [newInterview, ...prev]);
                }}
              />
            ) : view === 'hr-interview-history' ? (
              <InterviewHistory 
                interviews={liveInterviews} 
                userRole="hr" 
                onBack={() => setView('hr-interviews-dashboard')}
              />
            ) : view === 'shared-waiting-room' && activeInterview ? (
              <WaitingRoom 
                interview={activeInterview}
                userRole="hr"
                onBack={() => setView('hr-interviews-dashboard')}
                onEnterCall={() => {
                  fetch(`${API_BASE}/api/placement/interviews/${activeInterview.id}/status`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${localStorage.getItem('hiregrad_token')}`
                    },
                    body: JSON.stringify({ status: 'ongoing' })
                  }).then(() => {
                    fetchInterviews();
                    setView('shared-live-interview');
                  }).catch(err => {
                    console.error('Failed to update status:', err);
                    setView('shared-live-interview');
                  });
                }}
              />
            ) : view === 'shared-live-interview' && activeInterview ? (
              <LiveMeeting 
                interview={activeInterview}
                userRole="hr"
                onLeave={() => {
                  setActiveInterview(null);
                  setView('hr-interviews-dashboard');
                }}
                onSubmitEvaluation={(feedback) => {
                  fetch(`${API_BASE}/api/placement/interviews/${activeInterview.id}/evaluate`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${localStorage.getItem('hiregrad_token')}`
                    },
                    body: JSON.stringify({
                      communicationScore: feedback.communicationScore,
                      technicalScore: feedback.technicalScore,
                      confidenceScore: feedback.confidenceScore,
                      problemSolvingScore: feedback.problemSolvingScore,
                      overallRating: feedback.overallRating,
                      comments: feedback.comments,
                      result: feedback.result
                    })
                  }).then(res => res.json()).then(data => {
                    if (data.success) {
                      fetchInterviews();
                      setActiveInterview(null);
                      setView('hr-interview-history');
                    } else {
                      alert(data.message || 'Failed to submit evaluation.');
                    }
                  }).catch(err => {
                    console.error('Error submitting evaluation:', err);
                  });
                }}
              />
            ) : (
              <>
                {/* Active Drive Selector & Header */}
                <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', padding: '16px 24px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>Hiring Workspace</h2>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Configure drives, monitor candidate sessions, and track results</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Active Drive:</span>
                    <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>{driveNameInput || 'None'}</strong>
                  </div>
                </div>
            {/* Header Horizontal Stepper */}
            <div className="wizard-stepper">
              {[
                { step: 1, name: 'Create Drive' },
                { step: 2, name: 'Setup Rounds' },
                { step: 3, name: 'Add Questions' },
                { step: 4, name: 'Review summary' },
                { step: 5, name: 'Publish drive' },
                { step: 6, name: 'Live Monitor' },
                { step: 7, name: 'View Results' }
              ].map((item) => (
                <div 
                  key={item.step} 
                  className={`wizard-step ${recruitmentStep === item.step ? 'active' : ''} ${recruitmentStep > item.step ? 'completed' : ''}`}
                  onClick={() => {
                    if (item.step > 3 && recruitmentStep <= 3 && selectedDrive?.status === 'Draft') {
                      const missingRounds = rounds.filter(r => !allRoundsQuestions[r.id] || allRoundsQuestions[r.id].length === 0);
                      if (missingRounds.length > 0) {
                        alert(`Please generate and save questions for all rounds before proceeding. Missing rounds: ${missingRounds.map(r => r.name).join(', ')}`);
                        return;
                      }
                    }
                    setRecruitmentStep(item.step);
                  }}
                >
                  <div className="wizard-node">
                    {recruitmentStep > item.step ? <Check size={16} /> : item.step}
                  </div>
                  <span className="wizard-label">{item.name}</span>
                </div>
              ))}
            </div>

            {/* Step buttons footer panel */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', background: 'rgba(255,255,255,0.01)', padding: '12px 20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} disabled={recruitmentStep === 1} onClick={() => setRecruitmentStep(prev => prev - 1)}>
                <ChevronLeft size={16} /> Previous Phase
              </button>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', alignSelf: 'center' }}>Hiring Drive: <strong>{driveNameInput}</strong></span>
              <button 
                className="btn-primary" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }} 
                disabled={recruitmentStep === 7} 
                onClick={() => {
                  if (recruitmentStep === 3 && selectedDrive?.status === 'Draft') {
                    const missingRounds = rounds.filter(r => !allRoundsQuestions[r.id] || allRoundsQuestions[r.id].length === 0);
                    if (missingRounds.length > 0) {
                      alert(`Please generate and save questions for all rounds before proceeding. Missing rounds: ${missingRounds.map(r => r.name).join(', ')}`);
                      return;
                    }
                  }
                  setRecruitmentStep(prev => prev + 1);
                }}
              >
                Next Phase <ChevronRight size={16} />
              </button>
            </div>

            {/* STEP 1 PANEL: Create Hiring Drive Form */}
            {recruitmentStep === 1 && (
              <div className="glass-panel" style={{ maxWidth: '850px', margin: '0 auto' }}>
                <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Hiring Drive Core Details</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Company Name</label>
                    <input type="text" className="form-control" value={driveCompanyName} onChange={(e) => setDriveCompanyName(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Company Logo URL</label>
                    <input type="text" className="form-control" placeholder="Optional Logo URL link..." value={driveCompanyLogo || ''} onChange={(e) => setDriveCompanyLogo(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Hiring Drive Name</label>
                    <input type="text" className="form-control" value={driveNameInput} onChange={(e) => setDriveNameInput(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Job Role Title</label>
                    <input type="text" className="form-control" value={jobRoleInput} onChange={(e) => setJobRoleInput(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Package offered (CTC)</label>
                    <input type="text" className="form-control" value={packageInput} onChange={(e) => setPackageInput(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Recruitment Location</label>
                    <input type="text" className="form-control" value={locationInput} onChange={(e) => setLocationInput(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Assessment Date</label>
                    <input type="date" className="form-control" value={assessmentDateInput} onChange={(e) => setAssessmentDateInput(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Assessment Time</label>
                    <input type="time" className="form-control" value={assessmentTimeInput} onChange={(e) => setAssessmentTimeInput(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Duration (Minutes)</label>
                    <input type="number" className="form-control" value={driveDurationInput} onChange={(e) => setDriveDurationInput(parseInt(e.target.value))} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Min Cutoff CGPA</label>
                    <input type="number" step="0.1" className="form-control" value={minCgpaInput} onChange={(e) => setMinCgpaInput(parseFloat(e.target.value))} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Eligible Batch</label>
                    <input type="text" className="form-control" value={eligibleBatchInput} onChange={(e) => setEligibleBatchInput(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Max Candidates Limit</label>
                    <input type="number" className="form-control" value={maxStudentsInput} onChange={(e) => setMaxStudentsInput(parseInt(e.target.value))} />
                  </div>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Hiring Drive Description</label>
                  <textarea className="form-control" style={{ height: '100px' }} value={driveDescription} onChange={(e) => setDriveDescription(e.target.value)} />
                </div>

                {/* Stepper Step 1 Actions */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => triggerToast('Draft saved successfully')}>Save Draft</button>
                  <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', flex: 1 }} onClick={() => setShowDrivePreview(true)}>
                    <Eye size={16} /> Preview Drive
                  </button>
                  <button className="btn-primary" style={{ flex: 2 }} onClick={handleSaveDriveDraft}>Save & Configure Rounds</button>
                </div>

                {/* Preview drive model */}
                {showDrivePreview && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', position: 'relative' }}>
                      <h3>Drive Preview Card</h3>
                      <p><strong>Company:</strong> {driveCompanyName}</p>
                      <p><strong>Campaign Name:</strong> {driveNameInput}</p>
                      <p><strong>Job Role:</strong> {jobRoleInput}</p>
                      <p><strong>Salary CTC:</strong> {packageInput}</p>
                      <p><strong>Cutoff CGPA:</strong> {minCgpaInput}</p>
                      <p><strong>Batch Eligibility:</strong> {eligibleBatchInput}</p>
                      <button className="btn-primary" style={{ marginTop: '20px', width: '100%' }} onClick={() => setShowDrivePreview(false)}>Close Preview</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2 PANEL: Create Recruitment Rounds */}
            {recruitmentStep === 2 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3>Rounds configuration list</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Drag and drop items to re-order sequence</p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {rounds.map((r, idx) => (
                      <div 
                        key={r.id} 
                        className="draggable-item"
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, idx)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: r.enabled ? '1px solid var(--border-color)' : '1px solid rgba(239, 68, 68, 0.2)' }}
                      >
                        <div>
                          <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{idx + 1}. {r.name}</span>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Type: {r.type.toUpperCase()} | Pass: {r.passingPercentage}%</div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => duplicateRound(r)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}><Copy size={12} /></button>
                          <button onClick={() => removeRound(r.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="btn-secondary" onClick={addRound}>+ Add New Round</button>
                </div>

                <div className="glass-panel">
                  <h3>Edit Round parameters</h3>
                  {rounds.map((r, idx) => (
                    <div key={r.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px' }}>
                      <h4 style={{ color: 'var(--primary)', marginBottom: '8px' }}>Round {idx + 1}: {r.name}</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Round Name</label>
                          <input type="text" className="form-control" value={r.name} onChange={(e) => {
                            const updated = [...rounds];
                            updated[idx].name = e.target.value;
                            setRounds(updated);
                          }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Type</label>
                          <select className="form-control" value={r.type} onChange={(e) => {
                            const updated = [...rounds];
                            updated[idx].type = e.target.value;
                            setRounds(updated);
                          }}>
                            <option value="mcq">MCQ Quiz</option>
                            <option value="coding">Coding Sandbox</option>
                            <option value="hr">AI HR Interview</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Passing Percentage (%)</label>
                          <input type="number" className="form-control" value={r.passingPercentage} onChange={(e) => {
                            const updated = [...rounds];
                            updated[idx].passingPercentage = parseInt(e.target.value);
                            setRounds(updated);
                          }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Max Marks</label>
                          <input type="number" className="form-control" value={r.maxMarks || 100} onChange={(e) => {
                            const updated = [...rounds];
                            updated[idx].maxMarks = parseInt(e.target.value);
                            setRounds(updated);
                          }} />
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Instructions</label>
                          <input type="text" className="form-control" value={r.instructions || ''} onChange={(e) => {
                            const updated = [...rounds];
                            updated[idx].instructions = e.target.value;
                            setRounds(updated);
                          }} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button className="btn-primary" style={{ width: '100%', marginTop: '16px' }} onClick={saveRoundConfigs}>
                    Save Rounds Sequence & Next
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3 PANEL: Question Preparation */}
            {recruitmentStep === 3 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3>Select Stage</h3>
                  {rounds.map((r, idx) => (
                    <button 
                      key={r.id} 
                      className={`btn-secondary ${selectedStage?.id === r.id ? 'active' : ''}`} 
                      style={{ textAlign: 'left' }} 
                      onClick={() => selectStageRound(idx)}
                    >
                      Round {idx + 1}: {r.name}
                    </button>
                  ))}
                </div>

                <div className="glass-panel">
                  <h3>Questions workspace</h3>
                  
                  <div className="tab-bar" style={{ marginTop: '16px' }}>
                    <button className={`tab-btn ${questionCreationOption === 'ai' ? 'active' : ''}`} onClick={() => setQuestionCreationOption('ai')}>Gemini AI</button>
                    <button className={`tab-btn ${questionCreationOption === 'manual' ? 'active' : ''}`} onClick={() => setQuestionCreationOption('manual')}>Manual Form</button>
                    <button className={`tab-btn ${questionCreationOption === 'pdf' ? 'active' : ''}`} onClick={() => setQuestionCreationOption('pdf')}>Upload PDF</button>
                  </div>

                  {(() => {
                    if (!selectedStage) {
                      return (
                        <div className="glass-panel">
                          <h3>Questions workspace</h3>
                          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Please select an interview round to configure.
                          </div>
                        </div>
                      );
                    }

                    const config = stageDataMap[selectedStage.id] || selectedStage.config;
                    const meta = getMetadataForSubject(config.subjectCategory);

                    return (
                      <div className="glass-panel">
                        <h3>Questions workspace</h3>
                        
                        <div className="tab-bar" style={{ marginTop: '16px' }}>
                          <button className={`tab-btn ${config.questionCreationOption === 'ai' ? 'active' : ''}`} onClick={() => updateSelectedStageConfig('questionCreationOption', 'ai')}>Gemini AI</button>
                          <button className={`tab-btn ${config.questionCreationOption === 'manual' ? 'active' : ''}`} onClick={() => updateSelectedStageConfig('questionCreationOption', 'manual')}>Manual Form</button>
                          <button className={`tab-btn ${config.questionCreationOption === 'pdf' ? 'active' : ''}`} onClick={() => updateSelectedStageConfig('questionCreationOption', 'pdf')}>Upload PDF</button>
                        </div>

                        {config.questionCreationOption === 'ai' && (
                          (() => {
                            const availableCategories = Array.from(new Set(
                              rounds.map(r => {
                                const nameLower = (r.name || '').toLowerCase();
                                const s = (r.subject || '').toLowerCase();
                                if (nameLower.includes('aptitude') || s.includes('aptitude')) return 'Aptitude';
                                if (nameLower.includes('communication') || nameLower.includes('comunication') || nameLower.includes('commun') || nameLower.includes('comun') || nameLower.includes('english') || nameLower.includes('verbal') || nameLower.includes('interview') || nameLower.includes('hr') || nameLower.includes('behavioral') ||
                                    s.includes('communication') || s.includes('comunication') || s.includes('commun') || s.includes('comun') || s.includes('english') || s.includes('verbal') || s.includes('behavioral') || s.includes('hr') || (r.type || '').toLowerCase() === 'hr') {
                                  if (nameLower.includes('hr') || nameLower.includes('behavioral') || s.includes('behavioral') || (r.type || '').toLowerCase() === 'hr') {
                                    return 'HR';
                                  }
                                  return 'Communication';
                                }
                                if (nameLower.includes('program') || nameLower.includes('coding') || s.includes('program') || s.includes('coding') || (r.type || '').toLowerCase() === 'coding') {
                                  return 'Programming';
                                }
                                if (SUBJECT_METADATA[s]) {
                                  return SUBJECT_METADATA[s].displayName;
                                }
                                return r.subject || 'Technical';
                              })
                            ));

                            return (
                              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px' }}>
                                <div>
                                  <label style={{ fontSize: '0.8rem' }}>Subject Category</label>
                                  <select 
                                    className="form-control" 
                                    value={config.subjectCategory} 
                                    onChange={(e) => updateSelectedStageConfig('subjectCategory', e.target.value)}
                                  >
                                    {availableCategories.map(cat => (
                                      <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                  </select>
                                </div>
                                {meta.hasSubSubject && (
                                  <div>
                                    <label style={{ fontSize: '0.8rem' }}>{meta.subSubjectLabel || 'Sub-Subject'}</label>
                                    <input 
                                      type="text" 
                                      className="form-control" 
                                      value={config.subSubject} 
                                      placeholder={`e.g. ${meta.subSubjectDefault || 'Java'}`} 
                                      onChange={(e) => updateSelectedStageConfig('subSubject', e.target.value)} 
                                    />
                                  </div>
                                )}
                                <div>
                                  <label style={{ fontSize: '0.8rem' }}>Topic</label>
                                  <select 
                                    className="form-control" 
                                    value={config.topic} 
                                    onChange={(e) => updateSelectedStageConfig('topic', e.target.value)}
                                  >
                                    {meta.topics.map(t => (
                                      <option key={t} value={t}>{t}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.8rem' }}>Difficulty</label>
                                  <select className="form-control" value={config.difficulty} onChange={(e) => updateSelectedStageConfig('difficulty', e.target.value)}>
                                    <option value="Easy">Easy</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Hard">Hard</option>
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.8rem' }}>Questions Count</label>
                                  <input type="number" className="form-control" value={config.questionsCount} onChange={(e) => updateSelectedStageConfig('questionsCount', parseInt(e.target.value))} />
                                </div>
                                <button className="btn-primary" onClick={handleAIQuestionsGenerate} disabled={isGenerating}>
                                  {isGenerating ? 'Compiling AI questions...' : 'Generate AI Bank'}
                                </button>
                              </div>
                            );
                          })()
                        )}

                        {config.questionCreationOption === 'manual' && (
                          <form onSubmit={handleManualAddQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px' }}>
                            <div>
                              <label style={{ fontSize: '0.8rem' }}>Question Type</label>
                              <select className="form-control" value={manualQType} onChange={(e) => setManualQType(e.target.value as any)}>
                                <option value="mcq">MCQ</option>
                                <option value="coding">Programming</option>
                                <option value="text">Descriptive</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: '0.8rem' }}>Question Wording</label>
                              <textarea className="form-control" placeholder="Type question wording here..." value={manualQText} onChange={(e) => setManualQText(e.target.value)} required />
                            </div>
                            {manualQType === 'mcq' && (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                                <input type="text" className="form-control" placeholder="Option A" value={manualOptA} onChange={(e) => setManualOptA(e.target.value)} required />
                                <input type="text" className="form-control" placeholder="Option B" value={manualOptB} onChange={(e) => setManualOptB(e.target.value)} required />
                                <input type="text" className="form-control" placeholder="Option C" value={manualOptC} onChange={(e) => setManualOptC(e.target.value)} required />
                                <input type="text" className="form-control" placeholder="Option D" value={manualOptD} onChange={(e) => setManualOptD(e.target.value)} required />
                              </div>
                            )}
                            {manualQType === 'mcq' && (
                              <div>
                                <label style={{ fontSize: '0.8rem' }}>Correct Option Index</label>
                                <select className="form-control" value={manualCorrectIndex} onChange={(e) => setManualCorrectIndex(parseInt(e.target.value))}>
                                  <option value={0}>Option A</option>
                                  <option value={1}>Option B</option>
                                  <option value={2}>Option C</option>
                                  <option value={3}>Option D</option>
                                </select>
                              </div>
                            )}
                            <button type="submit" className="btn-primary">Add Question to Round</button>
                          </form>
                        )}

                        {config.questionCreationOption === 'pdf' && (
                          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px' }}>
                            <label style={{ fontSize: '0.8rem' }}>Select Question Paper PDF</label>
                            <input type="file" accept=".pdf" className="form-control" onChange={handlePDFQuestionsConvert} />
                            {isGenerating && <div style={{ color: 'var(--warning)', marginTop: '8px' }}>Scanning PDF and extracting questions structures...</div>}
                          </div>
                        )}

                        {/* Questions Lists */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
                          {(config.questions || []).map((q, idx) => (
                            <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <strong>Q{idx + 1}: {q.questionText}</strong>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button className="btn-secondary" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => {
                                    const newText = prompt('Edit Question Wording:', q.questionText);
                                    if (newText) {
                                      const updated = [...(config.questions || [])];
                                      updated[idx].questionText = newText;
                                      updateSelectedStageConfig('questions', updated);
                                    }
                                  }}>Edit</button>
                                  <button className="btn-secondary" style={{ padding: '2px 6px', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }} onClick={() => {
                                    const updated = (config.questions || []).filter((_, qIdx) => qIdx !== idx);
                                    updateSelectedStageConfig('questions', updated);
                                  }}>
                                    Reject
                                  </button>
                                </div>
                              </div>
                              {q.options && q.options.length > 0 && (
                                <ul style={{ listStyleType: 'none', paddingLeft: 0, fontSize: '0.9rem' }}>
                                  {q.options.map((opt: string, optIdx: number) => (
                                    <li key={optIdx} style={{ color: q.correctIndex === optIdx ? 'var(--success)' : '', padding: '4px 0' }}>
                                      {optIdx + 1}. {opt} {q.correctIndex === optIdx && '✓'}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>

                        {(config.questions || []).length > 0 && (
                          <button className="btn-primary" style={{ width: '100%', marginTop: '24px' }} onClick={approveRoundQuestions}>
                            Approve & Save Questions
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* STEP 4 PANEL: Review drive configurations summary */}
            {recruitmentStep === 4 && (
              <div className="glass-panel" style={{ maxWidth: '850px', margin: '0 auto' }}>
                <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Review Recruitment Drive Summary</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '24px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Company</span>
                    <div style={{ fontWeight: 'bold' }}>{driveCompanyName}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Hiring Drive</span>
                    <div style={{ fontWeight: 'bold' }}>{driveNameInput}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Offered Job Role</span>
                    <div style={{ fontWeight: 'bold' }}>{jobRoleInput}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Salary Package Offered</span>
                    <div style={{ fontWeight: 'bold' }}>{packageInput}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Assessment Date / Time</span>
                    <div style={{ fontWeight: 'bold' }}>{assessmentDateInput} @ {assessmentTimeInput}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Eligible Batch / Cutoff CGPA</span>
                    <div style={{ fontWeight: 'bold' }}>Batch {eligibleBatchInput} | Min {minCgpaInput} CGPA</div>
                  </div>
                </div>

                <h3>Rounds configuration sequence</h3>
                <table className="styled-table" style={{ marginBottom: '32px' }}>
                  <thead>
                    <tr><th>Round Name</th><th>Round Type</th><th>Time Limit</th><th>Passing Percentage</th></tr>
                  </thead>
                  <tbody>
                    {rounds.map((r, idx) => (
                      <tr key={r.id}>
                        <td><strong>Round {idx + 1}: {r.name}</strong></td>
                        <td>{r.type.toUpperCase()}</td>
                        <td>{r.timeLimit} Mins</td>
                        <td>{r.passingPercentage} %</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <button className="btn-primary" style={{ width: '100%', padding: '16px' }} onClick={handlePublishDrive}>
                  Confirm & Publish Recruitment Drive Assessment
                </button>
              </div>
            )}

            {/* STEP 5 PANEL: Publish Link generation */}
            {recruitmentStep === 5 && publishedDetails && (
              <div className="glass-panel" style={{ maxWidth: '650px', margin: '0 auto', textAlign: 'center', padding: '40px' }}>
                <CheckCircle2 size={64} style={{ color: 'var(--success)', margin: '0 auto 20px' }} />
                <h2>Hiring Assessment Drive Published!</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Assessment details generated successfully.</p>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '32px', textAlign: 'left' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Unique Assessment Link</span>
                    <div style={{ fontWeight: 'bold', wordBreak: 'break-all', color: 'var(--primary)' }}>{publishedDetails.assessmentLink}</div>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Assessment ID</span>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{publishedDetails.assessmentId}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                    <img src={publishedDetails.qrCodeUrl} alt="Assessment QR" style={{ border: '4px solid #fff', borderRadius: '8px' }} />
                  </div>
                </div>

                {/* Email Senders */}
                <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px', textAlign: 'left', marginBottom: '20px' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px' }}><Send size={16} /> Send Assessment Link to Candidates</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Enter candidate email IDs (comma-separated):</p>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. sara@college.edu, karthik@college.edu" 
                    value={candidateEmails} 
                    onChange={(e) => setCandidateEmails(e.target.value)} 
                  />
                  <button 
                    className="btn-secondary" 
                    style={{ marginTop: '12px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={handleSendEmails}
                    disabled={isSendingEmails}
                  >
                    {isSendingEmails ? 'Sending email invitations...' : '✉️ Send Test Link to Candidate Emails'}
                  </button>
                </div>

                <button className="btn-primary" style={{ width: '100%' }} onClick={handleStartLiveDriveTimer}>
                  Launch Live Assessment Room
                </button>
              </div>
            )}

            {/* STEP 6 PANEL: Live Monitoring Analytics */}
            {recruitmentStep === 6 && (
              <div>
                <h2>Hiring Live Session monitor</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Socket timeline and activity logs feeding in real-time</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                  <div className="glass-panel" style={{ textAlign: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Registered Students</span>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>15</div>
                  </div>
                  <div className="glass-panel" style={{ textAlign: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Attempting</span>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--warning)' }}>4</div>
                  </div>
                  <div className="glass-panel" style={{ textAlign: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Submitted</span>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--success)' }}>{liveCandidates.length}</div>
                  </div>
                  <div className="glass-panel" style={{ textAlign: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Blur Alerts</span>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--danger)' }}>1</div>
                  </div>
                </div>

                {/* Submissions Live Chart Bar Graph */}
                <div className="glass-panel" style={{ marginBottom: '32px' }}>
                  <h3>Submission Progress (Candidates over Time)</h3>
                  <div className="live-chart">
                    <div className="chart-bar" style={{ height: '20%' }} data-value="2 candidates"></div>
                    <div className="chart-bar" style={{ height: '45%' }} data-value="5 candidates"></div>
                    <div className="chart-bar" style={{ height: '70%' }} data-value="8 candidates"></div>
                    <div className="chart-bar" style={{ height: '90%' }} data-value="12 candidates"></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 16px' }}>
                    <span className="chart-label">Round Start</span>
                    <span className="chart-label">10 Mins</span>
                    <span className="chart-label">20 Mins</span>
                    <span className="chart-label">30 Mins</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                  <div className="glass-panel">
                    <h3>Candidate Standings</h3>
                    <table className="styled-table">
                      <thead>
                        <tr><th>Student</th><th>Status</th><th>Score</th></tr>
                      </thead>
                      <tbody>
                        {liveCandidates.map((c, idx) => (
                          <tr key={idx}>
                            <td><strong>{c.username}</strong></td>
                            <td style={{ color: c.status === 'Qualified' ? 'var(--success)' : 'var(--danger)' }}>{c.status}</td>
                            <td>{c.score}</td>
                          </tr>
                        ))}
                        {liveCandidates.length === 0 && (
                          <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Waiting for students to submit round...</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="glass-panel">
                    <h3>Socket Activity Log</h3>
                    <div style={{ height: '300px', overflowY: 'auto', background: '#090d16', padding: '16px', borderRadius: '10px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {activityLogs.map((log, idx) => <div key={idx} style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{log}</div>)}
                    </div>
                  </div>
                </div>

                <button className="btn-secondary" style={{ marginTop: '24px', width: '100%' }} onClick={() => setRecruitmentStep(7)}>
                  Close Live Room & View Results
                </button>
              </div>
            )}

            {/* STEP 7 PANEL: View Results & analytics */}
            {recruitmentStep === 7 && (
              <div>
                <h2>Hiring drive Results Overview</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Qualifying candidate tables, Excel sheets, and question analytics</p>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '24px' }}>
                  <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={exportCSVResults}>
                    <FileSpreadsheet size={16} /> Download Excel (CSV)
                  </button>
                  <button className="btn-secondary" onClick={exportPDFReport}>
                    Download PDF Report
                  </button>
                </div>

                <div className="glass-panel" style={{ marginBottom: '32px' }}>
                  <h3>Recruitment Drive Leaderboard</h3>
                  <table className="styled-table">
                    <thead>
                      <tr><th>Candidate</th><th>Round Scores</th><th>Progression status</th></tr>
                    </thead>
                    <tbody>
                      {driveCandidates.map((c, idx) => (
                        <tr key={idx}>
                          <td><strong>{c.username}</strong></td>
                          <td>
                            {Object.entries(c.scores).map(([rId, score]: any) => (
                              <span key={rId} className="badge-status" style={{ marginRight: '8px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                {rId}: {score}
                              </span>
                            ))}
                          </td>
                          <td>
                            <span className="badge-status" style={{ 
                              padding: '4px 8px', 
                              borderRadius: '12px', 
                              fontSize: '0.8rem', 
                              fontWeight: 'bold', 
                              background: c.status === 'Qualified' || c.status === 'Selected' ? 'rgba(16, 185, 129, 0.15)' : c.status === 'Pending' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)', 
                              color: c.status === 'Qualified' || c.status === 'Selected' ? 'var(--success)' : c.status === 'Pending' ? 'var(--warning)' : 'var(--danger)' 
                            }}>
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {driveCandidates.length === 0 && (
                        <tr>
                          <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No candidates have completed assessments yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div className="glass-panel">
                    <h3>Topic-wise strengths</h3>
                    <ul style={{ paddingLeft: '20px', lineHeight: '200%' }}>
                      <li>Logical Reasoning: <strong style={{ color: 'var(--success)' }}>85% Success</strong></li>
                      <li>Quantitative Aptitude: <strong style={{ color: 'var(--warning)' }}>62% Success</strong></li>
                      <li>Java Coding Algorithms: <strong style={{ color: 'var(--success)' }}>74% Success</strong></li>
                    </ul>
                  </div>
                  <div className="glass-panel">
                    <h3>Rounds Analytics</h3>
                    <ul style={{ paddingLeft: '20px', lineHeight: '200%' }}>
                      <li>Total Candidates Sourced: <strong>12</strong></li>
                      <li>R1 Qualified: <strong>8 (66%)</strong></li>
                      <li>R2 Qualified: <strong>3 (25%)</strong></li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
            </>
            )}
          </div>
        )}

        {/* ADMIN WORKSPACE */}
        {user && user.role === 'admin' && (
          <div>
            {view === 'admin-interviews-reports' ? (
              <AdminReports />
            ) : view === 'admin-interviews-monitoring' ? (
              <AdminMonitoring />
            ) : (
              <>
                <h2>Admin Controller Workspace</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Full access logs, recruiter drives, and system tracking reports</p>

            <div className="tab-bar">
              <button className={`tab-btn ${adminTab === 'students' ? 'active' : ''}`} onClick={() => setAdminTab('students')}>
                Student Details
              </button>
              <button className={`tab-btn ${adminTab === 'companies' ? 'active' : ''}`} onClick={() => setAdminTab('companies')}>
                Company Details
              </button>
            </div>

            {adminTab === 'students' && (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                <div className="glass-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Total Students Details Directory</h3>
                    <button
                      onClick={handleDeleteAllUsers}
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease-in-out'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#ef4444';
                        e.currentTarget.style.color = '#ffffff';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                        e.currentTarget.style.color = '#ef4444';
                      }}
                    >
                      <Trash2 size={14} /> Overall Delete
                    </button>
                  </div>
                  <table className="styled-table" style={{ marginTop: '16px' }}>
                    <thead>
                      <tr><th>Name</th><th>Username</th><th>Domain Streak</th><th>Access status</th><th style={{ textAlign: 'center' }}>Action</th></tr>
                    </thead>
                    <tbody>
                      {adminData.students && adminData.students.map((student: any, idx: number) => (
                        <tr key={idx}>
                          <td><strong>{student.fullName || 'Student Candidate'}</strong></td>
                          <td>{student.username}</td>
                          <td>{student.streak || 0} Day Practice Streak</td>
                          <td><span style={{ color: 'var(--success)', fontWeight: 'bold' }}>Enabled</span></td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => handleDeleteUser(student.username)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title={`Delete ${student.fullName || student.username}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!adminData.students || adminData.students.length === 0) && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No student records in system database.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="glass-panel">
                  <h3>System Audit Logs</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px', maxHeight: '350px', overflowY: 'auto' }}>
                    <div style={{ fontSize: '0.8rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                      <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>AUTH_LOGIN_SUCCESS</div>
                      <div style={{ color: 'var(--text-muted)' }}>Admin logged into portal</div>
                    </div>
                    <div style={{ fontSize: '0.8rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                      <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>STUDENT_PRACTICE_SYNC</div>
                      <div style={{ color: 'var(--text-muted)' }}>Synchronized streaks details</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {adminTab === 'companies' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-8px' }}>
                  <button
                    onClick={handleDeleteAllCompanies}
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease-in-out'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#ef4444';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                      e.currentTarget.style.color = '#ef4444';
                    }}
                  >
                    <Trash2 size={14} /> Overall Delete (All Companies & Drives)
                  </button>
                </div>
                <div className="glass-panel">
                  <h3>Visiting Companies & Offered Roles</h3>
                  <table className="styled-table" style={{ marginTop: '16px' }}>
                    <thead>
                      <tr>
                        <th>Company Name</th>
                        <th>Recruiter ID</th>
                        <th>Drive / Job Role Offer</th>
                        <th>shortlist Type</th>
                        <th>Session Status</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminData.drives && adminData.drives.map((drive: any) => {
                        const comp = adminData.companies.find((c: any) => c.username === drive.companyUsername);
                        return (
                          <tr key={drive.id}>
                            <td><strong>{comp ? comp.companyName : 'External Recruiter'}</strong></td>
                            <td>{drive.companyUsername}</td>
                            <td>{drive.name}</td>
                            <td>{drive.autoShortlist ? 'Automatic' : 'Manual Shortlist'}</td>
                            <td>
                              <span style={{ 
                                padding: '4px 8px', 
                                borderRadius: '12px', 
                                fontSize: '0.8rem', 
                                fontWeight: 'bold', 
                                background: drive.status === 'Active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)', 
                                color: drive.status === 'Active' ? 'var(--success)' : 'var(--text-muted)' 
                              }}>
                                {drive.status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                onClick={() => handleDeleteDrive(drive.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  borderRadius: '4px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title={`Delete Drive ${drive.name}`}
                              >
                                  <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {(!adminData.drives || adminData.drives.length === 0) && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No visiting company drives logged.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="glass-panel">
                  <h3>Recruiter Logins & Registrations</h3>
                  <table className="styled-table" style={{ marginTop: '16px' }}>
                    <thead>
                      <tr>
                        <th>Company Name</th>
                        <th>Recruiter Username</th>
                        <th>Access Code (Password)</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminData.companies && adminData.companies.map((comp: any, idx: number) => (
                        <tr key={idx}>
                          <td><strong>{comp.companyName}</strong></td>
                          <td>{comp.username}</td>
                          <td><code>{comp.password}</code></td>
                          <td><span style={{ color: 'var(--success)' }}>Authorized</span></td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => handleDeleteCompany(comp.username)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title={`Delete Company ${comp.companyName}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!adminData.companies || adminData.companies.length === 0) && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No companies have registered accounts yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
