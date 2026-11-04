-- Test izolacji i autoryzacji biblioteki Jakuplayera (wykonywany w transakcji z ROLLBACK).
begin;

do $$
declare
  v_ua uuid;
  v_ub uuid;
  v_tok_a text := 'test_tok_a_0123456789abcdef0123456789abcdef';
  v_tok_b text := 'test_tok_b_fedcba9876543210fedcba9876543210';
  v_res jsonb;
  v_denied boolean := false;
begin
  insert into public.community_users (username, pin_hash)
    values ('__jp_test_alice__', repeat('0', 64)) returning id into v_ua;
  insert into public.community_users (username, pin_hash)
    values ('__jp_test_bob__', repeat('0', 64)) returning id into v_ub;

  insert into public.community_sessions (token_hash, user_id)
    values (encode(extensions.digest('rejson_comm_sess_v1:' || v_tok_a, 'sha256'), 'hex'), v_ua),
           (encode(extensions.digest('rejson_comm_sess_v1:' || v_tok_b, 'sha256'), 'hex'), v_ub);

  set local role anon;

  begin
    perform * from public.jakuplayer_library;
    v_denied := false;
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'FAIL: anon miał bezpośredni dostęp do tabeli jakuplayer_library';
  end if;

  v_denied := false;
  begin
    perform public.jakuplayer_get_library('nieistniejacy_token_1234567890');
  exception when others then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'FAIL: nieprawidłowy token nie został odrzucony';
  end if;

  v_res := public.jakuplayer_save_library(
    v_tok_a,
    '[{"id":"vid1","title":"Song 1","artist":"Artist 1","thumbnail":"https://i.ytimg.com/vi/vid1/mqdefault.jpg"},{"id":"vid1","title":"Duplicate","artist":"Dup","thumbnail":""},{"id":"vid2","title":"Song 2","artist":"Artist 2","thumbnail":"javascript:alert(1)"}]'::jsonb,
    '[{"id":"pl1","name":"Moja lista","songs":[{"id":"vid1","title":"Song 1","artist":"Artist 1","thumbnail":"https://i.ytimg.com/vi/vid1/mqdefault.jpg"}]}]'::jsonb,
    null
  );
  if jsonb_array_length(v_res->'liked_songs') <> 2 then
    raise exception 'FAIL: oczekiwano deduplikacji liked_songs do 2 elementów';
  end if;
  if (v_res->'liked_songs'->1->>'thumbnail') <> '' then
    raise exception 'FAIL: niebezpieczna miniatura nie została wyczyszczona';
  end if;

  v_res := public.jakuplayer_save_library(
    v_tok_a,
    null,
    null,
    '[{"id":"vid9","title":"Ostatni","artist":"Wykonawca","thumbnail":""}]'::jsonb
  );
  if jsonb_array_length(v_res->'liked_songs') <> 2 or jsonb_array_length(v_res->'playlists') <> 1 or jsonb_array_length(v_res->'history') <> 1 then
    raise exception 'FAIL: częściowy zapis nadpisał inne kolekcje';
  end if;

  v_res := public.jakuplayer_get_library(v_tok_b);
  if jsonb_array_length(v_res->'liked_songs') <> 0 or jsonb_array_length(v_res->'playlists') <> 0 or jsonb_array_length(v_res->'history') <> 0 then
    raise exception 'FAIL: wyciek danych między kontami';
  end if;
end
$$;

rollback;
