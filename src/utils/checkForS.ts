export function checkForS(text: string): string {
  return text.toLowerCase().endsWith("s") ? `${text}'` : `${text}'s`;
}
