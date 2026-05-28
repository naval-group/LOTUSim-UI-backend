/**
 * Case-insensitive enum parser.
 * Uppercases input before matching so "surface" and "SURFACE" both resolve correctly.
 */
export function parseEnum<T extends Record<string, string>>(
  value: string,
  enumObj: T,
  enumName: string,
): T[keyof T] {
  const upper = value.toUpperCase();
  const enumValues = Object.values(enumObj) as string[];
  if (enumValues.includes(upper)) {
    return upper as T[keyof T];
  }
  throw new Error(`Unknown ${enumName}: "${value}". Expected one of: ${enumValues.join(", ")}`);
}
