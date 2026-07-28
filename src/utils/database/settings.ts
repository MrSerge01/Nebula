import { type InteractionResponse, type Message, PermissionFlagsBits } from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { easterEggNames, eventNames } from "handlers/events";
import { client } from "src/bot";
import { dekominator, kominator } from "utils/kominator";
import { safeMember, safeUser } from "utils/safeThings";
import type { Satisfies } from "utils/types";
import { db, values } from ".";
import type {
  BulkedSettingReturnType,
  SettingDefinitionRecord,
  SettingKeyFor,
  SettingPrecondition,
  SettingReturnType,
  SettingsFor,
  SettingsGlueFix1,
  SingleSettingDefinition,
  TableDefinition,
  TypeOfDefinition,
} from "./types";

type Def = Satisfies<
  TableDefinition,
  {
    name: "settings";
    definition: {
      guildID: "TEXT";
      key: "TEXT";
      value: "TEXT";
      parameters: "OBJECT";
    };
  }
>;

const invitePrecondition: SettingPrecondition<"BOOL" | "CHANNEL"> = async (
  interaction,
  newValue,
) => {
  if (
    newValue &&
    interaction.guild &&
    !(await safeMember(interaction.guild, interaction.client.user.id)).permissions.has(
      PermissionFlagsBits.CreateInstantInvite | PermissionFlagsBits.ManageGuild,
    )
  )
    return `The **Create Invite** and the **Manage Server** permissions are required for this setting to work.`;
};

export const defLeveling = {
  enabled: {
    type: "BOOL",
    desc: "Enable/disable the leveling system.",
    val: true,
    emoji: "✅",
  },
  channel: {
    type: "CHANNEL",
    desc: "Channel for logging leveling-related stuff (e.g., someone leveling up).",
    emoji: "📝",
  },
  block_channels: {
    type: "CHANNEL",
    desc: "Channels where messages aren't counted.",
    iterable: true,
    emoji: "🚫",
  },
  xp_gain: {
    type: "INTEGER",
    desc: "Set the amount of XP a user gains per message.",
    val: 2,
    emoji: "📈",
  },
  cooldown: {
    type: "INTEGER",
    desc: "Set the cooldown between messages that add XP (in seconds).",
    val: 2,
    emoji: "⏱️",
  },
  difficulty: {
    type: "INTEGER",
    desc: "Set the difficulty (e.g., 2 will make it 2x harder to level up).",
    val: 1,
    emoji: "🧩",
  },
  rewards: {
    type: "OBJECT",
    desc: "Set roles and channels to be granted to users who reach specific levels.",
    iterable: true,
    emoji: "🌟",
    sorting: (a: { level: number }, b: { level: number }): number => b.level - a.level,
    naming: (a: { level: number; channels: string[]; roles: string[] }): string =>
      `LVL ${a.level}, ${a.channels?.length ?? "no"} channels, ${a.roles?.length ?? "no"} roles`,
    properties: {
      $: {
        type: "TEXT",
        desc: "(Internal)",
        val: "",
      },
      level: {
        type: "INTEGER",
        desc: "The level required to get the level reward.",
        emoji: "🔢",
      },
      channels: {
        type: "mCHANNEL",
        iterable: true,
        desc: "Channels granted by this level.",
        emoji: "📑",
      },
      roles: {
        type: "mROLE",
        iterable: true,
        desc: "Roles granted by this level.",
        emoji: "📑",
      },
    },
  },
} satisfies SettingDefinitionRecord["settings"];

export const defModeration = {
  events: {
    type: "SELECT",
    desc: "Select what events you want to see in your log channel.",
    iterable: true,
    choices: eventNames,
    emoji: "📅",
  },
  channel: {
    type: "CHANNEL",
    desc: "Channel for logging moderation events.",
    emoji: "📋",
  },
  silent: {
    type: "BOOL",
    desc: "If enabled, all moderation actions will be done without pinging the affected user.",
    val: false,
    emoji: "🔇",
  },
} satisfies SettingDefinitionRecord["settings"];

