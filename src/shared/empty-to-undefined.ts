import { Transform } from 'class-transformer';

// Treat "" from an untouched form field as "not provided", so @IsOptional
// validators (IsEmail, Matches, ...) skip it instead of rejecting it.
export const EmptyToUndefined = () =>
  Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  );
