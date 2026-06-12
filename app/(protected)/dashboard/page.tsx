import { auth } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome {session?.user?.name ?? "there"}. Your PrepRoom workspace is
          ready.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Recent Rooms</CardTitle>
            <CardDescription>Coming in Phase 2.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No rooms yet.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Created Rooms</CardTitle>
            <CardDescription>Coming in Phase 2.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No rooms created yet.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Coming in Phase 2.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No activity yet.
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