export const defNews = {
  channel: {
    type: "CHANNEL",
    desc: "Channel where news messages are sent.",
    emoji: "📰",
  },
  role: {
    type: "ROLE",
    desc: "Roles that should be pinged when a news message is sent.",
    iterable: true,
    emoji: "📢",
  },
  edit_original_message: {
    type: "BOOL",
    desc: "Whether or not the original message should be edited when a news message is updated.",
    val: true,
    emoji: "✏️",
  },
} satisfies SettingDefinitionRecord["settings"];

export const defStarboard = {
  enabled: {
    type: "BOOL",
    desc: "Enable/disable the starboard.",
    val: false,
    emoji: "✅",
  },
  channel: {
    type: "CHANNEL",
    desc: "Channel where starred messages appear.",
    emoji: "📌",
  },
  emoji: {
    type: "TEXT",
    desc: "Emoji used for starring messages.",
    val: "⭐",
    emoji: "⭐",
  },
  threshold: {
    type: "INTEGER",
    desc: "Reactions needed for a message to be starred.",
    val: 3,
    emoji: "🦾",
  },
} satisfies SettingDefinitionRecord["settings"];

export const defServerboard = {
  shown: {
    type: "BOOL",
    desc: "Whether or not the server should be shown on the serverboard.",
    val: false,
    emoji: "🌐",
  },
  server_invite: {
    type: "BOOL",
    desc: "Whether to show a server invite link on the serverboard page.",
    val: false,
    precondition: invitePrecondition,
    emoji: "🔗",
  },
  invite_channel: {
    type: "CHANNEL",
    desc: "Channel for the invite. If not set, uses the first channel in the channel list.",
    // precondition: invitePrecondition,
    emoji: "📨",
  },
} satisfies SettingDefinitionRecord["settings"];

export const defWelcome = {
  join_channel: {
    type: "CHANNEL",
    desc: "Channel where welcome messages are sent.",
    emoji: "📥",
  },
  join_text: {
    type: "TEXT",
    desc: "Text sent when a user joins. Use (variables) to add dynamic info, run /help variables for info.",
    val: "Welcome to (servername), (name)! Interestingly, you just helped us reach (count) members. Have a nice day!",
    emoji: "👋",
  },
  leave_channel: {
    type: "CHANNEL",
    desc: "Channel where leave messages are sent.",
    emoji: "📤",
  },
  leave_text: {
    type: "TEXT",
    desc: "Text sent when a user leaves. Use (variables) to add dynamic info, run /help variables for info.",
    val: "(name) has left the server! 😥",
    emoji: "🚪",
  },
  join_dm: {
    type: "BOOL",
    desc: "Whether or not the bot should send a custom DM message to the user upon joining.",
    val: false,
    emoji: "💌",
  },
  dm_text: {
    type: "TEXT",
    desc: "Text sent in the user's DM when they join the server. Use (variables) to add dynamic info, run /help variables for info.",
    val: "Welcome to (servername), (name)! Interestingly, you just helped us reach (count) members. Have a nice day!",
    emoji: "📬",
  },
  roles: {
    type: "ROLE",
    desc: "The roles that should be given to the user when they join.",
    iterable: true,
    emoji: "🎭",
  },
} satisfies SettingDefinitionRecord["settings"];

export const defEaster = {
  enabled: {
    type: "BOOL",
    desc: 'Whether or not the bot should reply to certain messages with "easter egg" messages.',
    val: false,
    emoji: "✅",
  },
  enabled_eggs: {
    type: "SELECT",
    desc: "Specific easter eggs to enable. If none are selected, all easter eggs are enabled.",
    iterable: true,
    choices: easterEggNames,
    emoji: "🐣",
  },
  allowed_channels: {
    type: "CHANNEL",
    desc: "Channels where easter eggs are allowed.",
    iterable: true,
    emoji: "💬",
  },
} satisfies SettingDefinitionRecord["settings"];

const topggPrecondition: SettingPrecondition<"BOOL"> = async (
  interaction,
  newValue,
): Promise<string | undefined> => {
  const dmChannel = await (await safeUser(interaction.client, interaction.user.id)).createDM();
  if (newValue && !dmChannel?.isSendable())
    return `Sokora cannot DM you. Enable DMs for Sokora or send it a message to get top.gg notifications.`;
};

