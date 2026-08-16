import {
  getSetting,
  getSettingCategory,
  getSettingDef,
  resetSetting,
  resetSettingCategory,
  serverSettingsKeys,
  setSetting,
  settingsDefinition,
  type TS,
} from "database/settings";
import {
  type OmitPartialGroupDMChannel,
  type Message,
  ContainerBuilder,
  TextDisplayBuilder,
  codeBlock,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  Webhook,
  SectionBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  AttachmentBuilder,
} from "discord.js";
import { isSettingValueValid, type SettingKeyFor, type SettingSettableValue } from "database/types";
import { logChannel } from "./logChannel";
import { mention, unmention } from "./mention";
import { kominator } from "./kominator";
import { colorize, Sokolors } from "./colorize";
import { safeAlertChannel, safeMember } from "./safeThings";
import { MILLISEC_15M, MILLISEC_30M } from "./constants";
import type { Mention } from "./types";
import { getCase, listUserCases, listGuildCases } from "database/moderation";
import { fetchServerboard } from "database/serverboard";
import { serverEmbedData } from "embeds/serverEmbed";
import { getGuildLeaderboard, getUserXp } from "database/leveling";
import { getLatestNews, getNews } from "database/news";

const InterkoraState = new Map<
  string,
  {
    cmd: ParsedSetter<keyof TS>[];
  }
>();

function getState(id: string): { cmd: ParsedSetter<keyof TS>[] } | undefined {
  return InterkoraState.get(id);
}

function setState(
  id: string,
  op: ParsedSetter<keyof TS>[] | undefined,
): ParsedSetter<keyof TS>[] | undefined {
  if (!op) return op;
  InterkoraState.set(id, { cmd: op });
  setTimeout(() => {
    InterkoraState.delete(id);
  }, MILLISEC_15M);
  return op;
}

const COMMANDS = ["set", "reset", "drop", "get", "query"] as const;
const GETTERS = ["settings", "leaderboard", "starboard", "serverboard", "cases", "news"] as const;
const CLAUSES = ["set-guild", "reset-guild"] as const;

type CmpOperand = ">" | "<" | ">=" | "<=";
type PagingOperand = "-" | "+";
type SupportedRetrievalFormats = "json" | "yaml";
type Optional<T> = T & Record<never, never>;

const isOrder = (o: string): o is (typeof COMMANDS)[number] =>
  typeof o === "string" && COMMANDS.includes(o as "set");
const isGetter = (o: string): o is (typeof GETTERS)[number] =>
  typeof o === "string" && GETTERS.includes(o as "settings");
const isClause = (o: string): o is (typeof CLAUSES)[number] =>
  typeof o === "string" && CLAUSES.includes(o as "set-guild");
const isKey = (k: string): k is keyof TS =>
  typeof k === "string" && serverSettingsKeys.includes(k as "leveling");
const isSubKey = <K extends keyof TS>(k: K, s: string): s is SettingKeyFor<K> =>
  Object.hasOwn(settingsDefinition[k].settings, s);
const isPagingOperand = (o: string): o is PagingOperand => /(-|\+)/.test(o);
const isCmpOperand = (o: string): o is CmpOperand => /(>=|<=|>|<)/.test(o);
const isParsedGetter = (
  o: Omit<ParsedGetter | ParsedQueryOperand | ParsedSetter<keyof TS>, "gid">,
): o is ParsedGetter => o.action.order === "get";
const isParsedQueryOperand = (
  o: Omit<ParsedGetter | ParsedQueryOperand | ParsedSetter<keyof TS>, "gid">,
): o is ParsedQueryOperand => o.action.order === "query";

const cmpOperandMap: Record<CmpOperand, (a: number, b: number) => boolean> = {
  ">": (a, b) => a > b,
  "<": (a, b) => a < b,
  ">=": (a, b) => a >= b,
  "<=": (a, b) => a <= b,
};

const isOpThan = (op: CmpOperand, a: number, b: number): boolean => cmpOperandMap[op](a, b);

const requestors = new Set();

interface ParsedError {
  error: true;
  message: string;
}

interface ParsedSuccess {
  error: false;
  gid: string;
}

