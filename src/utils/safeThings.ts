import {
  ChannelType,
  type AnySelectMenuInteraction,
  type BaseFetchOptions,
  type ButtonInteraction,
  type Channel,
  type ChatInputCommandInteraction,
  type Client,
  type Collection,
  type Guild,
  type GuildMember,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  type InteractionResponse,
  type InteractionUpdateOptions,
  type Message,
  type MessagePayload,
  type ModalSubmitInteraction,
  type Role,
  type TextChannel,
  type User,
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
  replyOptions?: string | MessagePayload | InteractionReplyOptions;
  editOptions?: string | MessagePayload | InteractionEditReplyOptions;
}): Promise<Message | InteractionResponse | undefined> {
  const { interaction, replyOptions, editOptions } = options;

  if (interaction.replied || interaction.deferred) {
    if (editOptions) return await interaction.editReply(editOptions);
    if (replyOptions) return await interaction.followUp(replyOptions);
  }

  if (interaction.isButton() || interaction.isAnySelectMenu()) {
    if (editOptions)
      return await interaction.update((replyOptions ?? editOptions) as InteractionUpdateOptions);

    if (replyOptions) return await interaction.reply(replyOptions);
  }

  if (replyOptions) return await interaction.reply(replyOptions);
}

/**
 * Finds a channel to send important stuff to. **This should be used as a fallback,** i.e. prioritize log channel. This is only for things like welcome, canary updates, or important alerts when the server owner is not DM-able.
 * It does not check for logChannel, whether this should change will be checked.
 * @param guild Guild to find a channel in.
 */
export function safeAlertChannel(guild: Guild): TextChannel | undefined {
  return (
    guild.systemChannel ??
    guild.channels.cache
      .filter(c => c.type === ChannelType.GuildText)
      .filter(c => c.permissionsFor(guild.members.me).has("SendMessages"))
      .sort((a, b) => a.position - b.position)
      .first()
  );
}
