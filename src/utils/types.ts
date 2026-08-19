import type {
  ChatInputCommandInteraction,
  ClientEvents,
  Guild,
  TextBasedChannel,
  User,
} from "discord.js";

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

export interface Mention {
  type: "USER" | "ROLE" | "CHANNEL" | "TIMESTAMP";
  res: string;
}

/**
 * Force typescript to recognize a variable as a certain type *in place*. Useful for polymorphic const variables, for example.
 * @param _v The variable you want to force the type of
 * @returns The variable, now of the type specified in `<T>`
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters, @typescript-eslint/no-explicit-any
export function as<T>(v: any): T {
  return v as T;
}

/**
 * Type-checks that the interaction has a guild and a user. Doing `if (!interaction.guild) return;` doesn't properly tell the compiler that `guild` is non-nullable, this does.
 *
 * @param v Interaction.
 * @returns True if it does have a guild, false otherwise.
 */
export function isInteractionSafe(
  v: ChatInputCommandInteraction,
): v is ChatInputCommandInteraction & {
  guild: Guild;
  guildId: string;
  user: User;
  channel: TextBasedChannel;
} {
  return !(!v.guild || !v.guildId || !v.user || !v.channel);
}

// Generated stuff below with a website, https://transform.tools/json-schema-to-typescript, using the public GitHub schemas

export interface GHCommit {
  sha: string;
  html_url: string;
  commit: {
    author: null | {
      name?: string;
      email?: string;
      date?: string;
    };
    message: string;
  };
  stats?: {
    additions?: number;
    deletions?: number;
    total?: number;
  };
}
