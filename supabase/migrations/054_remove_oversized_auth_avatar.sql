-- Remove the legacy inline profile image that makes the test user's JWT too
-- large for Cloudflare and Supabase request-header limits. Preserve every
-- other user-metadata key and fail closed if the expected target has drifted.
DO $$
DECLARE
  target_count integer;
BEGIN
  SELECT count(*)
  INTO target_count
  FROM auth.users
  WHERE lower(email) = 'maxene_pableo@exodiagamedev.com'
    AND raw_user_meta_data->>'avatar_url' LIKE 'data:image/%'
    AND octet_length(raw_user_meta_data->>'avatar_url') > 16384;

  IF target_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly one test user with an oversized inline avatar, found %',
      target_count;
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data - 'avatar_url',
      updated_at = now()
  WHERE lower(email) = 'maxene_pableo@exodiagamedev.com'
    AND raw_user_meta_data->>'avatar_url' LIKE 'data:image/%'
    AND octet_length(raw_user_meta_data->>'avatar_url') > 16384;
END
$$;
