import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  codeBlock,
  ContainerBuilder,
  FileBuilder,
  FileUploadBuilder,
  LabelBuilder,
  ModalBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type InteractionResponse,
  type Message,
  type ModalSubmitInteraction,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { mention } from "utils/mention";
import { modalSubmit } from "utils/modalSubmit";
import { safeChannel, safeReply } from "utils/safeThings";
import { errorType } from "../errorType";

/**
 * Sends the embed containing an error.
 * @param interaction The interaction (slash command).
 * @param title The error.
 * @param reason The reason of the error.
 * @param forward Whether or not should the error embed be forwarded to the error log channel.
 * @returns Embed with the error description.
 */
export async function errorEmbed(options: {
  interaction?: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction;
  client?: Client;
  error?: unknown;
  title?: string;
  reason?: string;
  log?: boolean;
  forward?: boolean;
  fileName?: string;
  dmOwner?: boolean;
}): Promise<Message | InteractionResponse | undefined> {
  const { interaction, title, reason, log, forward, fileName, dmOwner } = options;
  const client = options.client ?? interaction?.client;
  if (!client) {
    console.error("You need to provide either a client or an interaction for errorEmbed to work.");
    return;
  }

  const error = errorType(options.error);
  const stack = error.stack;
  const content = [];
  if (title) content.push(`**${title}**`);
  if (reason) content.push(reason);
  if (!title && !reason) {
    content.push(
      "The bot has experienced an internal error.\nPretty please join the support server if you wish to report the issue! https://discord.gg/c6C25P4BuY",
    );

    if (forward)
      content.push(
        "-# Or, if you can...\n## report the issue with the button at the bottom.. pls...",
      );
  }

  function showErrors(container: ContainerBuilder, emojis: boolean) {
    return container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          emojis ? "**💬 • Error message**" : "**error message**",
          `${codeBlock(error.message)}${fileName ? `in \`${fileName}\`` : ""}`,
        ].join("\n"),
      ),
      new TextDisplayBuilder().setContent(
        [
          emojis ? "**📜 • Error stack**" : "**error stack**",
          stack
            ? stack.length <= 4096
              ? codeBlock(stack)
              : "The error stacktrace is an attachment below this embed due to it being too large."
            : "No error stacktrace.",
        ].join("\n"),
      ),
    );
  }

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## Something went wrong!"),
      new TextDisplayBuilder().setContent(content.join("\n")),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Red }));

  const forwardContainer = new ContainerBuilder().setAccentColor(
    await colorize({ hue: Sokolors.Red }),
  );

  if (options.error) {
    container.addSeparatorComponents(new SeparatorBuilder());
    showErrors(container, true);
    showErrors(forwardContainer, false);
  }

  if (interaction)
    forwardContainer
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `**guild ID**: ${interaction.guild.id}`,
            `**user ID**: ${interaction.user.id}`,
            `error sent on **${mention(interaction.createdTimestamp, "DETAILED_TIMESTAMP")}**`,
          ].join("\n"),
        ),
      );

  const files: AttachmentBuilder[] = [];
  if (stack && stack.length >= 4096) {
    files.push(new AttachmentBuilder(Buffer.from(stack, "utf8"), { name: "error.txt" }));
    container.addFileComponents(new FileBuilder().setURL("attachment://error.txt"));
  }

  if (forward) {
    const errorChannel = process.env.ERROR_CHANNEL_ID;
    if (!errorChannel) {
      console.error(error);
      console.log(
        "hey, you don't have ERROR_CHANNEL_ID set in .env and the bot tried to forward an error message to undefined :D",
      );
      return;
    }

    const channel = await safeChannel(client, errorChannel);
    if (!channel?.isTextBased() || !channel.isSendable()) return;
    await channel.send({ components: [forwardContainer], files, flags: "IsComponentsV2" });
  }

  if (dmOwner) {
    const dm = await (await interaction?.guild?.fetchOwner())?.createDM().catch(() => null);
    if (dm) await dm.send({ components: [container], files, flags: "IsComponentsV2" });
  }

  if (log) console.error(error);
  if (interaction) {
    if (forward)
      container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("Report")
            .setStyle(ButtonStyle.Primary)
            .setCustomId("please"),
        ),
      );

    const reply = await safeReply({
      interaction,
      replyOptions: { components: [container], files, flags: ["Ephemeral", "IsComponentsV2"] },
    });

    const collector = reply.createMessageComponentCollector({ time: 240_000 });
    collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
      if (await buttonCheck({ i: buttonInteraction, interaction, reply, noIdMismatchError: true }))
        return;

      collector.resetTimer({ time: 240_000 });
      if (buttonInteraction.customId == "please") {
        const modal = new ModalBuilder()
          .setCustomId("modalpls")
          .setTitle("•  Report the issue pretty please")
          .addLabelComponents(
            new LabelBuilder()
              .setLabel("Mind describing? 😟")
              .setTextInputComponent(
                new TextInputBuilder()
                  .setCustomId("description")
                  .setPlaceholder("Pleasepleasepleasepleasepleasplesae 🥹")
                  .setMaxLength(3900)
                  .setStyle(TextInputStyle.Paragraph)
                  .setRequired(true),
              ),
            new LabelBuilder()
              .setLabel("How????????????????????????")
              .setTextInputComponent(
                new TextInputBuilder()
                  .setCustomId("explanation")
                  .setPlaceholder("Now how the hell did you reproduce the issue..? please say ❤️‍🩹")
                  .setMaxLength(3900)
                  .setStyle(TextInputStyle.Paragraph)
                  .setRequired(false),
              ),
            new LabelBuilder()
              .setLabel("Any screenies? 🥺")
              .setFileUploadComponent(
                new FileUploadBuilder().setCustomId("images").setRequired(false),
              ),
          );

        await buttonInteraction.showModal(modal);
        const modalInteraction = await modalSubmit(buttonInteraction);
        collector.resetTimer({ time: 240_000 });
        if (!modalInteraction) return;

        const modalContainer = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "## Thank you for reporting!.. you've made Goos proud 🥹\nWe'll look into this error and properly thank you in a future patch release 🫶",
            ),
          )
          .setAccentColor(await colorize({ hue: Sokolors.Purple }));

        await safeReply({
          interaction: modalInteraction,
          replyOptions: { components: [modalContainer], flags: ["Ephemeral", "IsComponentsV2"] },
        });

        const reportContainer0 = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              modalInteraction.fields.getTextInputValue("description"),
            ),
            new TextDisplayBuilder().setContent("-# description"),
          )
          .setAccentColor(await colorize({ hue: Sokolors.Green }));

        // [TODO] make images from file upload appear in container 1
        // const images = modalInteraction.fields.getUploadedFiles("images")[1];
        // console.log(modalInteraction.fields.getUploadedFiles("images"));
        // if (images != null)
        //   container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(images));

        const reportContainer1 = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              modalInteraction.fields.getTextInputValue("explanation"),
            ),
            new TextDisplayBuilder().setContent("-# explanation"),
          )
          .setAccentColor(await colorize({ hue: Sokolors.Yellow }));

        const reportChannel = process.env.REPORT_CHANNEL_ID;
        if (!reportChannel) {
          console.error(error);
          console.log(
            "hey, you don't have REPORT_CHANNEL_ID set in .env and someone somehow reported an issue for the bot to send it to undefined :D",
          );
          return;
        }

        const channel = await safeChannel(client, reportChannel);
        if (!channel?.isTextBased() || !channel.isSendable()) return;
        await channel.send({
          components: [reportContainer0, reportContainer1, forwardContainer],
          files,
          flags: "IsComponentsV2",
        });
      }
    });

    collector.on("end", async () => {
      await interaction.deleteReply();
    });
  }
}

export async function buttonCheck(options: {
  i: ButtonInteraction | AnySelectMenuInteraction;
  interaction:
    | ChatInputCommandInteraction
    | ButtonInteraction
    | ModalSubmitInteraction
    | AnySelectMenuInteraction;
  reply: Message | InteractionResponse;
  noExecuteError?: boolean;
  noIdMismatchError?: boolean;
}): Promise<Awaited<ReturnType<typeof errorEmbed>>> {
  const { i, interaction, reply, noExecuteError, noIdMismatchError } = options;
  // [TODO] fix issue where clicking on the report button brings out the error below
  if (!noIdMismatchError && i.message.id != (await reply.fetch()).id)
    return await errorEmbed({
      interaction: i,
      title:
        "For some reason, this click would've caused the bot to error. Thankfully, this message right here prevents that.",
    });

  if (noExecuteError) return;
  if (i.user.id != interaction.user.id)
    return await errorEmbed({
      interaction: i,
      title: "You are not the person who executed this command.",
    });
}
