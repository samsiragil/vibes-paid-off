import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { makerTag, repliesTag } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/public";

export type ReplyView = {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

/** Replies are one level and short, so a project page shows them all (oldest first) up to this. */
const MAX_REPLIES = 200;

/**
 * The visible replies under a published project, oldest first. Cached and shared by all visitors;
 * posting, deleting or reporting a reply invalidates it, and so does an author renaming themselves.
 */
export async function getProjectReplies(projectId: string): Promise<ReplyView[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(repliesTag(projectId));

  const { data, error } = await createPublicClient()
    .from("comments")
    .select(
      "id, body, created_at, author:profiles!comments_user_id_fkey (id, username, display_name, avatar_url)",
    )
    .eq("project_id", projectId)
    .eq("status", "visible")
    .order("created_at", { ascending: true })
    .limit(MAX_REPLIES);
  if (error) throw new Error(`Could not load replies: ${error.message}`);

  const replies = data.flatMap((row) =>
    row.author?.username
      ? [
          {
            id: row.id,
            body: row.body,
            createdAt: row.created_at,
            author: {
              id: row.author.id,
              username: row.author.username,
              displayName: row.author.display_name || row.author.username,
              avatarUrl: row.author.avatar_url,
            },
          },
        ]
      : [],
  );
  for (const authorId of new Set(replies.map((reply) => reply.author.id))) {
    cacheTag(makerTag(authorId));
  }
  return replies;
}
