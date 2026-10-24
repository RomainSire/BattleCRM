/**
 * The name of a row, a link stretched over the row that opens its record: one tab stop, its focus
 * ring around the row, as the rows of Battles have it. The row is `relative` and a `group`; its own
 * actions sit above it, `relative` too.
 */
export const ROW_LINK_CLASS =
  "self-start font-medium underline-offset-4 outline-none group-hover:underline after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent-text max-md:py-3";
