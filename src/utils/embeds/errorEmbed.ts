import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  codeBlock,
  ContainerBuilder,
  FileBuilder,
  FileUploadBuilder,
  LabelBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ModalBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  type AnySelectMenuInteraction,
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

  function addContent(fwdContainer: boolean): string {
    const content = [];
    if (title) content.push(`**${title}**`);
    if (reason) content.push(reason);
    if (!fwdContainer && !title && !reason) {
      content.push(
        "The bot has experienced an internal error.\nPretty please join the support server if you wish to report the issue! https://discord.gg/c6C25P4BuY",
      );

      if (forward)
        content.push(
          "-# Or, if you can…\n## report the issue with the button at the bottom… please…",
        );
    }

    return content.join("\n");
  }

  function showErrors(container: ContainerBuilder, emojis: boolean): ContainerBuilder {
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
            ? (stack.length <= 4096
              ? codeBlock(stack)
              : "The error stacktrace is an attachment below this embed due to it being too large.")
            : "No error stacktrace.",
        ].join("\n"),
      ),
    );
  }

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## Something went wrong!"),
      new TextDisplayBuilder().setContent(addContent(false)),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Red }));

  const forwardContainer = new ContainerBuilder().setAccentColor(
    await colorize({ hue: Sokolors.Red }),
  );

  if (addContent(true))
    forwardContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(addContent(true)),
    );

  if (options.error) {
    container.addSeparatorComponents(new SeparatorBuilder());
    showErrors(container, true);
    showErrors(forwardContainer, false);
  }

  if (interaction?.guild)
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
      if (buttonInteraction.customId != "please") {
        collector.stop();
        return;
      }
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
                .setPlaceholder("Now how the hell did you reproduce the issue…? please say ❤️‍🩹")
                .setMaxLength(3900)
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false),
            ),
          new LabelBuilder()
            .setLabel("Any screenies? (or videos) 🥺")
            .setFileUploadComponent(
              new FileUploadBuilder().setCustomId("images").setMaxValues(10).setRequired(false),
            ),
        );

      await buttonInteraction.showModal(modal);
      const modalInteraction = await modalSubmit(buttonInteraction);
      collector.resetTimer({ time: 240_000 });
      if (!modalInteraction) {
        collector.stop();
        return;
      }

      const modalContainer = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "## Thank you for reporting! You've made Goos proud 🥹\nWe'll look into this error and properly thank you in a future patch release 🫶",
          ),
        )
        .setAccentColor(await colorize({ hue: Sokolors.Purple }));

      await safeReply({
        interaction: modalInteraction,
        replyOptions: { components: [modalContainer], flags: ["Ephemeral", "IsComponentsV2"] },
      });

      const descriptionContainer = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            modalInteraction.fields.getTextInputValue("description"),
          ),
        )
        .setAccentColor(await colorize({ hue: Sokolors.Green }));

      const media = modalInteraction.fields.getUploadedFiles("images");
      if (media) {
        const actualMediaGallery = media
          .filter(
            item =>
              item.contentType == "image/jpeg" ||
              item.contentType == "image/png" ||
              item.contentType == "video/mp4",
          )
          .map(image => new MediaGalleryItemBuilder().setURL(image.url))
          .toReversed();

        if (actualMediaGallery)
          descriptionContainer.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(actualMediaGallery),
          );
      }

      descriptionContainer.addTextDisplayComponents(
        new TextDisplayBuilder().setContent("-# description"),
      );

      const explanationContainer = new ContainerBuilder()
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
        collector.stop();
        return;
      }

      const channel = await safeChannel(client, reportChannel);
      if (!channel?.isTextBased() || !channel.isSendable()) {
        collector.stop();
        return;
      }
      await channel.send({
        components: [descriptionContainer, explanationContainer, forwardContainer],
        files,
        flags: "IsComponentsV2",
      });
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
}): Promise<Awaited<ReturnType<typeof errorEmbed>>> {
  const { i, interaction, reply, noExecuteError } = options;

  if (i.customId == "please") return;
  if (i.message.id != (await reply.fetch()).id)
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
