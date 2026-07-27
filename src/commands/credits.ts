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
  const color = await colorize({ user, avatar: user.displayAvatarURL(), hue: Sokolors.Purple });
  let isPastView = false;

  async function construct(pastView: boolean) {
    return new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `## Entities involved${pastView ? " in the past" : ""}`,
        ),
        new TextDisplayBuilder().setContent(
          pastView
            ? [
                "**Developers**: itsakuro, Kalze, Littie, Mart *(+ translator lead)*, Pigpot, Spectrum, Sungi *(+ translator)*, **ThyTonyStank *(the reason Sokora exists!)***, underscored *(+ tester)*, Zayaan AR",
                "**Designers**: ArtyH, pibayar, proJM, Slider_on_the_black",
                "**Translators**: SaFire",
                "**Testers**: astol",
                "\n> I thank everyone that was in the team and helped shape the project into what it is today. I hope that you'll have a bright future ahead of you.",
                "\\- *Goos*",
                "\n-# If you're on this list and wish to remove/change your name, please contact us via contact@sokora.org",
              ].join("\n")
            : [
                "**Founder**: Goos",
                "**Developers**: Froxcey, Golem64 *(+ translator)*, Meqr, Nikkerudon *(+ translator)*, ZakaHaceCosas *(+ designer, social relations, translator)*",
                "**Designers**: Pjanda, trvhz",
                "**Social relations**: Spoon",
                "**Translators**: Dimkauzh, GraczNet, TrulyBlue",
                "**Testers**: Blaze, fishy, flojo, Trynera",
                "\n> I'm grateful for everyone's presence in the Sokora team. With every contribution and every idea, you help Sokora improve to one day be one of the best bots out there. Thank you.",
                "\\- *Goos*",
              ].join("\n"),
        ),
      )
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("team")
            .setLabel(pastView ? "View the current team" : "View past team members")
            .setStyle(ButtonStyle.Secondary),
        ),
      )
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${madeWithEmoji}`))
      .setAccentColor(color);
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
