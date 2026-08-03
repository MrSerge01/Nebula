import {
  ContainerBuilder,
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";

export const data = new SlashCommandSubcommandBuilder()
  .setName("import")
  .setDescription("Show help with how to import leveling data from other bots.");

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  const firstContainer = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## The /import command"),
      new TextDisplayBuilder().setContent(
        "You can use the `/import` command to bring your leaderboard from other bots into Sokora.",
      ),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  const botsContainer = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## 📜 • Supported bots"),
      new TextDisplayBuilder().setContent(
        [
          "- 🟢 • Tatsu • [tatsu.gg](https://tatsu.gg)",
          "🔵 • MEE6 • [mee6.xyz](https://mee6.xyz)",
          "🟡 • Lurkr • [lurkr.gg](https://lurkr.gg)",
        ].join("\n- "),
      ),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  const instructContainer = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## 👀 • What you need to do"),
      new TextDisplayBuilder().setContent(
        [
          "Sokora imports data using the bot provider’s API (if any). This requires for both Tatsu and MEE6 **that you make your leaderboard public**, and doesn’t require further configuration. For Lurkr however, this is a bit harder as you need to provide your own API token with read only permissions on your server’s leaderboard. You can do so from Lurkr’s dashboard.\n",
          "With everything provided, all you need to do is to choose between performing a 🟩 **data merge** or a 🟥 **data overwrite**.\n",
          "> 🟩 **Merging will ADD levels on top of Sokora’s existing leaderboard.**",
          "> For example, if member Goos has 200 XP with Sokora and 455 XP with your previous bot, he’d have **655 XP** with Sokora afterwards.\n",
          "> 🟥 **Overwriting will REPLACE levels from Sokora’s existing leaderboard with the imported ones.**",
          "> For example, if member Goos has 200 XP with Sokora and 455 XP with your previous bot, he’d have **455 XP** with Sokora afterwards.",
        ].join("\n"),
      ),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  const expectContainer = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## 🚩 • What to expect from the command"),
      new TextDisplayBuilder().setContent(
        [
          "You’ll be shown an interactive menu, a list of bots to import from with an ’Import’ button. For Lurkr it triggers a modal to input your API key, for other bots it just tries to fetch your server’s leaderboard.",
          "Once ready you’ll have the options to merge, overwrite, or to preview (in a readable-ish JSON format) the data that’ll be imported.",
          "After importing, you’ll be shown the outcome. That’s it!",
        ].join("\n\n"),
      ),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  await interaction.reply({
    components: [firstContainer, botsContainer, instructContainer, expectContainer],
    flags: ["Ephemeral", "IsComponentsV2"],
  });
}
