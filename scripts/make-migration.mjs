// Writes a migration without the native schema engine (its download is blocked in some sandboxes).
//   node scripts/make-migration.mjs <name> [old-schema.prisma]
// With an old schema it writes the difference from it to prisma/schema.prisma; without one, the full schema.
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { SchemaEngine } from '@prisma/schema-engine-wasm';
import { PrismaPg } from '@prisma/adapter-pg';
import { bindMigrationAwareSqlAdapterFactory } from '@prisma/driver-adapter-utils';

const name = process.argv[2];
const oldPath = process.argv[3];
if (!name) { console.error('usage: make-migration.mjs <name> [old-schema]'); process.exit(1); }
const content = readFileSync('prisma/schema.prisma', 'utf8');
const factory = new PrismaPg({ connectionString: process.env.DATABASE_URL }, {});
const adapter = bindMigrationAwareSqlAdapterFactory(factory);
const engine = await SchemaEngine.new({ datamodels: [['prisma/schema.prisma', content]] }, (m) => process.stderr.write(String(m) + '\n'), adapter);
const from = oldPath ? { tag: 'schemaDatamodel', files: [{ path: 'prisma/schema.prisma', content: readFileSync(oldPath, 'utf8') }] } : { tag: 'empty' };
const res = await engine.diff({ from, to: { tag: 'schemaDatamodel', files: [{ path: 'prisma/schema.prisma', content }] }, script: true, exitCode: null, filters: { externalTables: [], externalEnums: [] } });
const sql = (res.stdout ?? res).toString();
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const dir = `prisma/migrations/${name.match(/^\d/) ? name : stamp + '_' + name}`;
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/migration.sql`, sql);
if (!existsSync('prisma/migrations/migration_lock.toml')) writeFileSync('prisma/migrations/migration_lock.toml', 'provider = "postgresql"\n');
console.log(`wrote ${dir}/migration.sql (${sql.length} chars)`);
process.exit(0);
