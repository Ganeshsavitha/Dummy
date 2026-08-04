export interface Candidate {
  id: string;
  name: string;
  email: string;
  cgpa: number;
  department: string;
  skills: string[];
  mcqScore: string;
  codingScore: string;
  resume: string;
}

export interface Interview {
  id: string;
  studentName: string;
  studentEmail: string;
  studentId: string;
  hrName: string;
  hrId: string;
  date: string;
  time: string;
  duration: number;
  type: string;
  status: 'scheduled' | 'waiting' | 'ongoing' | 'completed' | 'cancelled';
  meetingId: string;
}

export interface Feedback {
  interviewId: string;
  communicationScore: number;
  technicalScore: number;
  confidenceScore: number;
  problemSolvingScore: number;
  overallRating: number;
  comments: string;
  result: 'selected' | 'rejected' | 'hold';
}

export const mockCandidates: Candidate[] = [
  {
    id: 'stud_1',
    name: 'Alice Smith',
    email: 'alice@example.com',
    cgpa: 8.5,
    department: 'CSE',
    skills: ['React', 'TypeScript', 'CSS', 'JavaScript'],
    mcqScore: '8.5 / 10',
    codingScore: '8.0 / 10',
    resume: 'Alice Smith is a passionate frontend developer with experience building clean UIs in React and TypeScript. She has worked on multiple projects including a dashboard and a campus network tool. She is well-versed in HTML5 semantic structures and responsive designs.'
  },
  {
    id: 'stud_2',
    name: 'Bob Jones',
    email: 'bob@example.com',
    cgpa: 6.8,
    department: 'ECE',
    skills: ['Java', 'Spring Boot', 'SQL', 'Hibernate'],
    mcqScore: '8.0 / 10',
    codingScore: '5.5 / 10',
    resume: 'Bob Jones is an ECE student focusing on backend development with Java and Spring. Experienced in database design, REST API development, and unit testing using JUnit. Looking for challenges in backend engineering.'
  },
  {
    id: 'stud_3',
    name: 'Eva Davis',
    email: 'eva@example.com',
    cgpa: 9.0,
    department: 'CSE',
    skills: ['Python', 'Machine Learning', 'SQL', 'Pandas', 'TensorFlow'],
    mcqScore: '9.5 / 10',
    codingScore: '8.0 / 10',
    resume: 'Eva Davis is a Data Scientist candidate. Experienced in Python data processing, training ML models, TensorFlow, and predictive analytics. Top of her class in database systems and data structure design.'
  }
];

export const mockInterviews: Interview[] = [
  {
    id: 'int_1',
    studentName: 'Alice Smith',
    studentEmail: 'alice@example.com',
    studentId: 'stud_1',
    hrName: 'HR Recruiter',
    hrId: 'hr_1',
    date: '2026-08-05',
    time: '10:00',
    duration: 45,
    type: 'Technical',
    status: 'scheduled',
    meetingId: 'meet-101-abc'
  },
  {
    id: 'int_2',
    studentName: 'Bob Jones',
    studentEmail: 'bob@example.com',
    studentId: 'stud_2',
    hrName: 'HR Recruiter',
    hrId: 'hr_1',
    date: '2026-08-05',
    time: '14:30',
    duration: 30,
    type: 'HR',
    status: 'scheduled',
    meetingId: 'meet-102-def'
  },
  {
    id: 'int_3',
    studentName: 'Eva Davis',
    studentEmail: 'eva@example.com',
    studentId: 'stud_3',
    hrName: 'HR Recruiter',
    hrId: 'hr_1',
    date: '2026-08-04',
    time: '11:00',
    duration: 60,
    type: 'Technical',
    status: 'completed',
    meetingId: 'meet-103-ghi'
  }
];

export const mockFeedbackList: Record<string, Feedback> = {
  'int_3': {
    interviewId: 'int_3',
    communicationScore: 8,
    technicalScore: 9,
    confidenceScore: 8,
    problemSolvingScore: 9,
    overallRating: 8.5,
    comments: 'Eva has exceptional technical skills and logical clarity. She answered machine learning concepts with great detail and designed a clean scaling strategy for the design question.',
    result: 'selected'
  }
};
