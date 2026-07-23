import type { ClientEvents } from "discord.js";

export type Event<K extends keyof ClientEvents> = (...arguments_: ClientEvents[K]) => unknown;

export type Mentionable =
  "USER" | "ROLE" | "CHANNEL" | "DEFAULT_TIMESTAMP" | "SIMPLE_TIMESTAMP" | "DETAILED_TIMESTAMP";

export type ReplaceableStrings =
  | "(name)"
  | "(username)"
  | "(count)"
  | "(servername)"
  | "(serverowner)"
  | "(currentdate)"
  | "(currentdate, simple)"
  | "(currentdate, detailed)";

export type Replacements = { text: ReplaceableStrings; replacement: string | number }[];

export type Satisfies<K, T extends K> = T;

/**
 * Force typescript to recognize a variable as a certain type (useful for polymorphic const variables for example)
 * @param v The variable you want to force the type of
 * @returns true (the variable is now of the type specified in `<T>`)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-unnecessary-type-parameters, @typescript-eslint/no-explicit-any
export function forceType<T>(v: any): v is T {
  return true;
}

// Generated stuff below with a website, https://transform.tools/json-schema-to-typescript, using the public GitHub schemas

export interface GHCommit {
  url: string;
  sha: string;
  node_id: string;
  html_url: string;
  comments_url: string;
  commit: {
    url: string;
    author: null | GitUser;
    committer: null | GitUser;
    message: string;
    comment_count: number;
    tree: {
      sha: string;
      url: string;
      [k: string]: unknown;
    };
    verification?: Verification;
    [k: string]: unknown;
  };
  author: SimpleUser | null;
  committer: SimpleUser | null;
  parents: {
    sha: string;
    url: string;
    html_url?: string;
    [k: string]: unknown;
  }[];
  stats?: {
    additions?: number;
    deletions?: number;
    total?: number;
  };
}
/**
 * Metaproperties for Git author/committer information.
 */
export interface GitUser {
  name?: string;
  email?: string;
  date?: string;
}
export interface Verification {
  verified: boolean;
  reason: string;
  payload: string | null;
  signature: string | null;
  verified_at: string | null;
  [k: string]: unknown;
}
/**
 * A GitHub user.
 */
export interface SimpleUser {
  name?: string | null;
  email?: string | null;
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string | null;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  site_admin: boolean;
  starred_at?: string;
  user_view_type?: string;
}
