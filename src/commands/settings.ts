import {
  settingsDefinition,
  getSetting,
  setSetting,
  type TS,
  serverSettingsKeys,
} from "database/settings";
import type { SettingKeyFor, SettingReturnType } from "database/types";
import {
  EmbedBuilder,
  type Guild,
  PermissionsBitField,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  type ChatInputCommandInteraction,
  type User,
} from "discord.js";
import { settingsEmbed } from "embeds/settingsEmbed";
import { colorize, Sokolors } from "utils/colorize";
import { dotCheck } from "utils/dotCheck";
import { logChannel } from "utils/logChannel";
import { safeMember } from "utils/safeThings";
import { isInteractionSafe } from "utils/types";

export const data = new SlashCommandBuilder()
  .setName("settings")
  .setDescription("Configure Sokora to your liking.")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  .setContexts(0);

for (const key of serverSettingsKeys)
  data.addSubcommand(
    new SlashCommandSubcommandBuilder()
      .setName(key)
      .setDescription(settingsDefinition[key].description),
  );

async function setSettingPlease<K extends keyof TS, S extends SettingKeyFor<K>>(
  interaction: ChatInputCommandInteraction & { guild: Guild; guildId: string; user: User },
  key: K,
  setting: S,
  value: SettingReturnType<K, S>,
): Promise<void> {
  if ((await getSetting(interaction.guild.id, "moderation", "events"))?.includes("settings")) {
    const member = await safeMember(interaction.guild, interaction.user.id);
    const avatar = member.displayAvatarURL();
    const previousValue = await getSetting(interaction.guild.id, key, setting);
    const embed = new EmbedBuilder()
      .setAuthor({
        name: `${dotCheck({ string: avatar, doubleSpace: true })}${member.user.username} changed ${key}.${setting}`,
        iconURL: avatar,
      })
      .addFields(
        {
          name: "📻 • **Old value**",
          value: previousValue === undefined ? "(unset)" : JSON.stringify(previousValue),
        },
        {
          name: "📱 • **New value**",
          // [TODO]: review, since OBJECT settings need to be shown in a proper format
          value: JSON.stringify(value),
        },
      )
      .setFooter({ text: `User ID: ${member.id}` })
      .setTimestamp(Date.now())
      .setColor(await colorize({ hue: Sokolors.Blue }));

    await logChannel(interaction.guild, { embeds: [embed] });
  }
  await setSetting(interaction.guild.id, key, setting, value);
  return;
}

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isInteractionSafe(interaction))
    throw new Error("Why is guild null if you are setting a server-table setting?");

  const key = interaction.options.getSubcommand() as keyof TS;

  await settingsEmbed(interaction, key, {
    setSettingPlease: async (key, setting, value) => {
      await setSettingPlease(interaction, key, setting, value);
    },
    getSettingPlease: async (key, setting) => {
      return await getSetting(interaction.guild.id, key, setting);
    },
  });
}
