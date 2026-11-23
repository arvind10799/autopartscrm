"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserManagement } from "./UserManagement";
import { ReminderAdminSettings } from "@/features/reminders/ReminderNotificationSettings";
export function UserCenterWorkspace() {
  const [tab, setTab] = useState<"users" | "reminders">("users");
  return (
    <div className="crm-brand-actions crm-reminder-ui space-y-5">
      <div className="flex gap-2">
        <Button
          variant={tab === "users" ? "default" : "outline"}
          aria-pressed={tab === "users"}
          onClick={() => setTab("users")}
        >
          Users
        </Button>
        <Button
          variant={tab === "reminders" ? "default" : "outline"}
          aria-pressed={tab === "reminders"}
          onClick={() => setTab("reminders")}
        >
          Reminders
        </Button>
      </div>
      {tab === "users" ? <UserManagement /> : <ReminderAdminSettings />}
    </div>
  );
}
