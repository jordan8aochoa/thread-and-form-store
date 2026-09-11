-- Replace sample descriptions, policy details, images and return address before launch.
insert into public.store_settings(id,brand_name,tagline,support_email,owner_email,return_address,free_shipping_threshold_cents,announcement)
values('store','Thread & Form','Good things, made to stay.','hello@example.com','owner@example.com','{"name":"Thread & Form","street1":"123 Example Street","street2":"","city":"Chicago","state":"IL","zip":"60601","country":"US"}',20000,'A little warmth goes a long way. Meet your new everyday knits.') on conflict(id) do nothing;
do $$
declare names text[]:=array['The Everyday Crew','The Weekend Cardigan','The Alpine Cable','The Studio Mockneck','The Soft Rib Polo','The Sunday V-neck'];
slugs text[]:=array['everyday-crew','weekend-cardigan','alpine-cable','studio-mockneck','soft-rib-polo','sunday-v-neck'];
prices integer[]:=array[9800,14800,12800,11800,10800,9800];
shades text[]:=array['Oat','Moss','Cloud','Charcoal','Clay','Walnut'];
photos text[]:=array['/images/knit-05.jpg','/images/knit-06.jpg','/images/knit-04.jpg','/images/knit-01.jpg','/images/knit-05.jpg','/images/knit-06.jpg'];
sizes text[]:=array['XS','S','M','L','XL'];
i integer;j integer;k integer;pid uuid;vid uuid;quantity integer;
begin
for i in 1..6 loop
pid:=('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
insert into public.products(id,name,slug,description,category,price_cents,sale_price_cents,active,featured,seo_title,seo_description,created_at)
values(pid,names[i],slugs[i],E'An easy layer for slow mornings and everything after. A soft, substantial knit with a relaxed shape, thoughtful proportions, and ribbed finishing. Designed to find its way into your everyday rotation.\n\nDemo product: replace this description, fiber content, care instructions, and photography with verified details before launch.',case when i=2 then 'Cardigans' when i=5 then 'Polos' else 'Sweaters' end,prices[i],case when i=5 then 8800 else null end,true,i<=3,names[i],'An effortless everyday knit from Thread & Form.',('2026-09-'||lpad((7-i)::text,2,'0')||'T12:00:00Z')::timestamptz) on conflict(id) do nothing;
insert into public.product_images(id,product_id,url,alt,position) values(('30000000-0000-4000-8000-'||lpad((i*10)::text,12,'0'))::uuid,pid,photos[i],names[i]||' — sample knitwear photography',0),(('30000000-0000-4000-8000-'||lpad((i*10+1)::text,12,'0'))::uuid,pid,photos[((i+1)%6)+1],'Sample knitwear detail',1) on conflict(id) do nothing;
for j in 1..5 loop for k in 0..1 loop
vid:=('20000000-0000-4000-8000-'||lpad((i*100+(j-1)*2+k)::text,12,'0'))::uuid;
quantity:=case when i=6 then 0 when j=3 then 3 else 12 end;
insert into public.product_variants(id,product_id,size,color,sku,inventory_quantity,weight_oz,active) values(vid,pid,sizes[j],case when k=0 then shades[i] when i%2=0 then 'Oat' else 'Charcoal' end,'TF-'||i||'-'||sizes[j]||'-'||k,quantity,18+(i-1)*2,true) on conflict(id) do nothing;
end loop;end loop;
end loop;
end $$;
insert into public.discounts(code,kind,value,active,minimum_subtotal_cents,max_uses) values('WELCOME10','percentage',10,true,0,1000) on conflict(code) do nothing;
