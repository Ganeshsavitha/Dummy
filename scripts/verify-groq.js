require("dotenv").config();
const Groq = require("groq-sdk");

async function main() {
  const keys = Object.entries(process.env)
    .filter(([name]) => /^GROQ_API_KEYS?(?:_\d+)?$/.test(name))
    .flatMap(([, value]) => String(value || "").split(","))
    .map(value => value.trim())
    .filter(Boolean);
  if (!keys.length) throw new Error("No Groq API keys are configured.");
  console.log(`Configured Groq key count: ${keys.length}`);
  let validCount = 0;
  for (let index = 0; index < keys.length; index += 1) {
    try {
      const groq = new Groq({ apiKey: keys[index] });
      const response = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
        messages: [{ role: "user", content: "Reply with the single word OK." }],
        temperature: 0, max_tokens: 100
      });
      if (!response.choices[0]?.message?.content) throw new Error("unexpected_response");
      validCount += 1;
      console.log(`Key ${index + 1}: VALID`);
    } catch (error) {
      const code = error?.error?.error?.code || error?.error?.code || error?.status || "request_failed";
      console.log(`Key ${index + 1}: INVALID (${code})`);
    }
  }
  if (!validCount) throw new Error("No valid Groq API key is available.");
  console.log(`Groq connectivity verified with ${validCount}/${keys.length} key(s).`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
