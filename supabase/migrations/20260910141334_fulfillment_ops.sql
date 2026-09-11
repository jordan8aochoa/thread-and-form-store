create function public.claim_label(p_order_id uuid,p_shipment_id text,p_rate_id text) returns jsonb language plpgsql set search_path='' as $$
declare o public.orders; op public.label_operations; q public.shipping_quotes; begin
select * into o from public.orders where id=p_order_id for update;
if not found then raise exception 'Order missing'; end if;
if exists(select 1 from public.shipments where order_id=o.id) then return jsonb_build_object('complete',true); end if;
if o.status not in ('paid','processing') or exists(select 1 from public.refund_requests where order_id=o.id) then raise exception 'Order cannot be shipped'; end if;
select * into q from public.shipping_quotes where order_id=o.id and easypost_shipment_id=p_shipment_id;
if not found or not exists(select 1 from jsonb_array_elements(q.rates) x where x->>'id'=p_rate_id) then raise exception 'Invalid label rate'; end if;
select * into op from public.label_operations where order_id=o.id for update;
if found then
 if op.easypost_shipment_id<>p_shipment_id or op.rate_id<>p_rate_id then raise exception 'Retry the existing label operation before choosing another shipment'; end if;
 if op.locked_until>now() then raise exception 'Label purchase already running'; end if;
 update public.label_operations set locked_until=now()+interval '2 minutes' where order_id=o.id;
else
 if q.created_at<now()-interval '20 minutes' then raise exception 'Shipping quote expired'; end if;
 insert into public.label_operations(order_id,easypost_shipment_id,rate_id,locked_until) values(o.id,p_shipment_id,p_rate_id,now()+interval '2 minutes');
end if;
return jsonb_build_object('complete',false); end $$;

create function public.complete_fulfillment(p_order_id uuid,p_shipment jsonb,p_admin_id uuid,p_manual boolean default false) returns uuid language plpgsql set search_path='' as $$
declare o public.orders; sid uuid; op public.label_operations; begin
select * into o from public.orders where id=p_order_id for update;
if not found then raise exception 'Order missing'; end if;
select id into sid from public.shipments where order_id=o.id;
if sid is not null then return sid; end if;
if o.status not in ('paid','processing') or exists(select 1 from public.refund_requests where order_id=o.id) then raise exception 'Order cannot be fulfilled'; end if;
select * into op from public.label_operations where order_id=o.id;
if p_manual and found then raise exception 'Reconcile existing label purchase before manual fulfillment'; end if;
if not p_manual and (op.order_id is null or op.easypost_shipment_id<>p_shipment->>'easypost_shipment_id') then raise exception 'Label operation mismatch'; end if;
insert into public.shipments(order_id,easypost_shipment_id,easypost_tracker_id,label_url,carrier,service,postage_cents,tracking_code,tracking_url,status)
values(o.id,p_shipment->>'easypost_shipment_id',p_shipment->>'easypost_tracker_id',p_shipment->>'label_url',p_shipment->>'carrier',coalesce(p_shipment->>'service',''),coalesce((p_shipment->>'postage_cents')::integer,0),p_shipment->>'tracking_code',p_shipment->>'tracking_url','shipped') returning id into sid;
update public.label_operations set status='complete',locked_until=null where order_id=o.id;
update public.orders set status='shipped',updated_at=now() where id=o.id;
insert into public.order_events(order_id,kind,message,admin_id) values(o.id,'shipped',case when p_manual then 'Manually fulfilled by administrator.' else 'Shipping label purchased and tracking saved.' end,p_admin_id);
insert into public.email_outbox(dedupe_key,kind,recipient,payload) values('shipped:'||o.id,'shipping_confirmation',o.email,jsonb_build_object('order_id',o.id)) on conflict do nothing;
return sid; end $$;

create function public.request_refund(p_order_id uuid,p_restock boolean,p_reason text,p_admin_id uuid) returns jsonb language plpgsql set search_path='' as $$
declare o public.orders; r public.refund_requests; begin
select * into o from public.orders where id=p_order_id for update;
if not found then raise exception 'Order missing'; end if;
select * into r from public.refund_requests where order_id=o.id;
if found then return to_jsonb(r); end if;
if o.refunded_cents>=o.total_cents or o.status not in ('paid','processing','shipped','delivered') then raise exception 'Order cannot be refunded'; end if;
if exists(select 1 from public.label_operations where order_id=o.id and status<>'complete') then raise exception 'Reconcile pending label purchase before refunding'; end if;
insert into public.refund_requests(order_id,restock,reason,admin_id) values(o.id,p_restock,p_reason,p_admin_id) returning * into r;
insert into public.order_events(order_id,kind,message,admin_id) values(o.id,'refund_requested','Full remaining payment refund requested; inventory changes only after Stripe confirms success.',p_admin_id);
return to_jsonb(r); end $$;

create function public.apply_tracking(p_event_id text,p_tracker_id text,p_status text,p_description text,p_occurred_at timestamptz) returns void language plpgsql set search_path='' as $$
declare s public.shipments; o public.orders; begin
select * into s from public.shipments where easypost_tracker_id=p_tracker_id for update;
if not found then raise exception 'Shipment not ready'; end if;
if exists(select 1 from public.webhook_events where id=p_event_id) then return; end if;
insert into public.webhook_events(id,provider,type) values(p_event_id,'easypost','tracker.updated');
insert into public.tracking_events(shipment_id,provider_event_id,status,description,occurred_at) values(s.id,p_event_id,p_status,p_description,p_occurred_at);
update public.shipments set status=case when status='delivered' then status else p_status end where id=s.id;
if p_status='delivered' then
 select * into o from public.orders where id=s.order_id for update;
 update public.orders set status='delivered',updated_at=now() where id=o.id and status in ('shipped','processing','paid');
 insert into public.email_outbox(dedupe_key,kind,recipient,payload) values('delivered:'||o.id,'delivery',o.email,jsonb_build_object('order_id',o.id)) on conflict do nothing;
 if not exists(select 1 from public.order_events where order_id=o.id and kind='delivered') then insert into public.order_events(order_id,kind,message) values(o.id,'delivered','Carrier confirmed delivery.'); end if;
end if;
end $$;

revoke all on function public.claim_label(uuid,text,text),public.complete_fulfillment(uuid,jsonb,uuid,boolean),public.request_refund(uuid,boolean,text,uuid),public.apply_tracking(text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_label(uuid,text,text),public.complete_fulfillment(uuid,jsonb,uuid,boolean),public.request_refund(uuid,boolean,text,uuid),public.apply_tracking(text,text,text,text,timestamptz) to service_role;

-- Public photography; only authorized administrators may upload, replace, or delete files.
do $$ begin
if to_regclass('storage.buckets') is not null then
 insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('product-images','product-images',true,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=true,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
 execute 'create policy product_photos_read on storage.objects for select to anon,authenticated using (bucket_id=''product-images'')';
 execute 'create policy product_photos_admin_insert on storage.objects for insert to authenticated with check (bucket_id=''product-images'' and (select private.is_admin()))';
 execute 'create policy product_photos_admin_update on storage.objects for update to authenticated using (bucket_id=''product-images'' and (select private.is_admin())) with check (bucket_id=''product-images'' and (select private.is_admin()))';
 execute 'create policy product_photos_admin_delete on storage.objects for delete to authenticated using (bucket_id=''product-images'' and (select private.is_admin()))';
end if; end $$;
