import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type Message,
} from "discord.js";
import { buttonCheck, errorEmbed } from "embeds/errorEmbed";
import { colorize, Sokolors } from "utils/colorize";
import { COLLECTOR_DURATION } from "utils/constants";
import { randomize } from "utils/randomize";

type RPSChoice = "rock" | "paper" | "scissors";
const rpsChoices: RPSChoice[] = ["rock", "paper", "scissors"];
const rpsEmojis: Record<RPSChoice, string> = {
  rock: "🪨",
  paper: "📄",
  scissors: "✂️",
};

export const data = new SlashCommandSubcommandBuilder()
  .setName("rps")
  .setDescription("Play rock paper scissors.")
  .addUserOption(option => option.setName("opponent").setDescription("The user to play against."));

function getWinner(choice1: RPSChoice, choice2: RPSChoice): 0 | 1 | 2 {
  if (choice1 == choice2) return 0;
  if (
    (choice1 == "rock" && choice2 == "scissors") ||
    (choice1 == "paper" && choice2 == "rock") ||
    (choice1 == "scissors" && choice2 == "paper")
  )
    return 1;

  return 2;
}

export async function run(
  interaction: ChatInputCommandInteraction,
): Promise<Message | InteractionResponse | undefined> {
  let opponent = interaction.options.getUser("opponent");
  opponent ??= interaction.client.user;
  const user = interaction.user;
  const baseContainer = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## An invitation to play!"),
      new TextDisplayBuilder().setContent(
        opponent.bot
          ? "**Choose your weapon!**"
          : `**${user.displayName}** has challenged **${opponent.displayName}** to a game!\n**Both players, make your choice!**`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...rpsChoices.map((choice: RPSChoice) =>
          new ButtonBuilder()
            .setCustomId(`rps_${choice}`)
            .setEmoji(rpsEmojis[choice])
            .setStyle(ButtonStyle.Primary),
        ),
      ),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  if (opponent.id == user.id)
    return await errorEmbed({
      interaction,
      title: "Invalid opponent.",
      reason: "You cannot play against yourself.",
    });

  const reply = await interaction.reply({ components: [baseContainer], flags: "IsComponentsV2" });
  const playerChoices = new Map<string, RPSChoice>();
  const collector = reply.createMessageComponentCollector({ time: COLLECTOR_DURATION });

  collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
    if (!reply) return;
    if (await buttonCheck({ i: buttonInteraction, interaction, reply, noExecuteError: true }))
      return;

    const cID = buttonInteraction.customId;
    if (cID == "please") return;

    if (buttonInteraction.user.id != opponent.id && buttonInteraction.user.id != user.id)
      return await errorEmbed({
        interaction: buttonInteraction,
        title: "You aren’t participating.",
      });

    playerChoices.set(buttonInteraction.user.id, cID.split("_", 2)[1] as RPSChoice);
    if (opponent.bot) collector.stop("game-complete");
    else {
      await buttonInteraction.reply({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Choice recorded!"))
            .setAccentColor(await colorize({ hue: Sokolors.Green })),
        ],
        flags: ["Ephemeral", "IsComponentsV2"],
      });
      if (playerChoices.size == 2) collector.stop("game-complete");
    }
  });

  collector.on("end", async (_, reason) => {
    try {
      if (reason == "time")
        return await interaction.editReply({
          components: [
            new ContainerBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("## Game timed out"),
                new TextDisplayBuilder().setContent(
                  "The game has been canceled due to inactivity.",
                ),
              )
              .setAccentColor(await colorize({ hue: Sokolors.Red })),
          ],
        });

      const p1Choice = playerChoices.get(user.id);
      const p2Choice = opponent.bot ? randomize(rpsChoices) : playerChoices.get(opponent.id);
      if (!p1Choice || !p2Choice) return;

      const winner = getWinner(p1Choice, p2Choice);
      const resultContainer = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("## Game results"),
          new TextDisplayBuilder().setContent(
            [
              `**${user.displayName}** ${rpsEmojis[p1Choice]} vs ${rpsEmojis[p2Choice]} **${opponent.displayName}**\n`,
              {
                0: "## **It’s a tie!**",
                1: `## **${user.displayName}**, you win!`,
                2: opponent.bot
                  ? `## **Sokora** wins!`
                  : `## **${opponent.displayName}**, you win!`,
              }[winner],
            ].join("\n"),
          ),
        )
        .setAccentColor(
          await colorize({
            hue:
              winner == 0
                ? Sokolors.Blue
                : (winner == 2 && opponent.bot
                  ? Sokolors.Red
                  : Sokolors.Green),
          }),
        );

      await interaction.editReply({ components: [resultContainer] });
    } catch (error) {
      if (Error.isError(error) && error.message.toLowerCase().includes("unknown message")) return;
      throw error;
    }
  });
}
