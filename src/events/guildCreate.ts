import { EmbedBuilder } from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { commands } from "handlers/commands";
import { CANARY } from "src/canary";
import { colorize, Sokolors } from "utils/colorize";
import { dotCheck } from "utils/dotCheck";
import { replace } from "utils/replace";
import { safeAlertChannel } from "utils/safeThings";
import type { Event } from "utils/types";

export default (async function run(guild) {
  const client = guild.client;
  const user = client.user;
  const avatar = user.displayAvatarURL();
  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${dotCheck({ string: avatar, doubleSpace: true })}Welcome to ${client.user.username}!`,
      iconURL: avatar,
    })
    .setDescription(
      CANARY
        ? [
            "## Hey!! You are running **Sokora Canary**!",
            "You probably already know what Sokora is so we'll skip the welcome text.\n",
            "**Note that this bot will sometimes try to ping the server owner without asking.** As a Canary bot, whenever our devs push an update, you get it immediately, and a message with the commit log will be sent to the *first available server channel*, pinging the owner.\n",
            "> By using this bot you get to try features early, which also means you get to find issues before anyone else. The idea is simple: you deliberatedly test the bot in all ways you know and report any bug (or general feedback) you find to us. YOU HELP A LOT BY DOING THIS, THANK YOU SO MUCH!!",
            "Users who successfully report issues will be credited on the next stable release. Thank you again, happy testing!",
          ].join("\n")
        : [
            "Sokora is a multipurpose Discord bot that lets you manage your servers easily.",
            "To configure the bot, use the **/settings** command.\n",
            "Sokora is in an early stage of development. If you find bugs, please go to our [official server](https://discord.gg/c6C25P4BuY).",
          ].join("\n"),
    )
    .setFooter({ text: replace("(madeWith)") })
    .setColor(await colorize({ user, avatar, hue: Sokolors.Blue }));

  await guild.commands.set(commands.map(command => command.data));
  try {
    const welcomeChannel = safeAlertChannel(guild);
    if (!welcomeChannel.permissionsFor(guild.client.user)?.has("SendMessages")) return;
    await welcomeChannel.send({ embeds: [embed] });
  } catch (error) {
    return await errorEmbed({
      client,
      error,
      log: true,
      forward: true,
      fileName: "guildCreate.ts",
    });
  }
} as Event<"guildCreate">);
