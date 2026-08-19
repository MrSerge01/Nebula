import type { Guild, Message, OmitPartialGroupDMChannel, User } from "discord.js";
import { as } from "utils/types";

export const mockGuild = as<Guild>({
  memberCount: 12 ** 2,
  id: process.env.DEVELOPMENT_GUILD_ID,
  name: "Kosora",
  ownerId: "725985503177867295",
  members: {
    cache: {
      get: () => {
        return mockUser();
      },
    },
  },
});

interface MockUserConfig {
  admin: boolean;
}

export function mockUser(_config?: MockUserConfig): User {
  const config: MockUserConfig = _config ?? {
    admin: false,
  };

  return as<User>({
    displayName: "John Sokora",
    username: "mrserge01",
    id: process.env.OWNER,
    displayAvatarURL: () =>
      "https://kde.org/stuff/clipart/logo/kde-logo-white-gray-rounded-128x128.png",
    permissions: {
      has: () => config.admin,
    },
  });
}

export function generateMessage(
  content: string,
  user?: MockUserConfig,
): OmitPartialGroupDMChannel<Message> {
  if (!process.env.DEVELOPMENT_GUILD_ID)
    throw new Error(
      "Cannot test without the bot being in a testing guild and said guild’s ID being provided.",
    );

  return as<OmitPartialGroupDMChannel<Message>>({
    content,
    partial: false,
    guildId: process.env.DEVELOPMENT_GUILD_ID,
    guild: mockGuild,
    author: mockUser(user),
    reply: async (): Promise<OmitPartialGroupDMChannel<Message>> => {
      return {};
    },
  });
}
