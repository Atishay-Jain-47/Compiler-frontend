import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logout } from "../services/operations/authApi";
import { apiConnector } from "../services/apiConnector";
import { runEndpoints } from "../services/apis"
import toast from "react-hot-toast";
import { setLanguage, setOutput } from "../slices/codeSlice";

function Navbar() {

    const dispatch = useDispatch();
  const navigate = useNavigate();

  const { token } = useSelector((state) => state.auth);
  const { user } = useSelector((state) => state.profile);
  const { language, code, input } = useSelector((state) => state.code);


  console.log("Local Storage Code: ", code);
 
  const [loading, setLoading] = useState(false);
//   const [output, setOutput] = useState("");


  const { RUN_API } = runEndpoints;

  const languageHandler = (value) => {
    dispatch(setLanguage(value));
    localStorage.setItem("language", value);
  }

  const runCode = async () => {

    if(!token) {
      toast.error("Login Required");
      return navigate("/login");
    }

    setLoading(true);
    dispatch(setOutput("Running..."));

    try {
      const response = await apiConnector(
        "POST", 
        RUN_API, 
        JSON.stringify({
          language, code, input, user
        }), 
        {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        }
      ); 

      const data = response.data;
      console.log("DATA.....",response);
      dispatch(setOutput(data.output));
    } catch (err) {
      dispatch(setOutput(err.response?.data?.message || err.message));
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
    <div>
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
                <select value={language} onChange={(e) => languageHandler(e.target.value)}>
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
    </div>
  )
}

export default Navbar