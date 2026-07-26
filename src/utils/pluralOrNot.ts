import { replace } from "./replace";

/**
 * If `numberToCheck` isn't 1, `word` is made plural and returned, otherwise `word` is returned untouched.
 * @param {string} word Word to pluralize.
 * @param {number} numberToCheck Number to check.
 * @returns {string} Pluralized (or not) string.
 */
export function pluralOrNot(word: string, numberToCheck: number): string {
  if (numberToCheck == 1) return word;
  return replace(word, [
    {
      text: word,
      replacement: word.endsWith("y") ? `${word.replace("y", "")}ies` : `${word}s`,
    },
  ]);
}
