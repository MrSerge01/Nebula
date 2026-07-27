import { postNews, updateNews } from "database/news";
import { getSetting } from "database/settings";
import type { ChatInputCommandInteraction, Guild, TextChannel } from "discord.js";
import { newsEmbed } from "embeds/newsEmbed";
import { channelCheck } from "./channelCheck";
import { safeChannel } from "./safeThings";

/**
 * Sends news to a channel.
 * @param {Guild} guild Guild where the channel is in.
 * @param {ChatInputCommandInteraction} interaction Command interaction.
 * @param {object} newsOptions Options to send the news post.
 * @param {?boolean} edit Whether or not should the function make a new message with some reused elements.
 * @returns News message in a channel.
 */
export async function sendChannelNews(
  guild: Guild,
  interaction: ChatInputCommandInteraction,
  newsOptions: {
    title: string;
    body: string;
    author: string;
    id: number;
    imageURL?: string | null;
  },
  edit?: boolean,
): Promise<void> {
  const { title, body, author, id, imageURL } = newsOptions;

  const channel = (await safeChannel(
    guild,
    ((await getSetting(guild.id, "news", "channel")) as string) ?? interaction.channel?.id,
  )) as TextChannel;

  if (
    !(await channelCheck({
      channel,
      guild,
      permType: "View",
      setting: { category: "news", setting: "channel" },
    }))
  )
    return;

  const message = await channel.send({
    components: [await newsEmbed(guild, { title, body, author, id, imageURL })],
    flags: "IsComponentsV2",
  });
  if (edit) {
    await updateNews(guild.id, id, title, body, message.id);
    return;
  }
  await postNews(guild.id, title, body, author, message.id, imageURL, id);
}
