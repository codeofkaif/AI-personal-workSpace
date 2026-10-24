-- Backfill college ownership for shared documents created before DocumentService
-- explicitly populated documents.college_id. Review the affected row count before committing.
BEGIN;

UPDATE documents AS d
SET college_id = u.college_id
FROM users AS u
WHERE d.user_id = u.id
  AND d.is_college_doc IS TRUE
  AND d.college_id IS NULL
  AND u.college_id IS NOT NULL;

COMMIT;