interface ParsedGetter extends ParsedSuccess {
  error: false;
  action: {
    order: "get";
    format: SupportedRetrievalFormats;
  } & (
    | ({
        key: "cases";
      } & Optional<
        | {
            specifier: number;
            operand: "+" | "-";
          }
        | {
            specifier: Mention;
            operand: CmpOperand;
          }
      >)
    | {
        key: "settings";
        specifier?: string | undefined;
        operand?: string;
      }
    | {
        key: "starboard";
        specifier?: Mention | number | undefined;
        operand?: string;
      }
    | {
        key: "news";
        specifier?: Mention | number | undefined;
        operand?: string;
      }
    | {
        key: "serverboard";
        specifier?: "." | number | undefined;
        operand?: string;
      }
    | {
        key: "leaderboard";
        specifier?: Mention | number;
        operand?: undefined;
      }
  );
}

interface ParsedSetter<K extends keyof TS> extends ParsedSuccess {
  action:
    | {
        order: "set";
        key: K;
        subKey: SettingKeyFor<K>;
        value: SettingSettableValue;
      }
    | {
        order: "reset";
        key: K;
        subKey: SettingKeyFor<K>;
      }
    | { order: "drop"; key: K };
}

interface ParsedQueryOperand extends ParsedSuccess {
  action:
    | {
        order: "query";
        key: "set-guild";
        specifier: string;
      }
    | {
        order: "query";
        key: "reset-guild";
      };
}

function switchInnerTypes(value: string): SettingSettableValue {
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  if (["true", "false"].includes(value)) return value === "true";
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) return numeric;
  if (value.includes(",")) return kominator(value);
  return value;
}

/*
level 1
foo "bar"

. level 2
foo "bar"
. level 3
foo "baz"
*/

function parseSokoraML(rows: string[]): unknown {
  const isArray = rows.length > 0 && rows[0].startsWith(".");
  const result: Record<string, SettingSettableValue> | Record<string, SettingSettableValue>[] =
    isArray ? [] : {};

  let held: Record<string, SettingSettableValue> = {};

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index].trim();

    if (row.trim() === "") continue;

    const hasDotPrefix = row.startsWith(".");

    if (isArray && hasDotPrefix) {
      if (Object.keys(held).length > 0)
        (result as Record<string, SettingSettableValue>[]).push(held);

      held = {};

      const content = row.slice(1).trim();
      const [key, value] = content.split(" ", 2);

      if (key) held[key] = switchInnerTypes(value ? value.trim() : "true");
    } else {
      const isLastRow = index === rows.length - 1;

      const [key, value] = row.split(" ", 2);

      if (key) held[key] = switchInnerTypes(value ? value.trim() : "true");

      if (!hasDotPrefix && isArray && isLastRow && Object.keys(held).length > 0)
        (result as Record<string, SettingSettableValue>[]).push(held);
    }
  }

  return isArray ? result : held;
}

