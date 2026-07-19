import {
  ContainerBuilder,
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { replaceVariables } from "utils/replace";

export const data = new SlashCommandSubcommandBuilder()
  .setName("variables")
  .setDescription("Show a list of (variables) used to dynamically show data on certain messages.");

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  const user = interaction.user;
  if (!user) return;

  const example = "Welcome to (servername), **(name)**!";
  const exampleTwo =
    "Hi **(username)**! Thanks for joining *(servername)* at (currentdate, simple), **(serverowner)** and the ***(count)*** members are happy to meet you!";

  const exampleThree =
    "Thank you so much to (725985503177867295, user) for making this announcement the (1770053619077, detailed_timestamp). We love you!";

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## Dynamic (variables)"),
      new TextDisplayBuilder().setContent(
        "You can write the following variables in some places to dynamically show certain pieces of data. Data like 'current time' or 'member count' always refer to what that value is at the moment of sending the specific message. Dynamic variables are currently supported for **join messages, leave messages, join DMs, and news.**",
      ),
      new TextDisplayBuilder().setContent(
        [
          "**👀 • Simple example**",
          [
            `A simple example: \`${example}\` will result in:`,
            `> ${await replaceVariables(example, guild, user)}`,
          ].join("\n"),
        ].join("\n"),
      ),
      new TextDisplayBuilder().setContent(
        [
          "**🎛 • Another example**",
          [
            `Adding more stuff:\n\`${exampleTwo}\`\nwill result in:`,
            `> ${await replaceVariables(exampleTwo, guild, user)}`,
          ].join("\n"),
        ].join("\n"),
      ),
      new TextDisplayBuilder().setContent(
        [
          "**🛜 • Dynamic mentioning**",
          [
            `You can use a similar syntax to mention specific users, roles, channels, or timestamps, since Discord disallows this natively:\n\`${exampleThree}\`\nwill result in:`,
            `> ${await replaceVariables(exampleThree, guild, user)}`,
          ].join("\n"),
        ].join("\n"),
      ),
      new TextDisplayBuilder().setContent(
        [
          "**📜 • All variables**",
          [
            "`(name)` - display name of the user who joined",
            "`(username)` - username of the user who joined",
            "`(count)` - member count",
            "`(servername)` - name of this server",
            `\`(serverowner)\` - ${
              user.id == guild.ownerId ? "your name!" : "name of this server's owner"
            }`,
            "`(currentdate)` - current date in the 'July 10, 2025' format",
            "`(currentdate, simple)` - current date in the '7/10/25' format",
            "`(currentdate, detailed)` - current date in the 'July 10, 2025 at 1:11 PM' format",
            "`(<id>, user | role | channel)` - given an ID, allows you to mention/link it (Discord modals don't let you do this natively)",
            "`(<timestamp>, default_timestamp | simple_timestamp | detailed_timestamp)` - given a timestamp, formats it as a date",
          ].join("\n"),
        ].join("\n"),
      ),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  await interaction.reply({ components: [container], flags: ["Ephemeral", "IsComponentsV2"] });
}
