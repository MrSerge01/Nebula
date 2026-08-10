import { getSetting } from "database/settings";
import type {
  AnySelectMenuInteraction,
  BaseFetchOptions,
  ButtonInteraction,
  Channel,
  ChatInputCommandInteraction,
  Client,
  Collection,
  DMChannel,
  Guild,
  GuildMember,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  InteractionResponse,
  Message,
  MessagePayload,
  ModalSubmitInteraction,
  NewsChannel,
  Role,
  TextChannel,
  User,
} from "discord.js";

/**
 * Ensures that the channel that you're getting will be gotten.
 * @param option The guild or the client where the channel resides.
 * @param id The ID of the channel.
 * @returns A channel.
 */
export async function safeChannel(option: Guild | Client, id: string): Promise<Channel> {
  const res = option.channels.cache.get(id) ?? (await option.channels.fetch(id));
  if (!res) throw new Error(`Channel ${id} was NOT found.`);
  return res;
}

/**
 * Ensures that the role that you're getting will be gotten.
 * @param guild The guild where the role resides.
 * @param id The ID of the role.
 * @returns A role.
 */
export async function safeRole(guild: Guild, id: string): Promise<Role> {
  const res = guild.roles.cache.get(id) ?? (await guild.roles.fetch(id));
  if (!res) throw new Error(`Role ${id} was NOT found.`);
  return res;
}

/**
 * Ensures that the member that you're getting will be gotten.
 * @param guild The guild where the member resides.
 * @param id The ID of the member.
 * @returns A member.
 */
export async function safeMember(guild: Guild, id: string): Promise<GuildMember> {
  return guild.members.cache.get(id) ?? (await guild.members.fetch(id));
}

export async function safeMembers(guild: Guild): Promise<Collection<string, GuildMember>> {
  return guild.members.cache ?? (await guild.members.fetch());
}

/**
 * Ensures that the user that you're getting will be gotten.
 * @param client The client where the user resides.
 * @param id The ID of the user.
 * @returns A user.
 */
export async function safeUser(
  client: Client,
  id: string,
  force?: BaseFetchOptions,
): Promise<User> {
  return client.users.cache.get(id) ?? (await client.users.fetch(id, force));
}

/**
 * Ensures that the guild that you're getting will be gotten.
 * @param client The client where the guild resides.
 * @param id The ID of the guild.
 * @returns A guild.
 */
export async function safeGuild(client: Client, id: string): Promise<Guild> {
  return client.guilds.cache.get(id) ?? (await client.guilds.fetch(id));
}

/**
 * Properly handles replying/following up to an interaction.
 * @param {{
 *   interaction: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction;
 *   replyOptions?: string | MessagePayload | InteractionReplyOptions;
 *   editOptions?: string | MessagePayload | InteractionEditReplyOptions;
 * }} options Options.
 * @returns {(Promise<Message<boolean> | InteractionResponse<boolean>>)}
 */
export async function safeReply(options: {
  interaction:
    | ChatInputCommandInteraction
    | ButtonInteraction
    | AnySelectMenuInteraction
    | ModalSubmitInteraction;
  replyOptions: string | MessagePayload | InteractionReplyOptions;
}): Promise<Message | InteractionResponse> {
  const { interaction, replyOptions } = options;

  if (interaction.replied || interaction.deferred) return await interaction.followUp(replyOptions);

  if (interaction.isButton() || interaction.isAnySelectMenu())
    return await interaction.reply(replyOptions);

  return await interaction.reply(replyOptions);
}

/**
 * Properly handles editing the response/follow up to an interaction.
 * @param {{
 *   interaction: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction;
 *   replyOptions?: string | MessagePayload | InteractionReplyOptions;
 *   editOptions?: string | MessagePayload | InteractionEditReplyOptions;
 * }} options Options.
 * @returns {(Promise<Message<boolean> | InteractionResponse<boolean>>)}
 */
export async function safeEdit(options: {
  interaction:
    | ChatInputCommandInteraction
    | ButtonInteraction
    | AnySelectMenuInteraction
    | ModalSubmitInteraction;
  editOptions: string | MessagePayload | InteractionEditReplyOptions;
}): Promise<Message | InteractionResponse> {
  const { interaction, editOptions } = options;

  if (interaction.replied || interaction.deferred) return await interaction.editReply(editOptions);

  if (interaction.isButton() || interaction.isAnySelectMenu())
    return await interaction.update(editOptions);

  throw new Error("Should’ve probably used safeReply instead of safeEdit.");
}

/**
 * Finds a channel to send important stuff to. This is only for things like welcome, canary updates or important alerts.
 * It tries, in order: logChannel, guild's system channel, owner's DM and first text channel in guild Sokora can text to as a last resort.
 *
 * If SOMEHOW nowhere is it possible to message, throws an Error.
 *
 * @param guild Guild to find a channel in.
 */
export async function safeAlertChannel(
  guild: Guild,
  shouldDmOwner: true,
): Promise<DMChannel | TextChannel>;
export async function safeAlertChannel(guild: Guild, shouldDmOwner?: false): Promise<TextChannel>;
export async function safeAlertChannel(
  guild: Guild,
  shouldDmOwner?: boolean,
): Promise<DMChannel | NewsChannel | TextChannel> {
  const me = guild.members.me;
  if (!me) throw new Error("how??? this shouldn’t happen…");

  const logChannelId = await getSetting(guild.id, "moderation", "channel");
  const _logChannel = logChannelId ? await guild.channels.fetch(logChannelId) : null;
  const guildChannel = guild.systemChannel;
  const logChannel =
    _logChannel &&
    _logChannel.viewable &&
    _logChannel.isTextBased() &&
    !_logChannel.isThread() &&
    _logChannel.isSendable() &&
    !_logChannel.isVoiceBased()
      ? _logChannel
      : (guildChannel && guildChannel.viewable && guildChannel.isSendable()
        ? guildChannel
        : null);

  const channel: NewsChannel | DMChannel | TextChannel | undefined =
    logChannel ??
    (shouldDmOwner ? await (await guild.fetchOwner()).user.createDM() : null) ??
    guild.channels.cache
      .filter(c => c.isTextBased() && !c.isThread() && c.isSendable() && !c.isVoiceBased())
      .filter(c => c.viewable && c.permissionsFor(me).has("SendMessages"))
      .sort((a, b) => b.position - a.position)
      .last();

  if (!channel)
    throw new Error(
      "the user has done black magic to achieve this, so the bot cannot send anything in this entire server.",
    );

  return channel;
}
