import type { SQLDialect, DatabaseCapabilities } from "db0";

// ============================================================================
// Prisma Client Type Definitions
// ============================================================================

type PrismaAction =
  | "findUnique"
  | "findUniqueOrThrow"
  | "findFirst"
  | "findFirstOrThrow"
  | "findMany"
  | "create"
  | "createMany"
  | "createManyAndReturn"
  | "update"
  | "updateMany"
  | "updateManyAndReturn"
  | "upsert"
  | "delete"
  | "deleteMany"
  | "deleteManyAndReturn"
  | "aggregate"
  | "groupBy"
  | "count";

interface PrismaModelDelegate {
  findUnique: (args: any) => Promise<any>;
  findUniqueOrThrow: (args: any) => Promise<any>;
  findFirst: (args: any) => Promise<any>;
  findFirstOrThrow: (args: any) => Promise<any>;
  findMany: (args?: any) => Promise<any[]>;
  create: (args: any) => Promise<any>;
  createMany: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  updateMany: (args: any) => Promise<any>;
  upsert: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
  deleteMany: (args?: any) => Promise<any>;
  aggregate: (args: any) => Promise<any>;
  groupBy: (args: any) => Promise<any>;
  count: (args?: any) => Promise<number>;
  fields: Record<
    string,
    {
      name: string;
      typeName: string;
      isId?: boolean;
      isRequired?: boolean;
      isList?: boolean;
      hasDefaultValue?: boolean;
      relationName?: string;
    }
  >;
}

interface PrismaClientBase {
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
  $transaction: (<T>(
    fn: (tx: any) => Promise<T>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: string },
  ) => Promise<T>) &
    (<T>(
      promises: Promise<T>[],
      options?: { isolationLevel?: string },
    ) => Promise<T[]>);
  $queryRaw: <T = unknown>(
    query: TemplateStringsArray | string,
    ...values: any[]
  ) => Promise<T>;
  $executeRaw: (
    query: TemplateStringsArray | string,
    ...values: any[]
  ) => Promise<number>;
  $queryRawUnsafe: <T = unknown>(query: string, ...values: any[]) => Promise<T>;
  $executeRawUnsafe: (query: string, ...values: any[]) => Promise<number>;
}

type PrismaClient = PrismaClientBase & Record<string, PrismaModelDelegate>;

// ============================================================================
// Type Inference Utilities
// ============================================================================

type ExtractModels<TClient> = {
  [K in keyof TClient as TClient[K] extends PrismaModelDelegate
    ? K extends `$${string}`
      ? never
      : K
    : never]: TClient[K] extends PrismaModelDelegate ? TClient[K] : never;
};

type InferPrismaModel<TDelegate> = TDelegate extends {
  findMany: (args?: any) => Promise<infer T>;
}
  ? T extends (infer U)[]
    ? U
    : never
  : never;

type InferPrismaCreateInput<TDelegate> = TDelegate extends {
  create: (args: { data: infer T }) => any;
}
  ? T
  : never;

type InferPrismaUpdateInput<TDelegate> = TDelegate extends {
  update: (args: { data: infer T }) => any;
}
  ? T
  : never;

type InferPrismaWhereInput<TDelegate> = TDelegate extends {
  findMany: (args?: { where?: infer T }) => any;
}
  ? T
  : never;

type InferPrismaWhereUniqueInput<TDelegate> = TDelegate extends {
  findUnique: (args: { where: infer T }) => any;
}
  ? T
  : never;

// ============================================================================
// Model Definition Types
// ============================================================================

interface FieldDefinition {
  name: string;
  type: string;
  isRequired: boolean;
  isList: boolean;
  isId: boolean;
  hasDefault: boolean;
  isRelation: boolean;
}

export interface ModelDefinition<
  TModel = unknown,
  TCreateInput = unknown,
  TUpdateInput = unknown,
  TWhere = unknown,
  TWhereUnique = unknown,
