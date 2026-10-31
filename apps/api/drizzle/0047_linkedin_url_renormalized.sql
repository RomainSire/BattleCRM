-- ST-93: normalizeLinkedInUrl (packages/domain) now decodes the %xx of each path segment, writes accents
-- in one form (NFC) and cuts a profile to /in/<slug>. The stored URLs, written by its previous version,
-- are normalized again by the same rules. Two Contacts of a User that would share a URL are left as
-- they were and named in a warning: they are to be merged by hand.
-- lower() may differ from toLowerCase() on letters a LinkedIn slug never holds (a dotted capital I,
-- a final sigma), only on letters that were stored encoded.
-- Forced row level security would blind the owner: forced again at the end of this migration.
ALTER TABLE "contact" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- A segment, its %xx decoded; as written when one encodes nothing, or encodes what a segment cannot
-- hold as such (decodeSegment in packages/domain/src/normalize.ts).
CREATE FUNCTION pg_temp.decode_url_segment(segment text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  bytes bytea := '';
  part text;
  decoded text;
BEGIN
  IF position('%' IN segment) = 0 THEN
    RETURN segment;
  END IF;
  FOR part IN SELECT match[1] FROM regexp_matches(segment, '(%[0-9a-fA-F]{2}|%|[^%]+)', 'g') AS match LOOP
    IF part = '%' THEN
      RETURN segment;
    END IF;
    bytes := bytes || CASE WHEN left(part, 1) = '%' THEN decode(substr(part, 2), 'hex') ELSE convert_to(part, 'UTF8') END;
  END LOOP;
  decoded := convert_from(bytes, 'UTF8');
  -- The spaces of \s in JavaScript, which [:space:] alone misses on some systems.
  IF decoded ~ '[/?#%[:space:][:cntrl:]\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]' THEN
    RETURN segment;
  END IF;
  RETURN decoded;
EXCEPTION WHEN character_not_in_repertoire THEN
  -- Bytes that are no UTF-8 text.
  RETURN segment;
END $$;--> statement-breakpoint
-- A URL written by the previous normalizeLinkedInUrl, normalized again.
CREATE FUNCTION pg_temp.normalize_linkedin_url(url text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'https://linkedin.com' || regexp_replace(
    normalize(lower(coalesce(
      (SELECT string_agg(pg_temp.decode_url_segment(segment), '/' ORDER BY n)
        FROM unnest(string_to_array(substr(url, length('https://linkedin.com') + 1), '/'))
          WITH ORDINALITY AS segments(segment, n)),
      ''
    )), NFC),
    '^(/in/[^/]+)/.*$',
    '\1'
  )
$$;--> statement-breakpoint
DO $$
DECLARE
  clash record;
BEGIN
  CREATE TEMP TABLE renormalized AS
    SELECT id, user_id, linkedin_url AS old_url, pg_temp.normalize_linkedin_url(linkedin_url) AS new_url
    FROM contact
    WHERE linkedin_url LIKE 'https://linkedin.com/%';
  FOR clash IN
    SELECT user_id, new_url, string_agg(format('%s (%s)', id, old_url), ', ' ORDER BY id) AS contacts
    FROM renormalized
    GROUP BY user_id, new_url
    HAVING count(*) > 1
  LOOP
    RAISE WARNING 'Contacts % of user % would share the LinkedIn URL %: left as they were, to be merged by hand',
      clash.contacts, clash.user_id, clash.new_url;
  END LOOP;
  UPDATE contact SET linkedin_url = one.new_url
  FROM renormalized one
  WHERE contact.id = one.id
    AND one.new_url <> one.old_url
    AND NOT EXISTS (
      SELECT FROM renormalized other
      WHERE other.user_id = one.user_id AND other.new_url = one.new_url AND other.id <> one.id
    );
  DROP TABLE renormalized;
END $$;--> statement-breakpoint
DROP FUNCTION pg_temp.normalize_linkedin_url(text);--> statement-breakpoint
DROP FUNCTION pg_temp.decode_url_segment(text);--> statement-breakpoint
ALTER TABLE "contact" FORCE ROW LEVEL SECURITY;
