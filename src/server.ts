import type { Database, Primitive } from "./types.ts";

export interface DatabaseServerOptions {
  db: Database;
  authorize?: (req: AuthorizeRequest) => void | Promise<void>;
}

export interface AuthorizeRequest {
  event: { node: { req: any; res: any }; [key: string]: any };
  type: "read" | "write";
}

export interface DatabaseResponse {
  rows?: unknown[];
  success: boolean;
  lastInsertRowid?: number;
  changes?: number;
  error?: string;
}

function isSelectQuery(sql: string): boolean {
  const trimmed = sql.trim().toUpperCase();
  return (
    trimmed.startsWith("SELECT") ||
    trimmed.startsWith("WITH") ||
    trimmed.startsWith("EXPLAIN")
  );
}

export function createDatabaseHandler(opts: DatabaseServerOptions) {
  return async (
    event: AuthorizeRequest["event"],
  ): Promise<DatabaseResponse> => {
    const { db, authorize } = opts;

    try {
      const method = event.node?.req?.method || event.method || "GET";

      if (method === "GET") {
        const url = new URL(
          event.node?.req?.url || event.path || "/",
          "http://localhost",
        );
        const sql = url.searchParams.get("sql");
        const paramsJson = url.searchParams.get("params");

        if (!sql) {
          return { success: false, error: "Missing sql parameter" };
        }

        if (!isSelectQuery(sql)) {
          return {
            success: false,
            error: "GET requests only allow SELECT queries",
          };
        }

        if (authorize) {
          await authorize({ event, type: "read" });
        }

        const params: Primitive[] = paramsJson ? JSON.parse(paramsJson) : [];
        const stmt = db.prepare(sql);
        const rows = await stmt.all(...params);

        return { rows, success: true };
      }

      if (method === "POST") {
        const body = (await readBody(event)) as {
          sql?: string;
          params?: Primitive[];
        } | null;

        if (!body?.sql) {
          return { success: false, error: "Missing sql in request body" };
        }

        const { sql, params = [] } = body;
        const queryType: "read" | "write" = isSelectQuery(sql)
          ? "read"
          : "write";

        if (authorize) {
          await authorize({ event, type: queryType });
        }

        const stmt = db.prepare(sql);

        if (isSelectQuery(sql)) {
          const rows = await stmt.all(...params);
          return { rows, success: true };
        }

        const result = await stmt.run(...params);
        return {
          success: result.success,
          lastInsertRowid: (result as any).lastInsertRowid,
          changes: (result as any).changes,
        };
      }

      return { success: false, error: `Method ${method} not allowed` };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || String(error),
      };
    }
  };
}

async function readBody(event: AuthorizeRequest["event"]): Promise<unknown> {
  // h3 event
  if (typeof (event as any).readBody === "function") {
    return (event as any).readBody();
  }

  // Native Node.js request
  const req = event.node?.req;
  if (req?.on) {
    return new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk: any) => (data += chunk));
      req.on("end", () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch {
          resolve({});
        }
      });
      req.on("error", reject);
    });
  }

  // Fetch API request
  if (typeof (event as any).json === "function") {
    return (event as any).json();
  }

  return {};
}
