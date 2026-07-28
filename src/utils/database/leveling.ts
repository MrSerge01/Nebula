import type { Satisfies } from "utils/types";
import { db, values } from ".";
import { type defLeveling, getSetting, setSetting } from "./settings";
import type { SqlObjectType, TableDefinition, TypeOfDefinition } from "./types";

type Def = Satisfies<
  TableDefinition,
  {
    name: "leveling";
    definition: {
      guild: "TEXT";
      userID: "TEXT";
      xp: "INTEGER";
    };
  }
>;

const getQuery = async (guild: string | number, userID: string): Promise<TypeOfDefinition<Def>[]> =>
  values<TypeOfDefinition<Def>>(
    await db`SELECT * FROM leveling WHERE "guild" = ${guild} AND "userID" = ${userID};`,
  );

export async function getUserXp(guildID: string, userID: string): Promise<number> {
  const res = await getQuery(guildID, userID);
  if (res.length === 0) return 0;
  return res[0].xp;
}

export async function setUserXp(
  guildID: string | number,
  userID: string,
  xp: number,
): Promise<void> {
  await db.begin(async tx => {
    await tx`DELETE FROM leveling WHERE "guild" = ${guildID} AND "userID" = ${userID};`;
    await tx`INSERT INTO leveling ("guild", "userID", "xp") VALUES (${guildID}, ${userID}, ${xp});`;
  });
}

export async function getGuildLeaderboard(
  guildID: string,
): Promise<{ guild: string; userID: string; xp: number; level: number }[]> {
  const xpData = values<TypeOfDefinition<Def>>(
    await db`SELECT * FROM leveling WHERE "guild" = ${guildID};`,
  );

  const difficulty = await getSetting(guildID, "leveling", "difficulty");
  return xpData.map(x => {
    return { ...x, level: calculateLevel({ xp: x.xp, difficulty }) };
  });
}

const formula = (difficulty: number, level: number): number =>
  difficulty * (20 * level ** 2 + 200 * level + 100);

export function calculateLevel(argument: { difficulty: number; xp: number }): number {
  const { difficulty, xp } = argument;
  let level = 0;
  let baseXp = 0;
  while (baseXp <= xp) {
    level++;
    baseXp = formula(difficulty, level + 1);
  }

  return level;
}

export async function getXpForNextLevel(guildID: string, userID: string): Promise<number> {
  const difficulty = await getSetting(guildID, "leveling", "difficulty");
  return formula(
    difficulty,
    calculateLevel({ difficulty, xp: await getUserXp(guildID, userID) }) + 1,
  );
}

type LevelReward = SqlObjectType<(typeof defLeveling)["rewards"]["properties"]>;
type LevelReward$Less = Omit<LevelReward, "$">;

export async function getLevelRewards(guildID: string): Promise<LevelReward[]> {
  const rewards = await getSetting(guildID, "leveling", "rewards");
  if (!rewards) return [];
  return rewards;
}

/**
 * Shorthand for adding level rewards to DB.
 * @param guildID
 * @param rewards Array of constructed reward objects, without GUID.
 */
export async function addLevelRewards(guildID: string, rewards: LevelReward$Less[]): Promise<void> {
  const content = await getLevelRewards(guildID);
  const properRewards: LevelReward[] = rewards.map(r => {
    return { $: Bun.randomUUIDv7(), ...r };
  });
  if (content.length === 0) {
    // :sob:
    await setSetting(guildID, "leveling", "rewards", properRewards);
    return;
  }

  await setSetting(guildID, "leveling", "rewards", [...content, ...properRewards]);
}

/**
 * Shorthand for deleting rewards from the DB.
 * @param guildID
 * @param rewards Array of constructed reward objects with GUID.
 */
export async function removeLevelRewards(guildID: string, rewards: LevelReward[]): Promise<void> {
  const content = await getLevelRewards(guildID);
  if (!content) return;
  const newRewards = [];
  for (const reward of content) if (rewards.every(r => r.$ != reward.$)) newRewards.push(reward);

  await setSetting(guildID, "leveling", "rewards", newRewards);
}
