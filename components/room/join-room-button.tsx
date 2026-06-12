"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface JoinRoomButtonProps {
  roomId: string;
}

export function JoinRoomButton({ roomId }: JoinRoomButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleJoin = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to join room.");
      }

      toast.success("Joined room successfully!");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-3">
      <Button asChild variant="outline" className="flex-1">
        <a href="/dashboard">Back to Dashboard</a>
      </Button>
      <Button onClick={handleJoin} disabled={loading} className="flex-1">
        {loading ? "Joining..." : "Join Room"}
      </Button>
    </div>
  );
}
