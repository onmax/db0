import type { SQLDialect, DatabaseCapabilities } from "db0";

// ============================================================================
// TypeORM Type Definitions
// ============================================================================

type AnyFunction = (...args: any[]) => any;
type AnyConstructor = new (...args: any[]) => any;

interface EntityMetadata {
  name: string;
  tableName: string;
  columns: ColumnMetadata[];
  primaryColumns: ColumnMetadata[];
  target: AnyConstructor | string;
}

interface ColumnMetadata {
  propertyName: string;
  databaseName: string;
  type: string | AnyFunction;
  isPrimary: boolean;
  isGenerated: boolean;
  isNullable: boolean;
  default?: any;
}

interface Repository<Entity = any> {
  find: (options?: TypeORMFindManyOptions<Entity>) => Promise<Entity[]>;
  findOne: (options: TypeORMFindOneOptions<Entity>) => Promise<Entity | null>;
  findOneBy: (where: TypeORMFindOptionsWhere<Entity>) => Promise<Entity | null>;
  save: <T extends Entity>(entity: T | T[]) => Promise<T | T[]>;
  insert: (
    entity: QueryDeepPartialEntity<Entity> | QueryDeepPartialEntity<Entity>[],
  ) => Promise<InsertResult>;
  update: (
    criteria: TypeORMFindOptionsWhere<Entity>,
    partialEntity: QueryDeepPartialEntity<Entity>,
  ) => Promise<UpdateResult>;
  delete: (criteria: TypeORMFindOptionsWhere<Entity>) => Promise<DeleteResult>;
  count: (options?: TypeORMFindManyOptions<Entity>) => Promise<number>;
  createQueryBuilder: (alias?: string) => SelectQueryBuilder<Entity>;
  metadata: EntityMetadata;
}

interface DataSource {
  isInitialized: boolean;
  options: DataSourceOptions;
  initialize: () => Promise<this>;
  destroy: () => Promise<void>;
  getRepository: <Entity>(target: EntityTarget<Entity>) => Repository<Entity>;
  transaction: <T>(
    runInTransaction: (entityManager: EntityManager) => Promise<T>,
  ) => Promise<T>;
  createQueryRunner: () => QueryRunner;
  entityMetadatas: EntityMetadata[];
}

interface DataSourceOptions {
  type: string;
  entities?: EntityTarget<any>[];
}

interface EntityManager {
  getRepository: <Entity>(target: EntityTarget<Entity>) => Repository<Entity>;
}

interface QueryRunner {
  connect: () => Promise<void>;
  startTransaction: (isolationLevel?: string) => Promise<void>;
  commitTransaction: () => Promise<void>;
  rollbackTransaction: () => Promise<void>;
  release: () => Promise<void>;
  manager: EntityManager;
}

interface SelectQueryBuilder<Entity> {
  where: (where: string | ((qb: this) => string), parameters?: any) => this;
  andWhere: (where: string | ((qb: this) => string), parameters?: any) => this;
  orWhere: (where: string | ((qb: this) => string), parameters?: any) => this;
  orderBy: (sort: string, order?: "ASC" | "DESC") => this;
  addOrderBy: (sort: string, order?: "ASC" | "DESC") => this;
  take: (take: number) => this;
  skip: (skip: number) => this;
  select: (selection: string | string[]) => this;
  getMany: () => Promise<Entity[]>;
  getOne: () => Promise<Entity | null>;
  getCount: () => Promise<number>;
}

interface TypeORMFindOneOptions<Entity = any> {
  where?: TypeORMFindOptionsWhere<Entity> | TypeORMFindOptionsWhere<Entity>[];
  select?: (keyof Entity)[] | TypeORMFindOptionsSelect<Entity>;
  order?: TypeORMFindOptionsOrder<Entity>;
  relations?: string[] | TypeORMFindOptionsRelations<Entity>;
}

interface TypeORMFindManyOptions<Entity = any>
  extends TypeORMFindOneOptions<Entity> {
  take?: number;
  skip?: number;
}

