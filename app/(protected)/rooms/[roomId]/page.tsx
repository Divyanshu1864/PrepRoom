import { redirect } from "next/navigation";
import Link from "next/link";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RoomWorkspace } from "@/components/room/room-workspace";
import { JoinRoomButton } from "@/components/room/join-room-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { roomId } = await params;

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      problems: true,
    },
  });

  if (!room) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-4">
        <h1 className="text-xl font-semibold mb-2">Room Not Found</h1>
        <p className="text-muted-foreground mb-4">The room you are looking for does not exist or has been deleted.</p>
        <Link href="/dashboard" className="text-sm text-primary hover:underline">
          Go back to Dashboard
        </Link>
      </div>
    );
  }

  const isOwner = room.ownerId === session.user.id;
  const isParticipant = room.participants.some((p) => p.userId === session.user.id);

  if (!isOwner && !isParticipant) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Join Room</CardTitle>
            <CardDescription>
              You are not a participant in this room yet. Join to collaborate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded p-3 bg-muted/40">
              <div className="font-semibold">{room.title}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {room.description || "No description provided."}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Hosted by: {room.owner.name || "Anonymous"}
              </div>
            </div>
            <JoinRoomButton roomId={room.id} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <RoomWorkspace
      room={room}
      currentUser={{
        id: session.user.id,
        name: session.user.name || "Anonymous",
        email: session.user.email || "",
      }}
    />
  );
}