export const defTopgg = {
  remind: {
    type: "BOOL",
    desc: "Whether or not should the bot remind you when you can vote in Top.gg. **This setting will DM you.**",
    val: false,
    precondition: topggPrecondition,
    emoji: "⏰",
  },
} satisfies SettingDefinitionRecord["settings"];

export const settingsDefinition = {
  leveling: {
    description: "Customize the behavior of the leveling system.",
    settings: defLeveling,
  },
  moderation: {
    description: "Change Sokora's settings related to moderation.",
    settings: defModeration,
  },
  news: {
    description: "Configure news for your server.",
    settings: defNews,
  },
  starboard: {
    description: "Configure the starboard system.",
    settings: defStarboard,
  },
  serverboard: {
    description: "Configure your server's appearance on the serverboard.",
    settings: defServerboard,
  },
  welcome: {
    description: "Change how Sokora welcomes your new users.",
    settings: defWelcome,
  },
  easter: {
    description: "Enable/disable easter eggs.",
    settings: defEaster,
  },
  topgg: { description: "Change settings about Top.gg.", settings: defTopgg },
};

export type TS = typeof settingsDefinition;
export const serverSettingsKeys = [
  "easter",
  "leveling",
  "moderation",
  "news",
  "serverboard",
  "starboard",
  "welcome",
] as (keyof TS)[];
export const userSettingsKeys = ["topgg"] as (keyof TS)[];

const clause = (sql_: Bun.SQL, key: string): [Bun.SQL.Query<string>, Bun.SQL.Query<string>] =>
  key.startsWith("topgg")
    ? ([sql_("user_settings"), sql_("userID")] as const)
    : ([sql_("settings"), sql_("guildID")] as const);

const deleteQuery = async (entID: string, key: string, sql_: Bun.SQL = db): Promise<Bun.SQL> => {
  const [table, ent] = clause(sql_, key);
  return await sql_`DELETE FROM ${table} WHERE ${ent} = ${entID} AND "key" = ${key};`;
};

export async function getSettingsTable<K extends keyof TS>(
  key: K,
  setting: SettingKeyFor<K>,
): Promise<TypeOfDefinition<Def>[]> {
  const [table] = clause(db, key);

  return values<TypeOfDefinition<Def>>(
    await db`SELECT * FROM ${table} WHERE "key" = ${`${key}.${setting}`};`,
  );
}

export function switchTypes(value: string, set: SingleSettingDefinition): unknown {
  switch (set.type) {
    case "BOOL": {
      return value == "true";
    }
    case "INTEGER":
    case "mINTEGER": {
      return Number.parseInt(value);
    }
    default: {
      return value;
    }
  }
}

/**
 * @param entityID ID of the guild/user to touch settings for.
 * @param key Key, e.g. `leveling`, `moderation`.
 * @param setting Specific setting to get.
 * @returns The setting's value.
 * @important Do not mix user and guild IDs. That's the only we cannot type-check.
 */
export async function getSetting<K extends keyof TS, S extends SettingKeyFor<K>>(
  entityID: string,
  key: K,
  setting: S,
): Promise<SettingReturnType<K, S>> {
  const settings: SettingsFor<K> = settingsDefinition[key].settings;
  const set = settings[setting] as SettingsGlueFix1<K, S>;

  const [table, ent] = clause(db, key);
  const res = values<TypeOfDefinition<Def>>(
    await db`SELECT * FROM ${table} WHERE ${ent} = ${entityID} AND "key" = ${`${key}.${setting}`};`,
  );

  const fallback = (): SettingReturnType<K, S> => {
    if (!set || !("val" in set)) return (set.iterable ? [] : undefined) as SettingReturnType<K, S>;
    // [TODO] shouldn't this need no assertion?
    return set.val as SettingReturnType<K, S>;
  };

  if (res.length === 0) return fallback();

  const value_: string | string[] = set.type === "OBJECT" ? res[0].parameters : res[0].value;
  if (!value_ || (typeof value_ == "string" && value_ == "null")) return fallback();

  const value = set.iterable && set.type != "OBJECT" ? kominator(value_) : value_;

  if (Array.isArray(value)) {
    const result = value.map(valuelet => switchTypes(valuelet, set)) as SettingReturnType<K, S>;
    return set.iterable && set.type === "OBJECT"
      ? ((result as unknown[]).toSorted(set.sorting) as SettingReturnType<K, S>)
      : result;
  }

  return switchTypes(value, set) as SettingReturnType<K, S>;
}

