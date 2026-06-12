import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <Card className="w-full max-w-2xl border-border/70 shadow-sm">
        <CardContent className="space-y-8 p-8 md:p-10">
          <div className="space-y-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Collaborative Coding Practice
            </p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">PrepRoom</h1>
            <p className="mx-auto max-w-xl text-muted-foreground">
              Practice coding interviews together with shared rooms, real-time collaboration, and
              structured problem solving.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/signup">Create account</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="rounded-lg border bg-background p-3">Collaborative editor</div>
            <div className="rounded-lg border bg-background p-3">Room chat</div>
            <div className="rounded-lg border bg-background p-3">Interview-ready workflows</div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
