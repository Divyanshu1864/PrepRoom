import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/auth/profile-form";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
    },
  });

  if (!user?.email) {
    redirect("/dashboard");
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Profile Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your account details and password.
        </p>
      </div>
      <ProfileForm defaultName={user.name ?? ""} email={user.email} />
    </section>
  );
}
