"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Users, MessageSquare, Code, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoomChat } from "./room-chat";
import { ParticipantList } from "./participant-list";

interface RoomWorkspaceProps {
  room: {
    id: string;
    title: string;
    description: string | null;
    ownerId: string;
    owner: { name: string | null; email: string | null };
    participants: { user: { id: string; name: string | null; email: string | null; image: string | null } }[];
  };
  currentUser: {
    id: string;
    name: string;
    email: string;
  };
}

export function RoomWorkspace({ room, currentUser }: RoomWorkspaceProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "participants">("chat");

  // Mock code template for the editor placeholder
  const [code, setCode] = useState(
    `# Two Sum\n# Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\ndef twoSum(nums, target):\n    # Write your collaborative code here...\n    pass\n`
  );

  useEffect(() => {
    // Connect to standalone socket server
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || "http://localhost:3001";
    const newSocket = io(socketUrl, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
    });

    newSocket.on("connect", () => {
      console.log("Connected to websocket server");
      setConnected(true);
      
      // Join room channel
      newSocket.emit("join-room", {
        roomId: room.id,
        userId: currentUser.id,
        username: currentUser.name,
      });
    });

    newSocket.on("disconnect", () => {
      console.log("Disconnected from websocket server");
      setConnected(false);
    });

    setSocket(newSocket);

    // Clean up connection on unmount
    return () => {
      newSocket.disconnect();
    };
  }, [room.id, currentUser.id, currentUser.name]);

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left Pane: Problem Description and Code Editor Placeholder */}
      <div className="lg:col-span-2 flex flex-col space-y-4 h-full">
        {/* Room Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{room.title}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {room.description || "No description provided."} • Hosted by {room.owner.name || "Anonymous"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            <span className="text-xs text-muted-foreground">{connected ? "Connected" : "Offline Mode"}</span>
          </div>
        </div>

        {/* Editor & Problem Split Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0 overflow-y-auto pr-1">
          {/* Problem panel */}
          <Card className="flex flex-col h-full overflow-hidden">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Code className="h-4 w-4 text-primary" /> Problem Description
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
              <div>
                <h3 className="font-semibold text-base">1. Two Sum</h3>
                <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 font-medium">
                  Easy
                </span>
              </div>
              <p className="leading-relaxed">
                Given an array of integers <code>nums</code> and an integer <code>target</code>, return indices of the two numbers such that they add up to <code>target</code>.
              </p>
              <p className="leading-relaxed">
                You may assume that each input would have <strong>exactly one solution</strong>, and you may not use the same element twice.
              </p>
              <div className="space-y-2">
                <p className="font-semibold text-xs text-muted-foreground">Example 1:</p>
                <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{`Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].`}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Code Editor Placeholder (Monaco Editor to come in Phase 3) */}
          <Card className="flex flex-col h-full overflow-hidden">
            <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Code Editor</CardTitle>
              <div className="flex items-center gap-2">
                <select className="text-xs border rounded bg-background px-2 py-1 outline-none">
                  <option>Python</option>
                  <option>JavaScript</option>
                  <option>C++</option>
                  <option>Java</option>
                </select>
                <Button size="sm" variant="outline" className="h-7 text-xs flex items-center gap-1">
                  <Play className="h-3 w-3 fill-current" /> Run
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 relative bg-zinc-950 font-mono text-xs text-zinc-300">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full h-full p-4 bg-transparent border-0 outline-none resize-none font-mono focus:ring-0"
              />
              <div className="absolute bottom-2 right-3 px-2 py-1 rounded bg-black/60 text-[10px] text-zinc-400">
                Monaco Editor (Coming Phase 3)
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right Pane: Chat and Participants Sidebar */}
      <Card className="flex flex-col h-full overflow-hidden border-border/80">
        <CardHeader className="p-0 border-b flex flex-row">
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === "chat" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="h-4 w-4" /> Chat
          </button>
          <button
            onClick={() => setActiveTab("participants")}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === "participants" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" /> People
          </button>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0 relative">
          {activeTab === "chat" && (
            <RoomChat socket={socket} room={room} currentUser={currentUser} />
          )}
          {activeTab === "participants" && (
            <ParticipantList socket={socket} dbParticipants={room.participants} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
