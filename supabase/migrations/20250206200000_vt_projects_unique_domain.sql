-- Enforce one project per (user_id, domain). Dedupe then add constraint.
-- Keeps the row with the smallest id per (user_id, domain).

DELETE FROM vt_projects a
USING vt_projects b
WHERE a.user_id = b.user_id
  AND a.domain = b.domain
  AND a.id > b.id;

ALTER TABLE vt_projects
  ADD CONSTRAINT vt_projects_user_id_domain_key UNIQUE (user_id, domain);
