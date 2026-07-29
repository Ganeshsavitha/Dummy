const Groq = require("groq-sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { runSandbox } = require("../sandbox/sandbox");
require("dotenv").config();

const hasGemini = !!process.env.GEMINI_API_KEY;
const hasGroq = !!process.env.GROQ_API_KEY;

let genAI = null;
let groq = null;

if (hasGemini) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}
if (hasGroq) {
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
}

async function getAICompletion(prompt, systemPrompt = "", isJson = false) {
  if (hasGemini) {
    try {
      const modelName = "gemini-1.5-flash";
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: isJson ? { responseMimeType: "application/json" } : undefined
      });

      const fullPrompt = systemPrompt ? `${systemPrompt}\n\nUser Request:\n${prompt}` : prompt;
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      return response.text();
    } catch (geminiError) {
      console.warn("Gemini compilation failed, attempting Groq fallback if available...", geminiError);
      if (!hasGroq) throw geminiError;
    }
  }

  if (hasGroq) {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const completion = await groq.chat.completions.create({
      messages: messages,
      model: "llama-3.1-8b-instant",
      response_format: isJson ? { type: "json_object" } : undefined,
      temperature: 0.7,
      max_tokens: 1500
    });
    return completion.choices[0].message.content;
  }

  throw new Error("No AI API Keys are configured. Please check your .env settings.");
}

function cleanJson(str) {
  try {
    const cleaned = str.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("JSON parsing error on AI response:", str, e);
    throw new Error("AI service returned a malformed response schema.");
  }
}

// Controller Endpoints
exports.generateQuestion = async (req, res) => {
  try {
    const { subject, difficulty = "Medium", role = "Software Engineer", mode = "normal" } = req.body;
    let systemPrompt = "You are a senior tech recruiter at Google.";
    let prompt = "";

    if (mode === "mcq") {
      prompt = `Generate exactly ONE multiple choice question (MCQ) for a developer candidate on the subject: "${subject}" at difficulty level: "${difficulty}".
      The question must contain 4 clear choices, the index of the correct option (0 to 3), and a comprehensive technical explanation.
      Return the output as a JSON object with this exact schema:
      {
        "question": "The question text",
        "options": ["Option 0 text", "Option 1 text", "Option 2 text", "Option 3 text"],
        "correctIndex": 2,
        "explanation": "Clear details explaining why the choice is correct"
      }`;
      const aiResponse = await getAICompletion(prompt, systemPrompt, true);
      const parsedData = cleanJson(aiResponse);
      return res.json({ success: true, mode: "mcq", question: parsedData });
    }

    if (mode === "coding") {
      prompt = `Generate exactly ONE coding round challenge for a candidate in: "${subject}" at difficulty level: "${difficulty}".
      Include challenge title, problem statement, sample input/output, starter code template, and 2 test case JSON assertions.
      Return output as a JSON object matching this schema:
      {
        "title": "Problem Title",
        "description": "Problem explanation",
        "sampleInput": "sample input text",
        "sampleOutput": "sample output text",
        "starterCode": "starter signature template",
        "testCases": [
          { "input": "input 1", "output": "expected output 1" },
          { "input": "input 2", "output": "expected output 2" }
        ]
      }`;
      const aiResponse = await getAICompletion(prompt, systemPrompt, true);
      const parsedData = cleanJson(aiResponse);
      return res.json({ success: true, mode: "coding", question: parsedData });
    }

    if (mode === "hr") {
      prompt = `Generate exactly ONE HR / Behavioral interview question for a candidate applying for: "${role}". Target key behavioral traits like collaboration, problem solving, or adaptibility.
      Return ONLY the raw question string. No JSON, no formatting, no explanations.`;
      const aiResponse = await getAICompletion(prompt, systemPrompt, false);
      return res.json({ success: true, mode: "hr", question: aiResponse.trim() });
    }

    // Default Normal / Mock
    prompt = `Generate exactly ONE technical conceptual interview question on: "${subject}" at difficulty level: "${difficulty}".
    Focus on foundational principles and real-world implementation.
    Return ONLY the raw question string. No explanations, no formatting, no markdown wrappers.`;
    const aiResponse = await getAICompletion(prompt, systemPrompt, false);
    res.json({ success: true, mode: "normal", question: aiResponse.trim() });

  } catch (error) {
    console.error("AI Generation failed:", error);
    res.status(500).json({ success: false, message: "Error generating questions: " + error.message });
  }
};

