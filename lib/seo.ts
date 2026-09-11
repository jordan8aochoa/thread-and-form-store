/** JSON inside a script element must never contain a literal closing-tag opener. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
