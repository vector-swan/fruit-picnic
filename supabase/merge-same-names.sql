-- One-off clean-up: join players who show up more than once under the same
-- name (ignoring capitals and spaces) into one. Run supabase/leaderboard.sql
-- first, then paste this into Supabase → SQL Editor → New query and press Run.
--
-- For each name, the row with the most recent best score is kept. The others
-- are folded into it with merge_player: the better score and every group carry
-- over, and their phones switch to the kept player next time they open the
-- game. The result lists what was joined. Safe to run more than once.
drop table if exists pg_temp.merged;
create temporary table merged as
with ranked as (
  select player_id, name, score, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) as same,
         row_number() over (partition by lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
                            order by updated_at desc, score desc) as n
  from public.scores
)
select k.name, k.player_id as keep_id, k.score as kept_score, o.player_id as old_id, o.score as old_score
from ranked o join ranked k on k.same = o.same and k.n = 1
where o.n > 1;

do $$
declare r record;
begin
  for r in select keep_id, old_id from merged loop
    perform public.merge_player(r.keep_id, r.old_id);
  end loop;
end;
$$;

select m.name, count(*) + 1 as rows_joined, max(s.score) as score_now
from merged m join public.scores s on s.player_id = m.keep_id
group by m.name, m.keep_id
order by m.name;