// Batch MCQ deck generation to replace sequential prefetch
exports.generateMcqDeck = async (req, res) => {
  try {
    const { subject, difficulty = "Medium" } = req.body;
    const systemPrompt = "You are a senior tech recruiter at Google.";
    const prompt = `Generate exactly 10 unique multiple choice questions (MCQs) for a developer candidate on the subject: "${subject}" at difficulty level: "${difficulty}".
    The questions must contain 4 clear choices, the index of the correct option (0 to 3), and a comprehensive technical explanation.
    Return the output as a JSON object with this exact schema:
    {
      "questions": [
        {
          "question": "The question text",
          "options": ["Option 0 text", "Option 1 text", "Option 2 text", "Option 3 text"],
          "correctIndex": 2,
          "explanation": "Clear details explaining why the choice is correct"
        }
      ]
    }`;
    const aiResponse = await getAICompletion(prompt, systemPrompt, true);
    const parsedData = cleanJson(aiResponse);
    res.json({ success: true, questions: parsedData.questions });
  } catch (error) {
    console.error("Batch MCQ Generation failed:", error);
    res.status(500).json({ success: false, message: "Error generating MCQ deck: " + error.message });
  }
};

exports.evaluateAnswer = async (req, res) => {
  try {
    const { question, answer, type = "normal" } = req.body;
    let systemPrompt = "You are an automated code evaluation engine.";
    let prompt = "";

    if (type === "hr") {
      prompt = `Evaluate the candidate's HR behavioral interview answer.
      Question: "${question}"
      User Answer: "${answer}"
      
      Score their response out of 10 and assess three specific categories: confidence (High/Medium/Low), grammar (Excellent/Good/Needs Improvement), and communication quality (Clear/Vague/Too Wordy).
      Return response in this exact JSON schema:
      {
        "score": 8,
        "strengths": ["shows ownership", "clear structure"],
        "improvements": ["needs to explain metrics better"],
        "confidenceRating": "High",
        "grammarRating": "Excellent",
        "communicationRating": "Clear",
        "modelAnswer": "Model STAR behavioral answer template"
      }`;
      const aiResponse = await getAICompletion(prompt, systemPrompt, true);
      const parsed = cleanJson(aiResponse);
      return res.json({ success: true, feedback: parsed });
    }

    // Default evaluate
    prompt = `Review this technical answer.
    Question: "${question}"
    User Answer: "${answer}"
    
    Evaluate the response and provide score (1-10), strengths list, improvements list, and model answer.
    Return response in this exact JSON schema:
    {
      "score": 7,
      "strengths": ["accurate concept"],
      "improvements": ["expand with edge cases"],
      "modelAnswer": "Detailed conceptual answer definition"
    }`;
    const aiResponse = await getAICompletion(prompt, systemPrompt, true);
    const parsed = cleanJson(aiResponse);
    res.json({ success: true, feedback: parsed });

  } catch (error) {
    console.error("AI Evaluation failed:", error);
    res.status(500).json({ success: false, message: "Error evaluating answer: " + error.message });
  }
};

