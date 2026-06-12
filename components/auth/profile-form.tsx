"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProfileFormProps = {
  defaultName: string;
  email: string;
};

export function ProfileForm({ defaultName, email }: ProfileFormProps) {
  const [name, setName] = useState(defaultName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const onUpdateProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingProfile(true);

    const response = await fetch("/api/users/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    const payload = (await response.json()) as { message?: string };

    setIsSavingProfile(false);

    if (!response.ok) {
      toast.error(payload.message ?? "Could not update profile");
      return;
    }

    toast.success(payload.message ?? "Profile updated");
  };

  const onResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingPassword(true);

    const response = await fetch("/api/auth/reset-password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const payload = (await response.json()) as { message?: string };

    setIsSavingPassword(false);

    if (!response.ok) {
      toast.error(payload.message ?? "Could not update password");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    toast.success(payload.message ?? "Password updated");
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your display information.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            id="profile-form"
            onSubmit={onUpdateProfile}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" value={email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                required
              />
            </div>
          </form>
        </CardContent>
        <CardFooter>
          <Button type="submit" form="profile-form" disabled={isSavingProfile}>
            {isSavingProfile ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Save profile
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>
            Change your account password securely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            id="password-form"
            onSubmit={onResetPassword}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>
          </form>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            form="password-form"
            disabled={isSavingPassword}
          >
            {isSavingPassword ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Update password
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
