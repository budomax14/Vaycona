// Minimal in-memory stand-ins for the parts of the Admin SDK Firestore and
// Storage APIs personalization.js uses — enough to run its handlers in a
// plain `node --test` without a Firebase project or emulator.

const clone = (value) => (value === undefined ? undefined : structuredClone(value));
let autoId = 0;

class DocSnapshot {
  constructor(ref, data) {
    this.ref = ref;
    this.id = ref.id;
    this.exists = data !== undefined;
    this._data = data;
  }
  data() {
    return clone(this._data);
  }
}

class DocRef {
  constructor(db, path) {
    this.db = db;
    this.path = path;
    this.id = path.split("/").pop();
  }
  collection(name) {
    return new CollectionRef(this.db, `${this.path}/${name}`);
  }
  async get() {
    return new DocSnapshot(this, clone(this.db.store.get(this.path)));
  }
  async set(data, options) {
    this.db._write(this.path, data, options);
  }
  async update(data) {
    if (!this.db.store.has(this.path)) throw new Error(`No document to update: ${this.path}`);
    this.db._write(this.path, data, { merge: true });
  }
  async delete() {
    this.db.store.delete(this.path);
  }
}

class Query {
  constructor(db, path, filters = [], max = Infinity) {
    this.db = db;
    this.path = path;
    this.filters = filters;
    this.max = max;
  }
  where(field, op, value) {
    return new Query(this.db, this.path, [...this.filters, { field, op, value }], this.max);
  }
  limit(n) {
    return new Query(this.db, this.path, this.filters, n);
  }
  async get() {
    const docs = [];
    for (const [path, data] of this.db.store) {
      const parent = path.slice(0, path.lastIndexOf("/"));
      if (parent !== this.path) continue;
      const ok = this.filters.every(({ field, op, value }) => {
        const v = data[field];
        const a = v instanceof Date ? v.getTime() : v;
        const b = value instanceof Date ? value.getTime() : value;
        if (op === "==") return a === b;
        if (op === "<") return a < b;
        throw new Error(`Unsupported op ${op}`);
      });
      if (ok) docs.push(new DocSnapshot(new DocRef(this.db, path), clone(data)));
      if (docs.length >= this.max) break;
    }
    return { docs, empty: docs.length === 0, size: docs.length };
  }
}

class CollectionRef extends Query {
  doc(id) {
    autoId += 1;
    return new DocRef(this.db, `${this.path}/${id || `auto${autoId}`}`);
  }
}

export class FakeDb {
  constructor() {
    this.store = new Map();
  }
  collection(name) {
    return new CollectionRef(this, name);
  }
  _write(path, data, options) {
    const prev = options?.merge ? this.store.get(path) || {} : {};
    this.store.set(path, { ...prev, ...clone(data) });
  }
  async runTransaction(fn) {
    const writes = [];
    const tx = {
      get: (ref) => ref.get(),
      set: (ref, data, options) => writes.push(() => this._write(ref.path, data, options)),
      update: (ref, data) => writes.push(() => this._write(ref.path, data, { merge: true })),
    };
    const result = await fn(tx);
    writes.forEach((w) => w());
    return result;
  }
  // test helpers
  data(path) {
    return clone(this.store.get(path));
  }
  seed(path, data) {
    this.store.set(path, clone(data));
  }
}

export class FakeBucket {
  constructor() {
    this.name = "test-bucket";
    this.files = new Map();
  }
  file(path) {
    const bucket = this;
    return {
      name: path,
      async exists() {
        return [bucket.files.has(path)];
      },
      async download() {
        if (!bucket.files.has(path)) throw new Error(`No such file ${path}`);
        return [Buffer.from(bucket.files.get(path).buffer)];
      },
      async getMetadata() {
        return [bucket.files.get(path)?.metadata || {}];
      },
      async save(buffer, options = {}) {
        bucket.files.set(path, { buffer: Buffer.from(buffer), metadata: { ...options.metadata, timeCreated: new Date().toISOString() } });
      },
      async delete() {
        bucket.files.delete(path);
      },
    };
  }
  async deleteFiles({ prefix }) {
    for (const path of [...this.files.keys()]) if (path.startsWith(prefix)) this.files.delete(path);
  }
  async getFiles({ prefix }) {
    const files = [...this.files.entries()]
      .filter(([path]) => path.startsWith(prefix))
      .map(([path, f]) => ({ name: path, metadata: f.metadata, delete: async () => this.files.delete(path) }));
    return [files];
  }
  // test helpers
  put(path, buffer, contentType, timeCreated = new Date().toISOString()) {
    this.files.set(path, { buffer: Buffer.from(buffer), metadata: { contentType, timeCreated } });
  }
}
