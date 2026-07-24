import { getSetting } from "database/settings";
import {
  ContainerBuilder,
  DMChannel,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type TextChannel,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { channelCheck } from "utils/channelCheck";
import { colorize, Sokolors } from "utils/colorize";
import { kominator } from "utils/kominator";
import { replaceVariables } from "utils/replace";
import { safeChannel } from "utils/safeThings";
import type { Event } from "utils/types";

export default (async function run(member) {
  const guild = member.guild;
  const guildID = guild.id;
  const id =
    ((await getSetting(guildID, "welcome", "join_channel")) as string) ??
    ((await getSetting(guildID, "welcome", "leave_channel")) as string);

  if (!id) return;
  const roles = await getSetting(guildID, "welcome", "roles");
  const user = member.user;
  const avatar = user.displayAvatarURL();
  const banner = user.bannerURL({ size: 512 });

  async function welcomeContainer(dm: boolean) {
    const container = new ContainerBuilder();
    if (banner)
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(banner)),
      );

    return container
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${user.displayName} joined`),
            new TextDisplayBuilder().setContent(
              dm
                ? await replaceVariables(
                    (await getSetting(guildID, "welcome", "dm_text")) as string,
                    guild,
                    user,
                  )
                : await replaceVariables(
                    (await getSetting(guildID, "welcome", "join_text")) as string,
                    guild,
                    user,
                  ),
            ),
          )
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar)),
      )
      .setAccentColor(await colorize({ user, avatar, hue: Sokolors.Blue }));
  }

  const channel = (await safeChannel(guild, id)) as TextChannel;
  if (
    await channelCheck({
      guild,
      channel,
      permType: "Send",
      setting: { category: "welcome", setting: "join_channel" },
    })
  ) {
    if (roles && !user.bot) await member.roles.add([...kominator(roles as string)]);
    await channel.send({ components: [await welcomeContainer(false)], flags: "IsComponentsV2" });
  }

  if (!(await getSetting(guildID, "welcome", "join_dm"))) return;
  const dmChannel: DMChannel = await user.createDM().catch(() => null);
  if (!dmChannel || user.bot) return;

  try {
    await dmChannel.send({ components: [await welcomeContainer(true)], flags: "IsComponentsV2" });
  } catch (error) {
    return await errorEmbed({
      client: member.client,
      error,
      log: true,
      forward: true,
      fileName: "guildMemberAdd.ts",
    });
  }
} as Event<"guildMemberAdd">);
