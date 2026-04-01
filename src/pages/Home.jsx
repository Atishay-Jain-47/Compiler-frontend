import React from "react";
import { useSelector, useDispatch } from "react-redux";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { go } from "@codemirror/lang-go";
import { oneDark } from "@codemirror/theme-one-dark";
import { setInput, setCode } from "../slices/codeSlice";
import Navbar from "../components/Navbar";


function Home() {
  const dispatch = useDispatch();

  const { language, code, input, output } = useSelector((state) => state.code);


  console.log("Local Storage Code: ", code);

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

  const codeChangeHandler = (value) => {
    setCode(value);
    dispatch(setCode(value));
    localStorage.setItem("code", value);
  }

  const inputChangeHandler = (value) => {
    // setInput(value);
    dispatch(setInput(value));
    localStorage.setItem("input", value);
  }

  return (
    <>
      <style>{`
        .hbtn:hover  { filter: brightness(1.18); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.35); }
        .hbtn:active { filter: brightness(0.92); transform: translateY(1px);  box-shadow: none; }
        .hbtn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; filter: none; box-shadow: none; }
      `}</style>

    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>

      {/* Top Bar */}
      <Navbar/>

      <div className="flex flex-row justify-between gap-2 rounded-xl mt-2">
        <div className="w-[60vw]">
          {/* Editor */}
          <CodeMirror
            value={code}
            height="100%"
            theme={oneDark}
            minHeight="90vh"
            extensions={[getLanguageExtension()]}
            onChange={codeChangeHandler}
          />
        </div>

        <div className="flex flex-col w-[40vw] gap-2">
          {/* Input */}
          <textarea
            placeholder="Custom Input"
            value={input}
            onChange={(e) => inputChangeHandler(e.target.value)}
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