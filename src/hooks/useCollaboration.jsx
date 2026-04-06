import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { CodemirrorBinding, CodeMirrorBinding } from "y-codemirror";
import { useEffect, useRef, useState } from "react";

export function useCollaboration(roomId, username) {
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const bindingRef = useRef(null);
  const [peers, setPeers] = useState([]);
  const [connected, setConnected] = useState(false);

  // Call this after Monaco editor mounts
  function bindEditor(editor, codemirror) {
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("code"); // shared text for the editor
    const yAwareness = null; // set below via provider

    const provider = new WebsocketProvider(
      `ws://localhost:8082/collaboration`, // your Spring Boot WS endpoint
      roomId, // room = one shared document
      ydoc,
      { params: { username } },
    );

    // Awareness: cursor positions + user info
    provider.awareness.setLocalStateField("user", {
      name: username,
      color: randomColor(),
    });

    provider.awareness.on("change", () => {
      const states = [...provider.awareness.getStates().values()];
      setPeers(states.filter((s) => s.user).map((s) => s.user));
    });

    provider.on("status", ({ status }) => setConnected(status === "connected"));

    // Bind Yjs text to codemirror model
    const codemirrorModel = editor.getModel();
    const binding = new CodemirrorBinding(
      ytext,
      codemirrorModel,
      new Set([editor]),
      provider.awareness,
    );

    ydocRef.current = ydoc;
    providerRef.current = provider;
    bindingRef.current = binding;
  }

  useEffect(() => {
    return () => {
      bindingRef.current?.destroy();
      providerRef.current?.destroy();
      ydocRef.current?.destroy();
    };
  }, [roomId]);

  return { bindEditor, peers, connected };
}

function randomColor() {
  const colors = ["#E57373", "#64B5F6", "#81C784", "#FFD54F", "#BA68C8"];
  return colors[Math.floor(Math.random() * colors.length)];
}
