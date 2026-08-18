import { getLatestNews } from "database/news";
import {
  ContainerBuilder,
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type Message,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { colorize, Sokolors } from "utils/colorize";
import { dekominator } from "utils/kominator";
import { modalSubmit } from "utils/modalSubmit";
import { newsModal } from "utils/newsModal";
import { replaceVariables } from "utils/replace";
import { safeMember } from "utils/safeThings";
import { sendChannelNews } from "utils/sendChannelNews";

export const data = new SlashCommandSubcommandBuilder()
  .setName("post")
  .setDescription("Post your news.");

export async function run(
  interaction: ChatInputCommandInteraction,
): Promise<Message | InteractionResponse | undefined> {
  const guild = interaction.guild;
  const userID = interaction.user.id;
  if (!guild || !(await safeMember(guild, userID)).permissions.has("ManageGuild"))
    return await errorEmbed({
      interaction,
      title: "You can’t execute this command.",
      reason: "You need the **Manage Server** permission.",
    });

  try {
    await interaction.showModal(await newsModal(null, guild));
  } catch (error) {
    await errorEmbed({ interaction, error, forward: true, fileName: "post" });
  }

  const modalInteraction = await modalSubmit(interaction);
  if (!modalInteraction) return;

  const title = await replaceVariables(
    modalInteraction.fields.getTextInputValue("title"),
    interaction.guild,
    interaction.user,
  );

  const body = await replaceVariables(
    modalInteraction.fields.getTextInputValue("body"),
    interaction.guild,
    interaction.user,
  );

  try {
    const media = modalInteraction.fields.getUploadedFiles("images");
    await sendChannelNews(guild, interaction, {
      title,
      body,
      author: modalInteraction.user.displayName,
      imageURL: media
        ? dekominator(
            media
              .filter(
                item =>
                  item.contentType &&
                  (item.contentType.startsWith("image/") || item.contentType.startsWith("video/")),
              )
              .map(image => image.url)
              .toReversed(),
          )
        : null,
      id: ((await getLatestNews(guild.id))[0]?.id ?? 0) + 1,
      categoryID: modalInteraction.fields.getStringSelectValues("category")[0],
    });
  } catch (error) {
    return await errorEmbed({ interaction, error, forward: true, fileName: "post" });
  }

  await modalInteraction.reply({
    components: [
      new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## News post created."))
        .setAccentColor(await colorize({ hue: Sokolors.Green })),
    ],
    flags: ["Ephemeral", "IsComponentsV2"],
  });
}
