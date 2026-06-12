"use client";

import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { User, Shield } from "lucide-react";

interface DbParticipant {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface ParticipantListProps {
  socket: Socket | null;
  dbParticipants: DbParticipant[];
}

export function ParticipantList({ socket, dbParticipants }: ParticipantListProps) {
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!socket) return;

    // Receive lists of active user IDs from websocket server
    socket.on("room-users", (userIds: string[]) => {
      setOnlineUserIds(userIds);
    });

    return () => {
      socket.off("room-users");
    };
  }, [socket]);

  return (
    <div className="flex flex-col h-full bg-background p-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Room Participants ({dbParticipants.length})
      </h3>
      <ul className="space-y-3">
        {dbParticipants.map(({ user }) => {
          const isOnline = onlineUserIds.includes(user.id);
          
          return (
            <li key={user.id} className="flex items-center justify-between text-sm py-1">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 border relative">
                  {user.image ? (
                    <img
                      src={user.image}
                      alt={user.name || "User"}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground" />
                  )}
                  {/* Small online indicator badge */}
                  <span
                    className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background ${
                      isOnline ? "bg-green-500" : "bg-zinc-400"
                    }`}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {user.name || "Anonymous"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium">
                    online
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-50 text-zinc-400">
                    offline
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
