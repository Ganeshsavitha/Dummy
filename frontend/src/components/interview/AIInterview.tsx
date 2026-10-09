import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Camera, CheckCircle2, Loader2, Mic, MicOff, PhoneOff, Send, Sparkles, Volume2 } from 'lucide-react';
import type { Interview } from './mockData';

interface AIInterviewProps {
  interview: Interview;
  onLeave: () => void;
  onCompleted: () => void;
}

interface Evaluation {
  communicationScore: number;
  technicalScore: number;
  confidenceScore: number;
  problemSolvingScore: number;
  overallRating: number;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  summary: string;
  recommendation: 'selected' | 'hold' | 'rejected';
}

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : window.location.origin;

export default function AIInterview({ interview, onLeave, onCompleted }: AIInterviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const [question, setQuestion] = useState('Preparing your interview...');
  const [questionCount, setQuestionCount] = useState(0);
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState<'thinking' | 'speaking' | 'listening' | 'ready' | 'completed'>('thinking');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [error, setError] = useState('');
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);

  const speak = useCallback((text: string, after?: () => void) => {
    if (!('speechSynthesis' in window)) {
      setStatus('ready');
      after?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onstart = () => setStatus('speaking');
    utterance.onend = () => { setStatus('ready'); after?.(); };
    utterance.onerror = () => setStatus('ready');
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!active) return stream.getTracks().forEach(track => track.stop());
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setError('Camera preview unavailable. You can still continue using text input.');
      }

      try {
        const response = await fetch(`${API_BASE}/api/placement/interviews/${interview.id}/ai/start`, { method: 'POST' });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Unable to start AI interview.');
        if (!active) return;
        if (data.session.status === 'completed') {
          setEvaluation(data.session.evaluation);
          setStatus('completed');
          return;
        }
        setQuestion(data.session.currentQuestion);
        setQuestionCount(data.session.questionCount);
        speak(`${data.greeting ? `${data.greeting} ` : ''}${data.session.currentQuestion}`);
      } catch (startError: any) {
        setError(startError.message || 'Unable to start AI interview.');
        setStatus('ready');
      }
    };
    initialize();
    return () => {
      active = false;
      recognitionRef.current?.stop?.();
      window.speechSynthesis?.cancel();
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [interview.id, speak]);

  const toggleListening = () => {
    if (status === 'listening') {
      recognitionRef.current?.stop?.();
      setStatus('ready');
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setError('Voice recognition is not supported in this browser. Type your answer below.');
      return;
    }
    window.speechSynthesis.cancel();
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalText = answer;
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const text = event.results[index][0].transcript;
        if (event.results[index].isFinal) finalText = `${finalText} ${text}`.trim();
        else interim += text;
      }
      setAnswer(`${finalText}${interim ? ` ${interim}` : ''}`.trim());
    };
    recognition.onerror = () => { setStatus('ready'); setError('Voice capture stopped. You can edit or type the answer.'); };
    recognition.onend = () => setStatus(current => current === 'listening' ? 'ready' : current);
    recognitionRef.current = recognition;
    recognition.start();
    setError('');
    setStatus('listening');
  };

  const submitAnswer = async () => {
    const cleanAnswer = answer.trim();
    if (cleanAnswer.length < 2 || isSubmitting) return;
    recognitionRef.current?.stop?.();
    setIsSubmitting(true);
    setStatus('thinking');
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/placement/interviews/${interview.id}/ai/answer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: cleanAnswer })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to evaluate the answer.');
      setAnswer('');
      if (data.completed) {
        setEvaluation(data.evaluation);
        setStatus('completed');
        speak('Thank you. Your interview is complete. Your feedback report is now ready.');
        onCompleted();
      } else {
        setQuestion(data.session.currentQuestion);
        setQuestionCount(data.session.questionCount);
        speak(`${data.acknowledgement || 'Thank you.'} ${data.session.currentQuestion}`);
      }
    } catch (submitError: any) {
      setError(submitError.message || 'Unable to submit the answer. Please retry.');
      setStatus('ready');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (evaluation) {
    return (
      <div className="glass-panel ai-interview-report">
        <CheckCircle2 size={52} color="var(--success)" />
        <h2>AI HR Interview Completed</h2>
        <div className="ai-score-ring">{Math.round(evaluation.overallRating * 10)}%</div>
        <p>{evaluation.summary}</p>
        <div className="ai-score-grid">
          <span>Communication <strong>{evaluation.communicationScore}/10</strong></span>
          <span>Role Knowledge <strong>{evaluation.technicalScore}/10</strong></span>
          <span>Response Confidence <strong>{evaluation.confidenceScore}/10</strong></span>
          <span>Problem Solving <strong>{evaluation.problemSolvingScore}/10</strong></span>
        </div>
        <div className="ai-feedback-grid">
          <section><h3>Plus points</h3><ul>{evaluation.strengths.map((item, index) => <li key={index}>{item}</li>)}</ul></section>
          <section><h3>Areas to improve</h3><ul>{evaluation.weaknesses.map((item, index) => <li key={index}>{item}</li>)}</ul></section>
          <section><h3>Next actions</h3><ul>{evaluation.improvements.map((item, index) => <li key={index}>{item}</li>)}</ul></section>
        </div>
        <button className="btn-primary" onClick={onLeave}>Return to Interview Schedule</button>
      </div>
    );
  }

  return (
    <div className="ai-interview-layout">
      <div className="ai-video-stage">
        <video ref={videoRef} autoPlay muted playsInline className="ai-candidate-video" />
        <div className={`ai-avatar-card ${status}`}>
          <div className="ai-avatar"><Bot size={62} /></div>
          <div className="ai-avatar-name"><Sparkles size={15} /> HireGrad AI HR</div>
          <div className="ai-avatar-status">
            {status === 'thinking' && <><Loader2 className="spin" size={15} /> Thinking</>}
            {status === 'speaking' && <><Volume2 size={15} /> Speaking</>}
            {status === 'listening' && <><Mic size={15} /> Listening</>}
            {status === 'ready' && <>Ready for your answer</>}
          </div>
        </div>
        <div className="ai-camera-label"><Camera size={14} /> You</div>
      </div>

      <aside className="ai-interview-panel glass-panel">
        <div className="ai-progress"><span>Question {Math.max(questionCount, 1)} of 5</span><progress value={questionCount} max={5} /></div>
        <div className="ai-question"><Bot size={22} /><p>{question}</p></div>
        <p className="ai-consent-note">Only your transcript and evaluation are stored. Your camera video is not recorded.</p>
        {error && <div className="ai-error">{error}</div>}
        <textarea className="form-control ai-answer" value={answer} onChange={event => setAnswer(event.target.value)}
          placeholder={speechSupported ? 'Use the microphone or type your answer here…' : 'Type your answer here…'} disabled={isSubmitting} />
        <div className="ai-actions">
          <button className={status === 'listening' ? 'btn-primary' : 'btn-secondary'} onClick={toggleListening} disabled={isSubmitting || status === 'speaking' || status === 'thinking'}>
            {status === 'listening' ? <MicOff size={17} /> : <Mic size={17} />} {status === 'listening' ? 'Stop' : 'Speak Answer'}
          </button>
          <button className="btn-primary" onClick={submitAnswer} disabled={answer.trim().length < 2 || isSubmitting || status === 'speaking'}>
            {isSubmitting ? <Loader2 className="spin" size={17} /> : <Send size={17} />} Submit Answer
          </button>
          <button className="btn-secondary" onClick={onLeave}><PhoneOff size={17} /> Leave</button>
        </div>
      </aside>
    </div>
  );
}
