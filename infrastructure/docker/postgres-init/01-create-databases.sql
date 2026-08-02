-- Creates one database per service. Database-per-service is the boundary that stops two
-- services quietly coupling through a shared table (see docs/architecture.md).
--
-- IMPORTANT: scripts in /docker-entrypoint-initdb.d run ONLY when the data directory is empty,
-- i.e. on the very first start of a fresh volume. Editing this file later does nothing until the
-- volume is destroyed:  docker compose down -v && docker compose up -d
--
-- Postgres has no CREATE DATABASE IF NOT EXISTS, which is fine precisely because this only ever
-- runs once. Owner defaults to the connecting role (POSTGRES_USER), which is what we want.

CREATE DATABASE auth_db;
CREATE DATABASE notes_db;
CREATE DATABASE todo_db;
