import { Api } from "@top-gg/sdk";
import { Chart, registerables } from "chart.js";
import { updateDatabase } from "database/index";
import { getUserSettingsTable, setUserSetting } from "database/userSettings";
import {
  ActivityType,
  Client,
  codeBlock,
  ContainerBuilder,
  Partials,
  TextDisplayBuilder,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import ms from "enhanced-ms";
import { registerGuildCommands } from "handlers/commands";
import { loadEasterEggs, loadEvents } from "handlers/events";
import { colorize, Sokolors } from "utils/colorize";
import { mention } from "utils/mention";
import { safeAlertChannel, safeUser } from "utils/safeThings";
import type { GHCommit } from "utils/types";
import { rescheduleUnbans } from "utils/unbanScheduler";
import { CANARY } from "./canary";

export const client = new Client({
  presence: {
    activities: [{ name: "your feedback!", type: ActivityType.Listening }],
  },
  partials: [Partials.Message, Partials.Reaction, Partials.User],
  intents: [
    "DirectMessages",
    "Guilds",
    "GuildMembers",
    "GuildMessages",
    "GuildModeration",
    "GuildEmojisAndStickers",
    "GuildBans",
    "GuildMessageReactions",
    "MessageContent",
  ],
});

client.once("clientReady", async () => {
  const token = process.env.TOPGG_TOKEN;
  if (token)
    setInterval(async () => {
      const topgg = new Api(token);
      try {
        await topgg.postStats({ serverCount: (await client.guilds.fetch()).size });
        console.log("Posted statistics to top.gg!");
      } catch (error) {
        console.error(`Failed to start top.gg autoposter: ${error}`);
      }

      for (const user of new Set(
        (await getUserSettingsTable("topgg", "remind"))
          ?.filter(index => index.value == "1")
          .map(index => index.userID.replaceAll('"', "")),
      ))
        try {
          if (await topgg.hasVoted(user)) continue;

          const dmChannel = await (await safeUser(client, user)).createDM();
          if (!dmChannel?.isSendable()) continue;

          await dmChannel.send(
            "Reminder that **you can vote for Sokora** on [top.gg](https://top.gg/bot/873918300726394960/vote) - go vote!!",
          );
        } catch (error) {
          await errorEmbed({
            client,
            error,
            title: "top.gg reminding error.",
            log: true,
            forward: true,
            fileName: "bot",
          });
          await setUserSetting(user, "topgg", "remind", false);
        }
    }, ms("6h"));

  await updateDatabase(); // Needs to be executed before anything else (since some things like rescheduleUnbans needs a DB in the first place)
  await Promise.all([
    loadEvents(client),
    loadEasterEggs(),
    registerGuildCommands(client),
    rescheduleUnbans(client),
  ]).then(() => {
    console.log(
      Math.random() < 0.002
        ? "こんにちは! (konichi whats upppppppp)"
        : CANARY
          ? "ちーっす Canary!"
          : "ちーっす！",
    );
  });

  if (CANARY) {
    // 43200000 is 12 h in ms
    const user = client.user;
    const yesterday = new Date(Date.now() - 1_209_600_000);
    const response = await fetch(
      `https://api.github.com/repos/SokoraDesu/Sokora/commits?since=${yesterday.toISOString()}&until=${new Date().toISOString()}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10",
        },
      },
    );
    const log = (await response.json()) as GHCommit[];
    const dump = log
      .map(
        c =>
          `${c.commit.message
            .trim()
            .split("\n")
            .map(s => "+ " + s)
            .join("\n")}\n^ by ${c.commit.author?.name} in \`${c.sha}\`\n`,
      )
      .join("\n");

    await Promise.all(
      client.guilds.cache.values().map(async guild => {
        if (!user) return;
        const textDisplayComponents =
          log.length > 0
            ? [
                new TextDisplayBuilder().setContent("## Sokora Canary pulled updates!"),
                new TextDisplayBuilder().setContent(
                  "Hello! This scheduled restart brought changes. We don't maintain a formal changelog for these quick patches, so here's a developer commit log, messages should be clear enough.",
                ),
                new TextDisplayBuilder().setContent(codeBlock("diff", dump)),
                new TextDisplayBuilder().setContent(
                  [
                    "**Enjoy testing, and thanks for using Sokora Canary!**",
                    `-# By the way, get pinged, ${mention(guild.ownerId, "USER")}!`,
                  ].join("\n"),
                ),
              ]
            : [
                new TextDisplayBuilder().setContent(
                  "## Sokora Canary restarted, though there's nothing new",
                ),
                new TextDisplayBuilder().setContent(
                  [
                    "Hello! This scheduled restart brought no new updates.",
                    "We'll hopefully have something new soon.",
                    "Thanks for using Sokora Canary!",
                  ].join("\n"),
                ),
              ];

        await safeAlertChannel(guild).send({
          components: [
            new ContainerBuilder()
              .addTextDisplayComponents(textDisplayComponents)
              .setAccentColor(
                await colorize({ user, avatar: user.displayAvatarURL(), hue: Sokolors.Green }),
              ),
          ],
          flags: "IsComponentsV2",
        });
      }),
    );
  }

  // if you want to register/remove guild/global commands, replace registerGuildCommands() with:
  // removeGuildCommands(client)
  // removeGlobalCommands(client)
  // registerGlobalCommands(client)
  Chart.register(...registerables);
});

await client.login(process.env.TOKEN);