> {
  name: string;
  fields: Record<string, FieldDefinition>;
  _types: {
    model: TModel;
    createInput: TCreateInput;
    updateInput: TUpdateInput;
    where: TWhere;
    whereUnique: TWhereUnique;
  };
}

// ============================================================================
// Model API Types
// ============================================================================

type WhereOperator<T> =
  | T
  | {
      equals?: T;
      not?: T | WhereOperator<T>;
      in?: T[];
      notIn?: T[];
      lt?: T;
      lte?: T;
      gt?: T;
      gte?: T;
      contains?: T extends string ? string : never;
      startsWith?: T extends string ? string : never;
      endsWith?: T extends string ? string : never;
    };

type ModelWhereClause<T> = { [K in keyof T]?: WhereOperator<T[K]> } & {
  AND?: ModelWhereClause<T> | ModelWhereClause<T>[];
  OR?: ModelWhereClause<T>[];
  NOT?: ModelWhereClause<T> | ModelWhereClause<T>[];
};

type OrderByDirection = "asc" | "desc";
type ModelOrderByClause<T> = { [K in keyof T]?: OrderByDirection };

export interface ModelFindOneOptions<T> {
  where: ModelWhereClause<T>;
  select?: Partial<Record<keyof T, boolean>>;
  include?: Record<string, boolean | object>;
}

export interface ModelFindManyOptions<T> {
  where?: ModelWhereClause<T>;
  select?: Partial<Record<keyof T, boolean>>;
  include?: Record<string, boolean | object>;
  orderBy?: ModelOrderByClause<T> | ModelOrderByClause<T>[];
  take?: number;
  skip?: number;
  cursor?: Partial<T>;
  distinct?: (keyof T)[];
}

export interface ModelUpdateOptions<T, TUpdate> {
  where: ModelWhereClause<T>;
  data: TUpdate;
}

export interface ModelDeleteOptions<T> {
  where: ModelWhereClause<T>;
}

// ============================================================================
// Model Interface
// ============================================================================

export interface Model<
  TModel,
  TCreateInput,
  TUpdateInput,
  TWhere,
  TWhereUnique,
> {
  findOne(options?: {
    where?: TWhere;
    select?: Partial<Record<keyof TModel, boolean>>;
    include?: Record<string, boolean | object>;
  }): Promise<TModel | null>;
  findMany(options?: ModelFindManyOptions<TModel>): Promise<TModel[]>;
  create(data: TCreateInput): Promise<TModel>;
  update(options: { where: TWhereUnique; data: TUpdateInput }): Promise<TModel>;
  updateMany(
    options: ModelUpdateOptions<TModel, TUpdateInput>,
  ): Promise<{ count: number }>;
  delete(options: { where: TWhereUnique }): Promise<TModel>;
  deleteMany(options?: ModelDeleteOptions<TModel>): Promise<{ count: number }>;
  count(options?: { where?: TWhere }): Promise<number>;
}

// ============================================================================
// Transaction Types
// ============================================================================

export interface PrismaTransaction<TClient> {
  native: TClient;
  model: <K extends keyof ExtractModels<TClient>>(
    name: K,
  ) => Model<
    InferPrismaModel<ExtractModels<TClient>[K]>,
    InferPrismaCreateInput<ExtractModels<TClient>[K]>,
    InferPrismaUpdateInput<ExtractModels<TClient>[K]>,
    InferPrismaWhereInput<ExtractModels<TClient>[K]>,
    InferPrismaWhereUniqueInput<ExtractModels<TClient>[K]>
  >;
}

export interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
  isolationLevel?:
    | "ReadUncommitted"
    | "ReadCommitted"
    | "RepeatableRead"
    | "Serializable";
}

// ============================================================================
// Adapter Result Types
// ============================================================================

