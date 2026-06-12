import { compare, hash } from "bcrypt";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const resetPasswordSchema = z.object({
  currentPassword: z.string().min(8).max(64),
  newPassword: z.string().min(8).max(64),
});

export async function PATCH(request: Request) {
  try {
    const session = await getServerAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid password update payload." },
        { status: 400 },
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { message: "New password must be different from current password." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    });

    if (!user?.password) {
      return NextResponse.json(
        { message: "Password reset is unavailable for this account." },
        { status: 400 },
      );
    }

    const isValidCurrentPassword = await compare(
      currentPassword,
      user.password,
    );

    if (!isValidCurrentPassword) {
      return NextResponse.json(
        { message: "Current password is incorrect." },
        { status: 401 },
      );
    }

    const hashedPassword = await hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
      select: { id: true },
    });

    return NextResponse.json({ message: "Password updated successfully." });
  } catch {
    return NextResponse.json(
      { message: "Unexpected server error." },
      { status: 500 },
    );
  }
}
