-- Compatibility patch for inventory actions.
-- Apply this in Supabase if consuming/wasting/adjusting products returns a 500
-- caused by older enum values.

alter type movement_type add value if not exists 'consume';
alter type movement_type add value if not exists 'waste';
alter type movement_type add value if not exists 'adjust';
alter type movement_type add value if not exists 'undo';
alter type movement_type add value if not exists 'shopping_transfer';

alter type batch_status add value if not exists 'consumed';
alter type batch_status add value if not exists 'wasted';
alter type batch_status add value if not exists 'expired';
alter type batch_status add value if not exists 'removed';

alter type activity_type add value if not exists 'product_consumed';
alter type activity_type add value if not exists 'product_wasted';
alter type activity_type add value if not exists 'product_adjusted';
alter type activity_type add value if not exists 'shopping_finished';
