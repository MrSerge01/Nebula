import type {
  AnySelectMenuInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
} from "discord.js";
import { COLLECTOR_DURATION } from "./times";

/**
 * Collects a modal submit interaction.
 * @param interaction Either a command, a button or a select menu that triggered the modal.
 * @returns The modal.
 */
export async function modalSubmit(
  interaction: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction,
): Promise<ModalSubmitInteraction | undefined> {
  try {
    return await interaction.awaitModalSubmit({
      time: COLLECTOR_DURATION,
      filter: m => m.user.id === interaction.user.id,
    });
  } catch {
    /* In case of timeout */
  }
}
