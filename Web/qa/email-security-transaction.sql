-- Rollback-only checks. Never opts a real account into email protection.
begin;
do $$ declare u uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); s2 uuid:=gen_random_uuid(); c uuid; r jsonb;
begin
 if has_function_privilege('authenticated','public.seven_email_security(text,uuid,uuid,uuid,text)','EXECUTE')
 or has_table_privilege('authenticated','public.seven_email_session_proofs','INSERT') then raise exception 'Proof is publicly writable'; end if;
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(u,'email-fixture-'||u||'@example.invalid',now(),'{}');
 insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(s,u,now(),now(),'aal1'),(s2,u,now(),now(),'aal1');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'session_id',s,'aal','aal1')::text,true);
 if not public.seven_auth_assurance_ok() then raise exception 'Existing account blocked'; end if;
 r:=public.seven_email_security('start',u,s,null,'enable');c:=(r->>'id')::uuid;
 if c is null then raise exception 'Missing challenge'; end if;
 r:=public.seven_email_security('start',u,s,null,'enable');if not (r->>'cooldown')::boolean then raise exception 'No resend cooldown'; end if;
 r:=public.seven_email_security('attempt',u,s,c);if not (r->>'valid')::boolean then raise exception 'Attempt rejected'; end if;
 r:=public.seven_email_security('finish',u,s,c);if not (r->>'valid')::boolean then raise exception 'Proof rejected'; end if;
 if not public.seven_auth_assurance_ok() then raise exception 'Verified session blocked'; end if;
 r:=public.seven_email_security('finish',u,s,c);if (r->>'valid')::boolean then raise exception 'Challenge replay succeeded'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'session_id',s2,'aal','aal2')::text,true);
 if public.seven_auth_assurance_ok() then raise exception 'Other device or AAL2 bypassed email'; end if;
 update auth.users set email='changed-'||u||'@example.invalid' where id=u;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'session_id',s,'aal','aal1')::text,true);
 if public.seven_auth_assurance_ok() then raise exception 'Email change did not invalidate proof'; end if;
end $$;
rollback;
select 'PASS: email proofs are private, session bound, single use, email bound, and existing accounts remain unchanged.' as verification;
