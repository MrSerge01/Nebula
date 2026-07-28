import { getNews } from "database/news";
import { getSetting } from "database/settings";
import {
  ContainerBuilder,
  type Guild,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
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
  willEdit?: boolean,
): Promise<ContainerBuilder> {
  const { title, body, author, id, imageURL } = newsOptions;
  const roles = await getSetting(guild.id, "news", "role");
  const rolesToSend: string[] = roles
    ? await Promise.all(roles.map(async role => mention((await safeRole(guild, role)).id, "ROLE")))
    : [];

  const news = await getNews(guild.id, id);
  const image = willEdit ? news?.imageURL : imageURL;
  const timestamp = willEdit ? news?.createdAt.valueOf() : Date.now();
  // [TODO] fix typing so we don't need this assertion; when willEdit is true news should not be null
  if (!timestamp) throw new Error("this should never happen");
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Posted by ${author}${rolesToSend ? ` for ${rolesToSend.join(" ")}` : ""}**`,
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
      `-# Latest from ${guild.name} • ID: ${id} • ${mention(timestamp, "DEFAULT_TIMESTAMP")}`,
    ),
  );

  return container;
}
