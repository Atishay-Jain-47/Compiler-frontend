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
import { apiConnector } from "../services/apiConnector";
import toast from "react-hot-toast";
import { collabEndpoints } from "../services/apis";


// --- Yjs & Collaboration Imports ---
import * as Y from "yjs";
import { yCollab } from "y-codemirror.next";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import * as base64 from "base64-js";
import { useNavigate } from "react-router";




function Home() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { language, code, input, output } = useSelector((state) => state.code);
  const {token} = useSelector((state) => state.auth);
  const userName = useSelector((state) => state.profile?.user); 
  const { WS_URL, JOIN_ROOM_API, CREATE_ROOM_API } = collabEndpoints;

  // --- Collaboration State & Refs ---
  const [roomId, setRoomId] = useState("");
  const [isCollaborating, setIsCollaborating] = useState(false);
  const stompClientRef = useRef(null);

  // Generate a random user ID for the WebSocket session
  const userId = localStorage.getItem("user");
  // Initialize Yjs Document
  const ydocRef = useRef(null);
  if (!ydocRef.current) {
    ydocRef.current = new Y.Doc();
  }

  const ytextRef = useRef(null);
  if (!ytextRef.current) {
    ytextRef.current = ydocRef.current.getText("codemirror");
  }

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
        webSocketFactory: () => new SockJS(WS_URL),
        reconnectDelay: 5000,
        onConnect: () => {
          console.log("Connected to Room:", roomId);

          // 1. Listen for incoming changes from Spring Boot
          client.subscribe(`/topic/room/${roomId}`, (message) => {
            const payload = JSON.parse(message.body);
            console.log("Received payload from", payload.senderId, "Current user:", userId, payload);
            
            if (payload.type === "SYNC_REQUEST") {
              // Only respond to SYNC_REQUEST from OTHER users
              if (payload.senderId !== userId) {
                // Another user joined! Send them our full document state
                const fullState = Y.encodeStateAsUpdate(ydoc);
                const codeContent = ytextRef.current.toString();
                client.publish({
                  destination: `/app/editor.sync/${roomId}`,
                  body: JSON.stringify({
                    senderId: userId,
                    type: "SYNC_STATE",
                    updateBase64: base64.fromByteArray(fullState),
                  }),
                });
                console.log("✓ User", payload.senderId, "joined. Sent SYNC_STATE with code:", codeContent);
              }
            } else if (payload.type === "SYNC_STATE" || payload.type === "UPDATE") {
              // Process updates and state syncs from ANY user (including other users)
              if (!payload.updateBase64) {
                console.log("No updateBase64 in payload", payload);
                return;
              }
              const updateArray = base64.toByteArray(payload.updateBase64);
              Y.applyUpdate(ydoc, updateArray, "stomp");
              // Sync remote update to Redux and localStorage immediately
              const yjsContent = ytextRef.current.toString();
              dispatch(setCode(yjsContent));
              localStorage.setItem("code", yjsContent);
              if (payload.type === "SYNC_STATE") {
                console.log("✓ Received full SYNC_STATE from", payload.senderId, "Code:", yjsContent);
              } else {
                console.log("✓ Applied UPDATE from", payload.senderId, "Code:", yjsContent);
              }
            }
          });

          // 2. We just connected! Ask existing users for the current full state
          client.publish({
            destination: `/app/editor.sync/${roomId}`,
            body: JSON.stringify({
              senderId: userId,
              type: "SYNC_REQUEST",
            }),
          });
        },
      });

      client.activate();
      stompClientRef.current = client;

      // 3. Broadcast local typing changes to Spring Boot
      const handleYjsUpdate = (update, origin) => {
        console.log("Yjs Update triggered - Origin:", origin, "Connected:", stompClientRef.current?.connected);
        if (origin !== "stomp" && stompClientRef.current?.connected) {
          const payload = {
            senderId: userId,
            type: "UPDATE", // Tag standard typing events
            updateBase64: base64.fromByteArray(update),
          };
          stompClientRef.current.publish({
            destination: `/app/editor.sync/${roomId}`,
            body: JSON.stringify(payload),
          });
          console.log("Published UPDATE to server from", userId);
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
  }, [isCollaborating, roomId, userId, dispatch]);

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

  
  // Create the yCollab extension exactly once, stable across renders
