import { resetSetting } from "database/settings";
import {
  ChannelType,
  ContainerBuilder,
  GuildMFALevel,
  GuildNSFWLevel,
  type GuildPremiumTier,
  GuildVerificationLevel,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type Guild,
  type NewsChannel,
  type StageChannel,
  type TextChannel,
  type VoiceChannel,
  type GuildMember,
} from "discord.js";
import { logChannel } from "utils/logChannel";
import { pagedButtons } from "utils/pagination";
import { safeChannel, safeMember } from "utils/safeThings";
import { colorize, Sokolors } from "../colorize";
import { mention } from "../mention";
import { pluralOrNot } from "../pluralOrNot";

interface Options {
  guild: Guild;
  invite?: {
    show: boolean;
    channel: string | undefined;
  };
  roles?: boolean;
  shouldDisableButtons?: boolean;
  page?: number;
  pages?: number;
}

interface ServerEmbedData {
  inviteChannel: string | undefined | 1;
  boostTier: GuildPremiumTier;
  owner: GuildMember;
  description: string | undefined;
  createdAt: string;
  boostCount: number;
  boosterCount: number;
  safetyLevel: "Unrestricted" | "Low" | "Mid" | "High" | "Very high";
  has2fa: boolean;
  channelCount: number;
  memberCount: number;
  textChannelCount: number;
  voiceChannelCount: number;
  nsfwLevel: "Age restricted" | "Explicit" | "Safe";
  /** [1st 3 role mention list, role len, role len - 3] */
  roles: [string[], number, number];
  iconUrl: string | undefined;
}

/**
 * Returns data for building a server embed. Values are formatted where possible, but prioritize being API-serializable.
 *
 * @param {Options} options
 */
export async function serverEmbedData(options: Options): Promise<ServerEmbedData> {
  const { guild, invite } = options;
  const { premiumTier, premiumSubscriptionCount: boostCount } = guild;
  const boosters = guild.members.cache.filter(member => member.premiumSince);
  const client = guild.client.user.id;
  const owner = await guild.fetchOwner();

  const roles = guild.roles.cache;
  const sortedRoles = [...roles].toSorted((role1, role2) => role2[1].position - role1[1].position);
  sortedRoles.pop();
  const rolesLength = sortedRoles.length;

  const channels = guild.channels.cache;

  const channelSizes = {
    text: channels.filter(
      channel =>
        channel.type == ChannelType.GuildText ||
        channel.type == ChannelType.GuildForum ||
        channel.type == ChannelType.GuildAnnouncement,
    ).size,
    voice: channels.filter(
      channel =>
        channel.type == ChannelType.GuildVoice || channel.type == ChannelType.GuildStageVoice,
    ).size,
  };

  const safetySetupString = {
    [GuildVerificationLevel.None]: "Unrestricted",
    [GuildVerificationLevel.Low]: "Low",
    [GuildVerificationLevel.Medium]: "Mid",
    [GuildVerificationLevel.High]: "High",
    [GuildVerificationLevel.VeryHigh]: "Very high",
  }[guild.verificationLevel];

  let inviteChannel: 1 | string | undefined;

  if (invite?.show) {
    const clientMember = await safeMember(guild, client);
    if (
      !clientMember.permissions.has("CreateInstantInvite") ||
      !clientMember.permissions.has("ManageGuild")
    )
      inviteChannel = 1;
    else {
      const invites = await guild.invites.fetch();
      const previousInvite = invites.find(invite => invite.inviter?.id == client);
      const id =
        invite.channel ??
        guild.channels.cache
          ?.filter(channel => channel.isTextBased() && !channel.isThread())
          ?.find(channel => channel.position == 0)?.id;

      if (id) {
        const possibleInviteChannel = await safeChannel(guild, id);

        const inviteChannelPerSe =
          possibleInviteChannel?.isTextBased() &&
          !possibleInviteChannel.isThread() &&
          !possibleInviteChannel.isDMBased()
            ? possibleInviteChannel
            : guild.rulesChannel;

        if (!inviteChannelPerSe) inviteChannel = undefined;
        else if (inviteChannelPerSe.permissionsFor(client)?.has("CreateInstantInvite"))
          inviteChannel = previousInvite
            ? previousInvite.url
            : (await inviteChannelPerSe.createInvite({ maxAge: 0, reason: "Serverboard invite" }))
                .url;
        else inviteChannel = 1;
      } else inviteChannel = 1;
    }
  }

  return {
    owner,
    createdAt: mention(guild.createdAt.valueOf(), "DEFAULT_TIMESTAMP"),
    iconUrl: guild.iconURL() ?? undefined,
    description: guild.description ?? undefined,
    inviteChannel,
    boostTier: premiumTier,
    safetyLevel: safetySetupString as "Unrestricted",
    nsfwLevel:
      guild.nsfwLevel == GuildNSFWLevel.Explicit
        ? "Explicit"
        : (guild.nsfwLevel == GuildNSFWLevel.Safe
          ? "Safe"
          : "Age restricted"),
    has2fa: guild.mfaLevel == GuildMFALevel.Elevated,
    memberCount: guild.memberCount,
    textChannelCount: channelSizes.text,
    voiceChannelCount: channelSizes.voice,
    boostCount: boostCount ?? 0,
    channelCount: channelSizes.text + channelSizes.voice,
    boosterCount: boosters.size,
    roles: [
      sortedRoles.slice(0, 3).map(role => mention(role[0], "ROLE")),
      rolesLength,
      Math.max(0, rolesLength - 3),
    ],
  };
}

