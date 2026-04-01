import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { go } from "@codemirror/lang-go";
import { oneDark } from "@codemirror/theme-one-dark";
import { logout } from "../services/operations/authApi";
import { apiConnector } from "../services/apiConnector";
import { endpoints } from "../services/apis"

function Home() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { token } = useSelector((state) => state.auth);
  const { user } = useSelector((state) => state.auth);

  const [language, setLanguage] = useState("C");
  const [code, setCode] = useState("// Write your code here");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const { RUN_API } = endpoints

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
      const response = await apiConnector(
        "POST", 
        RUN_API, 
        JSON.stringify({
          language, code, input, userName: "atishay"
        }), 
        {"Content-Type": "application/json",}
      ); 

      const data = await response.json();
      setOutput(data.output);
    } catch (err) {
      setOutput(err);
    }
    setLoading(false);
  };

  const btnBase = {
    padding: "6px 16px",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.15s ease",
  };

  const runStyle = {
    ...btnBase,
    background: "#16a34a",
    color: "#fff",
    border: "1px solid #15803d",
  };

  const loginStyle = {
    ...btnBase,
    background: "transparent",
    color: "#93c5fd",
    border: "1px solid #3b82f6",
  };

  const signupStyle = {
    ...btnBase,
    background: "#2563eb",
    color: "#fff",
    border: "1px solid #1d4ed8",
  };

  const logoutStyle = {
    ...btnBase,
    background: "transparent",
    color: "#fca5a5",
    border: "1px solid #ef4444",
  };

  return (
    <>
      <style>{`
        .hbtn:hover  { filter: brightness(1.18); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.35); }
        .hbtn:active { filter: brightness(0.92); transform: translateY(1px);  box-shadow: none; }
        .hbtn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; filter: none; box-shadow: none; }
      `}</style>

    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>

      {/* Top Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
          padding: "10px",
          color: "red",
        }}
      >
        {/* Left: language selector + run button */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="PYTHON">Python</option>
            <option value="CPP">C++</option>
            <option value="JAVA">Java</option>
            <option value="C">C</option>
            <option value="GO">Go</option>
          </select>

          <button
            className="hbtn"
            style={runStyle}
            onClick={runCode}
            disabled={loading}
          >
            {loading ? "Running..." : "Run"}
          </button>
        </div>

        {/* Right: auth buttons */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {token ? (
            <>
              <span style={{ color: "white", fontSize: "14px" }}>
                {user?.userName}
              </span>
              <button
                className="hbtn"
                style={logoutStyle}
                onClick={() => dispatch(logout(navigate))}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                className="hbtn"
                style={loginStyle}
                onClick={() => navigate("/login")}
              >
                Log In
              </button>
              <button
                className="hbtn"
                style={signupStyle}
                onClick={() => navigate("/signup")}
              >
                Sign Up
              </button>
            </>
          )}
        </div>
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

        <div className="flex flex-col w-[40vw] gap-2">
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
    </>
  );
}

export default Home;