export async function getSettingCategory<K extends keyof TS>(
  guildID: string,
  key: K,
): Promise<BulkedSettingReturnType<K>> {
  const keys = Object.keys(settingsDefinition[key].settings) as (keyof TS[K]["settings"] &
    string)[];
  return Object.fromEntries(
    await Promise.all(
      keys.map(async setting => [setting, await getSetting(guildID, key, setting)]),
    ),
  ) as BulkedSettingReturnType<K>;
}

export async function setSetting<K extends keyof TS, S extends SettingKeyFor<K>>(
  entityID: string,
  key: K,
  setting: S,
  value: SettingReturnType<K, S>,
): Promise<void> {
  const settings: SettingsFor<K> = settingsDefinition[key].settings;
  const _set = settings[setting] as SettingsGlueFix1<K, S>;

  const isObject = _set.type == "OBJECT";
  const isIterable = _set.iterable == true;
  const isArray = Array.isArray(value);

  if (!isArray && isIterable)
    throw new Error(
      `Attempted to set ${key}.${setting} (WHICH IS ITERABLE!) to something that is NOT a JS Array.`,
    );

  const set: unknown = isArray && !isObject ? dekominator(value as string[]) : value;
  const keySetting = `${key}.${setting}`;
  const [table, ent] = clause(db, key);
  await db.begin(async tx => {
    // Two queries for one thing ? We could shorten it if we ever go with one DB ("on duplicate, update" kind of thing)
    await deleteQuery(entityID, keySetting, tx);
    await (isObject
      ? tx`INSERT INTO ${table} (${ent}, "key", "parameters") VALUES (${entityID}, ${keySetting}, ${set});`
      : tx`INSERT INTO ${table} (${ent}, "key", "value") VALUES (${entityID}, ${keySetting}, ${set});`);
  }); // Auto-commits if nothing goes wrong
}

export async function resetSetting<K extends keyof TS>(
  entityID: string,
  key: K,
  setting: SettingKeyFor<K>,
): Promise<void> {
  await deleteQuery(entityID, `${key}.${setting}`);
}

export async function resetSettingCategory(entityID: string, key: keyof TS): Promise<void> {
  const [table, ent] = clause(db, key);
  await db`DELETE FROM ${table} WHERE ${ent} = ${entityID} AND "key" LIKE ${`${key}%`};`;
}

export async function listPublicServers(): Promise<
  {
    guildID: string;
    showInvite: boolean;
    inviteChannelId: string | undefined;
  }[]
> {
  const publicGuildSet = new Set(
    values<TypeOfDefinition<Def>>(
      await db`SELECT * FROM settings WHERE "key" = 'serverboard.shown' AND "value" = 'true';`,
    ).map(entry => entry.guildID),
  );

  const inviteGuildsSet = new Set(
    values<TypeOfDefinition<Def>>(
      await db`SELECT * FROM settings WHERE "key" = 'serverboard.server_invite' AND "value" = 'true';`,
    ).map(entry => entry.guildID),
  );

  return Promise.all(
    [...publicGuildSet].map(async (entry: unknown) => {
      if (typeof entry != "string")
        throw new Error(`Somehow '${entry}' was not of type string in listPublicServers.`);

      const inviteChannel = await getSetting(entry, "serverboard", "invite_channel");
      return {
        guildID: entry,
        showInvite: inviteGuildsSet.has(entry),
        inviteChannelId: inviteChannel?.toString(),
      };
    }),
  );
}

export async function deletePublicServer(
  guildID: string,
): Promise<Message | InteractionResponse | undefined> {
  try {
    await db`DELETE FROM settings WHERE "guildID" = ${guildID} AND "key" = 'serverboard.shown' AND "value" = 'true';`;
  } catch (error) {
    return await errorEmbed({
      client,
      error,
      log: true,
      forward: true,
      fileName: "database/settings",
    });
  }
}
