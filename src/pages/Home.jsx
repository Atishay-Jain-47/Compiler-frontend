import React, { useState, useEffect, useRef, useMemo } from "react";
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

// --- Yjs & Collaboration Imports ---
import * as Y from "yjs";
import { yCollab } from "y-codemirror.next";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import * as base64 from "base64-js";

function Home() {
  const dispatch = useDispatch();

  const { language, code, input, output } = useSelector((state) => state.code);

  // --- Collaboration State & Refs ---
  const [roomId, setRoomId] = useState("");
  const [isCollaborating, setIsCollaborating] = useState(false);
  const stompClientRef = useRef(null);
  
  // Generate a random user ID for the WebSocket session
  const userId = useMemo(() => "user-" + Math.random().toString(36).substring(2, 9), []);
  
  // Initialize Yjs Document
  const ydocRef = useRef(new Y.Doc());
  const ytextRef = useRef(ydocRef.current.getText("codemirror"));

  // Ensure initial Redux code is loaded into Yjs exactly once
  useEffect(() => {
    if (ytextRef.current.length === 0 && code) {
      ytextRef.current.insert(0, code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- WebSocket Connection Effect ---
  useEffect(() => {
    const ydoc = ydocRef.current;

    if (isCollaborating && roomId.trim() !== "") {
      const client = new Client({
        webSocketFactory: () => new SockJS("http://localhost:8080/ws-compiler"),
        reconnectDelay: 5000,
        onConnect: () => {
          console.log("Connected to Room:", roomId);
          
          // 1. Listen for incoming changes from Spring Boot
          client.subscribe(`/topic/room/${roomId}`, (message) => {
            const payload = JSON.parse(message.body);
            if (payload.senderId !== userId) {
              const updateArray = base64.toByteArray(payload.updateBase64);
              Y.applyUpdate(ydoc, updateArray, "stomp");
            }
          });
        },
      });

      client.activate();
      stompClientRef.current = client;

      // 2. Broadcast local typing changes to Spring Boot
      const handleYjsUpdate = (update, origin) => {
        if (origin !== "stomp" && stompClientRef.current?.connected) {
          const payload = {
            senderId: userId,
            updateBase64: base64.fromByteArray(update),
          };
          stompClientRef.current.publish({
            destination: `/app/editor.sync/${roomId}`,
            body: JSON.stringify(payload),
          });
        }
      };

      ydoc.on("update", handleYjsUpdate);

      return () => {
        ydoc.off("update", handleYjsUpdate);
        if (stompClientRef.current) {
          stompClientRef.current.deactivate();
        }
      };
    }
  }, [isCollaborating, roomId, userId]);

  const getLanguageExtension = () => {
    switch (language) {
      case "PYTHON": return python();
      case "CPP": return cpp();
      case "GO": return go();
      case "JAVA": return java();
      case "C": return cpp();
      default: return javascript();
    }
  };

  // --- DYNAMIC EXTENSIONS ARRAY (Fix for cascading render error) ---
  const editorExtensions = [getLanguageExtension()];
  if (isCollaborating) {
    editorExtensions.push(yCollab(ytextRef.current, null));
  }

  const codeChangeHandler = (value) => {
    dispatch(setCode(value));
    localStorage.setItem("code", value);
  };

  const inputChangeHandler = (value) => {
    dispatch(setInput(value));
    localStorage.setItem("input", value);
  };

  // --- Room Management Functions ---
  const toggleCollaboration = () => {
    if (!isCollaborating && roomId.trim() === "") {
      alert("Please enter a Room ID to join.");
      return;
    }
    setIsCollaborating(!isCollaborating);
  };

  const createNewRoom = () => {
    const newRoomId = "room-" + Math.random().toString(36).substring(2, 8);
    setRoomId(newRoomId);
    setIsCollaborating(true);
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
        <Navbar />

        {/* --- Collaboration UI Bar --- */}
        <div className="flex flex-row items-center gap-3 px-4 py-2 mt-1">
          <span className="text-gray-300 font-medium text-sm">Collab Room:</span>
          
          <input
            type="text"
            placeholder="e.g. room-123"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            disabled={isCollaborating}
            className="bg-[#222] text-white px-3 py-1.5 rounded border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
          />
          
          {!isCollaborating ? (
            <>
              <button
                onClick={toggleCollaboration}
                className="px-4 py-1.5 rounded font-medium text-sm transition-colors bg-blue-600 hover:bg-blue-500 text-white"
              >
                Join
              </button>

              <span className="text-gray-500 text-sm">or</span>

              <button
                onClick={createNewRoom}
                className="px-4 py-1.5 rounded font-medium text-sm transition-colors bg-green-600 hover:bg-green-500 text-white"
              >
                Create Room
              </button>
            </>
          ) : (
            <>
              <button
                onClick={toggleCollaboration}
                className="px-4 py-1.5 rounded font-medium text-sm transition-colors bg-red-600 hover:bg-red-500 text-white"
              >
                Disconnect
              </button>
              
              <span className="text-green-400 text-xs ml-2 animate-pulse">
                ● Live (Room ID: <span className="font-bold text-white tracking-wider">{roomId}</span>)
              </span>
            </>
          )}
        </div>

        <div className="flex flex-row justify-between gap-2 rounded-xl mt-2 px-2">
          <div className="w-[60vw]">
            {/* Editor */}
            <CodeMirror
              value={isCollaborating ? undefined : code}
              height="100%"
              theme={oneDark}
              minHeight="85vh"
              extensions={editorExtensions}
              onChange={(value) => codeChangeHandler(value)}
            />
          </div>

          <div className="flex flex-col w-[40vw] gap-2">
            {/* Input */}
            <textarea
              placeholder="Custom Input"
              value={input}
              onChange={(e) => inputChangeHandler(e.target.value)}
              style={{ padding: "10px", fontFamily: "monospace" }}
              className="bg-[#111] text-white rounded-xl h-[42vh] border border-[#333] focus:outline-none focus:border-blue-500"
            />

            {/* Output */}
            <textarea
              placeholder="Output"
              value={output}
              readOnly
              style={{ padding: "10px", fontFamily: "monospace", background: "#111", color: "white" }}
              className="h-[42vh] rounded-xl border border-[#333] focus:outline-none"
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default Home;