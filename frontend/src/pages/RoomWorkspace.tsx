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
  BookOpen,
  Plus,
  Trash2,
  ChevronRight,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  mode: "COLLAB" | "INTERVIEW";
  participants: Participant[];
}

interface ChatMessage {
  id: string;
  content: string;
  userId: string;
  username: string;
  createdAt: string;
}

interface Problem {
  id: string;
  title: string;
  description: string;
  difficulty: "Easy" | "Medium" | "Hard";
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

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
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
];

const DIFFICULTY_STYLES: Record<Problem["difficulty"], string> = {
  Easy: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Medium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Hard: "text-red-400 bg-red-400/10 border-red-400/20",
};

const getRandomColor = () =>
  RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];

// ─── Component ────────────────────────────────────────────────────────────────

export const RoomWorkspace: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState("python");
  const [copied, setCopied] = useState(false);
  const initialActiveProblemIdRef = useRef<string | null>(null);

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

  // Problem Panel states
  const [problems, setProblems] = useState<Problem[]>([]);
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null);
  const [showProblemPanel, setShowProblemPanel] = useState(true);
  const [problemPanelWidth, setProblemPanelWidth] = useState(320);
  const isResizingRef = useRef(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResizing);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizingRef.current) return;
    const newWidth = Math.min(Math.max(240, e.clientX), 600);
    setProblemPanelWidth(newWidth);
  };

  const stopResizing = () => {
    isResizingRef.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopResizing);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", stopResizing);
    };
  }, []);
  const [isAddProblemOpen, setIsAddProblemOpen] = useState(false);
  const [problemForm, setProblemForm] = useState({
    title: "",
    description: "",
    difficulty: "Easy" as Problem["difficulty"],
  });
  const [isSubmittingProblem, setIsSubmittingProblem] = useState(false);

  // Leetcode bank states
  const [bankSearch, setBankSearch] = useState("");
  const [bankResults, setBankResults] = useState<any[]>([]);
  const [isSearchingBank, setIsSearchingBank] = useState(false);

  // Debounced search for question bank
  useEffect(() => {
    if (!isAddProblemOpen) {
      setBankSearch("");
      setBankResults([]);
      return;
    }

    if (!bankSearch.trim()) {
      setBankResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingBank(true);
      try {
        const res = await fetch(
          `/api/problems/bank?search=${encodeURIComponent(bankSearch)}&limit=15`
        );
        if (!res.ok) {
          throw new Error("Failed to fetch questions from bank");
        }
        const data = await res.json();
        if (data.success) {
          setBankResults(data.questions || []);
        }
      } catch (err) {
        console.error("Error fetching from bank:", err);
      } finally {
        setIsSearchingBank(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [bankSearch, isAddProblemOpen]);


  // Yjs Refs
  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const editorRef = useRef<any>(null);

  // Socket Ref
  const socketRef = useRef<Socket | null>(null);

  // User Ref to prevent socket useEffect reconnection loops on context re-renders
  const userRef = useRef(user);

  // Chat container scroll ref
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Keep track of current language for the Yjs sync handler
  const languageRef = useRef(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const isOwner = room ? user?.id === room.ownerId : false;

  // ─── Fetch Room Info ─────────────────────────────────────────────────────

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

  // ─── Fetch Problems ───────────────────────────────────────────────────────

  const fetchProblemsList = async () => {
    if (!roomId) return;
    try {
      const response = await fetch(`/api/rooms/${roomId}/problems`);
      if (response.ok) {
        const data = await response.json();
        const loadedProblems = data.problems || [];
        setProblems(loadedProblems);
        if (loadedProblems.length > 0) {
          const initialId = initialActiveProblemIdRef.current;
          const found = initialId ? loadedProblems.find((p: any) => p.id === initialId) : null;
          setActiveProblem(found || loadedProblems[0]);
        } else {
          setActiveProblem(null);
        }
      }
    } catch (err) {
      console.error("Problems fetch error:", err);
    }
  };

  useEffect(() => {
    fetchProblemsList();
  }, [roomId]);

  // ─── Yjs WebSockets ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!roomId || !user) return;

    const doc = new Y.Doc();
    docRef.current = doc;

    // Use environment variable or fallback to deployed Render URL
    const backendUrl = import.meta.env.VITE_API_URL || "https://preproom-backend.onrender.com";

    const wsHost =
      window.location.hostname === "localhost"
        ? "ws://localhost:5000/yjs"
        : backendUrl.replace(/^http/, "ws") + "/yjs";

    const provider = new WebsocketProvider(wsHost, `preproom-${roomId}`, doc, {
      connect: true,
    });
    providerRef.current = provider;

    const color = getRandomColor();
    provider.awareness.setLocalStateField("user", {
      name: user.name,
      color: color,
    });

    provider.on("status", (event: any) => {
      console.log("Yjs status:", event.status);
    });

    provider.on("sync", (isSynced: boolean) => {
      if (isSynced) {
        const yText = doc.getText("monaco");
        if (yText.toString().trim() === "") {
          yText.insert(0, DEFAULT_TEMPLATES[languageRef.current] || "");
        }
      }
    });

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

  // ─── Socket.io Chat & Presence ────────────────────────────────────────────

  useEffect(() => {
    if (!roomId || !user) return;

    const socketHost =
      window.location.hostname === "localhost"
        ? "http://localhost:5000"
        : (import.meta.env.VITE_API_URL || "https://preproom-backend.onrender.com");

    const socket = io(socketHost, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.emit("join-room", {
      roomId,
      userId: user.id,
      username: user.name,
    });

    socket.on("chat-history", (history: ChatMessage[]) => {
      setMessages(history);
    });

    socket.on("message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("room-users", (userIds: string[]) => {
      setOnlineUserIds(userIds);
    });

    socket.on("room-state", ({ activeProblemId, language: serverLanguage }) => {
      if (serverLanguage) {
        setLanguage(serverLanguage);
      }
      if (activeProblemId) {
        initialActiveProblemIdRef.current = activeProblemId;
        setProblems((prevProblems) => {
          const found = prevProblems.find(p => p.id === activeProblemId);
          if (found) {
            setActiveProblem(found);
          }
          return prevProblems;
        });
      }
    });

    socket.on("problem-selected", (problemId: string) => {
      initialActiveProblemIdRef.current = problemId;
      setProblems((prevProblems) => {
        const found = prevProblems.find(p => p.id === problemId);
        if (found) {
          setActiveProblem(found);
        }
        return prevProblems;
      });
    });

    socket.on("language-changed", (newLang: string) => {
      setLanguage(newLang);
    });

    socket.on("problems-updated", () => {
      fetchProblemsList();
    });

    socket.on("code-running", ({ senderId }) => {
      if (senderId === userRef.current?.id) return;
      console.log("[Socket client] Received code-running event");
      setIsCompiling(true);
      setConsoleOutput(null);
      toast.info("Partner is running code on compile sandbox...");
    });

    socket.on("code-result", ({ senderId, result, error }) => {
      if (senderId === userRef.current?.id) return;
      console.log("[Socket client] Received code-result event:", { result, error });
      setIsCompiling(false);
      if (error) {
        toast.error(error || "Code compilation failed.");
      } else if (result) {
        setConsoleOutput(result);
        if (result.statusName === "Accepted") {
          toast.success("Execution completed successfully!");
        } else {
          toast.warning(`Execution result: ${result.statusName || "Failed"}`);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, user?.id]);

  // ─── Chat Scroll ──────────────────────────────────────────────────────────

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── Editor Handlers ──────────────────────────────────────────────────────

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;

    if (docRef.current && providerRef.current) {
      const yText = docRef.current.getText("monaco");

      const binding = new MonacoBinding(
        yText,
        editor.getModel()!,
        new Set([editor]),
        providerRef.current.awareness
      );
      bindingRef.current = binding;
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;

    if (docRef.current) {
      const yText = docRef.current.getText("monaco");
      const currentVal = yText.toString();

      const normalize = (str: string) => str.replace(/\r\n/g, "\n").trim();
      const normalizedCurrent = normalize(currentVal);

      // Check if it's currently the template of the old language, or empty
      const currentLangTemplate = DEFAULT_TEMPLATES[language];
      const isUntouched =
        (currentLangTemplate && normalize(currentLangTemplate) === normalizedCurrent) ||
        normalizedCurrent === "";

      if (!isUntouched) {
        const confirmSwitch = window.confirm(
          "Changing the language will overwrite your current code. Do you want to proceed?"
        );
        if (!confirmSwitch) {
          // Cancelled: do nothing (the dropdown will revert because of controlled state `value={language}`)
          return;
        }
      }

      setLanguage(newLang);

      if (socketRef.current) {
        socketRef.current.emit("change-language", { roomId, language: newLang });
      }

      docRef.current.transact(() => {
        yText.delete(0, yText.length);
        yText.insert(0, DEFAULT_TEMPLATES[newLang] || "");
      });
    } else {
      setLanguage(newLang);
    }
  };

  const handleCopyId = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    toast.success("Room ID copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Chat Handlers ────────────────────────────────────────────────────────

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

  // ─── Code Execution ───────────────────────────────────────────────────────

  const runCode = async () => {
    if (!editorRef.current) return;
    const sourceCode = editorRef.current.getValue();

    setIsCompiling(true);
    setConsoleOutput(null);
    toast.info("Running code on compile sandbox...");

    if (socketRef.current && user) {
      socketRef.current.emit("run-code", { roomId, senderId: user.id });
    }

    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceCode, language }),
      });

      const data = await response.json();

      if (response.ok) {
        const resultData = {
          stdout: data.stdout,
          stderr: data.stderr,
          compile_output: data.compile_output,
          statusName: data.status?.description,
          time: data.time,
          memory: data.memory,
        };
        setConsoleOutput(resultData);
        if (socketRef.current && user) {
          socketRef.current.emit("code-result", { roomId, senderId: user.id, result: resultData });
        }

        if (data.status?.id === 3) {
          toast.success("Execution completed successfully!");
        } else {
          toast.warning(
            `Execution result: ${data.status?.description || "Failed"}`
          );
        }
      } else {
        toast.error(data.message || "Code compilation failed.");
        if (socketRef.current && user) {
          socketRef.current.emit("code-result", { roomId, senderId: user.id, error: data.message || "Code compilation failed." });
        }
      }
    } catch (err) {
      console.error("Code execution API error:", err);
      toast.error("Sandbox connectivity error. Try again.");
      if (socketRef.current && user) {
        socketRef.current.emit("code-result", { roomId, senderId: user.id, error: "Sandbox connectivity error. Try again." });
      }
    } finally {
      setIsCompiling(false);
    }
  };

  // ─── Problem Handlers ─────────────────────────────────────────────────────

  const handleAddProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemForm.title.trim() || !problemForm.description.trim()) {
      toast.error("Title and description are required.");
      return;
    }

    setIsSubmittingProblem(true);
    try {
      const response = await fetch(`/api/rooms/${roomId}/problems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(problemForm),
      });

      const data = await response.json();
      if (response.ok) {
        const newProblem = data.problem as Problem;
        setProblems((prev) => [...prev, newProblem]);
        setActiveProblem(newProblem);
        initialActiveProblemIdRef.current = newProblem.id;
        if (socketRef.current) {
          socketRef.current.emit("update-problems", { roomId });
          socketRef.current.emit("select-problem", { roomId, problemId: newProblem.id });
        }
        setIsAddProblemOpen(false);
        setProblemForm({ title: "", description: "", difficulty: "Easy" });
        toast.success("Problem added to room.");
      } else {
        toast.error(data.message || "Failed to add problem.");
      }
    } catch (err) {
      console.error("Add problem error:", err);
      toast.error("Network error. Please try again.");
    } finally {
      setIsSubmittingProblem(false);
    }
  };

  const handleDeleteProblem = async (problemId: string) => {
    try {
      const response = await fetch(
        `/api/rooms/${roomId}/problems/${problemId}`,
        { method: "DELETE" }
      );
      if (response.ok) {
        setProblems((prev) => prev.filter((p) => p.id !== problemId));
        if (activeProblem?.id === problemId) {
          const remaining = problems.filter((p) => p.id !== problemId);
          setActiveProblem(remaining[0] ?? null);
          initialActiveProblemIdRef.current = remaining[0]?.id ?? null;
          if (socketRef.current && remaining[0]) {
            socketRef.current.emit("select-problem", { roomId, problemId: remaining[0].id });
          }
        }
        if (socketRef.current) {
          socketRef.current.emit("update-problems", { roomId });
        }
        toast.success("Problem removed.");
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to delete problem.");
      }
    } catch (err) {
      console.error("Delete problem error:", err);
      toast.error("Network error. Please try again.");
    }
  };

  // ─── Loading / Guards ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground font-medium animate-pulse">
          Entering Workspace...
        </p>
      </div>
    );
  }

  if (!room) return null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-background text-white font-sans overflow-hidden">
      {/* ── Header ── */}
      <header className="h-14 border-b border-border bg-card/40 backdrop-blur px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-white transition cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold truncate max-w-[150px] sm:max-w-[200px]">
                {room.title}
              </h1>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                  room.mode === "INTERVIEW"
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                }`}
              >
                {room.mode === "INTERVIEW" ? "Interview" : "Collab"}
              </span>
              <button
                onClick={handleCopyId}
                title="Click to copy Room ID"
                className="text-[10px] bg-card border border-border text-muted-foreground px-2 py-0.5 rounded font-mono hover:text-white hover:border-neutral-700 transition flex items-center gap-1 select-all cursor-pointer"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span className="hidden sm:inline">ID:</span> {roomId}
              </button>
            </div>
            <p className="text-xs text-muted-foreground/80 truncate max-w-[150px] sm:max-w-[300px]">
              {room.description || "No description provided"}
            </p>
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-3">
          {/* Problem Panel Toggle */}
          <button
            onClick={() => setShowProblemPanel((v) => !v)}
            title={showProblemPanel ? "Hide problems" : "Show problems"}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition cursor-pointer ${
              showProblemPanel
                ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-400"
                : "bg-card border-border text-muted-foreground hover:text-white hover:border-neutral-700"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Problems</span>
            {problems.length > 0 && (
              <span className="bg-indigo-500/30 text-indigo-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {problems.length}
              </span>
            )}
          </button>

          {/* Copy Invite Code */}
          <button
            onClick={handleCopyId}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border text-muted-foreground hover:text-white rounded-lg text-xs font-semibold hover:border-neutral-700 transition cursor-pointer"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Invite Code</span>
          </button>

          {/* Language Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground/80 hidden md:inline">
              Language:
            </span>
            <select
              value={language}
              onChange={handleLanguageChange}
              className="bg-card border border-border hover:border-neutral-700 text-neutral-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
            </select>
          </div>

          {/* Run Button */}
          <button
            onClick={runCode}
            disabled={isCompiling}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow-lg shadow-indigo-600/10 transition cursor-pointer"
          >
            {isCompiling ? (
              <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            Run Code
          </button>
        </div>
      </header>

      {/* ── Main Layout: [Problem Panel] | [Editor] | [Chat] ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left: Problem Panel ── */}
        {showProblemPanel && (
          <div 
            style={{ width: `${problemPanelWidth}px` }}
            className="flex flex-col bg-background shrink-0 hidden md:flex min-w-[240px] max-w-[600px] relative"
          >
            {/* Panel Header */}
            <div className="h-11 px-3 border-b border-border flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                Problems
              </span>
              <div className="flex items-center gap-1">
                {isOwner && (
                  <button
                    onClick={() => setIsAddProblemOpen(true)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-2 py-0.5 rounded-md transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                )}
              </div>
            </div>

            {/* Problem List */}
            {problems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center mb-3">
                  <BookOpen className="w-5 h-5 text-muted-foreground/60" />
                </div>
                <p className="text-xs font-medium text-muted-foreground/80">
                  No problems added yet
                </p>
                {isOwner && (
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    Click "+ Add" to post a problem
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col min-h-0 flex-1">
                {/* Problem Tabs */}
                <div className="flex flex-col gap-0.5 p-2 border-b border-border">
                  {problems.map((p) => (
                    <div
                      key={p.id}
                      className={`group flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition ${
                        activeProblem?.id === p.id
                          ? "bg-indigo-600/15 border border-indigo-500/25"
                          : "hover:bg-card/60 border border-transparent"
                      }`}
                      onClick={() => {
                        setActiveProblem(p);
                        initialActiveProblemIdRef.current = p.id;
                        if (socketRef.current) {
                          socketRef.current.emit("select-problem", { roomId, problemId: p.id });
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ChevronRight
                          className={`w-3 h-3 shrink-0 transition ${
                            activeProblem?.id === p.id
                              ? "text-indigo-400 rotate-90"
                              : "text-muted-foreground/60"
                          }`}
                        />
                        <span className="text-xs font-medium text-neutral-200 truncate">
                          {p.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            DIFFICULTY_STYLES[p.difficulty]
                          }`}
                        >
                          {p.difficulty}
                        </span>
                        {isOwner && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProblem(p.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground/60 hover:text-red-400 transition cursor-pointer"
                            title="Delete problem"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Active Problem Description */}
                {activeProblem && (
                  <div className="flex-1 overflow-y-auto p-3">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <h2 className="text-sm font-bold text-neutral-100 leading-snug">
                        {activeProblem.title}
                      </h2>
                      <span
                        className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          DIFFICULTY_STYLES[activeProblem.difficulty]
                        }`}
                      >
                        {activeProblem.difficulty}
                      </span>
                    </div>
                    <div 
                      className="leetcode-description"
                      dangerouslySetInnerHTML={{ __html: activeProblem.description }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {showProblemPanel && (
          <div
            onMouseDown={startResizing}
            className="w-[4px] hover:w-[6px] active:w-[6px] bg-card hover:bg-indigo-500/80 active:bg-indigo-500 transition-all cursor-col-resize h-full shrink-0 select-none z-10 hidden md:block"
          />
        )}

        {/* ── Centre: Editor + Console ── */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-border">
          {/* Monaco Editor */}
          <div className="flex-1 min-h-0 relative bg-background">
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

          {/* Console Output */}
          <div className="h-56 border-t border-border bg-background flex flex-col shrink-0">
            <div className="h-9 border-b border-border bg-card/20 px-4 flex items-center justify-between text-xs text-muted-foreground font-semibold shrink-0">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                Console Sandbox Output
              </span>
              {consoleOutput && (
                <div className="flex items-center gap-3 text-muted-foreground/80">
                  {consoleOutput.time && (
                    <span>Time: {consoleOutput.time}s</span>
                  )}
                  {consoleOutput.memory && (
                    <span>Mem: {consoleOutput.memory} KB</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs select-text">
              {consoleOutput ? (
                <div className="space-y-3">
                  {consoleOutput.statusName &&
                    consoleOutput.statusName !== "Accepted" && (
                      <div className="flex items-center gap-1.5 text-amber-500 font-semibold">
                        <AlertCircle className="w-4 h-4" />
                        <span>Status: {consoleOutput.statusName}</span>
                      </div>
                    )}
                  {consoleOutput.stdout && (
                    <div>
                      <div className="text-muted-foreground/80 font-bold mb-0.5">
                        STDOUT:
                      </div>
                      <pre className="text-neutral-200 bg-card/60 p-2 rounded-lg border border-border overflow-x-auto">
                        {consoleOutput.stdout}
                      </pre>
                    </div>
                  )}
                  {consoleOutput.stderr && (
                    <div>
                      <div className="text-red-500 font-bold mb-0.5">
                        STDERR:
                      </div>
                      <pre className="text-red-400 bg-red-950/20 p-2 rounded-lg border border-red-900/30 overflow-x-auto">
                        {consoleOutput.stderr}
                      </pre>
                    </div>
                  )}
                  {consoleOutput.compile_output && (
                    <div>
                      <div className="text-muted-foreground/80 font-bold mb-0.5">
                        COMPILE LOGS:
                      </div>
                      <pre className="text-yellow-200/80 bg-card/60 p-2 rounded-lg border border-border overflow-x-auto">
                        {consoleOutput.compile_output}
                      </pre>
                    </div>
                  )}
                  {!consoleOutput.stdout &&
                    !consoleOutput.stderr &&
                    !consoleOutput.compile_output && (
                      <div className="text-muted-foreground/80 italic">
                        Code executed successfully with empty output.
                      </div>
                    )}
                </div>
              ) : (
                <div className="text-muted-foreground/60 italic flex items-center gap-1.5">
                  <Code className="w-4 h-4" />
                  Write code and click 'Run Code' to execute in sandbox.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Chat + Participants ── */}
        <div className="w-80 flex flex-col bg-card/30 backdrop-blur shrink-0 hidden md:flex">
          {/* Tabs */}
          <div className="h-12 border-b border-border flex items-stretch shrink-0">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer ${
                activeTab === "chat"
                  ? "text-indigo-400 border-b-2 border-indigo-500 bg-card/20"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Chat Panel
            </button>
            <button
              onClick={() => setActiveTab("participants")}
              className={`flex-1 flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer ${
                activeTab === "participants"
                  ? "text-indigo-400 border-b-2 border-indigo-500 bg-card/20"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" />
              People ({onlineUserIds.length})
            </button>
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-background/20">
            {activeTab === "chat" ? (
              <>
                {/* Chat Messages */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                  {messages.map((msg) => {
                    const isSystem = msg.userId === "system";
                    const isMe = msg.userId === user?.id;

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="text-center">
                          <span className="text-[10px] bg-card text-muted-foreground/80 px-2.5 py-1 rounded-full border border-border">
                            {msg.content}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          isMe ? "items-end" : "items-start"
                        }`}
                      >
                        <span className="text-[10px] text-muted-foreground/80 mb-1 px-1">
                          {isMe ? "You" : msg.username}
                        </span>
                        <div
                          className={`max-w-[90%] rounded-2xl px-3.5 py-2 text-xs select-text ${
                            isMe
                              ? "bg-indigo-600 text-white rounded-tr-none"
                              : "bg-card text-neutral-200 rounded-tl-none border border-border"
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 border-t border-border flex gap-2"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 bg-background/80 border border-border rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                <h4 className="text-xs font-semibold text-muted-foreground/80 mb-2">
                  Room Registry
                </h4>
                {room.participants.map((participant) => {
                  const isOnline = onlineUserIds.includes(participant.userId);
                  const isParticipantOwner =
                    participant.userId === room.ownerId;

                  return (
                    <div
                      key={participant.userId}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-card/30 border border-border/60"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 bg-neutral-800 rounded-full flex items-center justify-center font-bold text-xs text-indigo-400 border border-neutral-700 shrink-0">
                          {participant.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-neutral-200 truncate">
                            {participant.user.name}
                          </p>
                          <span className="text-[10px] text-muted-foreground/80 truncate block">
                            {participant.user.email}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isParticipantOwner && (
                          <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md shrink-0">
                            Host
                          </span>
                        )}
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isOnline
                              ? "bg-emerald-500 animate-pulse"
                              : "bg-neutral-600"
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

      {/* ── Add Problem Modal ── */}
      {isAddProblemOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                Add Problem
              </h2>
              <button
                onClick={() => setIsAddProblemOpen(false)}
                className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddProblem} className="p-5 space-y-4">
              {/* LeetCode Search */}
              <div className="relative">
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 flex items-center justify-between">
                  <span>Import LeetCode Question (Optional)</span>
                  {isSearchingBank && (
                    <span className="text-[10px] text-indigo-400 animate-pulse">Searching bank...</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={bankSearch}
                    onChange={(e) => setBankSearch(e.target.value)}
                    placeholder="Search e.g. Two Sum, Reverse Linked List..."
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 pr-10"
                  />
                  {bankSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setBankSearch("");
                        setBankResults([]);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/80 hover:text-neutral-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Dropdown Menu */}
                {bankResults.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1.5 max-h-56 overflow-y-auto bg-background border border-border rounded-xl shadow-2xl z-[60] divide-y divide-neutral-900/50 scrollbar-thin">
                    {bankResults.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          setProblemForm({
                            title: q.title,
                            difficulty: q.difficulty as Problem["difficulty"],
                            description: q.description,
                          });
                          setBankSearch("");
                          setBankResults([]);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-muted/40 transition flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{q.title}</p>
                          <p className="text-[10px] text-muted-foreground/80">ID: {q.questionId}</p>
                        </div>
                        <span
                          className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            DIFFICULTY_STYLES[q.difficulty as Problem["difficulty"]] || "border-border text-muted-foreground/80"
                          }`}
                        >
                          {q.difficulty}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Problem Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={problemForm.title}
                  onChange={(e) =>
                    setProblemForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="e.g. Two Sum"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>


              {/* Difficulty */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Difficulty
                </label>
                <div className="flex gap-2">
                  {(["Easy", "Medium", "Hard"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        setProblemForm((f) => ({ ...f, difficulty: d }))
                      }
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        problemForm.difficulty === d
                          ? DIFFICULTY_STYLES[d]
                          : "border-border text-muted-foreground/80 hover:border-neutral-700"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Problem Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={problemForm.description}
                  onChange={(e) =>
                    setProblemForm((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                  placeholder={`Describe the problem statement, constraints, and examples.\n\nExample:\nGiven an array of integers nums and an integer target, return indices of the two numbers that add up to target.\n\nConstraints:\n- 2 <= nums.length <= 10^4\n- Only one valid answer exists.`}
                  rows={9}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono"
                />
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddProblemOpen(false)}
                  className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProblem}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmittingProblem ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add Problem
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
