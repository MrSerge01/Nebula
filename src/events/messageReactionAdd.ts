// [TODO] fix updating

import { getSetting } from "database/settings";
import { getStarred, setStarred } from "database/starboard";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { channelCheck } from "utils/channelCheck";
import { colorize, Sokolors } from "utils/colorize";
import { mention } from "utils/mention";
import { safeChannel } from "utils/safeThings";
import type { Event } from "utils/types";

export default (async function run(reaction, user) {
  const client = user.client;
  if (reaction.partial)
    try {
      await reaction.fetch();
    } catch (error) {
      return await errorEmbed({
        client,
        error,
        title: "Error fetching reaction.",
        log: true,
        forward: true,
        fileName: "messageReactionAdd.ts",
      });
    }

  if (user.partial)
    try {
      await user.fetch();
    } catch (error) {
      await errorEmbed({
        client,
        error,
        title: "Error fetching user.",
        log: true,
        forward: true,
        fileName: "messageReactionAdd.ts",
      });
    }

  const message = await reaction.message.fetch();
  const { guild, author, content, createdAt, url, id, attachments } = message;
  if (!guild) return;

  const starEmoji = ((await getSetting(guild.id, "starboard", "emoji")) as string) || "⭐";
  if (reaction.emoji.name != starEmoji) return;
  if (!(await getSetting(guild.id, "starboard", "enabled"))) return;
  if (!content && attachments.size === 0) return;

  const starboardChannelId = (await getSetting(guild.id, "starboard", "channel")) as string;
  if (!starboardChannelId) return;

  const starboardChannel = await safeChannel(guild, starboardChannelId);
  if (
    !starboardChannel?.isTextBased() ||
    !(await channelCheck({
      channel: starboardChannel,
      guild,
      permType: "Send",
      setting: { category: "starboard", setting: "channel" },
    })) ||
    starboardChannel.isDMBased()
  )
    return;

  let starCount = reaction.count ?? 0;
  const threshold = Number((await getSetting(guild.id, "starboard", "threshold")) as string) || 3;
  if (reaction.users.valueOf().has(user.id)) starCount--;
  if (starCount < threshold) return;

  const existingStarred = await getStarred(guild.id, message.id);
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${author.displayName}  •  ${starCount} ${starEmoji}`),
      new TextDisplayBuilder().setContent(content),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Yellow }));

  const reference = message.reference ? await message.fetchReference() : null;
  const containers = [];
  if (reference)
    containers.push(
      new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**${reference.author.displayName}  •  Replied by starred message**`,
          ),
          new TextDisplayBuilder().setContent(reference.content),
        )
        .addActionRowComponents(
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setLabel("•  Jump to")
              .setURL(reference.url)
              .setEmoji("🔗")
              .setStyle(ButtonStyle.Link),
          ),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `-# ${mention(reference.createdAt.toDateString(), "DEFAULT_TIMESTAMP")}`,
          ),
        )
        .setAccentColor(await colorize({ hue: Sokolors.Blue })),
    );

  const attachment = attachments.first();
  if (attachment?.contentType?.startsWith("image/"))
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(attachment.url)),
    );

  container
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel(`•  Jump to ${reference ? "starred " : ""}`)
          .setURL(url)
          .setEmoji("🔗")
          .setStyle(ButtonStyle.Link),
      ),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# ${mention(createdAt.toDateString(), "DEFAULT_TIMESTAMP")}`,
      ),
    );

  containers.push(container);
  try {
    if (!existingStarred) {
      await setStarred(
        guild.id,
        id,
        message.channel.id,
        author.id,
        (await starboardChannel.send({ components: containers, flags: "IsComponentsV2" })).id,
        starCount,
        content || "",
        new Date(message.createdTimestamp),
      );
      return;
    }

    await (
      await starboardChannel.messages.fetch(existingStarred.message)
    ).edit({ components: containers });
    await setStarred(
      guild.id,
      id,
      existingStarred.channel,
      author.id,
      existingStarred.message,
      starCount,
      content || "",
      new Date(message.createdTimestamp),
    );
  } catch (error) {
    await errorEmbed({
      client,
      error,
      title: "Error handling starboard message.",
      log: true,
      forward: true,
      fileName: "messageReactionAdd.ts",
    });
  }
} as Event<"messageReactionAdd">);
