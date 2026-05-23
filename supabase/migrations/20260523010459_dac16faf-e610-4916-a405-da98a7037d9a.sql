UPDATE auth.users
SET encrypted_password = crypt('Barbara26', gen_salt('bf')),
    updated_at = now()
WHERE id = '84023485-dc2b-434b-996a-fc219e844126';