function loop(
  content: string,
): ParsedError | Omit<ParsedGetter | ParsedSetter<keyof TS> | ParsedQueryOperand, "gid"> {
  const [firstLine, ...restOfLines] = content.split("\n");
  const [order, key, subKey, preValue] = firstLine.trim().split(" ", 4);

  if (!isOrder(order))
    return {
      error: true,
      message: `Order **${order}** is not valid. Choose any of ${COMMANDS.map(s => `\`${s}\``).join(", ")}`,
    };

  if (order === "query") {
    if (!isClause(key))
      return {
        error: true,
        message: `Key **${key}** is not a query clause.`,
      };

    if (key === "set-guild") {
      if (!subKey)
        return {
          error: true,
          message: "You did not provide a guild to set.",
        };

      return {
        error: false,
        action: {
          order: "query",
          key: "set-guild",
          specifier: subKey,
        },
      };
    }

    return {
      error: false,
      action: {
        order: "query",
        key,
      },
    };
  }

  if (order === "get") {
    if (!isGetter(key))
      return {
        error: true,
        message: `Key **${key}** is not a getter.`,
      };

    let specifier: Mention | string | number | undefined;
    let operand: string | undefined;
    if (!subKey || subKey == ".") specifier = undefined;
    else
      switch (key) {
        case "settings": {
          const [settingKey, settingSubKey] = subKey.split(".", 2);

          if (!isKey(settingKey))
            return {
              error: true,
              message: `Setting key **${key}** is not valid. Choose any of ${serverSettingsKeys.map(s => `\`${s}\``).join(", ")}.`,
            };

          if (!settingSubKey) {
            specifier = settingKey;
            break;
          }

          if (!isSubKey(settingKey, settingSubKey))
            return {
              error: true,
              message: `Setting **${subKey}** is not a valid member of ${key}.`,
            };

          specifier = subKey;

          break;
        }
        case "cases": {
          const [actualSubKey, actualOperand] = subKey.split("/", 2);
          const numeric = Number(actualSubKey);
          const mention = unmention(actualSubKey);
          if (!Number.isNaN(numeric)) specifier = numeric;
          else if (mention != null)
            if (mention.type !== "USER" && mention.type !== "TIMESTAMP")
              return {
                error: true,
                message: `Specifier **${actualSubKey}** uses a mention that is of type ${mention.type} and not USER or TIMESTAMP, the ones allowed.`,
              };
            else specifier = mention;

          if (actualOperand)
            if (typeof specifier === "number" || mention?.type === "USER") {
              if (!isPagingOperand(actualOperand))
                return {
                  error: true,
                  message: `Provided operand **${actualOperand}** used incorrectly.`,
                };
            } else if (!isCmpOperand(actualOperand))
              return {
                error: true,
                message: `Provided operand **${actualOperand}** used incorrectly.`,
              };

          operand = actualOperand;

          break;
        }
        case "leaderboard": {
          const numeric = Number(subKey);
          const mention = unmention(subKey);

          if (!Number.isNaN(numeric)) specifier = numeric;
          else if (mention != null)
            if (mention.type === "USER") specifier = mention;
            else
              return {
                error: true,
                message: `Specifier **${subKey}** uses a mention that is of type ${mention.type} and not USER, the one allowed.`,
              };

          break;
        }
        case "starboard": {
          const [actualSubKey, actualOperand] = subKey.split("/", 2);
          const numeric = Number(actualSubKey);
          const mention = unmention(actualSubKey);

          if (!Number.isNaN(numeric)) specifier = numeric;
          else if (mention != null)
            if (mention.type === "USER") specifier = mention;
            else
              return {
                error: true,
                message: `Specifier **${subKey}** uses a mention that is of type ${mention.type} and not USER, the one allowed.`,
              };

          if (actualOperand) {
            if (typeof specifier === "number")
              return {
                error: true,
                message: `Provided operand **${actualOperand}** used incorrectly.`,
              };

            if (!isCmpOperand(actualOperand))
              return {
                error: true,
                message: `Provided operand **${actualOperand}** used incorrectly.`,
              };
          }

          operand = actualOperand;

          break;
        }
        case "news": {
          const [actualSubKey, actualOperand] = subKey.split("/", 2);
          const numeric = Number(actualSubKey);
          const mention = unmention(actualSubKey);

          if (!Number.isNaN(numeric)) specifier = numeric;
          else if (mention != null)
            if (mention.type === "TIMESTAMP") specifier = mention;
            else
              return {
                error: true,
                message: `Specifier **${subKey}** uses a mention that is of type ${mention.type} and not TIMESTAMP, the one allowed.`,
              };

          if (actualOperand) {
            if (typeof specifier === "number")
              return {
                error: true,
                message: `Provided operand **${actualOperand}** used incorrectly.`,
              };

            if (!isCmpOperand(actualOperand))
              return {
                error: true,
                message: `Provided operand **${actualOperand}** used incorrectly.`,
              };
          }

          operand = actualOperand;

          break;
        }
        case "serverboard": {
          const numeric = Number(subKey);

          if (!Number.isNaN(numeric)) specifier = numeric;

          break;
        }
      }

    let format: SupportedRetrievalFormats;
    if (!preValue) format = "json";
    else if (["json", "yaml"].includes(preValue)) format = preValue as SupportedRetrievalFormats;
    else
      return {
        error: true,
        message: `Data format **${preValue}** is not valid.`,
      };

    return {
      error: false,
      action: {
        order,
        key,
        specifier,
        operand,
        format,
        // TODO: this is bad practice
      } as ParsedGetter["action"],
    };
  }

  if (!isKey(key))
    return {
      error: true,
      message: `Setting key **${key}** is not valid. Choose any of ${serverSettingsKeys.map(s => `\`${s}\``).join(", ")}.`,
    };

  if (order === "drop")
    return {
      error: false,
      action: {
        key,
        order,
      },
    };

  if (!isSubKey(key, subKey))
    return {
      error: true,
      message: `Setting **${subKey}** is not a valid member of ${key}.`,
    };

  if (order === "reset")
    return {
      error: false,
      action: { key, subKey, order },
    };

  const def = getSettingDef(key, subKey);

  let value: unknown;

  try {
    value =
      preValue == "\\"
        ? parseSokoraML(restOfLines)
        : (preValue == "\\\\"
          ? JSON.parse(restOfLines[0])
          : switchInnerTypes(preValue));

    if (!isSettingValueValid(value, { key, setting: subKey, def }))
      return {
        error: true,
        message: `Provided value did not fullfil type constraints (${def.type}, ${def.iterable ? "ITERABLE" : "STATIC"}).\nDetected: ${codeBlock("yaml", Bun.YAML.stringify(value))}\nTested against: ${codeBlock("yaml", Bun.YAML.stringify(def, null, 4))}`,
      };
  } catch {
    return {
      error: true,
      message: `Provided value errored when checking for type constraints (${def.type}, ${def.iterable ? "ITERABLE" : "STATIC"}).\nTested against: ${codeBlock("yaml", Bun.YAML.stringify(def, null, 4))}\nPlease report this to the Sokora team together with the command you ran.`,
    };
  }

  return {
    error: false,
    action: {
      subKey,
      key,
      order,
      value,
    },
  };
}

async function execGetter(guildId: string, client: Client, getter: ParsedGetter): Promise<string> {
  const Stringify = getter.action.format === "json" ? JSON.stringify : Bun.YAML.stringify;

  if (getter.action.key === "settings") {
    // TODO: fix this by returning a typed array from the parser directly
    type K = keyof TS;
    if (!getter.action.specifier) throw new Error("No specifier provided.");
    const [k, s] = getter.action.specifier.split(".", 2) as [K, SettingKeyFor<K>];
    return Stringify(s ? await getSetting(guildId, k, s) : await getSettingCategory(guildId, k));
  }

  if (getter.action.key === "cases") {
    const cases = (await listGuildCases(guildId)).toSorted((a, b) => b.id - a.id);

    if (!getter.action.specifier) return Stringify(cases.slice(0, 5));

    if (typeof getter.action.specifier === "number") {
      if (getter.action.operand === "-")
        return Stringify(await getCase(guildId, getter.action.specifier));

      return Stringify(cases.slice(getter.action.specifier, getter.action.specifier + 5));
    }
    if (getter.action.specifier.type === "TIMESTAMP") {
      const comparable = Number(getter.action.specifier.res);
      if (!getter.action.operand)
        throw new Error("No action.operand in " + Bun.YAML.stringify(getter));

      return Stringify(
        cases.filter(c =>
          isOpThan(getter.action.operand as CmpOperand, c.timestamp.valueOf() / 1000, comparable),
        ),
      );
    }

    return Stringify(await listUserCases(guildId, getter.action.specifier.res));
  }

  if (getter.action.key === "serverboard") {
    const board = await fetchServerboard(client);
    console.debug(board.map(b => b.guild.name));

    if (getter.action.operand === ".") {
      const localGuild = board.find(v => v.guild.id == guildId);
      if (!localGuild?.guild) return Stringify({});
      const serverEmbed = await serverEmbedData({ guild: localGuild.guild });
      return Stringify(serverEmbed);
    }

    const requestedGuild = board[((getter.action.specifier as number | undefined) ?? 1) - 1] ?? {};
    if (!requestedGuild?.guild) return Stringify({});
    const serverEmbed = await serverEmbedData({ guild: requestedGuild.guild });
    return Stringify(serverEmbed);
  }

  if (getter.action.key === "leaderboard") {
    if (!getter.action.specifier || typeof getter.action.specifier == "number") {
      const out = await getGuildLeaderboard(guildId);
      const start = (getter.action.specifier ?? 1) - 1;

      return Stringify(out.slice(start, start + 10));
    }

    const xp = await getUserXp(guildId, getter.action.specifier.res);

    // TODO: get user level too
    // which takes me to another task
    // TODO: add more methods that use pure SQL instead of JS-side logic for getting things
    // and maybe TODO: move pagination too from JS slicing to SQL limiting
    return Stringify({
      xp,
    });
  }

  if (getter.action.key === "news") {
    if (!getter.action.specifier || typeof getter.action.specifier === "number") {
      const news =
        typeof getter.action.specifier === "number"
          ? await getNews(guildId, getter.action.specifier)
          : await getLatestNews(guildId);

      return Stringify(news ?? { error: "No news." });
    }

    return Stringify({ error: "Not yet supported. :SOB:" });
  }

  if (getter.action.key === "starboard") return Stringify({ error: "Not implemented." });

  throw new Error("shouldn’t happen (edge case in execGetter)");
}

async function requestInterkora(
  isEnabled: boolean,
  isWhitelisted: boolean,
  memberId: string,
  message: OmitPartialGroupDMChannel<Message>,
  avatar: string | undefined,
): Promise<void> {
  if (!message.guild) return;
  if (!isEnabled) await message.reply("Interkora is not enabled in this guild.");
  else if (isWhitelisted) await message.reply("You’re already whitelisted!");
  else if (requestors.has(memberId))
    await message.reply(
      "You’ve already requested Interkora access. Wait 30 minutes before requesting again.",
    );
  else {
    requestors.add(memberId);
    const channel = await safeAlertChannel(message.guild, true);
    const reason = message.content.replace("s!request", "").trim();
    const requestContainer = new ContainerBuilder();
    const start = [
      new TextDisplayBuilder().setContent(
        `## ${mention(message.author.id, "USER")} wants Interkora access`,
      ),
      new TextDisplayBuilder().setContent(
        [
          `**Requested at**: ${mention(message.createdTimestamp, "DEFAULT_TIMESTAMP")}`,
          `**Sent to**: ${mention(message.channelId, "CHANNEL")} (thereby guild is **${message.guild.name}**)`,
          `**Requester is a**: ${message.author.bot ? "bot" : (message.webhookId ? "webhook" : "human")}`,
          reason == "" ? "Reason wasn’t even provided." : `**Reason is**: ${reason}`,
        ].join("\n"),
      ),
    ];

    if (avatar)
      requestContainer.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(start)
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar)),
      );
    else requestContainer.addTextDisplayComponents(start);

    requestContainer
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `\n✅ Authorize this by typing \`s!whitelist add ${message.author.id}\`, or with the button below.\n❌ Deny this by doing nothing. Note they may request it again.\n\n🛡️ After allowing, deny it if desired by running \`s!whitelist del ${message.author.id}\`.\n\nAll these things can also be done from PSE, access it with \`/settings interkora\`.\nDoes any of this give you doubts? Give \`/help interkora\` a quick read.`,
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`interkora_add:${message.author.id}`)
            .setLabel("Authorize")
            .setStyle(ButtonStyle.Success),
        ),
      )
      .setAccentColor(await colorize({ avatar, hue: Sokolors.Yellow }));

    await channel.send({
      components: [requestContainer],
      flags: ["IsComponentsV2"],
    });
    // TODO: test this
    setTimeout(() => {
      requestors.delete(message.author.id);
    }, MILLISEC_30M);
  }
  return;
}

