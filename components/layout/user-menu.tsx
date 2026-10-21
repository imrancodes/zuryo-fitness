"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { InitialsAvatar } from "@/components/initials-avatar";
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
import { useResetOnHide } from "@/hooks/use-reset-on-hide";
import { ROLE_LABEL } from "@/lib/roles";
import type { PublicUser } from "@/types/user";

export function UserMenu({ user }: { user: PublicUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  useResetOnHide(() => {
    setOpen(false);
    setPending(false);
  });

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
      <InitialsAvatar name={user.name} />
      <Badge variant="brand" className="hidden md:inline-flex">
        {ROLE_LABEL[user.role]}
      </Badge>
      <Dialog open={open} onOpenChange={setOpen}>
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
