import { listAllNews } from "database/news";
import {
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type Message,
} from "discord.js";
import { buttonCheck, errorEmbed } from "embeds/errorEmbed";
import { colorize, Sokolors } from "utils/colorize";
import { mention } from "utils/mention";
import { handlePages, pagedButtons } from "utils/pagination";
import { safeReply } from "utils/safeThings";

export const data = new SlashCommandSubcommandBuilder()
  .setName("view")
  .setDescription("View the news of this server.")
  .addNumberOption(number =>
    number.setName("page").setDescription("The news post that you want to see."),
  );

export async function run(
  interaction: ChatInputCommandInteraction,
): Promise<Message | InteractionResponse | undefined> {
  if (!interaction.guild)
    return await errorEmbed({
      interaction,
      title: "Error viewing a news post.",
      reason: "This command can only be used in a server.",
    });

  const news = await listAllNews(interaction.guild.id);
  const pages = news.length;
  let page = Math.max(0, Math.min(interaction.options.getNumber("page") ?? 0, pages) - 1);

  if (!news?.length)
    return await errorEmbed({
      interaction,
      title: "No news found.",
      reason: "Admins can post news with the **/news post** command.",
    });

  async function getContainer(disabled: boolean): Promise<ContainerBuilder> {
    const currentNews = news[page];
    const { author, title, body, id, updatedAt, createdAt, imageURL } = currentNews;
    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Posted by ${author}**`),
        new TextDisplayBuilder().setContent(`## ${title}`),
        new TextDisplayBuilder().setContent(body),
      )
      .setAccentColor(await colorize({ hue: Sokolors.Blue }));

    if (imageURL)
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(imageURL)),
      );

    if (pages > 1) container.addActionRowComponents(pagedButtons(pages, page, disabled));

    return container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# ID: ${id} • ${mention(updatedAt?.valueOf() ?? createdAt.valueOf(), "DEFAULT_TIMESTAMP")}`,
      ),
    );
  }

  const reply = await interaction.reply({
    components: [await getContainer(false)],
    flags: "IsComponentsV2",
  });

  if (pages <= 1) return;
  const collector = reply.createMessageComponentCollector({ time: 60_000 });
  collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
    if (await buttonCheck({ i: buttonInteraction, interaction, reply })) return;
    collector.resetTimer({ time: 60_000 });
    if (buttonInteraction.customId == "please") return;

    page = await handlePages({ i: buttonInteraction, page, pages, collector });
    await safeReply({
      interaction: buttonInteraction,
      editOptions: { components: [await getContainer(false)] },
    });
  });

  collector.on("end", async () => {
    try {
      await interaction.editReply({ components: [await getContainer(true)] });
    } catch (error) {
      if (Error.isError(error) && error.message.toLowerCase().includes("unknown message")) return;
      throw error;
    }
  });
}
