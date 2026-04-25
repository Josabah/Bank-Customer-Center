drop index if exists public.knowledge_base_entries_body_trgm_idx;
drop extension if exists pg_trgm;

create index if not exists call_sessions_customer_id_idx on public.call_sessions (customer_id);

drop policy if exists "service role manages customers" on public.customers;
drop policy if exists "service role manages customer auth factors" on public.customer_auth_factors;
drop policy if exists "service role manages accounts" on public.accounts;
drop policy if exists "service role manages transactions" on public.transactions;
drop policy if exists "service role manages call sessions" on public.call_sessions;
drop policy if exists "service role manages call messages" on public.call_messages;
drop policy if exists "service role manages knowledge base entries" on public.knowledge_base_entries;

create policy "service role manages customers" on public.customers for all using ((select auth.role()) = 'service_role') with check ((select auth.role()) = 'service_role');
create policy "service role manages customer auth factors" on public.customer_auth_factors for all using ((select auth.role()) = 'service_role') with check ((select auth.role()) = 'service_role');
create policy "service role manages accounts" on public.accounts for all using ((select auth.role()) = 'service_role') with check ((select auth.role()) = 'service_role');
create policy "service role manages transactions" on public.transactions for all using ((select auth.role()) = 'service_role') with check ((select auth.role()) = 'service_role');
create policy "service role manages call sessions" on public.call_sessions for all using ((select auth.role()) = 'service_role') with check ((select auth.role()) = 'service_role');
create policy "service role manages call messages" on public.call_messages for all using ((select auth.role()) = 'service_role') with check ((select auth.role()) = 'service_role');
create policy "service role manages knowledge base entries" on public.knowledge_base_entries for all using ((select auth.role()) = 'service_role') with check ((select auth.role()) = 'service_role');
