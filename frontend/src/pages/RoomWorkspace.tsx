import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import {
  Play,
  Users,
  MessageSquare,
  Send,
  Copy,
  Check,
  ChevronLeft,
  Terminal,
  Code,
  AlertCircle,
} from "lucide-react";

interface Participant {
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface RoomDetails {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  participants: Participant[];
}

interface ChatMessage {
  id: string;
  content: string;
  userId: string;
  username: string;
  createdAt: string;
}

const DEFAULT_TEMPLATES: Record<string, string> = {
  javascript: `// JavaScript collaborative workspace
function solve() {
  console.log("Hello, PrepRoom!");
}

solve();`,
  python: `# Python collaborative workspace
def solve():
    print("Hello, PrepRoom!")

if __name__ == "__main__":
    solve()`,
  cpp: `// C++ collaborative workspace
#include <iostream>

int main() {
    std::cout << "Hello, PrepRoom!" << std::endl;
    return 0;
}`,
  java: `// Java collaborative workspace
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, PrepRoom!");
    }
}`,
};

const RANDOM_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#06b6d4", // Cyan
];

const getRandomColor = () => RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];

export const RoomWorkspace: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState("javascript");
  const [copied, setCopied] = useState(false);

  // Editor states
  const [isCompiling, setIsCompiling] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<{
    stdout?: string;
    stderr?: string;
    compile_output?: string;
    statusName?: string;
    time?: string;
    memory?: string;
  } | null>(null);

  // Chat and Presence states
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"chat" | "participants">("chat");

  // Yjs Refs
  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const editorRef = useRef<any>(null);

  // Socket Ref
  const socketRef = useRef<Socket | null>(null);

  // Chat container scroll ref
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch Room Info on Mount
  useEffect(() => {
    const fetchRoomDetails = async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}`);
        if (!response.ok) {
          if (response.status === 403) {
            toast.error("You are not authorized to access this room.");
          } else {
            toast.error("Room not found.");
          }
          navigate("/dashboard");
          return;
        }
        const data = await response.json();
        setRoom(data.room);
      } catch (err) {
        console.error("Room fetch error:", err);
        toast.error("Failed to load room details.");
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchRoomDetails();
  }, [roomId, navigate]);

  // Setup Yjs WebSockets
  useEffect(() => {
    if (!roomId || !user) return;

    // Create Yjs Doc
    const doc = new Y.Doc();
    docRef.current = doc;

    // Determine WS Connection URL
    const wsHost =
      window.location.hostname === "localhost"
        ? "ws://localhost:5000/yjs"
        : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/yjs`;

    // Initialize Websocket Provider
    const provider = new WebsocketProvider(wsHost, `preproom-${roomId}`, doc, { connect: true });
    providerRef.current = provider;

    // Set User Presence Awareness Info
    const color = getRandomColor();
    provider.awareness.setLocalStateField("user", {
      name: user.name,
      color: color,
    });

    provider.on("status", (event: any) => {
      console.log("Yjs status:", event.status);
    });

    // Cleanup on unmount
    return () => {
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
      if (providerRef.current) {
        providerRef.current.disconnect();
        providerRef.current.destroy();
        providerRef.current = null;
      }
      if (docRef.current) {
        docRef.current.destroy();
        docRef.current = null;
      }
    };
  }, [roomId, user]);

  // Setup Socket.io for Chat & Active Users
  useEffect(() => {
    if (!roomId || !user) return;

    // Connect to backend port
    const socketHost =
      window.location.hostname === "localhost" ? "http://localhost:5000" : window.location.origin;

    const socket = io(socketHost, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    // Emit Join event
    socket.emit("join-room", {
      roomId,
      userId: user.id,
      username: user.name,
    });

    // Message events
    socket.on("chat-history", (history: ChatMessage[]) => {
      setMessages(history);
    });

    socket.on("message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("room-users", (userIds: string[]) => {
      setOnlineUserIds(userIds);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, user]);

  // Scroll Chat to Bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle Monaco Mounting
  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;

    if (docRef.current && providerRef.current) {
      const yText = docRef.current.getText("monaco");

      // Check if text is currently empty and seed it with template
      if (yText.toString() === "") {
        yText.insert(0, DEFAULT_TEMPLATES[language] || "");
      }

      const binding = new MonacoBinding(
        yText,
        editor.getModel()!,
        new Set([editor]),
        providerRef.current.awareness
      );
      bindingRef.current = binding;
    }
  };

  // Change Language and Seed Text if Empty
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setLanguage(newLang);

    if (docRef.current) {
      const yText = docRef.current.getText("monaco");
      // Replace text if it matches current templates
      const currentVal = yText.toString();
      const isCurrentTemplate = Object.values(DEFAULT_TEMPLATES).some((t) => t === currentVal) || currentVal === "";

      if (isCurrentTemplate) {
        docRef.current.transact(() => {
          yText.delete(0, yText.length);
          yText.insert(0, DEFAULT_TEMPLATES[newLang] || "");
        });
      }
    }
  };

  const handleCopyId = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    toast.success("Room ID copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socketRef.current || !user || !roomId) return;

    socketRef.current.emit("send-message", {
      roomId,
      userId: user.id,
      username: user.name,
      content: chatInput,
    });
    setChatInput("");
  };

  const runCode = async () => {
    if (!editorRef.current) return;
    const sourceCode = editorRef.current.getValue();

    setIsCompiling(true);
    setConsoleOutput(null);
    toast.info("Running code on compile sandbox...");

    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceCode,
          language,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setConsoleOutput({
          stdout: data.stdout,
          stderr: data.stderr,
          compile_output: data.compile_output,
          statusName: data.status?.description,
          time: data.time,
          memory: data.memory,
        });

        if (data.status?.id === 3) {
          toast.success("Execution completed successfully!");
        } else {
          toast.warning(`Execution result: ${data.status?.description || "Failed"}`);
        }
      } else {
        toast.error(data.message || "Code compilation failed.");
      }
    } catch (err) {
      console.error("Code execution API error:", err);
      toast.error("Sandbox connectivity error. Try again.");
    } finally {
      setIsCompiling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
        <p className="text-neutral-400 font-medium animate-pulse">Entering Workspace...</p>
      </div>
    );
  }

  if (!room) return null;

  return (
    <div className="h-screen flex flex-col bg-neutral-950 text-white font-sans overflow-hidden">
      {/* Workspace Header */}
      <header className="h-14 border-b border-neutral-900 bg-neutral-900/40 backdrop-blur px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold truncate max-w-[150px] sm:max-w-[200px]">
                {room.title}
              </h1>
              <button
                onClick={handleCopyId}
                title="Click to copy Room ID"
                className="text-[10px] bg-neutral-900 border border-neutral-800 text-neutral-400 px-2 py-0.5 rounded font-mono hover:text-white hover:border-neutral-700 transition flex items-center gap-1 select-all cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span className="hidden sm:inline">ID:</span> {roomId}
              </button>
            </div>
            <p className="text-xs text-neutral-500 truncate max-w-[150px] sm:max-w-[300px]">
              {room.description || "No description provided"}
            </p>
          </div>
        </div>

        {/* Configurations / Buttons */}
        <div className="flex items-center gap-3">
          {/* Copy Room ID code */}
          <button
            onClick={handleCopyId}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 border border-neutral-850 text-neutral-400 hover:text-white rounded-lg text-xs font-semibold hover:border-neutral-700 transition cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Invite Code</span>
          </button>

          {/* Language Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-500 hidden md:inline">Language:</span>
            <select
              value={language}
              onChange={handleLanguageChange}
              className="bg-neutral-900 border border-neutral-850 hover:border-neutral-700 text-neutral-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
            </select>
          </div>

          {/* Run button */}
          <button
            onClick={runCode}
            disabled={isCompiling}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow-lg shadow-indigo-600/10 transition cursor-pointer"
          >
            {isCompiling ? (
              <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            Run Code
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Editor + Output */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-neutral-900">
          {/* Editor Container */}
          <div className="flex-1 min-h-0 relative bg-neutral-950">
            <Editor
              height="100%"
              language={language === "cpp" ? "cpp" : language}
              theme="vs-dark"
              options={{
                fontSize: 14,
                fontFamily: "var(--font-mono)",
                minimap: { enabled: false },
                cursorBlinking: "smooth",
                lineHeight: 22,
                tabSize: 2,
                automaticLayout: true,
                padding: { top: 12 },
              }}
              onMount={handleEditorDidMount}
            />
          </div>

          {/* Bottom Console / Output */}
          <div className="h-56 border-t border-neutral-900 bg-neutral-950 flex flex-col shrink-0">
            <div className="h-9 border-b border-neutral-900 bg-neutral-900/20 px-4 flex items-center justify-between text-xs text-neutral-400 font-semibold shrink-0">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                Console Sandbox Output
              </span>
              {consoleOutput && (
                <div className="flex items-center gap-3 text-neutral-500">
                  {consoleOutput.time && <span>Time: {consoleOutput.time}s</span>}
                  {consoleOutput.memory && <span>Mem: {consoleOutput.memory} KB</span>}
                </div>
              )}
            </div>

            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs select-text">
              {consoleOutput ? (
                <div className="space-y-3">
                  {/* Compilation Error or Status Warning */}
                  {consoleOutput.statusName && consoleOutput.statusName !== "Accepted" && (
                    <div className="flex items-center gap-1.5 text-amber-500 font-semibold">
                      <AlertCircle className="w-4 h-4" />
                      <span>Status: {consoleOutput.statusName}</span>
                    </div>
                  )}

                  {/* Stdout */}
                  {consoleOutput.stdout && (
                    <div>
                      <div className="text-neutral-500 font-bold mb-0.5">STDOUT:</div>
                      <pre className="text-neutral-200 bg-neutral-900/60 p-2 rounded-lg border border-neutral-900 overflow-x-auto">
                        {consoleOutput.stdout}
                      </pre>
                    </div>
                  )}

                  {/* Stderr */}
                  {consoleOutput.stderr && (
                    <div>
                      <div className="text-red-500 font-bold mb-0.5">STDERR:</div>
                      <pre className="text-red-400 bg-red-950/20 p-2 rounded-lg border border-red-900/30 overflow-x-auto">
                        {consoleOutput.stderr}
                      </pre>
                    </div>
                  )}

                  {/* Compile Output */}
                  {consoleOutput.compile_output && (
                    <div>
                      <div className="text-neutral-500 font-bold mb-0.5">COMPILE LOGS:</div>
                      <pre className="text-yellow-200/80 bg-neutral-900/60 p-2 rounded-lg border border-neutral-900 overflow-x-auto">
                        {consoleOutput.compile_output}
                      </pre>
                    </div>
                  )}

                  {!consoleOutput.stdout && !consoleOutput.stderr && !consoleOutput.compile_output && (
                    <div className="text-neutral-500 italic">Code executed successfully with empty output.</div>
                  )}
                </div>
              ) : (
                <div className="text-neutral-600 italic flex items-center gap-1.5">
                  <Code className="w-4 h-4" />
                  Write code and click 'Run Code' to execute in sandbox.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Chat + Participants */}
        <div className="w-80 flex flex-col bg-neutral-900/30 backdrop-blur shrink-0 hidden md:flex">
          {/* Tabs header */}
          <div className="h-12 border-b border-neutral-900 flex items-stretch shrink-0">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer ${
                activeTab === "chat"
                  ? "text-indigo-400 border-b-2 border-indigo-500 bg-neutral-900/20"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Chat Panel
            </button>
            <button
              onClick={() => setActiveTab("participants")}
              className={`flex-1 flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer ${
                activeTab === "participants"
                  ? "text-indigo-400 border-b-2 border-indigo-500 bg-neutral-900/20"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" />
              Participants ({onlineUserIds.length})
            </button>
          </div>

          {/* Active Tab View */}
          <div className="flex-1 flex flex-col min-h-0 bg-neutral-950/20">
            {activeTab === "chat" ? (
              <>
                {/* Chat Message Thread */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                  {messages.map((msg) => {
                    const isSystem = msg.userId === "system";
                    const isMe = msg.userId === user?.id;

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="text-center">
                          <span className="text-[10px] bg-neutral-900 text-neutral-500 px-2.5 py-1 rounded-full border border-neutral-850">
                            {msg.content}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        <span className="text-[10px] text-neutral-500 mb-1 px-1">
                          {isMe ? "You" : msg.username}
                        </span>
                        <div
                          className={`max-w-[90%] rounded-2xl px-3.5 py-2 text-xs select-text ${
                            isMe
                              ? "bg-indigo-600 text-white rounded-tr-none"
                              : "bg-neutral-900 text-neutral-200 rounded-tl-none border border-neutral-850"
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input form */}
                <form onSubmit={handleSendMessage} className="p-3 border-t border-neutral-900 flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 bg-neutral-950/80 border border-neutral-850 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            ) : (
              /* Participants Tab */
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                <h4 className="text-xs font-semibold text-neutral-500 mb-2">Room Registry</h4>
                {room.participants.map((participant) => {
                  const isOnline = onlineUserIds.includes(participant.userId);
                  const isOwner = participant.userId === room.ownerId;

                  return (
                    <div
                      key={participant.userId}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900/30 border border-neutral-850/60"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 bg-neutral-850 rounded-full flex items-center justify-center font-bold text-xs text-indigo-400 border border-neutral-700 shrink-0">
                          {participant.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-neutral-200 truncate">
                            {participant.user.name}
                          </p>
                          <span className="text-[10px] text-neutral-500 truncate block">
                            {participant.user.email}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isOwner && (
                          <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md shrink-0">
                            Host
                          </span>
                        )}
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isOnline ? "bg-emerald-500 animate-pulse" : "bg-neutral-600"
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
