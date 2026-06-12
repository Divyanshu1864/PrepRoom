"use client";

import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatMessage {
  id: string;
  content: string;
  userId: string;
  username: string;
  createdAt: string | Date;
}

interface RoomChatProps {
  socket: Socket | null;
  room: { id: string };
  currentUser: { id: string; name: string };
}

export function RoomChat({ socket, room, currentUser }: RoomChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    // Load history when available
    socket.on("chat-history", (history: ChatMessage[]) => {
      setMessages(history);
    });

    // Listen to new real-time messages
    socket.on("message", (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.off("chat-history");
      socket.off("message");
    };
  }, [socket]);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !inputValue.trim()) return;

    socket.emit("send-message", {
      roomId: room.id,
      userId: currentUser.id,
      username: currentUser.name,
      content: inputValue,
    });

    setInputValue("");
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            No messages yet. Say hi!
          </div>
        ) : (
          messages.map((msg) => {
            const isSystem = msg.userId === "system";
            const isSelf = msg.userId === currentUser.id;

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center text-xs text-muted-foreground my-2">
                  <span className="bg-muted px-2 py-0.5 rounded-full">{msg.content}</span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[80%] ${isSelf ? "ml-auto items-end" : "mr-auto items-start"}`}
              >
                <span className="text-[10px] text-muted-foreground mb-1">
                  {msg.username} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div
                  className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    isSelf
                      ? "bg-primary text-primary-foreground rounded-tr-none"
                      : "bg-muted text-foreground rounded-tl-none"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 border-t flex gap-2 items-center bg-muted/20">
        <Input
          placeholder={socket ? "Type a message..." : "Connecting to chat..."}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={!socket}
          className="flex-1 text-sm h-9"
          required
        />
        <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!socket || !inputValue.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
