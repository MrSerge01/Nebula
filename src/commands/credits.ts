import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ContainerBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { buttonCheck } from "embeds/errorEmbed";
import { colorize, Sokolors } from "utils/colorize";
import { replace } from "utils/replace";
import { safeReply } from "utils/safeThings";

export const data = new SlashCommandBuilder()
  .setName("credits")
  .setDescription("Lists everyone who contributed to Sokora.")
  .setContexts(0);

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  const user = interaction.client.user;
  const madeWithEmoji = replace("(madeWith)");
  let isPastView = false;

  async function construct(pastView: boolean) {
    return new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## Entities involved"),
        new TextDisplayBuilder().setContent(
          pastView
            ? ["# idk man we'll add someone here later lmfaos"].join("\n")
            : [
                "**Founder**: Goos",
                "**Developers**: Froxcey, Golem64, Koslz, Meqr, Nikkerudon, ZakaHaceCosas",
                "**Designers**: Pjanda, trvhz, ZakaHaceCosas",
                "**Social relations**: Spoon",
                "**Translators**: Dimkauzh, flojo, Golem64, GraczNet, Nikkerudon, TrulyBlue, ZakaHaceCosas",
                "**Testers**: Blaze, fishy, Trynera",
              ].join("\n"),
        ),
      )
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("team")
            .setLabel(pastView ? "View the current team" : "View the past team members")
            .setStyle(ButtonStyle.Secondary),
        ),
      )
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${madeWithEmoji}`))
      .setAccentColor(
        await colorize({ user, avatar: user.displayAvatarURL(), hue: Sokolors.Purple }),
      );
  }

  const reply = await interaction.reply({
    components: [await construct(isPastView)],
    flags: ["Ephemeral", "IsComponentsV2"],
  });

  const collector = reply.createMessageComponentCollector({ time: 60_000 });
  collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
    if (await buttonCheck({ i: buttonInteraction, interaction, reply })) return;

    const cID = buttonInteraction.customId;
    if (cID == "please") return;
    if (cID == "team") isPastView = !isPastView;

    await safeReply({
      interaction: buttonInteraction,
      editOptions: { components: [await construct(isPastView)] },
    });
  });

  collector.on("end", async () => {
    try {
      await interaction.deleteReply();
    } catch (error) {
      if (Error.isError(error) && error.message.toLowerCase().includes("unknown message")) return;
      throw error;
    }
  });
}
