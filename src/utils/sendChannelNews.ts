import { getNews, postNews, updateNews } from "database/news";
import { getSetting } from "database/settings";
import {
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
  type Guild,
  type Role,
  type TextChannel,
} from "discord.js";
import { channelCheck } from "./channelCheck";
import { colorize, Sokolors } from "./colorize";
import { mention } from "./mention";
import { safeChannel, safeRole } from "./safeThings";

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
    authorPFP?: string;
    id: number;
    imageURL?: string | null;
  },
  edit?: boolean,
): Promise<void> {
  const { title, body, author, authorPFP, imageURL, id } = newsOptions;
  const role = (await getSetting(guild.id, "news", "role")) as string;
  const roleToSend: Role | null = role ? await safeRole(guild, role) : null;
  const news = await getNews(guild.id, id);
  const image = edit ? (news?.imageURL ?? null) : (imageURL ?? null);
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Posted by ${author}${roleToSend ? `for ${roleToSend}` : ""}**`,
      ),
      new TextDisplayBuilder().setContent(`## ${title}`),
      new TextDisplayBuilder().setContent(body),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  if (image)
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(image)),
    );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# Latest from ${guild.name} • ID: ${id} • ${mention(edit ? news?.createdAt.valueOf()! : Date.now(), "DEFAULT_TIMESTAMP")}`,
    ),
  );

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

  const message = await channel.send({ components: [container], flags: "IsComponentsV2" });
  if (edit) {
    await updateNews(guild.id, id, title, body, message.id);
    return;
  }
  await postNews(guild.id, title, body, author, authorPFP, message.id, imageURL, id);
}