/**
 * Gives you a CONTAINER containing information about the guild.
 * @param options Options of the container.
 * @returns Container that contains the guild info.
 */
export async function serverEmbed(options: Options): Promise<ContainerBuilder> {
  const { page, pages, guild, shouldDisableButtons } = options;
  const {
    channelCount,
    textChannelCount,
    voiceChannelCount,
    createdAt,
    owner,
    iconUrl,
    inviteChannel,
    memberCount,
    has2fa,
    safetyLevel,
    nsfwLevel,
    boostTier,
    boostCount,
    boosterCount,
    roles,
  } = await serverEmbedData(options);

  const generalValues = [
    `Owned by **${owner.user.displayName}**`,
    `Created on **${createdAt}**`,
  ].join("\n");

  const safetyValues: (string | null)[] = [
    `**${safetyLevel}** level`,
    `**${has2fa ? "Has" : "No"}** 2FA`,
  ];

  if (guild.nsfwLevel != GuildNSFWLevel.Default) safetyValues.push(`**${nsfwLevel}**`);

  const statValues: (string | null)[] = [
    `**${memberCount}** members`,
    voiceChannelCount > 0
      ? `**${channelCount}** ${pluralOrNot("channel", channelCount)} • **${textChannelCount}** text and **${voiceChannelCount}** voice`
      : `**${channelCount}** text ${pluralOrNot("channel", channelCount)}`,
  ];

  if (boostTier)
    statValues.push(
      `${boostTier ? `Level **${boostTier}**` : "**No** level"} • **${boostCount}** ${pluralOrNot("boost", boostCount ?? 0)} • **${boosterCount}** ${pluralOrNot("booster", boosterCount)}`,
    );

  if (options.roles)
    statValues.push(
      `**${roles[1]}** ${pluralOrNot("role", roles[1])} • ${
        roles[1] == 0
          ? "*None*"
          : `${roles[0].join(" • ")}${roles[2] > 0 ? ` and **${roles[2]}** more` : ""}`
      }`,
    );

  const container = new ContainerBuilder();
  const start = [
    new TextDisplayBuilder().setContent(
      `## ${page && pages && pages > 1 ? `#${page + 1}  •  ` : ""}${guild.name}`,
    ),
    new TextDisplayBuilder().setContent([generalValues, safetyValues.join(" • ")].join("\n")),
  ];

  if (iconUrl)
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(start)
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl)),
    );
  else container.addTextDisplayComponents(start);

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  if (guild.description)
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`> ${guild.description}`),
    );

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(statValues.join("\n")));

  async function noPerms(
    channel?: NewsChannel | TextChannel | StageChannel | VoiceChannel,
  ): Promise<ContainerBuilder> {
    await resetSetting(guild.id, "serverboard", "server_invite");
    await resetSetting(guild.id, "serverboard", "invite_channel");
    const errorContainer = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## Serverboard is misconfigured in your server!"),
        new TextDisplayBuilder().setContent(
          [
            "⁉️ • What happened",
            [
              "Sokora does not have the **Create Invite** and **Manage Server** permissions to create an invitation, but `serverboard.server_invite` is enabled.",
              `Please give Sokora the permission${channel ? ` for ${channel.name}` : ""} and enable the settings again in **/settings serverboard**.`,
            ].join("\n"),
          ].join("\n"),
        ),
        new TextDisplayBuilder().setContent(`This is coming from ${guild.name} • ID: ${guild.id}`),
      )
      .setAccentColor(await colorize({ hue: Sokolors.Red }));

    await logChannel(guild, { components: [errorContainer], flags: "IsComponentsV2" }, true, {
      isSilent: false,
      user: owner.user,
      options: { components: [container], flags: "IsComponentsV2" },
    });

    return container;
  }

  if (inviteChannel == 1) return await noPerms();

  if (inviteChannel != undefined)
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `This server allows you to join from here! ${inviteChannel}`,
      ),
    );

  if (pages && pages > 1)
    container.addActionRowComponents(pagedButtons(pages, page, shouldDisableButtons));

  container
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Server ID: ${guild.id}`))
    .setAccentColor(await colorize({ avatar: iconUrl, hue: Sokolors.Blue }));

  return container;
}
