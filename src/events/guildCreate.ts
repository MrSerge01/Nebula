import {
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { commands } from "handlers/commands";
import { colorize, Sokolors } from "utils/colorize";
import { replace } from "utils/replace";
import type { Event } from "utils/types";

export default (async function run(guild) {
  const client = guild.client;
  const user = client.user;
  const banner = user.bannerURL({ size: 512 });
  const container = new ContainerBuilder();
  if (banner)
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(banner)),
    );

  container
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## Welcome to ${client.user.username}!`),
      new TextDisplayBuilder().setContent(
        [
          "Sokora is a multipurpose Discord bot that lets you manage your servers easily.",
          "To configure the bot, use the **/settings** subcommands.",
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "**Sokora is in an early stage of development.**",
          "If you find bugs, please go to our [official server](https://discord.gg/c6C25P4BuY).",
        ].join("\n"),
      ),
      new TextDisplayBuilder().setContent(`-# ${replace("(madeWith)")}`),
    )
    .setAccentColor(
      await colorize({ user, avatar: user.displayAvatarURL(), hue: Sokolors.Purple }),
    );

  await guild.commands.set(commands.map(command => command.data));
  try {
    const welcomeChannel = guild.systemChannel;
    if (!welcomeChannel) return;
    if (!welcomeChannel.permissionsFor(guild.client.user)?.has("SendMessages")) return;
    await welcomeChannel.send({ components: [container], flags: "IsComponentsV2" });
  } catch (error) {
    return await errorEmbed({
      client,
      error,
      log: true,
      forward: true,
      fileName: "guildCreate.ts",
    });
  }
} as Event<"guildCreate">);
