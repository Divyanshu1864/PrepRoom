import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getServerAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const { roomId } = await params;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true },
    });

    if (!room) {
      return NextResponse.json({ message: "Room not found." }, { status: 404 });
    }

    // Check if already a participant
    const existingParticipant = await prisma.participant.findUnique({
      where: {
        userId_roomId: {
          userId: session.user.id,
          roomId: roomId,
        },
      },
    });

    if (existingParticipant) {
      return NextResponse.json(
        { message: "You are already a participant in this room." },
        { status: 200 },
      );
    }

    // Add user as a participant
    await prisma.participant.create({
      data: {
        userId: session.user.id,
        roomId: roomId,
      },
    });

    return NextResponse.json(
      { message: "Joined room successfully." },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error joining room:", error);
    return NextResponse.json(
      { message: "Unexpected server error." },
      { status: 500 },
    );
  }
}
