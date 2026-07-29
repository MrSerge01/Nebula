import {
  getSetting,
  setSetting,
  settingsDefinition,
  userSettingsKeys,
  type TS,
} from "database/settings";
import {
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { settingsEmbed } from "embeds/settingsEmbed";
import { isInteractionSafe } from "utils/types";

export const data = new SlashCommandSubcommandGroupBuilder()
  .setName("settings")
  .setDescription("Configure Sokora to your liking.");

for (const key of userSettingsKeys)
  data.addSubcommand(
    new SlashCommandSubcommandBuilder()
      .setName(key)
      .setDescription(settingsDefinition[key].description),
  );

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isInteractionSafe(interaction))
    throw new Error("Why is user null if you are setting a user-table setting?");

  const key = interaction.options.getSubcommand() as keyof TS;

  await settingsEmbed(interaction, key, {
    setSettingPlease: async (key, setting, value) => {
      await setSetting(interaction.user.id, key, setting, value);
    },
    getSettingPlease: async (key, setting) => {
      const value = await getSetting(interaction.user.id, key, setting);
      return value;
    },
  });
}
