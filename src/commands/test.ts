import {
  codeBlock,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SlashCommandBuilder,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { isInteractionSafe } from "utils/types";

export const data = new SlashCommandBuilder()
  .setName("test")
  .setDescription("Run the Sokora test suite.")
  .setContexts(0);

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isInteractionSafe(interaction)) return;

  await interaction.deferReply();

  const output = (await Bun.$`bun test`.nothrow()).stderr.toString();

  await interaction.editReply({
    components: [
      new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("# test suite\n" + codeBlock("bash", output)),
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("-# running on `bun:test` " + Bun.version_with_sha),
        )
        .setAccentColor(await colorize({ hue: Sokolors.Yellow })),
    ],
    flags: "IsComponentsV2",
  });
}