type TypeORMFindOptionsWhere<Entity> = {
  [P in keyof Entity]?: Entity[P] | FindOperator<Entity[P]>;
};
type TypeORMFindOptionsSelect<Entity> = { [P in keyof Entity]?: boolean };
type TypeORMFindOptionsOrder<Entity> = {
  [P in keyof Entity]?: "ASC" | "DESC" | 1 | -1;
};
type TypeORMFindOptionsRelations<Entity> = {
  [P in keyof Entity]?: boolean | object;
};
type QueryDeepPartialEntity<Entity> = {
  [P in keyof Entity]?: Entity[P] | (() => string);
};
type EntityTarget<Entity> =
  | AnyConstructor
  | string
  | { new (): Entity }
  | EntitySchema<Entity>;

interface FindOperator<T> {
  type: string;
  value: T | T[];
}

interface InsertResult {
  identifiers: { [key: string]: any }[];
  generatedMaps: { [key: string]: any }[];
  raw: any;
}

interface UpdateResult {
  affected?: number;
  raw: any;
  generatedMaps: { [key: string]: any }[];
}

interface DeleteResult {
  affected?: number;
  raw: any;
}

interface EntitySchema<Entity = any> {
  options: EntitySchemaOptions<Entity>;
}

interface EntitySchemaOptions<Entity = any> {
  name: string;
  tableName?: string;
  columns: EntitySchemaColumnOptions;
}

interface EntitySchemaColumnOptions {
  [key: string]: {
    type: any;
    primary?: boolean;
    generated?: boolean | "increment" | "uuid" | "rowid";
    nullable?: boolean;
    default?: any;
  };
}

// ============================================================================
// Type Inference Utilities
// ============================================================================

type ExtractEntityType<T> =
  T extends EntitySchema<infer E>
    ? E
    : T extends { new (): infer E }
      ? E
      : T extends AnyConstructor
        ? any
        : any;

// ============================================================================
// Entity Definition Types
// ============================================================================

interface ColumnDefinition {
  name: string;
  databaseName: string;
  type: string;
  isPrimary: boolean;
  isGenerated: boolean;
  isNullable: boolean;
  hasDefault: boolean;
}

export interface EntityDefinition<TEntity = unknown> {
  name: string;
  tableName: string;
  columns: Record<string, ColumnDefinition>;
  _types: { entity: TEntity };
}

// ============================================================================
// Model API Types
// ============================================================================

type WhereOperator<T> =
  | T
  | { eq: T }
  | { ne: T }
  | { gt: T }
  | { gte: T }
  | { lt: T }
  | { lte: T }
  | { like: T extends string ? string : never }
  | { in: T[] }
  | { isNull: true }
  | { isNotNull: true };

type WhereClause<T> = { [K in keyof T]?: WhereOperator<T[K]> };

type SelectFields<T> = (keyof T)[];

export interface ModelFindOneOptions<T> {
  where?: WhereClause<T>;
  select?: SelectFields<T>;
}

type OrderByDirection = "asc" | "desc";
type OrderByClause<T> = { [K in keyof T]?: OrderByDirection };

export interface ModelFindManyOptions<T> {
  where?: WhereClause<T>;
  select?: SelectFields<T>;
  limit?: number;
  offset?: number;
  orderBy?: OrderByClause<T>;
}

export interface UpdateOptions<T, TUpdate> {
  where: WhereClause<T>;
  data: TUpdate;
}

export interface DeleteOptions<T> {
  where: WhereClause<T>;
}

type PickFields<T, K extends (keyof T)[] | undefined> = K extends (keyof T)[]
  ? Pick<T, K[number]>
  : T;

// ============================================================================
// Model Interface
// ============================================================================

