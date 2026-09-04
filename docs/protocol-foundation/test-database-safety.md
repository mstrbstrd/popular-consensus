# Admission test database safety

The admission integration suite resets fixture data with TRUNCATE. Never point
this suite at a database containing retained records, real participants or keys.

When RUN_DB_TESTS=true, createAdmissionClient refuses an admission database whose
name does not end in the exact suffix `_test`. This check runs before creating
the client or opening any connection. Sharing the legacy database is still
rejected, including different loopback host spellings for the same database name.
A suffix is an accidental-target safeguard, not proof that data is disposable;
operators must still verify the target before running tests or migrations.

For example, after creating two disposable local databases:

```bash
export PC_RUNTIME_MODE=test
export RUN_DB_TESTS=true
export DATABASE_URL=postgresql://pc:pc@127.0.0.1:5432/popular_consensus_test
export ADMISSION_DATABASE_URL=postgresql://pc:pc@127.0.0.1:5432/popcon_admission_test
pnpm db:generate
pnpm db:migrate
pnpm db:admission:migrate
pnpm --filter @pc/api test
```

These are illustrative local fixture credentials, not production configuration.
Both databases are disposable. The admission guard does not alter the legacy
suite's reset behavior. The operator must also keep DATABASE_URL pointed at a
separate disposable legacy test database.

For ordinary local admission operation, leave RUN_DB_TESTS unset or false and
use its dedicated development database as described in transactional-admission.md.
Do not rename a retained database to satisfy the test guard. No runtime server
route provides a reset operation.
