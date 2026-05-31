-- Backfill can_undo for historical activity events
-- Safe target: only events that are not already undone and currently non-undoable.
-- Includes inventory events + settings adjustments stored as product_adjusted.

-- 1) Preview rows that will be updated
select
  id,
  type,
  title,
  can_undo,
  undone_at,
  created_at
from activity_events
where coalesce(can_undo, false) = false
  and undone_at is null
  and (
    type::text in ('product_added', 'product_consumed', 'product_wasted', 'product_adjusted')
    or (type::text = 'product_adjusted' and coalesce(metadata->>'section', '') = 'settings')
  )
order by created_at desc;

-- 2) Apply update
update activity_events
set can_undo = true
where coalesce(can_undo, false) = false
  and undone_at is null
  and (
    type::text in ('product_added', 'product_consumed', 'product_wasted', 'product_adjusted')
    or (type::text = 'product_adjusted' and coalesce(metadata->>'section', '') = 'settings')
  );

-- 3) Verify result
select
  count(*) as undoable_events
from activity_events
where can_undo = true
  and undone_at is null
  and type::text in ('product_added', 'product_consumed', 'product_wasted', 'product_adjusted');
