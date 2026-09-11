-- Thread & Form. USD cents; domestic US shipping. All sensitive tables are private by RLS.
create schema if not exists private;
create table public.admin_profiles (id uuid primary key references auth.users(id) on delete cascade, role text not null check(role in ('owner','admin')), active boolean not null default true, created_at timestamptz not null default now());
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select auth.uid() is not null and exists(select 1 from public.admin_profiles where id=auth.uid() and active and role in ('owner','admin')); $$;
revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;
create table public.products (id uuid primary key default gen_random_uuid(),name text not null,slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),description text not null default '',category text not null default 'Sweaters',price_cents integer not null check(price_cents>0),sale_price_cents integer check(sale_price_cents>0 and sale_price_cents<price_cents),active boolean not null default false,featured boolean not null default false,seo_title text not null default '',seo_description text not null default '',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.product_images (id uuid primary key default gen_random_uuid(),product_id uuid not null references products on delete cascade,url text not null,alt text not null default '',position integer not null default 0);
create table public.product_variants (id uuid primary key default gen_random_uuid(),product_id uuid not null references products on delete cascade,size text not null,color text not null,sku text not null unique,price_override_cents integer check(price_override_cents>0),inventory_quantity integer not null default 0 check(inventory_quantity>=0),weight_oz numeric not null default 16 check(weight_oz>0),active boolean not null default true,unique(product_id,size,color));
create table public.inventory_adjustments (id uuid primary key default gen_random_uuid(),variant_id uuid references product_variants on delete set null,quantity_change integer not null,reason text not null,admin_id uuid references auth.users on delete set null,order_id uuid,created_at timestamptz not null default now());
create table public.customers (id uuid primary key default gen_random_uuid(),email text not null unique,stripe_customer_id text,created_at timestamptz not null default now());
create table public.addresses (id uuid primary key default gen_random_uuid(),customer_id uuid references customers on delete set null,name text not null,street1 text not null,street2 text not null default '',city text not null,state text not null,zip text not null,country text not null default 'US',phone text,created_at timestamptz not null default now());
create table public.discounts (id uuid primary key default gen_random_uuid(),code text not null unique check(code=upper(code)),kind text not null check(kind in ('fixed','percentage')),value integer not null check(value>0),active boolean not null default true,starts_at timestamptz,ends_at timestamptz,minimum_subtotal_cents integer not null default 0 check(minimum_subtotal_cents>=0),max_uses integer check(max_uses>0),uses integer not null default 0 check(uses>=0),created_at timestamptz not null default now(),check(kind<>'percentage' or value<=100));
create table public.store_settings (id text primary key default 'store' check(id='store'),brand_name text not null default 'Thread & Form',tagline text not null default 'Fewer, better layers.',logo_url text not null default '',support_email text not null default 'hello@example.com',owner_email text not null default '',return_address jsonb not null default '{}',free_shipping_threshold_cents integer not null default 15000 check(free_shipping_threshold_cents>=0),announcement text not null default 'Thoughtfully made. Worn on repeat.',social_links jsonb not null default '{}');
create table public.checkout_quotes (id uuid primary key default gen_random_uuid(),token_hash text not null unique,email text not null,address jsonb not null,items jsonb not null,subtotal_cents integer not null,discount_id uuid references discounts on delete set null,discount_cents integer not null default 0,shipping_shipment_id text not null,rates jsonb not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '20 minutes');
create table public.checkout_reservations (id uuid primary key default gen_random_uuid(),quote_id uuid not null unique references checkout_quotes,rate_id text not null,status text not null default 'creating' check(status in ('creating','active','paid','expired')),items jsonb not null,subtotal_cents integer not null,discount_id uuid references discounts on delete set null,discount_cents integer not null,shipping_cents integer not null,shipping_service jsonb not null,stripe_session_id text unique,stripe_customer_id text,stripe_coupon_id text,session_url text,expires_at timestamptz not null,created_at timestamptz not null default now());
create table public.orders (id uuid primary key default gen_random_uuid(),order_number text not null unique default 'TF-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),reservation_id uuid unique references checkout_reservations,customer_id uuid references customers,address_id uuid references addresses,email text not null,shipping_address jsonb not null,status text not null default 'paid' check(status in ('pending','paid','processing','shipped','delivered','canceled','refunded')),subtotal_cents integer not null,discount_cents integer not null default 0,shipping_cents integer not null default 0,tax_cents integer not null default 0,total_cents integer not null,refunded_cents integer not null default 0,discount_code text,stripe_customer_id text,stripe_checkout_session_id text unique,stripe_payment_intent_id text unique,shipping_service jsonb,inventory_restored boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table inventory_adjustments add foreign key(order_id) references orders on delete set null;
create table public.order_items (id uuid primary key default gen_random_uuid(),order_id uuid not null references orders,product_id uuid references products on delete set null,variant_id uuid references product_variants on delete set null,name text not null,sku text not null,size text not null,color text not null,unit_price_cents integer not null,quantity integer not null check(quantity>0),weight_oz numeric not null,image_url text);
create table public.payments (id uuid primary key default gen_random_uuid(),order_id uuid not null references orders,stripe_payment_intent_id text not null unique,stripe_checkout_session_id text not null unique,amount_cents integer not null,status text not null,created_at timestamptz not null default now());
create table public.refund_requests (id uuid primary key default gen_random_uuid(),order_id uuid not null unique references orders,admin_id uuid references auth.users,restock boolean not null default false,reason text,created_at timestamptz not null default now());
create table public.refunds (id text primary key,order_id uuid not null references orders,amount_cents integer not null,status text not null,created_at timestamptz not null default now());
create table public.order_events (id uuid primary key default gen_random_uuid(),order_id uuid not null references orders,kind text not null,message text not null,admin_id uuid references auth.users,created_at timestamptz not null default now());
create table public.shipping_quotes (id uuid primary key default gen_random_uuid(),order_id uuid not null references orders,easypost_shipment_id text not null unique,rates jsonb not null,created_at timestamptz not null default now());
create table public.label_operations (order_id uuid primary key references orders,easypost_shipment_id text not null,rate_id text not null,status text not null default 'pending',locked_until timestamptz,created_at timestamptz not null default now());
create table public.shipments (id uuid primary key default gen_random_uuid(),order_id uuid not null unique references orders,easypost_shipment_id text unique,easypost_tracker_id text unique,label_url text,carrier text not null,service text not null default '',postage_cents integer not null default 0,tracking_code text,tracking_url text,status text not null default 'shipped',created_at timestamptz not null default now());
create table public.tracking_events (id uuid primary key default gen_random_uuid(),shipment_id uuid not null references shipments,provider_event_id text not null unique,status text not null,description text,occurred_at timestamptz not null default now(),created_at timestamptz not null default now());
create table public.webhook_events (id text primary key,provider text not null,type text not null,processed_at timestamptz not null default now());
create table public.email_outbox (id uuid primary key default gen_random_uuid(),dedupe_key text not null unique,kind text not null,recipient text,payload jsonb not null default '{}',status text not null default 'pending' check(status in ('pending','sending','sent','failed')),attempts integer not null default 0,available_at timestamptz not null default now(),lease_until timestamptz,provider_id text,last_error text,created_at timestamptz not null default now(),sent_at timestamptz);
create table public.order_lookup_tokens (token_hash text primary key,order_id uuid not null references orders,expires_at timestamptz not null,created_at timestamptz not null default now());
create table public.contact_submissions (id uuid primary key default gen_random_uuid(),name text not null,email text not null,subject text not null default '',message text not null,status text not null default 'new',created_at timestamptz not null default now());
create table public.newsletter_subscribers (id uuid primary key default gen_random_uuid(),email text not null unique,token_hash text,unsubscribed_at timestamptz,created_at timestamptz not null default now());
create table public.rate_limits (key text primary key,count integer not null,reset_at timestamptz not null);

do $$ declare t text; begin
for t in select unnest(array['admin_profiles','products','product_images','product_variants','inventory_adjustments','customers','addresses','discounts','store_settings','checkout_quotes','checkout_reservations','orders','order_items','payments','refund_requests','refunds','order_events','shipping_quotes','label_operations','shipments','tracking_events','webhook_events','email_outbox','order_lookup_tokens','contact_submissions','newsletter_subscribers','rate_limits']) loop
execute format('alter table public.%I enable row level security',t);
execute format('revoke all on public.%I from anon, authenticated',t);
execute format('grant all on public.%I to service_role',t);
end loop;
for t in select unnest(array['products','product_images','product_variants','inventory_adjustments','orders','order_items','payments','refunds','order_events','shipments','tracking_events','discounts','store_settings','contact_submissions','newsletter_subscribers']) loop
execute format('grant select, insert, update, delete on public.%I to authenticated',t);
execute format('create policy admin_all on public.%I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',t);
end loop; end $$;
grant select on products,product_images,product_variants to anon,authenticated;
create policy public_products on products for select to anon,authenticated using(active);
create policy public_images on product_images for select to anon,authenticated using(exists(select 1 from products p where p.id=product_id and p.active));
create policy public_variants on product_variants for select to anon,authenticated using(active and exists(select 1 from products p where p.id=product_id and p.active));
grant select on admin_profiles to authenticated;
create policy own_admin_profile on admin_profiles for select to authenticated using(id=(select auth.uid()));

create function public.consume_rate_limit(p_key text,p_limit integer,p_window_seconds integer) returns boolean language plpgsql set search_path='' as $$
declare used integer; begin
insert into public.rate_limits(key,count,reset_at) values(p_key,1,now()+make_interval(secs=>p_window_seconds)) on conflict(key) do update set count=case when rate_limits.reset_at<=now() then 1 else rate_limits.count+1 end, reset_at=case when rate_limits.reset_at<=now() then now()+make_interval(secs=>p_window_seconds) else rate_limits.reset_at end returning count into used;
return used<=p_limit; end $$;

create function public.reserve_checkout(p_quote_id uuid,p_rate_id text) returns jsonb language plpgsql set search_path='' as $$
declare q public.checkout_quotes; r public.checkout_reservations; d public.discounts; item jsonb; v record; rate jsonb; reserved integer; expected integer; begin
select * into q from public.checkout_quotes where id=p_quote_id for update;
if not found then raise exception 'Quote missing'; end if;
select * into r from public.checkout_reservations where quote_id=q.id;
if found then if r.rate_id<>p_rate_id then raise exception 'Rate already selected'; end if; return to_jsonb(r); end if;
if q.expires_at<=now() then raise exception 'Quote expired'; end if;
select x into rate from jsonb_array_elements(q.rates) x where x->>'id'=p_rate_id;
if rate is null then raise exception 'Invalid shipping rate'; end if;
if q.subtotal_cents-q.discount_cents+(rate->>'amount_cents')::integer<50 then raise exception 'Checkout minimum is 50 cents'; end if;
if q.discount_id is not null then
 select * into d from public.discounts where id=q.discount_id for update;
 select count(*) into reserved from public.checkout_reservations where discount_id=d.id and status in ('creating','active');
 expected:=least(q.subtotal_cents,case when d.kind='percentage' then floor(q.subtotal_cents*d.value/100.0)::integer else d.value end);
 if not d.active or (d.starts_at is not null and d.starts_at>now()) or (d.ends_at is not null and d.ends_at<=now()) or q.subtotal_cents<d.minimum_subtotal_cents or (d.max_uses is not null and d.uses+reserved>=d.max_uses) or expected<>q.discount_cents then raise exception 'Discount unavailable'; end if;
end if;
for item in select x from jsonb_array_elements(q.items) x order by x->>'variant_id' loop
 select pv.*,p.active as product_active,coalesce(pv.price_override_cents,p.sale_price_cents,p.price_cents) as current_price into v from public.product_variants pv join public.products p on p.id=pv.product_id where pv.id=(item->>'variant_id')::uuid for update of pv,p;
 if not found or not v.active or not v.product_active or v.current_price<>(item->>'unit_price_cents')::integer then raise exception 'Product changed'; end if;
 select coalesce(sum((x->>'quantity')::integer),0) into reserved from public.checkout_reservations cr cross join jsonb_array_elements(cr.items) x where cr.status in ('creating','active') and x->>'variant_id'=item->>'variant_id';
 if (item->>'quantity')::integer<1 or v.inventory_quantity-reserved<(item->>'quantity')::integer then raise exception 'Insufficient inventory'; end if;
end loop;
insert into public.checkout_reservations(quote_id,rate_id,items,subtotal_cents,discount_id,discount_cents,shipping_cents,shipping_service,expires_at) values(q.id,p_rate_id,q.items,q.subtotal_cents,q.discount_id,q.discount_cents,(rate->>'amount_cents')::integer,rate,now()+interval '35 minutes') returning * into r;
return to_jsonb(r); end $$;

create function public.finalize_checkout(p_event_id text,p_event_type text,p_reservation_id uuid,p_session_id text,p_payment_intent_id text,p_customer_id text,p_subtotal integer,p_discount integer,p_shipping integer,p_tax integer,p_total integer) returns uuid language plpgsql set search_path='' as $$
declare r public.checkout_reservations; q public.checkout_quotes; item jsonb; oid uuid; cid uuid; aid uuid; remaining integer; begin
select * into r from public.checkout_reservations where id=p_reservation_id for update;
if not found then raise exception 'Reservation missing'; end if;
select id into oid from public.orders where reservation_id=r.id;
if oid is not null then insert into public.webhook_events(id,provider,type) values(p_event_id,'stripe',p_event_type) on conflict do nothing; return oid; end if;
if r.status='expired' then raise exception 'Payment after confirmed expiration requires review'; end if;
if r.stripe_session_id is not null and r.stripe_session_id<>p_session_id then raise exception 'Session mismatch'; end if;
if p_subtotal<>r.subtotal_cents or p_discount<>r.discount_cents or p_shipping<>r.shipping_cents or p_total<>p_subtotal-p_discount+p_shipping+p_tax or p_tax<0 then raise exception 'Payment amount mismatch'; end if;
-- Match reservation's discount-before-variants lock order to avoid payment/checkout deadlocks.
perform 1 from public.discounts where id=r.discount_id for update;
select * into q from public.checkout_quotes where id=r.quote_id;
insert into public.webhook_events(id,provider,type) values(p_event_id,'stripe',p_event_type) on conflict do nothing;
insert into public.customers(email,stripe_customer_id) values(q.email,p_customer_id) on conflict(email) do update set stripe_customer_id=excluded.stripe_customer_id returning id into cid;
insert into public.addresses(customer_id,name,street1,street2,city,state,zip,country,phone) values(cid,q.address->>'name',q.address->>'street1',coalesce(q.address->>'street2',''),q.address->>'city',q.address->>'state',q.address->>'zip',q.address->>'country',q.address->>'phone') returning id into aid;
insert into public.orders(reservation_id,customer_id,address_id,email,shipping_address,subtotal_cents,discount_cents,shipping_cents,tax_cents,total_cents,stripe_customer_id,stripe_checkout_session_id,stripe_payment_intent_id,shipping_service,discount_code) values(r.id,cid,aid,q.email,q.address,p_subtotal,p_discount,p_shipping,p_tax,p_total,p_customer_id,p_session_id,p_payment_intent_id,r.shipping_service,(select code from public.discounts where id=r.discount_id)) returning id into oid;
for item in select x from jsonb_array_elements(r.items) x order by x->>'variant_id' loop
 update public.product_variants set inventory_quantity=inventory_quantity-(item->>'quantity')::integer where id=(item->>'variant_id')::uuid and inventory_quantity>=(item->>'quantity')::integer returning inventory_quantity into remaining;
 if not found then raise exception 'Inventory reconciliation required'; end if;
 insert into public.order_items(order_id,product_id,variant_id,name,sku,size,color,unit_price_cents,quantity,weight_oz,image_url) values(oid,(item->>'product_id')::uuid,(item->>'variant_id')::uuid,item->>'name',item->>'sku',item->>'size',item->>'color',(item->>'unit_price_cents')::integer,(item->>'quantity')::integer,(item->>'weight_oz')::numeric,item->>'image_url');
 insert into public.inventory_adjustments(variant_id,quantity_change,reason,order_id) values((item->>'variant_id')::uuid,-(item->>'quantity')::integer,'Confirmed payment',oid);
 if remaining<=3 then insert into public.email_outbox(dedupe_key,kind,payload) values('low:'||oid||':'||(item->>'variant_id'),'low_stock',jsonb_build_object('order_id',oid,'message',(item->>'name')||' / '||(item->>'sku')||': '||remaining||' remaining')) on conflict do nothing; end if;
end loop;
insert into public.payments(order_id,stripe_payment_intent_id,stripe_checkout_session_id,amount_cents,status) values(oid,p_payment_intent_id,p_session_id,p_total,'paid');
update public.checkout_reservations set status='paid',stripe_session_id=p_session_id,stripe_customer_id=p_customer_id where id=r.id;
update public.discounts set uses=uses+1 where id=r.discount_id;
insert into public.order_events(order_id,kind,message) values(oid,'paid','Payment confirmed by Stripe webhook.');
insert into public.email_outbox(dedupe_key,kind,recipient,payload) values('paid:'||oid,'order_confirmation',q.email,jsonb_build_object('order_id',oid)),('owner-paid:'||oid,'owner_order',null,jsonb_build_object('order_id',oid));
return oid; end $$;

create function public.expire_reservation(p_id uuid,p_session_id text) returns void language plpgsql set search_path='' as $$ begin
update public.checkout_reservations set status='expired' where id=p_id and stripe_session_id=p_session_id and status in ('creating','active');
end $$;

create function public.adjust_inventory(p_variant_id uuid,p_quantity_change integer,p_reason text,p_admin_id uuid) returns void language plpgsql set search_path='' as $$
declare reserved integer; v public.product_variants; begin
select * into v from public.product_variants where id=p_variant_id for update;
if not found then raise exception 'Variant missing'; end if;
select coalesce(sum((x->>'quantity')::integer),0) into reserved from public.checkout_reservations cr cross join jsonb_array_elements(cr.items) x where cr.status in ('creating','active') and x->>'variant_id'=p_variant_id::text;
if v.inventory_quantity+p_quantity_change<reserved then raise exception 'Inventory is reserved by a checkout'; end if;
update public.product_variants set inventory_quantity=inventory_quantity+p_quantity_change where id=p_variant_id;
insert into public.inventory_adjustments(variant_id,quantity_change,reason,admin_id) values(p_variant_id,p_quantity_change,p_reason,p_admin_id);
end $$;

create function public.apply_refund(p_event_id text,p_refund_id text,p_payment_intent_id text,p_amount integer,p_status text) returns uuid language plpgsql set search_path='' as $$
declare o public.orders; total integer; item record; restock boolean; begin
select * into o from public.orders where stripe_payment_intent_id=p_payment_intent_id for update;
if not found then raise exception 'Order not ready'; end if;
if p_amount<=0 or p_amount>o.total_cents then raise exception 'Invalid refund amount'; end if;
if exists(select 1 from public.refunds where id=p_refund_id and (order_id<>o.id or amount_cents<>p_amount)) then raise exception 'Refund identity mismatch'; end if;
-- Succeeded is terminal. A delayed pending/failed event must not reverse totals or restocking.
insert into public.refunds(id,order_id,amount_cents,status) values(p_refund_id,o.id,p_amount,p_status) on conflict(id) do update set status=case when refunds.status='succeeded' then refunds.status else excluded.status end;
select coalesce(sum(amount_cents),0) into total from public.refunds where order_id=o.id and status='succeeded';
update public.orders set refunded_cents=total,status=case when total>=total_cents then 'refunded' else status end,updated_at=now() where id=o.id;
if total>=o.total_cents and not o.inventory_restored then
 select rr.restock into restock from public.refund_requests rr where rr.order_id=o.id;
 if coalesce(restock,false) then
 for item in select * from public.order_items where order_id=o.id and variant_id is not null order by variant_id loop
 update public.product_variants set inventory_quantity=inventory_quantity+item.quantity where id=item.variant_id;
 insert into public.inventory_adjustments(variant_id,quantity_change,reason,order_id) values(item.variant_id,item.quantity,'Authorized full refund restock',o.id);
 end loop;
 update public.orders set inventory_restored=true where id=o.id;
 end if;
end if;
if p_status='succeeded' then
insert into public.email_outbox(dedupe_key,kind,recipient,payload) values('refund:'||p_refund_id,'refund',o.email,jsonb_build_object('order_id',o.id,'amount_cents',p_amount)) on conflict do nothing;
end if;
insert into public.webhook_events(id,provider,type) values(p_event_id,'stripe','refund') on conflict do nothing;
if not exists(select 1 from public.order_events where order_id=o.id and kind='refund:'||p_refund_id||':'||p_status) then insert into public.order_events(order_id,kind,message) values(o.id,'refund:'||p_refund_id||':'||p_status,'Stripe refund '||p_status); end if;
return o.id; end $$;

create function public.claim_emails(p_limit integer) returns setof public.email_outbox language sql set search_path='' as $$
update public.email_outbox set status='sending',lease_until=now()+interval '5 minutes',attempts=attempts+1 where id in(select id from public.email_outbox where ((status='pending' and available_at<=now()) or (status='sending' and lease_until<now())) and attempts<12 order by created_at for update skip locked limit least(p_limit,50)) returning *;
$$;

-- Service operations deliberately use SECURITY INVOKER, revoked from public/authenticated.
do $$ declare f record; begin for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('consume_rate_limit','reserve_checkout','finalize_checkout','expire_reservation','adjust_inventory','apply_refund','claim_emails') loop execute format('revoke all on function %s from public,anon,authenticated',f.signature); execute format('grant execute on function %s to service_role',f.signature); end loop; end $$;
create index variants_product on product_variants(product_id);
create index images_product on product_images(product_id);
create index items_order on order_items(order_id);
create index events_order on order_events(order_id,created_at);
create index reservations_status on checkout_reservations(status,expires_at);
create index outbox_pending on email_outbox(status,available_at);
create index orders_email_number on orders(email,order_number);

-- Storage policies are kept separate so schema tests can use plain PostgreSQL.
