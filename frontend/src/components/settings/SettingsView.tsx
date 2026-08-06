"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { useMe } from "@/hooks/useMe";
import PageHeader from "@/components/layout/PageHeader";
import EditProfileModal from "@/components/profile/EditProfileModal";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Input from "@/components/ui/Input";
import Switch from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { LogoutIcon } from "@/components/ui/icons";
import InteractionSettings from "./InteractionSettings";

export default function SettingsView() {
  const toast = useToast();
  const { me, refresh } = useMe();
  const { logout } = useAuth();

  const [editingProfile, setEditingProfile] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const [passwords, setPasswords] = useState({ current: "", next: "" });
  const [changingPassword, setChangingPassword] = useState(false);

  const togglePrivacy = async (isPrivate: boolean) => {
    setSavingPrivacy(true);
    try {
      await api.patch("/users/me/privacy", { isPrivate });
      await refresh();
      toast.success(isPrivate ? "Your account is now private" : "Your account is now public");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingPrivacy(false);
    }
  };

  const changePassword = async () => {
    if (passwords.next.length < 8) {
      toast.error("Use at least 8 characters");
      return;
    }

    setChangingPassword(true);
    try {
      await api.patch("/users/me/password", {
        currentPassword: passwords.current,
        newPassword: passwords.next,
      });
      setPasswords({ current: "", next: "" });
      toast.success("Password updated");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setChangingPassword(false);
    }
  };

  if (!me) return null;

  return (
    <div className="px-4 pt-5 lap:px-0 lap:pt-0">
      <PageHeader title="Adjustments" description="Your account, privacy and appearance." />

      <div className="mx-auto max-w-2xl space-y-5">
        {/* ------------------------------ Profile ----------------------------- */}
        <section className="rounded-xl bg-surface p-5 ring-1 ring-line">
          <div className="flex items-center gap-4">
            <Avatar
              src={me.userprofile_image}
              name={me.full_name}
              username={me.username}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-content">
                {me.full_name || me.username}
              </p>
              <p className="truncate text-xs text-muted">@{me.username}</p>
              <p className="truncate text-xs text-muted">{me.email}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setEditingProfile(true)}>
              Edit
            </Button>
          </div>
        </section>

        {/* ------------------------------ Privacy ----------------------------- */}
        <section className="rounded-xl bg-surface ring-1 ring-line">
          <header className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-content">Account privacy</h2>
          </header>

          <div className="px-5 py-5">
            <Switch
              checked={me.isPrivate}
              disabled={savingPrivacy}
              onChange={togglePrivacy}
              label="Private account"
              description="Only accepted followers can read your entries. Follow requests always need your approval either way."
            />
          </div>
        </section>

        {/* ------------------- Six reachability controls ---------------------- */}
        <InteractionSettings />

        {/* ----------------------------- Password ----------------------------- */}
        <section className="rounded-xl bg-surface ring-1 ring-line">
          <header className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-content">Change password</h2>
          </header>

          <div className="space-y-4 px-5 py-5">
            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={passwords.current}
              onChange={(event) =>
                setPasswords((current) => ({ ...current, current: event.target.value }))
              }
            />
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              value={passwords.next}
              onChange={(event) =>
                setPasswords((current) => ({ ...current, next: event.target.value }))
              }
              hint="At least 8 characters."
            />
            <Button
              loading={changingPassword}
              disabled={!passwords.current || !passwords.next}
              onClick={changePassword}
            >
              Update password
            </Button>
          </div>
        </section>

        {/* ------------------------------ Sign out ---------------------------- */}
        <section className="rounded-xl bg-surface p-5 ring-1 ring-line">
          <Button
            variant="danger"
            fullWidth
            leftIcon={<LogoutIcon />}
            onClick={() => setLogoutOpen(true)}
          >
            Sign out
          </Button>
        </section>
      </div>

      {editingProfile && <EditProfileModal open onClose={() => setEditingProfile(false)} />}

      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={logout}
        title="Sign out?"
        description="You'll need to sign in again to reach your diary."
        confirmLabel="Sign out"
        danger
      />
    </div>
  );
}
