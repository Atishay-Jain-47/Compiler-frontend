import React, { useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { go } from "@codemirror/lang-go";
import { oneDark } from "@codemirror/theme-one-dark";

function App() {
  const [language, setLanguage] = useState("C");
  const [code, setCode] = useState("// Write your code here");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const getLanguageExtension = () => {
    switch (language) {
      case "PYTHON":
        return python();
      case "CPP":
        return cpp();
      case "GO":
        return go();
      case "JAVA":
        return java();
      case "C":
        return cpp();
      default:
        return javascript();
    }
  };

  const runCode = async () => {
    setLoading(true);
    setOutput("Running...");

    try {
      const response = await fetch("http://10.129.200.100:8082/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language,
          code,
          input,
          userName: "satyam",
        }),
      });

      const data = await response.json();
      setOutput(data.output);
    } catch (err) {
      setOutput(err);
    }

    setLoading(false);
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top Bar */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          padding: "10px",
          // background: "#1ee1e",
          color: "red",
        }}
      >
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="PYTHON">Python</option>
          <option value="CPP">C++</option>
          <option value="JAVA">Java</option>
          <option value="C">C</option>
          <option value="GO">Go</option>
        </select>

        <button onClick={runCode} disabled={loading}>
          {loading ? "Running..." : "Run"}
        </button>
      </div>
      <div className="flex flex-row justify-between gap-2 rounded-xl mt-2">
        <div className="w-[60vw]">
          {/* Editor */}
          <CodeMirror
            value={code}
            height="100%"
            theme={oneDark}
            minHeight="90vh"
            extensions={[getLanguageExtension()]}
            onChange={(value) => setCode(value)}
          />
        </div>

        <div className="flex flex-col w-[40vw]  gap-2">
          {/* Input */}
          <textarea
            placeholder="Custom Input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{
              padding: "10px",
              fontFamily: "monospace",
            }}
            className="bg-[#111] text-white rounded-xl h-[44vh]"
          />

          {/* Output */}
          <textarea
            placeholder="Output"
            value={output}
            readOnly
            style={{
              padding: "10px",
              fontFamily: "monospace",
              background: "#111",
              color: "white",
            }}
            className="h-[45vh] rounded-xl"
          />
        </div>
      </div>
    </div>
  );
}

export default App;
