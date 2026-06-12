import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateRoomButton } from "@/components/dashboard/create-room-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch rooms where the user is a participant or the owner
  const rooms = await prisma.room.findMany({
    where: {
      participants: {
        some: {
          userId: session.user.id,
        },
      },
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          participants: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Separate rooms owned by user vs rooms user joined
  const ownedRooms = rooms.filter((r) => r.ownerId === session.user.id);
  const joinedRooms = rooms.filter((r) => r.ownerId !== session.user.id);

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {session.user.name || "Developer"}. Manage your collaborative rooms.
          </p>
        </div>
        <div>
          <CreateRoomButton />
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-medium tracking-tight mb-3">Your Rooms ({ownedRooms.length})</h2>
          {ownedRooms.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
                <p className="mb-2">You haven't created any coding rooms yet.</p>
                <p className="text-xs">Click the "Create Room" button to spin up a new session.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ownedRooms.map((room) => (
                <Card key={room.id} className="flex flex-col justify-between">
                  <CardHeader>
                    <CardTitle className="line-clamp-1">{room.title}</CardTitle>
                    <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                      {room.description || "No description provided."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-1">
                    <div>Participants: {room._count.participants} online / total</div>
                    <div>Created: {new Date(room.createdAt).toLocaleDateString()}</div>
                  </CardContent>
                  <CardFooter className="pt-2">
                    <Button asChild className="w-full" size="sm">
                      <Link href={`/rooms/${room.id}`}>Enter Room</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-medium tracking-tight mb-3">Joined Rooms ({joinedRooms.length})</h2>
          {joinedRooms.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
                <p>You haven't joined any rooms created by others yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {joinedRooms.map((room) => (
                <Card key={room.id} className="flex flex-col justify-between">
                  <CardHeader>
                    <CardTitle className="line-clamp-1">{room.title}</CardTitle>
                    <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                      {room.description || "No description provided."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-1">
                    <div>Hosted by: {room.owner.name || "Anonymous"}</div>
                    <div>Participants: {room._count.participants} total</div>
                    <div>Joined: {new Date(room.createdAt).toLocaleDateString()}</div>
                  </CardContent>
                  <CardFooter className="pt-2">
                    <Button asChild className="w-full" variant="secondary" size="sm">
                      <Link href={`/rooms/${room.id}`}>Enter Room</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
