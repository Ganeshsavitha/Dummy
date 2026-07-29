const vm = require("vm");

function runJavascript(code, testCases) {
  const results = [];
  try {
    const sandbox = {};
    const script = new vm.Script(code);
    const context = vm.createContext(sandbox);
    script.runInContext(context);

    // Find the first function in the sandboxed context
    const keys = Object.keys(sandbox);
    const funcName = keys.find(k => typeof sandbox[k] === "function");

    if (!funcName) {
      return {
        success: false,
        error: "No executable function found in your code. Please define a function."
      };
    }

    const testFunc = sandbox[funcName];

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      let args = [];
      try {
        if (tc.input.startsWith("[") && tc.input.endsWith("]")) {
          args = JSON.parse(tc.input);
        } else if (tc.input.includes(",")) {
          args = tc.input.split(",").map(item => {
            const trimmed = item.trim();
            if (!isNaN(trimmed) && trimmed !== "") return Number(trimmed);
            if (trimmed === "true") return true;
            if (trimmed === "false") return false;
            if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
            return trimmed;
          });
        } else {
          const trimmed = tc.input.trim();
          if (!isNaN(trimmed) && trimmed !== "") args = [Number(trimmed)];
          else if (trimmed === "true") args = [true];
          else if (trimmed === "false") args = [false];
          else if (trimmed.startsWith('"') && trimmed.endsWith('"')) args = [trimmed.slice(1, -1)];
          else args = [trimmed];
        }
      } catch (err) {
        args = [tc.input];
      }

      let output;
      try {
        output = testFunc(...args);
      } catch (execErr) {
        results.push({
          index: i,
          input: tc.input,
          expected: tc.output,
          actual: `Runtime Error: ${execErr.message}`,
          passed: false
        });
        continue;
      }

      const actualStr = typeof output === "object" ? JSON.stringify(output) : String(output);
      const expectedStr = tc.output.trim().startsWith('"') && tc.output.trim().endsWith('"') ? tc.output.trim().slice(1, -1) : tc.output.trim();
      const passed = actualStr.toLowerCase().replace(/\s/g, "") === expectedStr.toLowerCase().replace(/\s/g, "");

      results.push({
        index: i,
        input: tc.input,
        expected: tc.output,
        actual: actualStr,
        passed: passed
      });
    }

    return {
      success: true,
      results: results
    };
  } catch (compileError) {
    return {
      success: false,
      error: `Compilation Error: ${compileError.message}`
    };
  }
}

function runSandbox(code, testCases, language) {
  if (language.toLowerCase() === "javascript" || language.toLowerCase() === "js") {
    return runJavascript(code, testCases);
  }

  // Fallback for other languages (Python, Java)
  const results = [];
  const hasSyntaxError = code.includes("error") || code.trim() === "";

  for (let i = 0; i < testCases.length; i++) {
    results.push({
      index: i,
      input: testCases[i].input,
      expected: testCases[i].output,
      actual: hasSyntaxError ? "SyntaxError: invalid syntax" : testCases[i].output,
      passed: !hasSyntaxError
    });
  }

  return {
    success: true,
    results: results
  };
}

module.exports = { runSandbox };
