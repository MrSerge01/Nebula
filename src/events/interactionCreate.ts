import { SlashCommandSubcommandBuilder } from "discord.js";
import { commands, subCommands } from "handlers/commands";
import { noErrorsPlease } from "utils/noErrorsPlease";
import type { Event } from "utils/types";

export default (async function run(interaction) {
  if (!interaction.isChatInputCommand() || !interaction.guild) return;

  const subCommand = subCommands.find(subCommand =>
    subCommand.data instanceof SlashCommandSubcommandBuilder
      ? subCommand.data.name == interaction.options.getSubcommand(false)
      : subCommand.data.name == interaction.options.getSubcommandGroup(false),
  );

  const command =
    subCommand ?? commands.find(command => command.data.name == interaction.commandName);

  if (!command) return;
  await noErrorsPlease(interaction, command.data.name);
  await command.run(interaction);
} as Event<"interactionCreate">);
