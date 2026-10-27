import { HttpException, HttpStatus } from '@nestjs/common';

// Repository try/catch convention, with the `await` that makes it actually
// catch async query errors (a bare `return promise` inside try doesn't).
export const dbCall = async <T>(
  what: string,
  fn: () => Promise<T>,
): Promise<T> => {
  try {
    return await fn();
  } catch (e) {
    console.error(e);
    throw new HttpException(`Error ${what}`, HttpStatus.INTERNAL_SERVER_ERROR);
  }
};

// Escape LIKE/ILIKE wildcards in user-typed search text (Postgres default escape is \).
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
