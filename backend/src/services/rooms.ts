import { PrismaClient, RoomMode, ParticipantRole } from "@prisma/client";

const prisma = new PrismaClient();

export interface RoomDTO {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  createdAt: Date;
  owner: {
    id: string;
    name: string | null;
    email: string;
  };
}

/**
 * Creates a new room and automatically registers the owner as a participant.
 */
export const createRoom = async (
  userId: string,
  title: string,
  description: string | null,
  mode: RoomMode = "COLLAB"
) => {
  const initialRole: ParticipantRole = mode === "INTERVIEW" ? "INTERVIEWER" : "OWNER";

  return prisma.room.create({
    data: {
      title,
      description,
      ownerId: userId,
      mode,
      participants: {
        create: {
          userId,
          role: initialRole,
        },
      },
    },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
    },
  });
};

/**
 * Lists all rooms that a user is participating in, optionally filtered by a search query.
 */
export const listRooms = async (userId: string, search?: string) => {
  return prisma.room.findMany({
    where: {
      participants: {
        some: {
          userId,
        },
      },
      OR: search
        ? [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ]
        : undefined,
    },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: { participants: true },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

/**
 * Fetches a single room detail including owner, participants, and problems.
 */
export const findRoomById = async (roomId: string) => {
  return prisma.room.findUnique({
    where: { id: roomId },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
      participants: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      problems: true,
    },
  });
};

/**
 * Checks and registers a user to a room.
 */
export const joinRoom = async (userId: string, roomId: string) => {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    const error = new Error("Room not found.");
    (error as any).code = "ROOM_NOT_FOUND";
    throw error;
  }

  const existingParticipant = await prisma.participant.findUnique({
    where: {
      userId_roomId: {
        userId,
        roomId,
      },
    },
  });

  if (existingParticipant) {
    return { alreadyJoined: true };
  }

  let assignedRole: ParticipantRole = "MEMBER";
  if (room.mode === "INTERVIEW") {
    assignedRole = room.ownerId === userId ? "INTERVIEWER" : "INTERVIEWEE";
  }

  await prisma.participant.create({
    data: {
      userId,
      roomId,
      role: assignedRole,
    },
  });

  return { alreadyJoined: false };
};

/**
 * Deletes a room and cascades deletion to all child tables.
 */
export const deleteRoom = async (roomId: string) => {
  return prisma.room.delete({
    where: { id: roomId },
  });
};