export interface PrismaAdapterResult<TClient extends PrismaClient> {
  native: TClient;
  dialect: SQLDialect;
  capabilities: DatabaseCapabilities;
  tables: {
    [K in keyof ExtractModels<TClient>]: ModelDefinition<
      InferPrismaModel<ExtractModels<TClient>[K]>,
      InferPrismaCreateInput<ExtractModels<TClient>[K]>,
      InferPrismaUpdateInput<ExtractModels<TClient>[K]>,
      InferPrismaWhereInput<ExtractModels<TClient>[K]>,
      InferPrismaWhereUniqueInput<ExtractModels<TClient>[K]>
    >;
  };
  getModelDefinition: <K extends keyof ExtractModels<TClient>>(
    name: K,
  ) => ModelDefinition<
    InferPrismaModel<ExtractModels<TClient>[K]>,
    InferPrismaCreateInput<ExtractModels<TClient>[K]>,
    InferPrismaUpdateInput<ExtractModels<TClient>[K]>,
    InferPrismaWhereInput<ExtractModels<TClient>[K]>,
    InferPrismaWhereUniqueInput<ExtractModels<TClient>[K]>
  >;
  model: <K extends keyof ExtractModels<TClient>>(
    name: K,
  ) => Model<
    InferPrismaModel<ExtractModels<TClient>[K]>,
    InferPrismaCreateInput<ExtractModels<TClient>[K]>,
    InferPrismaUpdateInput<ExtractModels<TClient>[K]>,
    InferPrismaWhereInput<ExtractModels<TClient>[K]>,
    InferPrismaWhereUniqueInput<ExtractModels<TClient>[K]>
  >;
  transaction: <T>(
    fn: (tx: PrismaTransaction<TClient>) => Promise<T>,
    options?: TransactionOptions,
  ) => Promise<T>;
  dispose: () => Promise<void>;
}

export interface PrismaAdapterConfig {
  dialect?: SQLDialect;
}

// ============================================================================
// Dialect Detection
// ============================================================================

function detectDialect(client: PrismaClient): SQLDialect {
  // Try to detect from Prisma's internal datasource
  const internals =
    (client as any)._engineConfig?.activeProvider ||
    (client as any)._activeProvider ||
    (client as any)._engine?.config?.activeProvider;

  if (internals) {
    const provider = internals.toLowerCase();
    if (provider.includes("postgresql") || provider.includes("postgres"))
      return "postgresql";
    if (provider.includes("mysql")) return "mysql";
    if (provider.includes("sqlite")) return "sqlite";
  }

  // Fallback: check for specific methods or properties
  return "postgresql";
}

function getCapabilities(dialect: SQLDialect): DatabaseCapabilities {
  switch (dialect) {
    case "postgresql": {
      return {
        supportsJSON: true,
        supportsBooleans: true,
        supportsArrays: true,
        supportsDates: true,
        supportsUUIDs: true,
        supportsTransactions: true,
        supportsBatch: true,
      };
    }
    case "mysql": {
      return {
        supportsJSON: true,
        supportsBooleans: true,
        supportsArrays: false,
        supportsDates: true,
        supportsUUIDs: false,
        supportsTransactions: true,
        supportsBatch: true,
      };
    }
    case "sqlite":
    case "libsql": {
      return {
        supportsJSON: true,
        supportsBooleans: false,
        supportsArrays: false,
        supportsDates: false,
        supportsUUIDs: false,
        supportsTransactions: true,
        supportsBatch: true,
      };
    }
    case "mssql": {
      return {
        supportsJSON: true,
        supportsBooleans: true,
        supportsArrays: false,
        supportsDates: true,
        supportsUUIDs: true,
        supportsTransactions: true,
        supportsBatch: true,
      };
    }
  }
}

// ============================================================================
// Model Definition Extraction
// ============================================================================

