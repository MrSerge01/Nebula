import type { Client, Guild, InteractionResponse, Message } from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { client } from "src/bot";
import { values, db } from ".";
import { getSetting } from "./settings";
import { safeGuild } from "utils/safeThings";

export interface ServerboardEntry {
  guild: Guild;
  showInvite: boolean;
  inviteChannelId: string | undefined;
}

async function listPublicServers(): Promise<
  {
    guildID: string;
    showInvite: boolean;
    inviteChannelId: string | undefined;
  }[]
> {
  const publicGuildSet = new Set(
    values(
      await db`SELECT * FROM settings WHERE "key" = ${"serverboard.shown"} AND "value" = ${"true"};`,
    ).map(entry => entry.guildID),
  );

  const inviteGuildsSet = new Set(
    values(
      await db`SELECT * FROM settings WHERE "key" = ${"serverboard.server_invite"} AND "value" = ${"true"};`,
    ).map(entry => entry.guildID),
  );

  return Promise.all(
    [...publicGuildSet].map(async (entry: unknown) => {
      if (typeof entry != "string")
        throw new Error(`Somehow ’${entry}’ was not of type string in listPublicServers.`);

      const inviteChannel = await getSetting(entry, "serverboard", "invite_channel");
      return {
        guildID: entry,
        showInvite: inviteGuildsSet.has(entry),
        inviteChannelId: inviteChannel?.toString(),
      };
    }),
  );
}

async function deletePublicServer(
  guildID: string,
): Promise<Message | InteractionResponse | undefined> {
  try {
    await db`DELETE FROM settings WHERE "guildID" = ${guildID} AND "key" = ${"serverboard.shown"} AND "value" = ${"true"};`;
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

/**
 * Fetches the whole serverboard for you
 * @param {Client} client Bot client.
 * @returns {ServerboardEntry[]} Sorted array of entries.
 */
export async function fetchServerboard(client: Client): Promise<ServerboardEntry[]> {
  const returnValue = await Promise.all(
    (await listPublicServers()).map(async entry => {
      try {
        return {
          guild: await safeGuild(client, entry.guildID),
          showInvite: entry.showInvite,
          inviteChannelId: entry.inviteChannelId,
        };
      } catch (error) {
        if (String(error).toLowerCase().includes("unknown guild")) {
          await deletePublicServer(entry.guildID);
          return null;
        }
        throw error;
      }
    }),
  );

  return returnValue
    .filter(entry => entry != null)
    .toSorted((a, b) => b.guild.memberCount - a.guild.memberCount);
}
