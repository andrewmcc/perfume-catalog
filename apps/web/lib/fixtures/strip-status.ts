// Removes every `status` key (recursively) so an extraction result becomes an editable expected.json.
export function stripStatus(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripStatus);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'status')
        .map(([key, v]) => [key, stripStatus(v)]),
    );
  }
  return value;
}
