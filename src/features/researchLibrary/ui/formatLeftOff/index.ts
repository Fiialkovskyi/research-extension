/** "You left off at <title> (<n>% read)", the words the session picker and the popup share. */
export const formatLeftOff = ({
  title,
  readFraction,
}: {
  title: string;
  readFraction: number;
}): string => `You left off at ${title} (${Math.round(readFraction * 100)}% read)`;