function extractModelDefinitions<TClient extends PrismaClient>(
  client: TClient,
): Record<string, ModelDefinition> {
  const models: Record<string, ModelDefinition> = {};

  // Get model names from Prisma client (exclude $ prefixed methods)
  for (const key of Object.keys(client)) {
    if (key.startsWith("$") || key.startsWith("_")) continue;

    const delegate = (client as any)[key];
    if (!delegate || typeof delegate !== "object") continue;

    // Check if it's a model delegate by looking for findMany
    if (typeof delegate.findMany !== "function") continue;

    const fields: Record<string, FieldDefinition> = {};

    // Try to extract field information from Prisma's internal metadata
    if (delegate.fields && typeof delegate.fields === "object") {
      for (const [fieldName, fieldMeta] of Object.entries(delegate.fields)) {
        const meta = fieldMeta as any;
        fields[fieldName] = {
          name: meta.name || fieldName,
          type: meta.typeName || "unknown",
          isRequired: meta.isRequired ?? true,
          isList: meta.isList ?? false,
          isId: meta.isId ?? false,
          hasDefault: meta.hasDefaultValue ?? false,
          isRelation: !!meta.relationName,
        };
      }
    }

    models[key] = { name: key, fields, _types: {} as any };
  }

  return models;
}

// ============================================================================
// Model Implementation
// ============================================================================

function createModel<TModel, TCreateInput, TUpdateInput, TWhere, TWhereUnique>(
  delegate: PrismaModelDelegate,
): Model<TModel, TCreateInput, TUpdateInput, TWhere, TWhereUnique> {
  return {
    async findOne(options) {
      return delegate.findFirst(options);
    },

    async findMany(options) {
      return delegate.findMany(options);
    },

    async create(data) {
      return delegate.create({ data });
    },

    async update(options) {
      return delegate.update(options);
    },

    async updateMany(options) {
      return delegate.updateMany(options);
    },

    async delete(options) {
      return delegate.delete(options);
    },

    async deleteMany(options) {
      return delegate.deleteMany(options);
    },

    async count(options) {
      return delegate.count(options);
    },
  };
}

// ============================================================================
// Prisma Adapter
// ============================================================================

export function prismaAdapter<TClient extends PrismaClient>(
  client: TClient,
  config?: PrismaAdapterConfig,
): PrismaAdapterResult<TClient> {
  const dialect = config?.dialect ?? detectDialect(client);
  const capabilities = getCapabilities(dialect);
  const modelDefinitions = extractModelDefinitions(client);

  const tables = {} as PrismaAdapterResult<TClient>["tables"];
  for (const [key, def] of Object.entries(modelDefinitions)) {
    (tables as any)[key] = def;
  }

  return {
    native: client,
    dialect,
    capabilities,
    tables,

    getModelDefinition<K extends keyof ExtractModels<TClient>>(name: K) {
      const def = modelDefinitions[name as string];
      if (!def) throw new Error(`Model "${String(name)}" not found`);
      return def as any;
    },

    model<K extends keyof ExtractModels<TClient>>(name: K) {
      const delegate = (client as any)[name as string] as PrismaModelDelegate;
      if (!delegate || typeof delegate.findMany !== "function") {
        throw new Error(`Model "${String(name)}" not found`);
      }
      return createModel(delegate);
    },

    async transaction<T>(
      fn: (tx: PrismaTransaction<TClient>) => Promise<T>,
      options?: TransactionOptions,
    ): Promise<T> {
      return client.$transaction(async (txClient) => {
        const tx: PrismaTransaction<TClient> = {
          native: txClient as TClient,
          model<K extends keyof ExtractModels<TClient>>(modelName: K) {
            const delegate = (txClient as any)[
              modelName as string
            ] as PrismaModelDelegate;
            if (!delegate || typeof delegate.findMany !== "function") {
              throw new Error(`Model "${String(modelName)}" not found`);
            }
            return createModel(delegate);
          },
        };
        return fn(tx);
      }, options);
    },

    async dispose() {
      await client.$disconnect();
    },
  };
}

export type {
  PrismaClient,
  PrismaModelDelegate,
  PrismaAction,
  ExtractModels,
  InferPrismaModel,
  InferPrismaCreateInput,
  InferPrismaUpdateInput,
  InferPrismaWhereInput,
  InferPrismaWhereUniqueInput,
};
