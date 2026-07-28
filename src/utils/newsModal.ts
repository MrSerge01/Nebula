import type { getNews } from "database/news";
import {
  FileUploadBuilder,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

/**
 * Sends a modal that lets you write/edit a news post.
 * @param newsPost Already existing news post. If provided, the modal will be editing said post.
 * @returns News modal.
 */
export function newsModal(newsPost?: Awaited<ReturnType<typeof getNews>>): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(newsPost ? "editnews" : "postnews")
    .setTitle(newsPost ? `•  Edit news post: ${newsPost.title}` : "•  Write your news post")
    .addLabelComponents(
      new LabelBuilder().setLabel("Title").setTextInputComponent(
        new TextInputBuilder()
          .setCustomId("title")
          .setPlaceholder("Think of a title")
          .setMaxLength(100)
          .setStyle(TextInputStyle.Short)
          .setValue(newsPost ? newsPost.title : "")
          .setRequired(true),
      ),
      new LabelBuilder().setLabel("Content (supports Markdown)").setTextInputComponent(
        new TextInputBuilder()
          .setCustomId("body")
          .setPlaceholder("Write your news post here")
          .setMaxLength(3800)
          .setStyle(TextInputStyle.Paragraph)
          .setValue(newsPost ? newsPost.body : "")
          .setRequired(true),
      ),
    );

  if (!newsPost)
    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("Upload a banner image if you want")
        .setFileUploadComponent(
          new FileUploadBuilder().setCustomId("image").setMinValues(0).setRequired(false),
        ),
    );

  return modal;
}
