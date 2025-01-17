import {
  SlashCommandSubcommandBuilder, EmbedBuilder, PermissionsBitField,
  TextChannel, DMChannel, ChannelType,
  type Channel, type ChatInputCommandInteraction
} from "discord.js";
import { genColor } from "../../utils/colorGen.js";
import { errorEmbed } from "../../utils/embeds/errorEmbed.js";
import { QuickDB } from "quick.db";
import { getModerationTable, getSettingsTable } from "../../utils/database.js";

export default class Warn {
  data: SlashCommandSubcommandBuilder;
  db: QuickDB<any>;

  constructor(db: QuickDB<any>) {
    this.db = db;
    this.data = new SlashCommandSubcommandBuilder()
      .setName("warn")
      .setDescription("Warns a user.")
      .addUserOption(user => user
        .setName("user")
        .setDescription("The user that you want to warn.")
        .setRequired(true)
      )
      .addStringOption(string => string
        .setName("reason")
        .setDescription("The reason for the warn.")
      );
  }

  async run(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser("user");
    const members = interaction.guild.members.cache;
    const member = members.get(interaction.member.user.id);
    const selectedMember = members.get(user.id);
    const name = selectedMember.nickname ?? user.username;

    if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return await interaction.followUp({
      embeds: [errorEmbed("You need the **Moderate Members** permission to execute this command.")]
    });

    if (selectedMember === member) return await interaction.followUp({ embeds: [errorEmbed("You can't warn yourself.")] });

    if (!selectedMember.manageable) return await interaction.followUp({
      embeds: [errorEmbed(`You can't warn ${name}, because they have a higher role position than Nebula.`)]
    });

    if (member.roles.highest.position < selectedMember.roles.highest.position) return await interaction.followUp({
      embeds: [errorEmbed(`You can't warn ${name}, because they have a higher role position than you.`)]
    });

    const newWarn = {
      id: Date.now(),
      userId: user.id,
      moderator: member.id,
      reason: interaction.options.getString("reason") ?? "No reason provided"
    };

    const embed = new EmbedBuilder()
      .setAuthor({ name: `• ${user.username}`, iconURL: user.displayAvatarURL() })
      .setTitle(`✅ • Warned ${user.username}`)
      .setDescription([
        `**Moderator**: <@${member.id}>`,
        `**Reason**: ${interaction.options.getString("reason") ?? "No reason provided"}`
      ].join("\n"))
      .setThumbnail(user.displayAvatarURL())
      .setFooter({ text: `User ID: ${user.id}` })
      .setColor(genColor(100));

    const embedDM = new EmbedBuilder()
      .setAuthor({ name: `• ${user.username}`, iconURL: user.displayAvatarURL() })
      .setTitle("⚠️ • You were warned")
      .setDescription([
        `**Moderator**: <@${member.id}>`,
        `**Reason**: ${interaction.options.getString("reason") ?? "No reason provided"}`
      ].join("\n"))
      .setThumbnail(user.displayAvatarURL())
      .setFooter({ text: `User ID: ${user.id}` })
      .setColor(genColor(100));

    const logChannel = await (await getSettingsTable(this.db))
      ?.get(`${interaction.guild.id}.logChannel`)
      .then((channel: string | null) => channel)
      .catch(() => null);

    if (logChannel) {
      const channel = await interaction.guild.channels.cache
        .get(logChannel)
        .fetch()
        .then((channel: Channel) => {
          if (channel.type != ChannelType.GuildText) return null;
          return channel as TextChannel;
        }).catch(() => null);

      if (channel) await channel.send({ embeds: [embed] });
    }

    const dmChannel = (await user.createDM().catch(() => null)) as DMChannel | null;
    if (dmChannel) await dmChannel.send({ embeds: [embedDM] });
    await (await getModerationTable(this.db))?.push(`${interaction.guild.id}.${user.id}.warns`, newWarn);
    await interaction.followUp({ embeds: [embed] });
  }
}