exports.evaluateCode = async (req, res) => {
  try {
    const { question, answer, language } = req.body;
    const systemPrompt = "You are an automated static analysis code checker.";
    const prompt = `Analyze this code submission.
    Challenge: "${question}"
    Submitted Code: "${answer}"
    Language: "${language}"
    
    Determine time complexity, space complexity, syntactic correctness, and provide performance suggestions.
    Return response as a JSON object matching this schema:
    {
      "success": true,
      "timeComplexity": "O(N)",
      "spaceComplexity": "O(1)",
      "score": 8,
      "suggestions": ["Use map to replace loops", "Check boundary values"],
      "explanation": "Your code is efficient and works as expected."
    }`;
    const aiResponse = await getAICompletion(prompt, systemPrompt, true);
    const parsed = cleanJson(aiResponse);
    res.json({ success: true, feedback: parsed });
  } catch (error) {
    console.error("Coding feedback error:", error);
    res.status(500).json({ success: false, message: "Error evaluating code: " + error.message });
  }
};

// Sandbox Code execution endpoint
exports.executeCode = async (req, res) => {
  try {
    const { code, testCases, language } = req.body;
    if (!code || !testCases) {
      return res.status(400).json({ success: false, message: "Missing code or testCases parameter." });
    }
    const runResult = runSandbox(code, testCases, language);
    res.json(runResult);
  } catch (error) {
    console.error("Sandbox code execution error:", error);
    res.status(500).json({ success: false, message: "Error running code sandbox: " + error.message });
  }
};

exports.analyzeResume = async (req, res) => {
  try {
    const { resumeText } = req.body;
    const systemPrompt = "You are an expert HR Specialist and Resume ATS Evaluator.";
    const prompt = `Analyze this candidate resume context:
    "${resumeText}"
    
    Assess the ATS score (0-100), extract matching skills, determine missing skills, review formatting and grammar quality, and generate 3 custom mock interview questions.
    Return output as a JSON object matching this schema:
    {
      "atsScore": 75,
      "detectedSkills": ["Javascript", "React"],
      "missingSkills": ["Node.js", "Docker"],
      "formattingFeedback": "Formatting looks good, suggest adding a projects section.",
      "grammarFeedback": "Grammar is clean.",
      "suggestions": ["Add links to GitHub profile", "Use active verbs"],
      "resumeQuestions": ["Explain your role in React setup", "How did you scale database?", "Describe JavaScript testing experience"]
    }`;
    const aiResponse = await getAICompletion(prompt, systemPrompt, true);
    const parsed = cleanJson(aiResponse);
    res.json({ success: true, analysis: parsed });
  } catch (error) {
    console.error("Resume feedback error:", error);
    res.status(500).json({ success: false, message: "Error scanning resume: " + error.message });
  }
};

exports.generateRoadmap = async (req, res) => {
  try {
    const { currentSkill, targetCompany, targetRole, hours } = req.body;
    const systemPrompt = "You are a professional software engineering career mentor.";
    const prompt = `Create a custom learning roadmap to learn: "${currentSkill}" for role: "${targetRole}" at company: "${targetCompany}" with: ${hours} study hours per week.
    Provide a 4-week structured guide including weekly goals, study tasks, resource URLs, and practice code topics.
    Return output as a JSON object matching this schema:
    {
      "title": "Developer Learning path",
      "overview": "Detailed summary path target",
      "weeklyPlan": [
        {
          "week": 1,
          "topics": ["Topic A", "Topic B"],
          "tasks": ["Read articles", "Write 2 code scripts"],
          "resources": ["MDN Web Docs", "FreeCodeCamp Tutorials"]
        },
        {
          "week": 2,
          "topics": ["Topic C"],
          "tasks": ["Implement database schemas"],
          "resources": ["W3Schools SQL Tutorial"]
        }
      ],
      "practiceQuestions": ["Write index filters", "Develop callback routes"]
    }`;
    const aiResponse = await getAICompletion(prompt, systemPrompt, true);
    const parsed = cleanJson(aiResponse);
    res.json({ success: true, roadmap: parsed });
  } catch (error) {
    console.error("Roadmap generation error:", error);
    res.status(500).json({ success: false, message: "Error creating roadmap: " + error.message });
  }
};