export interface Model<TEntity, TCreate, TUpdate> {
  findOne<K extends (keyof TEntity)[] | undefined = undefined>(
    options?: ModelFindOneOptions<TEntity> & { select?: K },
  ): Promise<PickFields<TEntity, K> | null>;
  findMany<K extends (keyof TEntity)[] | undefined = undefined>(
    options?: ModelFindManyOptions<TEntity> & { select?: K },
  ): Promise<PickFields<TEntity, K>[]>;
  create(data: TCreate): Promise<TEntity>;
  createMany(data: TCreate[]): Promise<{ count: number }>;
  update(options: UpdateOptions<TEntity, TUpdate>): Promise<TEntity | null>;
  updateMany(options: UpdateOptions<TEntity, TUpdate>): Promise<TEntity[]>;
  delete(options: DeleteOptions<TEntity>): Promise<TEntity | null>;
  deleteMany(options: DeleteOptions<TEntity>): Promise<{ count: number }>;
  count(options?: { where?: WhereClause<TEntity> }): Promise<number>;
}

// ============================================================================
// Transaction Types
// ============================================================================

export interface TypeORMTransaction<
  TEntities extends Record<string, EntityTarget<any>>,
> {
  native: EntityManager;
  model: <K extends keyof TEntities>(
    name: K,
  ) => Model<
    ExtractEntityType<TEntities[K]>,
    Partial<ExtractEntityType<TEntities[K]>>,
    Partial<ExtractEntityType<TEntities[K]>>
  >;
}

export interface TransactionOptions {
  isolationLevel?:
    | "READ UNCOMMITTED"
    | "READ COMMITTED"
    | "REPEATABLE READ"
    | "SERIALIZABLE";
}

// ============================================================================
// Adapter Result Types
// ============================================================================

export interface TypeORMAdapterResult<
  TEntities extends Record<string, EntityTarget<any>>,
> {
  native: DataSource;
  dialect: SQLDialect;
  capabilities: DatabaseCapabilities;
  entities: {
    [K in keyof TEntities]: EntityDefinition<ExtractEntityType<TEntities[K]>>;
  };
  getEntityDefinition: <K extends keyof TEntities>(
    name: K,
  ) => EntityDefinition<ExtractEntityType<TEntities[K]>>;
  model: <K extends keyof TEntities>(
    name: K,
  ) => Model<
    ExtractEntityType<TEntities[K]>,
    Partial<ExtractEntityType<TEntities[K]>>,
    Partial<ExtractEntityType<TEntities[K]>>
  >;
  transaction: <T>(
    fn: (tx: TypeORMTransaction<TEntities>) => Promise<T>,
    options?: TransactionOptions,
  ) => Promise<T>;
  dispose: () => Promise<void>;
}

export interface TypeORMAdapterConfig<
  TEntities extends Record<string, EntityTarget<any>>,
> {
  dialect?: SQLDialect;
  entities: TEntities;
}

// ============================================================================
// Dialect Detection
// ============================================================================

