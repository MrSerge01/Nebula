import { getNews } from "database/news";
import { getSetting } from "database/settings";
import {
  ActionRowBuilder,
  ContainerBuilder,
  type Guild,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { dekominator, kominator } from "utils/kominator";
import { mention } from "utils/mention";
import { pagedButtons } from "utils/pagination";
import { safeRole } from "utils/safeThings";

export async function newsEmbed(
  guild: Guild,
  newsOptions: {
    title: string;
    body: string;
    author: string;
    id: number;
    imageURL?: string | null;
    categoryRoles?: string[];
  },
  willEdit?: boolean,
  viewOptions?: {
    pages: number;
    page: number;
    isDisabled: boolean;
    willShowCategories: boolean;
  },
): Promise<ContainerBuilder> {
  const { title, body, author, id, imageURL, categoryRoles } = newsOptions;
  const roles = categoryRoles ?? (await getSetting(guild.id, "news", "role"));
  const rolesToSend: string[] = roles
    ? await Promise.all(roles.map(async role => mention((await safeRole(guild, role)).id, "ROLE")))
    : [];

  const news = await getNews(guild.id, id);
  const media = willEdit ? news?.imageURL : imageURL;
  const timestamp = willEdit ? news?.createdAt.valueOf() : Date.now();
  if (!timestamp) throw new Error("this should never happen");

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Posted by ${author}${rolesToSend.length === 0 ? "" : ` for ${dekominator(rolesToSend, true)}`}**`,
      ),
      new TextDisplayBuilder().setContent(`## ${title}`),
      new TextDisplayBuilder().setContent(body),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  if (media)
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        kominator(media).map(file => new MediaGalleryItemBuilder().setURL(file)),
      ),
    );

  if (viewOptions && viewOptions.pages > 1)
    container.addActionRowComponents(
      pagedButtons(viewOptions.pages, viewOptions.page, viewOptions.isDisabled),
    );

  // [TODO] make this worky
  if (viewOptions?.willShowCategories) {
    const categories = await getSetting(guild.id, "news", "categories");
    if (categories.length > 0)
      container.addActionRowComponents(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("category")
            .setPlaceholder("Select a category")
            .addOptions([
              ...categories.map(category =>
                new StringSelectMenuOptionBuilder()
                  .setLabel(category.name)
                  .setDescription(category.$)
                  .setValue(category.$),
              ),
              new StringSelectMenuOptionBuilder().setLabel("None").setValue("none"),
            ])
            .setDisabled(viewOptions.isDisabled),
        ),
      );
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# ${viewOptions ? "" : `Latest from ${guild.name} • `}ID: ${id} • ${mention(timestamp, "DEFAULT_TIMESTAMP")}`,
    ),
  );

  return container;
}
