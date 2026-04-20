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
import chatbox from "../assets/chatbox.png";
 

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

  const { language, input, output ,code} = useSelector((state) => state.code);
  const { token } = useSelector((state) => state.auth);
  const userName = useSelector((state) => state.profile?.user);
  const { WS_URL, JOIN_ROOM_API, CREATE_ROOM_API } = collabEndpoints;

  // --- Collaboration State & Refs ---
  const [roomId, setRoomId] = useState("");
  const [isCollaborating, setIsCollaborating] = useState(false);
  const stompClientRef = useRef(null);
  const [connectedUsers, setConnectedUsers] = useState(new Set()); // Track unique user IDs in the room
  const [chatMessages, setChatMessages] = useState([]); // Chat messages
  const [chatInput, setChatInput] = useState(""); // Current chat input
  const [chatBoxVisible, setChatBoxVisible] = useState(false); // Chat box visibility

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

  useEffect( () => {
    console.log("Language changed to", language);
    dispatch(setCode(localStorage.getItem(`code_${language}`) || ""));
  }, [language, dispatch]);

  useEffect(() => {
    if(!isCollaborating){
      localStorage.setItem('code', localStorage.getItem(`code_${language}`) || "");
      dispatch(setCode(localStorage.getItem(`code_${language}`) || ""));
    }

    if(isCollaborating){
      dispatch(setCode(""));
    }
  }, [isCollaborating, dispatch, language]);

  // Ensure initial Redux code is loaded into Yjs exactly once
  useEffect(() => {
    if (ytextRef.current.length === 0 && code) {
      ytextRef.current.insert(0, code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

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

            if (payload.type === "DISCONNECT") {
              setConnectedUsers((prev) => {
                const updated = new Set(prev);
                updated.delete(payload.senderId);
                return updated;
              });
              console.log("User disconnected:", payload.senderId);
              return;
            }

            if (payload.type === "SYNC_REQUEST") {
              // Only respond to SYNC_REQUEST from OTHER users
              if (payload.senderId !== userId) {
                // Another user joined! Send them our full document state
                setConnectedUsers((prev) => new Set(prev).add(payload.senderId)); // Add new user to the set
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
              //  setConnectedUsers((prev) => new Set(prev).add(payload.senderId)); 
              if (!payload.updateBase64) {
                console.log("No updateBase64 in payload", payload);
                return;
              }
              setConnectedUsers((prev) => new Set(prev).add(payload.senderId));
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
            } else if (payload.type === "CHAT") {
              // Handle chat messages from other users
              console.log("Received CHAT message:", JSON.stringify(payload, null, 2));
              console.log("Payload keys:", Object.keys(payload));
              if (payload.senderId !== userId) {
                const messageText = payload.text || payload.content || payload.message;
                console.log("Extracted message text:", messageText);
                setChatMessages((prev) => [...prev, {
                  user: payload.senderId,
                  message: messageText || "[Message content not received from server]",
                  timestamp: new Date().toLocaleTimeString()
                }]);
              }
            }
          });


          // 3. We just connected! Ask existing users for the current full state
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
  }, [isCollaborating, roomId, userId, dispatch, WS_URL]);

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
  }, [language, isCollaborating, getLanguageExtension]); // Only rebuild if language or collab mode changes

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

    if (!token) {
      toast.error("Login is required");
      navigate('/login');
      return;
    }


    if (isCollaborating) {
      toast.success("Left the collaboration room");
      if (stompClientRef.current?.connected) {
        const payload = {
          senderId: userId,
          type: "DISCONNECT",
        };
        stompClientRef.current.publish({
          destination: `/app/editor.sync/${roomId}`,
          body: JSON.stringify(payload),
        });
        console.log("Published DISCONNECT to server from", userId);
      }
      setConnectedUsers(new Set());
      setChatMessages([]); // Clear chat messages
      return setIsCollaborating(false);
    }

    // When joining an existing room, DON'T sync old localStorage data
    // Instead, wait for SYNC_STATE from the room creator to avoid corrupted data
    // Only clear Yjs if it has old data to prepare for incoming SYNC_STATE
    if (!isCollaborating && ytextRef.current.length > 0) {
      // Clear Yjs document to receive clean state from room creator
      ytextRef.current.delete(0, ytextRef.current.length);
      console.log("Cleared Yjs document before joining room to receive clean state");
      dispatch(setCode(""));
      localStorage.setItem("code", "");
    }
    try {
      const response = await apiConnector('POST', JOIN_ROOM_API, { roomId, userName }, { Authorization: `Bearer ${token}` });
      if (!isCollaborating) {
        toast.success(response.data.message);
      }
      setIsCollaborating(!isCollaborating);
    } catch (error) {
      console.log("Error joining room:", error);
      toast.error(error.response?.data?.message || "Failed to join room");
    }
    setConnectedUsers((prev) => {
      const updated = new Set(prev);
      updated.add(userId);
      return updated;
    });
  };

  const createNewRoom = async () => {

    if (!token) {
      toast.error("Login is required");
      navigate('/login');
      return;
    }
    dispatch(setCode(""));
    localStorage.setItem("code", "");


    // Sync Redux code to Yjs BEFORE enabling collaboration
    if (code && ytextRef.current.length === 0) {
      ytextRef.current.insert(0, code);
      console.log("Synced current code to Yjs before creating room:", code);
    }

    const bodyData = {
      userName,
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

    setConnectedUsers((prev) => {
      const updated = new Set(prev);
      updated.add(userId);
      return updated;
    });
  };

  const sendChatMessage = () => {
    if (!chatInput.trim() || !stompClientRef.current?.connected) return;

    const message = chatInput.trim();
    console.log("Message.......", message);
    setChatMessages((prev) => [...prev, {
      user: userId,
      message,
      timestamp: new Date().toLocaleTimeString()
    }]);

    console.log(chatMessages);
    const payloadToSend = {
      senderId: userId,
      type: "CHAT",
      content: message,
    };
    console.log("Sending CHAT payload:", payloadToSend);
    stompClientRef.current.publish({
      destination: `/app/editor.sync/${roomId}`,
      body: JSON.stringify(payloadToSend),
    });

    setChatInput("");
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
        <div className="flex flex-row items-center relative gap-3 px-4 py-2 mt-1">
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

              <span className="group text-blue-400 text-xs ml-2 animate-pulse hover:animate-none">
                ● Connected Users:{" "}
                <span className="font-bold text-white tracking-wider">
                  {connectedUsers.size}
                </span>
                <div className="hidden absolute bg-gray-950 rounded-lg p-2 group-hover:block z-10">
                  {
                    Array.from(connectedUsers).map((user, index) => (
                      <div key={index} className="bg-gray-800 text-pink-400 text-xs rounded px-2 py-1 mt-1">
                        {console.log("Connected user:", user)}
                        {user}
                      </div>
                    ))
                  }
                </div>
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

          <div className="flex flex-col w-[40vw] gap-2 h-full relative ">
            {/* Input */}
            <textarea
              placeholder="Custom Input"
              value={input}
              onChange={(e) => inputChangeHandler(e.target.value)}
              className="flex bg-[#111] text-white rounded-xl h-[42vh] border border-[#333] focus:outline-none focus:border-blue-500 p-2 font-mono "
            />

            {/* Output */}
            <textarea
              placeholder="Output"
              value={output}
              readOnly
              className="flex bg-[#111] text-white rounded-xl h-[42vh] border border-[#333] focus:outline-none focus:border-blue-500 p-2 font-mono"
            />

            {/* Chat */}

            {isCollaborating && 
              (
                <img src={chatbox} alt="chatbox icon" onClick={() => setChatBoxVisible(!chatBoxVisible)} className="absolute right-2 bottom-2 w-18 h-18 cursor-pointer z-20 hover:opacity-80 bg-violet-500 rounded-full p-2 animate-bounce" />
              )
            }

            {
              isCollaborating && chatBoxVisible &&
              (<div className="bg-[#111] absolute text-white rounded-xl border border-[#333] h-[45vh] flex flex-col bottom-4 right-22 w-80 z-30 shadow-lg">
                <div className="p-3 border-b border-[#444] text-sm font-semibold bg-[#1a1a1a] rounded-t-xl">💬 Room Chat</div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {chatMessages.map((msg, index) => (
                    <div key={index} className="text-xs wrap-word-break">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400 font-semibold px-2 py-1 bg-[#222] rounded">{msg.user}</span>
                        <span className="text-gray-500 text-xs">{msg.timestamp}</span>
                      </div>
                      <div className="text-gray-200 ml-2 mt-1 bg-[#1a1a1a] p-2 rounded">{msg.message}</div>
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t border-[#444] flex gap-1.5 bg-[#1a1a1a] rounded-b-xl">
                  <input
                    type="text"
                    placeholder="Message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        sendChatMessage();
                      }
                    }}
                    className="flex-1 bg-[#222] text-white px-2 py-1 rounded border border-[#444] focus:outline-none focus:border-blue-400 text-xs"
                    disabled={!isCollaborating}
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!isCollaborating || !chatInput.trim()}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white rounded text-xs font-medium transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>)
            }

          </div>
        </div>
      </div>
    </>
  );
}

export default Home;
