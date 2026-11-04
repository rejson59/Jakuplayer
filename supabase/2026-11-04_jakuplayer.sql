-- Jakuplayer: prywatna biblioteka użytkownika (polubione utwory, playlisty i historia)
-- autoryzowana wyłącznie po stronie serwera przez community_session_user(p_token).

create table public.jakuplayer_library (
  owner_id uuid primary key references public.community_users(id) on delete cascade,
  liked_songs jsonb not null default '[]'::jsonb,
  playlists jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.jakuplayer_library enable row level security;
revoke all on public.jakuplayer_library from public, anon, authenticated;

create or replace function public.jakuplayer_sanitize_songs(p_items jsonb, p_limit integer)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_elem jsonb;
  v_id text;
  v_title text;
  v_artist text;
  v_thumb text;
  v_seen text[] := array[]::text[];
  v_out jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Nieprawidłowa lista utworów.';
  end if;
  if jsonb_array_length(p_items) > p_limit then
    raise exception 'Przekroczono limit utworów (%).', p_limit;
  end if;

  for v_elem in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_elem) <> 'object' then
      raise exception 'Nieprawidłowy element utworu.';
    end if;
    v_id := btrim(coalesce(v_elem->>'id', ''));
    if char_length(v_id) not between 1 and 64 or v_id ~ '[[:cntrl:]]' then
      raise exception 'Nieprawidłowy identyfikator utworu.';
    end if;
    if v_id = any(v_seen) then
      continue;
    end if;
    v_seen := array_append(v_seen, v_id);

    v_title := left(btrim(coalesce(v_elem->>'title', '')), 300);
    if v_title = '' or v_title ~ '[[:cntrl:]]' then
      v_title := 'Nieznany utwór';
    end if;

    v_artist := left(btrim(coalesce(v_elem->>'artist', '')), 300);
    if v_artist = '' or v_artist ~ '[[:cntrl:]]' then
      v_artist := 'Nieznany wykonawca';
    end if;

    v_thumb := btrim(coalesce(v_elem->>'thumbnail', ''));
    if char_length(v_thumb) > 500 or v_thumb ~ '[[:cntrl:]]' or (v_thumb <> '' and v_thumb !~* '^https?://') then
      v_thumb := '';
    end if;

    v_out := v_out || jsonb_build_array(
      jsonb_build_object(
        'id', v_id,
        'title', v_title,
        'artist', v_artist,
        'thumbnail', v_thumb
      )
    );
  end loop;

  return v_out;
end
$$;

create or replace function public.jakuplayer_sanitize_playlists(p_items jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_elem jsonb;
  v_id text;
  v_name text;
  v_songs jsonb;
  v_seen text[] := array[]::text[];
  v_out jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Nieprawidłowa lista playlist.';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'Limit 100 playlist został osiągnięty.';
  end if;

  for v_elem in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_elem) <> 'object' then
      raise exception 'Nieprawidłowy obiekt playlisty.';
    end if;
    v_id := btrim(coalesce(v_elem->>'id', ''));
    if char_length(v_id) not between 1 and 80 or v_id ~ '[[:cntrl:]]' then
      raise exception 'Nieprawidłowy identyfikator playlisty.';
    end if;
    if v_id = any(v_seen) then
      continue;
    end if;
    v_seen := array_append(v_seen, v_id);

    v_name := left(btrim(coalesce(v_elem->>'name', '')), 80);
    if v_name = '' or v_name ~ '[[:cntrl:]]' then
      v_name := 'Playlista';
    end if;

    v_songs := public.jakuplayer_sanitize_songs(coalesce(v_elem->'songs', '[]'::jsonb), 300);

    v_out := v_out || jsonb_build_array(
      jsonb_build_object(
        'id', v_id,
        'name', v_name,
        'songs', v_songs
      )
    );
  end loop;

  return v_out;
end
$$;

revoke all on function public.jakuplayer_sanitize_songs(jsonb, integer), public.jakuplayer_sanitize_playlists(jsonb) from public, anon, authenticated;

