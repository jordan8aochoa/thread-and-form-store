-- Atomic studio changes. The API validates administrator membership before using
-- these service-only SECURITY INVOKER functions. RLS remains enabled throughout.
create function public.save_product(p_product jsonb,p_variants jsonb,p_images jsonb,p_admin_id uuid) returns uuid language plpgsql set search_path='' as $$
declare pid uuid; v jsonb; vid uuid; im jsonb; current_product public.products; begin
if not exists(select 1 from public.admin_profiles where id=p_admin_id and active and role in ('owner','admin')) then raise exception 'Administrator required'; end if;
if jsonb_array_length(p_variants)<1 or jsonb_array_length(p_variants)>100 or jsonb_array_length(p_images)>30 then raise exception 'Invalid product structure'; end if;
if p_product->>'id' is not null then
 pid:=(p_product->>'id')::uuid;
 select * into current_product from public.products where id=pid for update;
 if not found then raise exception 'Product missing'; end if;
 update public.products set name=p_product->>'name',slug=p_product->>'slug',description=p_product->>'description',category=p_product->>'category',price_cents=(p_product->>'price_cents')::integer,sale_price_cents=(p_product->>'sale_price_cents')::integer,active=(p_product->>'active')::boolean,featured=(p_product->>'featured')::boolean,seo_title=p_product->>'seo_title',seo_description=p_product->>'seo_description',updated_at=now() where id=pid;
else
 insert into public.products(name,slug,description,category,price_cents,sale_price_cents,active,featured,seo_title,seo_description) values(p_product->>'name',p_product->>'slug',p_product->>'description',p_product->>'category',(p_product->>'price_cents')::integer,(p_product->>'sale_price_cents')::integer,(p_product->>'active')::boolean,(p_product->>'featured')::boolean,p_product->>'seo_title',p_product->>'seo_description') returning id into pid;
end if;
-- Omitted existing variants are archived, preserving inventory and references.
update public.product_variants set active=false where product_id=pid and id not in(select (x->>'id')::uuid from jsonb_array_elements(p_variants) x where x->>'id' is not null);
for v in select x from jsonb_array_elements(p_variants) x loop
 if v->>'id' is not null then
  vid:=(v->>'id')::uuid;
  update public.product_variants set size=v->>'size',color=v->>'color',sku=v->>'sku',price_override_cents=(v->>'price_override_cents')::integer,weight_oz=(v->>'weight_oz')::numeric,active=(v->>'active')::boolean where id=vid and product_id=pid;
  if not found then raise exception 'Variant does not belong to product'; end if;
 else
  insert into public.product_variants(product_id,size,color,sku,price_override_cents,inventory_quantity,weight_oz,active) values(pid,v->>'size',v->>'color',v->>'sku',(v->>'price_override_cents')::integer,(v->>'inventory_quantity')::integer,(v->>'weight_oz')::numeric,(v->>'active')::boolean) returning id into vid;
  insert into public.inventory_adjustments(variant_id,quantity_change,reason,admin_id) values(vid,(v->>'inventory_quantity')::integer,'Opening inventory',p_admin_id);
 end if;
end loop;
delete from public.product_images where product_id=pid;
for im in select x from jsonb_array_elements(p_images) x loop
 insert into public.product_images(product_id,url,alt,position) values(pid,im->>'url',im->>'alt',(im->>'position')::integer);
end loop;
return pid;
end $$;

create function public.delete_product(p_product_id uuid,p_admin_id uuid) returns void language plpgsql set search_path='' as $$
begin
if not exists(select 1 from public.admin_profiles where id=p_admin_id and active and role in ('owner','admin')) then raise exception 'Administrator required'; end if;
perform 1 from public.products where id=p_product_id for update;
if not found then raise exception 'Product missing'; end if;
perform 1 from public.product_variants where product_id=p_product_id order by id for update;
if exists(select 1 from public.checkout_reservations cr cross join jsonb_array_elements(cr.items) x where cr.status in ('creating','active') and x->>'product_id'=p_product_id::text) then raise exception 'Product is reserved in a checkout; archive it instead'; end if;
delete from public.products where id=p_product_id;
end $$;

create function public.admin_metrics() returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('revenue_cents',(select coalesce(sum(total_cents-refunded_cents),0) from public.orders where status not in ('pending','canceled')),'order_count',(select count(*) from public.orders),'units_sold',(select coalesce(sum(i.quantity),0) from public.order_items i join public.orders o on o.id=i.order_id where o.status not in ('pending','canceled','refunded')),'to_fulfill',(select count(*) from public.orders where status in ('paid','processing')),'low_stock',(select count(*) from public.product_variants v join public.products p on p.id=v.product_id where p.active and v.active and v.inventory_quantity<=3));
$$;

create function public.start_processing(p_order_id uuid,p_admin_id uuid) returns void language plpgsql set search_path='' as $$
begin
if not exists(select 1 from public.admin_profiles where id=p_admin_id and active and role in ('owner','admin')) then raise exception 'Administrator required'; end if;
update public.orders set status='processing',updated_at=now() where id=p_order_id and status='paid';
if not found then raise exception 'Only paid orders can enter processing'; end if;
insert into public.order_events(order_id,kind,message,admin_id) values(p_order_id,'processing','Order preparation started.',p_admin_id);
end $$;

revoke all on function public.save_product(jsonb,jsonb,jsonb,uuid),public.delete_product(uuid,uuid),public.admin_metrics(),public.start_processing(uuid,uuid) from public,anon,authenticated;
grant execute on function public.save_product(jsonb,jsonb,jsonb,uuid),public.delete_product(uuid,uuid),public.admin_metrics(),public.start_processing(uuid,uuid) to service_role;
create index inventory_adjustments_variant_date on public.inventory_adjustments(variant_id,created_at desc);
create index orders_status_date on public.orders(status,created_at desc);