async function actuallyRunInterkoraSetter<K extends keyof TS>(o: ParsedSetter<K>): Promise<void> {
  switch (o.action.order) {
    case "set": {
      // TODO: ??
      await setSetting(o.gid, o.action.key, o.action.subKey, o.action.value as never);

      break;
    }
    case "reset": {
      await resetSetting(o.gid, o.action.key, o.action.subKey);

      break;
    }
    case "drop": {
      await resetSettingCategory(o.gid, o.action.key);

      break;
    }
    default: {
      throw new Error("Unsupported.");
    }
  }
}

async function runInterkora(uID: string): Promise<void> {
  const state = getState(uID);

  if (!state) return;

  for (const o of state.cmd) await actuallyRunInterkoraSetter(o);

  setState(uID, undefined);

  return;
}

/**
 * Runs Interkora for the given message. Handles permissions, requests and everything.
 *
 * @export
 * @async
 * @param {OmitPartialGroupDMChannel<Message>} message Message sent.
 * @returns {Promise<void>}
 */
export async function interkora(message: OmitPartialGroupDMChannel<Message>): Promise<void> {
  if (!message.guild || !message.guildId) return;
  if (message.partial) await message.fetch();

  const member = message.webhookId
    ? await message.fetchWebhook()
    : await safeMember(message.guild, message.author.id);
  const avatar =
    (member instanceof Webhook ? member.avatarURL() : member.displayAvatarURL()) ?? undefined;
  const memberId = typeof member === "string" ? member : member.id;
  const isEnabled = await getSetting(message.guild.id, "interkora", "enabled");
  const whitelist =
    member instanceof Webhook
      ? await getSetting(message.guild.id, "interkora", "webhook_whitelist")
      : await getSetting(message.guild.id, "interkora", "whitelist");
  const isWhitelisted =
    whitelist.includes(memberId) ||
    memberId === message.guild.ownerId ||
    (member instanceof Webhook ? false : member.permissions.has("Administrator"));

  if (message.content.startsWith("s!request"))
    await requestInterkora(isEnabled, isWhitelisted, memberId, message, avatar);

  if (!isEnabled) {
    await message.reply("Not enabled.");
    return;
  }

  if (!isWhitelisted) {
    await logChannel(message.guild, {
      content: `At ${mention(Date.now(), "DEFAULT_TIMESTAMP")}, unauthorized user/application ${mention(message.author.id, "USER")} attempted to run Interkora commands.`,
    });
    return;
  }

  if (message.content === "s!confirm") {
    try {
      await runInterkora(memberId);
      await message.reply("Done!");
    } catch (error) {
      await message.reply(String(error));
    }
    return;
  }

  let queryGuildId = message.guildId;
  const operations: ParsedSetter<keyof TS>[] = [];
  const retrievals: ParsedGetter[] = [];
  const addOperation = (o: Omit<ParsedSetter<keyof TS>, "gid">): void => {
    operations.push({
      ...o,
      gid: queryGuildId,
    });
  };
  const addRetrieval = (o: Omit<ParsedGetter, "gid">): void => {
    retrievals.push({
      ...o,
      gid: queryGuildId,
    });
  };

  const gidRegex = /gid:\d+/gm;

  for (const _c of message.content.split("s!").slice(1)) {
    const gid = gidRegex.exec(_c);
    const gidParameter = gid?.[0];

    if (gidParameter) queryGuildId = gidParameter;
    const c = gidParameter ? _c.replaceAll(gidRegex, "") : _c;

    const out = loop(c);

    if (out.error) {
      await message.reply(
        `Interkora error\nSeq: Operation "${JSON.stringify(c)}"\nErr: ${out.message}.`,
      );
      return;
    }

    if (isParsedQueryOperand(out)) {
      if (gidParameter) {
        await message.reply("Interkora error\nQuery operand had a GID param for whatever reason.");
        return;
      }
      if (out.action.key === "reset-guild") queryGuildId = message.guildId;
      else {
        const newGuildId: string = out.action.specifier;
        const isItkEnabled = await getSetting(newGuildId, "interkora", "enabled");
        if (!isItkEnabled) {
          await message.reply(
            `Guild ${newGuildId} does not exist OR does not have Interkora enabled.`,
          );
          return;
        }
        queryGuildId = newGuildId;
      }
      continue;
    }

    if (isParsedGetter(out)) addRetrieval(out);
    else addOperation(out as Omit<ParsedSetter<keyof TS>, "gid">);
  }

  if (operations.length > 10 || retrievals.length > 10) {
    await message.reply(
      `Interkora error\nSingle message sequence is too large (exceeds 10 Interkora calls of the same kind message).\nOptimize calls or split into multiple messages.`,
    );
    return;
  }

  const operationOutput: string[] = [];
  const retrievalOutput: AttachmentBuilder[] = [];

  if (retrievals.length > 0)
    for (const [index, v] of retrievals.entries())
      try {
        const outputString = await execGetter(v.gid, message.client, v);
        retrievalOutput.push(
          new AttachmentBuilder(Buffer.from(outputString), {
            name: `${index}.${v.action.format}`,
          }),
        );
      } catch (error) {
        await message.reply(
          `Interkora error\nSeq: Retrieval "${JSON.stringify(v)}"\nErr: ${error}.`,
        );
        return;
      }

  if (operations.length > 0) {
    for (const v of operations) {
      const outputString =
        v.action.order === "drop"
          ? `DROP  "${v.action.key}" -- (*this resets the whole table!*)`
          : (v.action.order === "reset"
            ? `RESET "${v.action.key}.${v.action.subKey}"`
            : `SET   "${v.action.key}.${v.action.subKey}" TO (\n${Bun.YAML.stringify(v.action.value, null, 2)}\n)`);
      operationOutput.push(outputString);
    }

    operationOutput.push("-# Type `s!confirm` to run these.");
  }

  const finalString = operationOutput.join("\n");

  if (finalString.length > 2000) {
    await message.reply(
      `Interkora error\nSingle preview sequence is too large (exceeds 2000 chars, doing **${finalString.length}**).\nOptimize calls or split into multiple, sequential messages.`,
    );
    return;
  }

  if (retrievalOutput.length > 10) {
    await message.reply(
      `Interkora error\nSingle output sequence is too large (exceeds 10 attachments, doing **${retrievalOutput.length}**).\nOptimize calls or split into multiple, sequential messages.`,
    );
    return;
  }

  setState(memberId, operations);

  await message.reply({
    content: finalString,
    files: retrievalOutput,
  });
}

/*
IDEA for compactness
s!set leveling xp_rate \
base 2
multiplier 1.5
cap 1000
*/