create or replace function public.jakuplayer_get_library(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid;
  v_row public.jakuplayer_library;
begin
  select user_id into strict v_user from public.community_session_user(p_token);
  select * into v_row from public.jakuplayer_library where owner_id = v_user;
  if not found then
    return jsonb_build_object(
      'liked_songs', '[]'::jsonb,
      'playlists', '[]'::jsonb,
      'history', '[]'::jsonb,
      'updated_at', null
    );
  end if;
  return jsonb_build_object(
    'liked_songs', v_row.liked_songs,
    'playlists', v_row.playlists,
    'history', v_row.history,
    'updated_at', v_row.updated_at
  );
end
$$;

create or replace function public.jakuplayer_save_library(
  p_token text,
  p_liked_songs jsonb default null,
  p_playlists jsonb default null,
  p_history jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid;
  v_existing public.jakuplayer_library;
  v_has_existing boolean := false;
  v_liked jsonb;
  v_playlists jsonb;
  v_history jsonb;
  v_own_bytes bigint;
  v_old_bytes bigint := 0;
  v_total_bytes bigint;
  v_saved public.jakuplayer_library;
begin
  select user_id into strict v_user from public.community_session_user(p_token);
  perform pg_advisory_xact_lock(hashtext('jakuplayer_quota_v1'));

  select * into v_existing from public.jakuplayer_library where owner_id = v_user for update;
  if found then
    v_has_existing := true;
    v_old_bytes := octet_length(v_existing.liked_songs::text)
                 + octet_length(v_existing.playlists::text)
                 + octet_length(v_existing.history::text);
  end if;

  if p_liked_songs is not null and jsonb_typeof(p_liked_songs) <> 'null' then
    v_liked := public.jakuplayer_sanitize_songs(p_liked_songs, 500);
  elsif v_has_existing then
    v_liked := v_existing.liked_songs;
  else
    v_liked := '[]'::jsonb;
  end if;

  if p_playlists is not null and jsonb_typeof(p_playlists) <> 'null' then
    v_playlists := public.jakuplayer_sanitize_playlists(p_playlists);
  elsif v_has_existing then
    v_playlists := v_existing.playlists;
  else
    v_playlists := '[]'::jsonb;
  end if;

  if p_history is not null and jsonb_typeof(p_history) <> 'null' then
    v_history := public.jakuplayer_sanitize_songs(p_history, 50);
  elsif v_has_existing then
    v_history := v_existing.history;
  else
    v_history := '[]'::jsonb;
  end if;

  v_own_bytes := octet_length(v_liked::text)
               + octet_length(v_playlists::text)
               + octet_length(v_history::text);
  if v_own_bytes > 1048576 then
    raise exception 'Limit miejsca biblioteki Jakuplayera (1 MiB na konto) został osiągnięty.';
  end if;

  select coalesce(sum(octet_length(liked_songs::text) + octet_length(playlists::text) + octet_length(history::text)), 0)
    into v_total_bytes
    from public.jakuplayer_library;
  if v_total_bytes - v_old_bytes + v_own_bytes > 104857600 then
    raise exception 'Wspólne miejsce biblioteki Jakuplayera jest obecnie pełne.';
  end if;

  insert into public.jakuplayer_library (owner_id, liked_songs, playlists, history, updated_at)
  values (v_user, v_liked, v_playlists, v_history, clock_timestamp())
  on conflict (owner_id) do update
    set liked_songs = excluded.liked_songs,
        playlists = excluded.playlists,
        history = excluded.history,
        updated_at = clock_timestamp()
  returning * into v_saved;

  return jsonb_build_object(
    'liked_songs', v_saved.liked_songs,
    'playlists', v_saved.playlists,
    'history', v_saved.history,
    'updated_at', v_saved.updated_at
  );
end
$$;

revoke all on function public.jakuplayer_get_library(text), public.jakuplayer_save_library(text, jsonb, jsonb, jsonb) from public;
grant execute on function public.jakuplayer_get_library(text), public.jakuplayer_save_library(text, jsonb, jsonb, jsonb) to anon, authenticated;
