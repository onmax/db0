import type { Generated } from "kysely";

export interface UsersTable {
  id: Generated<number>;
  name: string | null;
  email: string | null;
}

export interface Database {
  users: UsersTable;
}
