"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useMe } from "@/hooks/useMe";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { CameraIcon } from "@/components/ui/icons";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export default function EditProfileModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const { me, refresh } = useMe();

  const [form, setForm] = useState({
    full_name: "",
    additional_name: "",
    pronounce: "",
    bio: "",
    location: "",
    link: "",
    link_alias: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !me) return;
    setForm({
      full_name: me.full_name ?? "",
      additional_name: me.additional_name ?? "",
      pronounce: me.pronounce ?? "",
      bio: me.bio ?? "",
      location: me.location ?? "",
      link: me.link ?? "",
      link_alias: me.link_alias ?? "",
    });
  }, [open, me]);

  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/users/me", form);
      await refresh();
      toast.success("Profile updated");
      onClose();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  /** Photos are uploaded as data URLs; the server pushes them to Cloudinary. */
  const uploadAvatar = async (file: File) => {
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Pick an image under 5MB");
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read that file"));
        reader.readAsDataURL(file);
      });

      await api.patch("/users/me/avatar", { userprofile_image: dataUrl });
      await refresh();
      toast.success("Photo updated");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit profile"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center">
        <div className="relative">
          <Avatar
            src={me?.userprofile_image}
            name={me?.full_name}
            username={me?.username}
            size="xl"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Change profile photo"
            className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white shadow-md transition-colors hover:bg-brand-strong disabled:opacity-60"
          >
            <CameraIcon className="h-4 w-4" />
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadAvatar(file);
            event.target.value = "";
          }}
        />

        {uploading && <p className="mt-2 text-xs text-muted">Uploading…</p>}
      </div>

      <div className="mt-6 space-y-4">
        <Input
          label="Display name"
          value={form.full_name}
          onChange={(event) => update("full_name", event.target.value)}
          maxLength={80}
        />

        <div className="grid gap-4 tab:grid-cols-2">
          <Input
            label="Additional name"
            value={form.additional_name}
            onChange={(event) => update("additional_name", event.target.value)}
            maxLength={80}
          />
          <Input
            label="Pronouns"
            value={form.pronounce}
            onChange={(event) => update("pronounce", event.target.value)}
            placeholder="they/them"
            maxLength={40}
          />
        </div>

        <Textarea
          label="Bio"
          value={form.bio}
          onChange={(event) => update("bio", event.target.value)}
          maxLength={500}
          showCount
          rows={4}
        />

        <Input
          label="Location"
          value={form.location}
          onChange={(event) => update("location", event.target.value)}
          maxLength={80}
        />

        <div className="grid gap-4 tab:grid-cols-2">
          <Input
            label="Link"
            type="url"
            inputMode="url"
            value={form.link}
            onChange={(event) => update("link", event.target.value)}
            placeholder="https://example.com"
            maxLength={200}
          />
          <Input
            label="Link label"
            value={form.link_alias}
            onChange={(event) => update("link_alias", event.target.value)}
            placeholder="My website"
            maxLength={80}
          />
        </div>
      </div>
    </Modal>
  );
}
