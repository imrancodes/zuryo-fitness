"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ROLE_LABEL } from "@/lib/roles";
import type { PublicUser } from "@/types/user";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function UserMenu({ user }: { user: PublicUser }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-tight">{user.name}</p>
        <p className="text-xs text-muted-foreground">{user.email}</p>
      </div>
      <span
        aria-hidden
        className="grid size-9 place-items-center rounded-full bg-secondary text-sm font-semibold text-primary"
      >
        {initials(user.name)}
      </span>
      <Badge variant="brand" className="hidden md:inline-flex">
        {ROLE_LABEL[user.role]}
      </Badge>
      <Dialog>
        <DialogTrigger render={<Button variant="ghost" size="icon" aria-label="Sign out" />}>
          <LogOut />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out of Zuryo?</DialogTitle>
            <DialogDescription>You will need to sign in again to access your workspace.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={signOut} disabled={pending}>
              {pending ? "Signing out…" : "Sign out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
