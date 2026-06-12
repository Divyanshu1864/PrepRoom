import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
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
      return NextResponse.json({ message: "Room not found." }, { status: 404 });
    }

    // Check if the user is a participant or the owner
    const isOwner = room.ownerId === session.user.id;
    const isParticipant = room.participants.some(
      (p) => p.userId === session.user.id,
    );

    if (!isOwner && !isParticipant) {
      return NextResponse.json(
        { message: "Forbidden. You are not a participant in this room." },
        { status: 403 },
      );
    }

    return NextResponse.json({ room });
  } catch (error) {
    console.error("Error fetching room:", error);
    return NextResponse.json(
      { message: "Unexpected server error." },
      { status: 500 },
    );
  }
}