function detectDialect(dataSource: DataSource): SQLDialect {
  const type = dataSource.options.type.toLowerCase();

  if (type.includes("postgres")) return "postgresql";
  if (type.includes("mysql") || type.includes("mariadb")) return "mysql";
  if (type.includes("sqlite") || type.includes("better-sqlite3"))
    return "sqlite";
  if (type.includes("mssql") || type.includes("sqlserver")) return "mssql";

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
// Entity Definition Extraction
// ============================================================================

function extractEntityDefinitions<
  TEntities extends Record<string, EntityTarget<any>>,
>(
  dataSource: DataSource,
  entities: TEntities,
): Record<string, EntityDefinition> {
  const definitions: Record<string, EntityDefinition> = {};

  for (const [key, entity] of Object.entries(entities)) {
    const metadata = dataSource.entityMetadatas.find((meta) => {
      if (isEntitySchema(entity)) {
        return meta.name === (entity as EntitySchema).options.name;
      }
      if (typeof entity === "function") {
        return meta.target === entity || meta.name === entity.name;
      }
      return false;
    });

    if (metadata) {
      const columns: Record<string, ColumnDefinition> = {};
      for (const col of metadata.columns) {
        columns[col.propertyName] = {
          name: col.propertyName,
          databaseName: col.databaseName,
          type:
            typeof col.type === "function" ? col.type.name : String(col.type),
          isPrimary: col.isPrimary,
          isGenerated: col.isGenerated,
          isNullable: col.isNullable,
          hasDefault: col.default !== undefined || col.isGenerated,
        };
      }

      definitions[key] = {
        name: metadata.name,
        tableName: metadata.tableName,
        columns,
        _types: {} as any,
      };
    } else {
      // Fallback for entities not yet registered
      definitions[key] = {
        name: key,
        tableName: key,
        columns: {},
        _types: {} as any,
      };
    }
  }

  return definitions;
}

function isEntitySchema(entity: any): entity is EntitySchema {
  return (
    entity &&
    typeof entity === "object" &&
    "options" in entity &&
    entity.options?.name
  );
}

// ============================================================================
// Where Clause Builder
// ============================================================================

function buildTypeORMWhere<T>(
  where?: WhereClause<T>,
): TypeORMFindOptionsWhere<T> | undefined {
  if (!where) return undefined;

  const result: any = {};

  for (const [key, value] of Object.entries(where)) {
    if (value === null || value === undefined) continue;

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const op = value as Record<string, unknown>;

      if ("eq" in op) {
        result[key] = op.eq;
      } else if ("ne" in op) {
        result[key] = { $ne: op.ne }; // Will be handled in query builder
      } else if ("gt" in op) {
        result[key] = { $gt: op.gt };
      } else if ("gte" in op) {
        result[key] = { $gte: op.gte };
      } else if ("lt" in op) {
        result[key] = { $lt: op.lt };
      } else if ("lte" in op) {
        result[key] = { $lte: op.lte };
      } else if ("like" in op) {
        result[key] = { $like: op.like };
      } else if ("in" in op) {
        result[key] = { $in: op.in };
      } else if ("isNull" in op) {
        result[key] = null;
      } else if ("isNotNull" in op) {
        result[key] = { $not: null };
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

function applyWhereToQueryBuilder<Entity>(
  qb: SelectQueryBuilder<Entity>,
  alias: string,
  where?: WhereClause<Entity>,
): void {
  if (!where) return;

  let isFirst = true;
  for (const [key, value] of Object.entries(where)) {
    if (value === null || value === undefined) continue;

    const method = isFirst ? "where" : "andWhere";
    isFirst = false;

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const op = value as Record<string, unknown>;

      if ("eq" in op) {
        qb[method](`${alias}.${key} = :${key}`, { [key]: op.eq });
      } else if ("ne" in op) {
        qb[method](`${alias}.${key} != :${key}`, { [key]: op.ne });
      } else if ("gt" in op) {
        qb[method](`${alias}.${key} > :${key}`, { [key]: op.gt });
      } else if ("gte" in op) {
        qb[method](`${alias}.${key} >= :${key}`, { [key]: op.gte });
      } else if ("lt" in op) {
        qb[method](`${alias}.${key} < :${key}`, { [key]: op.lt });
      } else if ("lte" in op) {
        qb[method](`${alias}.${key} <= :${key}`, { [key]: op.lte });
      } else if ("like" in op) {
        qb[method](`${alias}.${key} LIKE :${key}`, { [key]: op.like });
      } else if ("in" in op) {
        qb[method](`${alias}.${key} IN (:...${key})`, { [key]: op.in });
      } else if ("isNull" in op) {
        qb[method](`${alias}.${key} IS NULL`);
      } else if ("isNotNull" in op) {
        qb[method](`${alias}.${key} IS NOT NULL`);
      }
    } else {
      qb[method](`${alias}.${key} = :${key}`, { [key]: value });
    }
  }
}

// ============================================================================
// Model Implementation
// ============================================================================

function createModel<TEntity, TCreate, TUpdate>(
  repo: Repository<TEntity>,
  entityTarget: EntityTarget<TEntity>,
): Model<TEntity, TCreate, TUpdate> {
  const alias = repo.metadata.name.toLowerCase();

  return {
    async findOne<F extends (keyof TEntity)[] | undefined = undefined>(
      options?: ModelFindOneOptions<TEntity> & { select?: F },
    ): Promise<PickFields<TEntity, F> | null> {
      const qb = repo.createQueryBuilder(alias);

      if (options?.select && options.select.length > 0) {
        qb.select(options.select.map((s) => `${alias}.${String(s)}`));
      }

      applyWhereToQueryBuilder(qb, alias, options?.where);
      qb.take(1);

      const result = await qb.getOne();
      return result as PickFields<TEntity, F> | null;
    },

    async findMany<F extends (keyof TEntity)[] | undefined = undefined>(
      options?: ModelFindManyOptions<TEntity> & { select?: F },
    ): Promise<PickFields<TEntity, F>[]> {
      const qb = repo.createQueryBuilder(alias);

      if (options?.select && options.select.length > 0) {
        qb.select(options.select.map((s) => `${alias}.${String(s)}`));
      }

      applyWhereToQueryBuilder(qb, alias, options?.where);

      if (options?.orderBy) {
        let isFirst = true;
        for (const [field, direction] of Object.entries(options.orderBy)) {
          const order = direction === "asc" ? "ASC" : "DESC";
          if (isFirst) {
            qb.orderBy(`${alias}.${field}`, order);
            isFirst = false;
          } else {
            qb.addOrderBy(`${alias}.${field}`, order);
          }
        }
      }

      if (options?.limit !== undefined) {
        qb.take(options.limit);
      }

      if (options?.offset !== undefined) {
        qb.skip(options.offset);
      }

      const results = await qb.getMany();
      return results as PickFields<TEntity, F>[];
    },

    async create(data: TCreate): Promise<TEntity> {
      const result = await repo.save(data as any);
      return result as TEntity;
    },

    async createMany(data: TCreate[]): Promise<{ count: number }> {
      const result = await repo.insert(data as any[]);
      return { count: result.identifiers.length };
    },

    async update(
      options: UpdateOptions<TEntity, TUpdate>,
    ): Promise<TEntity | null> {
      const qb = repo.createQueryBuilder(alias);
      applyWhereToQueryBuilder(qb, alias, options.where);
      qb.take(1);

      const existing = await qb.getOne();
      if (!existing) return null;

      // Get primary key(s)
      const primaryCols = repo.metadata.primaryColumns;
      const whereUnique: any = {};
      for (const col of primaryCols) {
        whereUnique[col.propertyName] = (existing as any)[col.propertyName];
      }

      await repo.update(whereUnique, options.data as any);

      // Fetch updated record
      return repo.findOneBy(whereUnique);
    },

    async updateMany(
      options: UpdateOptions<TEntity, TUpdate>,
    ): Promise<TEntity[]> {
      const qb = repo.createQueryBuilder(alias);
      applyWhereToQueryBuilder(qb, alias, options.where);

      const existing = await qb.getMany();
      if (existing.length === 0) return [];

      // Get primary key(s)
      const primaryCols = repo.metadata.primaryColumns;

      for (const record of existing) {
        const whereUnique: any = {};
        for (const col of primaryCols) {
          whereUnique[col.propertyName] = (record as any)[col.propertyName];
        }
        await repo.update(whereUnique, options.data as any);
      }

      // Fetch updated records
      const updated: TEntity[] = [];
      for (const record of existing) {
        const whereUnique: any = {};
        for (const col of primaryCols) {
          whereUnique[col.propertyName] = (record as any)[col.propertyName];
        }
        const updatedRecord = await repo.findOneBy(whereUnique);
        if (updatedRecord) updated.push(updatedRecord);
      }

      return updated;
    },

    async delete(options: DeleteOptions<TEntity>): Promise<TEntity | null> {
      if (!options.where || Object.keys(options.where).length === 0) {
        throw new Error(
          "delete() requires a where clause to prevent accidental deletion of all records",
        );
      }

      const qb = repo.createQueryBuilder(alias);
      applyWhereToQueryBuilder(qb, alias, options.where);
      qb.take(1);

      const existing = await qb.getOne();
      if (!existing) return null;

      // Get primary key(s)
      const primaryCols = repo.metadata.primaryColumns;
      const whereUnique: any = {};
      for (const col of primaryCols) {
        whereUnique[col.propertyName] = (existing as any)[col.propertyName];
      }

      await repo.delete(whereUnique);
      return existing;
    },

    async deleteMany(
      options: DeleteOptions<TEntity>,
    ): Promise<{ count: number }> {
      if (!options.where || Object.keys(options.where).length === 0) {
        throw new Error(
          "deleteMany() requires a where clause to prevent accidental deletion of all records",
        );
      }

      const qb = repo.createQueryBuilder(alias);
      applyWhereToQueryBuilder(qb, alias, options.where);

      const existing = await qb.getMany();
      if (existing.length === 0) return { count: 0 };

      // Delete each record
      const primaryCols = repo.metadata.primaryColumns;
      for (const record of existing) {
        const whereUnique: any = {};
        for (const col of primaryCols) {
          whereUnique[col.propertyName] = (record as any)[col.propertyName];
        }
        await repo.delete(whereUnique);
      }

      return { count: existing.length };
    },

    async count(options?: { where?: WhereClause<TEntity> }): Promise<number> {
      const qb = repo.createQueryBuilder(alias);
      applyWhereToQueryBuilder(qb, alias, options?.where);
      return qb.getCount();
    },
  };
}

// ============================================================================
// TypeORM Adapter
// ============================================================================

export function typeormAdapter<
  TEntities extends Record<string, EntityTarget<any>>,
>(
  dataSource: DataSource,
  config: TypeORMAdapterConfig<TEntities>,
): TypeORMAdapterResult<TEntities> {
  const dialect = config.dialect ?? detectDialect(dataSource);
  const capabilities = getCapabilities(dialect);
  const entityDefinitions = extractEntityDefinitions(
    dataSource,
    config.entities,
  );

  const entities = {} as TypeORMAdapterResult<TEntities>["entities"];
  for (const [key, def] of Object.entries(entityDefinitions)) {
    (entities as any)[key] = def;
  }

  return {
    native: dataSource,
    dialect,
    capabilities,
    entities,

    getEntityDefinition<K extends keyof TEntities>(name: K) {
      const def = entityDefinitions[name as string];
      if (!def) throw new Error(`Entity "${String(name)}" not found`);
      return def as any;
    },

    model<K extends keyof TEntities>(name: K) {
      const entityTarget = config.entities[name];
      if (!entityTarget) {
        throw new Error(`Entity "${String(name)}" not found`);
      }

      const repo = dataSource.getRepository(entityTarget);
      return createModel<ExtractEntityType<TEntities[K]>, any, any>(
        repo,
        entityTarget,
      );
    },

    async transaction<T>(
      fn: (tx: TypeORMTransaction<TEntities>) => Promise<T>,
      options?: TransactionOptions,
    ): Promise<T> {
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();

      try {
        await queryRunner.startTransaction(options?.isolationLevel);

        const tx: TypeORMTransaction<TEntities> = {
          native: queryRunner.manager,
          model<K extends keyof TEntities>(modelName: K) {
            const entityTarget = config.entities[modelName];
            if (!entityTarget) {
              throw new Error(`Entity "${String(modelName)}" not found`);
            }

            const repo = queryRunner.manager.getRepository(entityTarget);
            return createModel<ExtractEntityType<TEntities[K]>, any, any>(
              repo,
              entityTarget,
            );
          },
        };

        const result = await fn(tx);
        await queryRunner.commitTransaction();
        return result;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    },

    async dispose() {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    },
  };
}

export type {
  DataSource,
  DataSourceOptions,
  Repository,
  EntityTarget,
  EntitySchema,
  EntitySchemaOptions,
  EntityManager,
  QueryRunner,
  WhereClause,
  WhereOperator,
  OrderByClause,
  OrderByDirection,
};
