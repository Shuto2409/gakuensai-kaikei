create table if not exists kv_store (
  id int primary key,
  value jsonb not null default '{}'::jsonb
);
insert into kv_store (id, value) values (1, '{}'::jsonb) on conflict (id) do nothing;

-- 途中の階層が無くても作る（jsonb_set は途中が無いと何もしないため）
create or replace function kv_ensure_parents(v jsonb, p text[])
returns jsonb language plpgsql as $$
declare cur jsonb := coalesce(v,'{}'::jsonb);
        i int;
        n int := coalesce(array_length(p,1),0);
begin
  for i in 1..(n-1) loop
    if jsonb_typeof(cur #> p[1:i]) is distinct from 'object' then
      cur := jsonb_set(cur, p[1:i], '{}'::jsonb, true);
    end if;
  end loop;
  return cur;
end; $$;

create or replace function kv_set_path(p text[], val jsonb)
returns void language plpgsql as $$
begin
  if array_length(p,1) is null then
    update kv_store set value = val where id = 1;
  else
    update kv_store set value = jsonb_set(kv_ensure_parents(value,p), p, val, true) where id = 1;
  end if;
end; $$;

create or replace function kv_update_path(p text[], val jsonb)
returns void language plpgsql as $$
declare cur jsonb;
begin
  if array_length(p,1) is null then
    update kv_store set value = coalesce(value,'{}'::jsonb) || val where id = 1;
  else
    select value #> p into cur from kv_store where id=1;
    if cur is null or jsonb_typeof(cur) <> 'object' then cur := '{}'::jsonb; end if;
    update kv_store set value = jsonb_set(kv_ensure_parents(value,p), p, cur || val, true) where id=1;
  end if;
end; $$;

create or replace function kv_remove_path(p text[])
returns void language plpgsql as $$
begin
  if array_length(p,1) is null then
    update kv_store set value = '{}'::jsonb where id=1;
  else
    update kv_store set value = value #- p where id=1;
  end if;
end; $$;

create or replace function kv_reset()
returns void language plpgsql as $$
begin
  update kv_store set value = '{}'::jsonb where id=1;
end; $$;

create or replace function kv_get_path(p text[])
returns jsonb language plpgsql as $$
begin
  if array_length(p,1) is null then
    return (select value from kv_store where id=1);
  else
    return (select value #> p from kv_store where id=1);
  end if;
end; $$;

create or replace function kv_cas_path(p text[], old_val jsonb, new_val jsonb)
returns boolean language plpgsql as $$
declare cur jsonb;
begin
  if array_length(p,1) is null then select value into cur from kv_store where id=1;
  else select value #> p into cur from kv_store where id=1; end if;
  if coalesce(cur,'null'::jsonb) = coalesce(old_val,'null'::jsonb) then
    if array_length(p,1) is null then update kv_store set value = new_val where id=1;
    else update kv_store set value = jsonb_set(kv_ensure_parents(value,p), p, new_val, true) where id=1; end if;
    return true;
  end if;
  return false;
end; $$;

alter table kv_store enable row level security;
drop policy if exists "allow all kv" on kv_store;
create policy "allow all kv" on kv_store for all using (true) with check (true);
do $$ begin
  begin alter publication supabase_realtime add table kv_store;
  exception when others then null; end;
end $$;
grant execute on all functions in schema public to anon, authenticated;
