/**
 * BaseMongoRepository — Template Method for the boring 80% of persistence.
 *
 * Subclasses supply a Mongoose model and a `toDomain` mapper; they inherit
 * pagination, search, filtering and CRUD. Anything genuinely specific to an
 * aggregate (e.g. "find the contract covering this period") is added as an
 * extra method on the subclass rather than by making this class cleverer.
 *
 * Note the mapper: repositories return DOMAIN objects, never Mongoose
 * documents. Leaking a document leaks the schema, `.save()`, and change
 * tracking into the application layer.
 */
import type { FilterQuery, Model, SortOrder } from 'mongoose'
import type { IRepository, PageQuery, Paged } from '../application/repository'
import { normalizePageQuery, paged } from '../application/repository'

export abstract class BaseMongoRepository<TDomain, TDoc> implements IRepository<TDomain> {
  protected constructor(
    protected readonly model: Model<TDoc>,
    /** Fields a `search` query string should match against, case-insensitively. */
    protected readonly searchableFields: string[] = [],
  ) {}

  /** Map a persistence document to the domain shape. Subclasses must implement. */
  protected abstract toDomain(doc: TDoc): TDomain

  protected buildFilter(query: PageQuery): FilterQuery<TDoc> {
    const filter: Record<string, unknown> = { ...(query.filters ?? {}) }

    // Drop empty values so a blank <select> does not filter everything away.
    for (const [k, v] of Object.entries(filter)) {
      if (v === undefined || v === null || v === '') delete filter[k]
    }

    if (query.search && this.searchableFields.length) {
      const rx = new RegExp(escapeRegex(query.search), 'i')
      filter.$or = this.searchableFields.map((f) => ({ [f]: rx }))
    }

    return filter as FilterQuery<TDoc>
  }

  async findById(id: string): Promise<TDomain | null> {
    const doc = await this.model.findById(id).lean<TDoc>().exec()
    return doc ? this.toDomain(doc) : null
  }

  async findMany(query: PageQuery): Promise<Paged<TDomain>> {
    const q = normalizePageQuery(query)
    const filter = this.buildFilter(q)
    const sort: Record<string, SortOrder> = q.sort
      ? { [q.sort]: q.order === 'asc' ? 1 : -1 }
      : { createdAt: -1 }

    const [docs, total] = await Promise.all([
      this.model
        .find(filter)
        .sort(sort)
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean<TDoc[]>()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ])

    return paged(docs.map((d) => this.toDomain(d)), total, q.page, q.limit)
  }

  async count(filters: Record<string, unknown> = {}): Promise<number> {
    return this.model.countDocuments(filters as FilterQuery<TDoc>).exec()
  }

  async create(data: Partial<TDomain>): Promise<TDomain> {
    const doc = await this.model.create(data as unknown as Partial<TDoc>)
    return this.toDomain(doc.toObject() as TDoc)
  }

  async update(id: string, data: Partial<TDomain>): Promise<TDomain | null> {
    const doc = await this.model
      .findByIdAndUpdate(id, data as never, { new: true, runValidators: true })
      .lean<TDoc>()
      .exec()
    return doc ? this.toDomain(doc) : null
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.model.findByIdAndDelete(id).lean().exec()
    return res !== null
  }
}

/** Escape user input before embedding it in a RegExp, so a stray "(" cannot throw. */
function escapeRegex(input: string): string {
  const special = new Set(['.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\'])
  let out = ''
  for (const ch of input) out += special.has(ch) ? `\\${ch}` : ch
  return out
}
