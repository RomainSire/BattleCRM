/** Markup that is already safe to send: only `html` builds it. */
export type SafeHtml = { readonly safeHtml: string };

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ENTITIES[character] ?? character);
}

/** The only way to write an e-mail's HTML: every interpolated string is escaped, markup built by `html` is kept. */
export function html(
  strings: TemplateStringsArray,
  ...values: (string | SafeHtml | SafeHtml[])[]
): SafeHtml {
  const render = (value: string | SafeHtml | SafeHtml[]): string => {
    if (typeof value === 'string') return escapeHtml(value);
    if (Array.isArray(value)) return value.map(render).join('');
    return value.safeHtml;
  };
  return {
    safeHtml: strings.reduce(
      (result, part, index) => result + render(values[index - 1] ?? '') + part,
    ),
  };
}