const yCollabExtRef = useRef(null);
if (!yCollabExtRef.current) {
  yCollabExtRef.current = yCollab(ytextRef.current, null);
}
const editorExtensions = useMemo(() => {
  const extensions = [getLanguageExtension()];
  if (isCollaborating) {
    extensions.push(yCollabExtRef.current); // ← stable ref, not a new instance
  }
  return extensions;
}, [language, isCollaborating]); // Only rebuild if language or collab mode changes

  const codeChangeHandler = (value) => {
    dispatch(setCode(value));
    localStorage.setItem("code", value);
    console.log("Local code change synced to storage:", value);
  };

  const inputChangeHandler = (value) => {
    dispatch(setInput(value));
    localStorage.setItem("input", value);
  };

  // --- Room Management Functions ---
  const toggleCollaboration = async () => {
    if (!isCollaborating && roomId.trim() === "") {
      toast.error("Please enter a Room ID to join.");
      return;
    }

    if(!token){
      toast.error("Login is required");
      navigate('/login');
      return;
    }
    
    // When joining an existing room, DON'T sync old localStorage data
    // Instead, wait for SYNC_STATE from the room creator to avoid corrupted data
    // Only clear Yjs if it has old data to prepare for incoming SYNC_STATE
    if (!isCollaborating && ytextRef.current.length > 0) {
      // Clear Yjs document to receive clean state from room creator
      ytextRef.current.delete(0, ytextRef.current.length);
      console.log("Cleared Yjs document before joining room to receive clean state");
    }
    try{
      const response = await apiConnector('POST', JOIN_ROOM_API, {roomId,userName},{Authorization: `Bearer ${token}`});
      if (!isCollaborating) {
        toast.success(response.data.message);
      }
      setIsCollaborating(!isCollaborating);
    } catch(error){
      console.log("Error joining room:", error);
      toast.error(error.response?.data?.message || "Failed to join room");
    }
  };

  const createNewRoom = async () => {

    if(!token){
      toast.error("Login is required");
      navigate('/login');
      return;
    }

    // Sync Redux code to Yjs BEFORE enabling collaboration
    if (code && ytextRef.current.length === 0) {
      ytextRef.current.insert(0, code);
      console.log("Synced current code to Yjs before creating room:", code);
    }
    
    const bodyData = {
      userName ,
      code,
      language,
      input
    };
    const Header = {
      Authorization: `Bearer ${token}`,
    }
    console.log("Creating new room with data:", bodyData);
    const response = await apiConnector('POST', CREATE_ROOM_API, bodyData, Header);
    const newRoomId = response.data.roomId;
    const message = response.data.message;
    toast.success(message);
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

      <div
        style={{ height: "100vh", display: "flex", flexDirection: "column" }}
      >
        {/* Top Bar */}
        <Navbar />

        {/* --- Collaboration UI Bar --- */}
        <div className="flex flex-row items-center gap-3 px-4 py-2 mt-1">
          <span className="text-gray-300 font-medium text-sm">
            Collab Room:
          </span>

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
                ● Live (Room ID:{" "}
                <span className="font-bold text-white tracking-wider">
                  {roomId}
                </span>
                )
              </span>
            </>
          )}
        </div>

        <div className="flex flex-row justify-between gap-2 rounded-xl mt-2 px-2">
          <div className="w-[60vw]">
            {/* Editor */}
            <CodeMirror
              key={isCollaborating ? "collab" : "solo"}   // ← stable key for yCollab binding
              value={isCollaborating ? undefined : code}
              height="100%"
              theme={oneDark}
              minHeight="85vh"
              extensions={editorExtensions}
              onChange={(value) => {
                 codeChangeHandler(value);
              }}
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
              style={{
                padding: "10px",
                fontFamily: "monospace",
                background: "#111",
                color: "white",
              }}
              className="h-[42vh] rounded-xl border border-[#333] focus:outline-none"
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default Home;
