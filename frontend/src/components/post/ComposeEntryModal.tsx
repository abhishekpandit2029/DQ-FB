"use client";

import { useEffect, useState } from "react";
import { mutate } from "swr";
import { api } from "@/lib/api";
import type { Post } from "@/lib/types";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Tag from "@/components/ui/Tag";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { XIcon } from "@/components/ui/icons";

export interface ComposeEntryModalProps {
  open: boolean;
  onClose: () => void;
  /** Supply an existing entry to edit it instead of creating a new one. */
  post?: Post | null;
  onSaved?: (post: Post) => void;
}

const MAX_TAGS = 10;

export default function ComposeEntryModal({
  open,
  onClose,
  post,
  onSaved,
}: ComposeEntryModalProps) {
  const toast = useToast();
  const isEditing = Boolean(post);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(post?.title ?? "");
    setContent(post?.content ?? "");
    setTags(post?.tags ?? []);
    setTagDraft("");
  }, [open, post]);

  const addTag = () => {
    const value = tagDraft.trim().replace(/^#/, "").toLowerCase();
    if (!value) return;
    if (tags.length >= MAX_TAGS) {
      toast.error(`You can add up to ${MAX_TAGS} tags`);
      return;
    }
    if (!tags.includes(value)) setTags([...tags, value]);
    setTagDraft("");
  };

  const save = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Give your entry a title and something to say");
      return;
    }

    setSaving(true);
    try {
      const payload = { title: title.trim(), content: content.trim(), tags };

      const result = isEditing
        ? await api.patch<{ post: Post }>(`/posts/${post!._id}`, payload)
        : await api.post<{ post: Post }>("/posts", payload);

      // Refresh every list that could contain this entry.
      await Promise.all([
        mutate((key) => typeof key === "string" && key.startsWith("/posts")),
      ]);

      onSaved?.(result.post);
      toast.success(isEditing ? "Entry updated" : "Entry saved");
      onClose();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit entry" : "New entry"}
      description={isEditing ? undefined : "What's on your mind today?"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            {isEditing ? "Save changes" : "Save entry"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="A quiet Tuesday"
          maxLength={200}
          autoFocus
        />

        <Textarea
          label="Your thoughts"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write freely — this is yours."
          maxLength={20000}
          showCount
          rows={8}
        />

        <div>
          <Input
            label="Tags"
            value={tagDraft}
            onChange={(event) => setTagDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                addTag();
              }
            }}
            placeholder="Add a tag and press Enter"
            hint={`${tags.length}/${MAX_TAGS} tags`}
            maxLength={40}
          />

          {tags.length > 0 && (
            <div className="-mt-1 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Tag key={tag} tone="brand">
                  #{tag}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((item) => item !== tag))}
                    aria-label={`Remove ${tag}`}
                    className="ml-0.5"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </Tag>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
