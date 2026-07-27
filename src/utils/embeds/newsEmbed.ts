import { getNews } from "database/news";
import { getSetting } from "database/settings";
import {
  ContainerBuilder,
  Guild,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  Role,
  TextDisplayBuilder,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { mention } from "utils/mention";
import { safeRole } from "utils/safeThings";

export async function newsEmbed(
  guild: Guild,
  newsOptions: {
    title: string;
    body: string;
    author: string;
    id: number;
    imageURL?: string | null;
  },
  edit?: boolean,
) {
  const { title, body, author, id, imageURL } = newsOptions;
  const role = (await getSetting(guild.id, "news", "role")) as string;
  const roleToSend: Role | null = role ? await safeRole(guild, role) : null;
  const news = await getNews(guild.id, id);
  const image = edit ? news?.imageURL : imageURL;
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Posted by ${author}${roleToSend ? ` for ${roleToSend}` : ""}**`,
      ),
      new TextDisplayBuilder().setContent(`## ${title}`),
      new TextDisplayBuilder().setContent(body),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  if (image)
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(image)),
    );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# Latest from ${guild.name} • ID: ${id} • ${mention(edit ? news?.createdAt.valueOf()! : Date.now(), "DEFAULT_TIMESTAMP")}`,
    ),
  );

  return container;
}
