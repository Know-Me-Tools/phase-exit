/** Self-contained: the hook runtime imports captured JavaScript as a data URL. */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, lstat, readlink } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
const executeFile = promisify(execFile);
export function sha256(bytes) {
    return createHash('sha256').update(bytes).digest('hex');
}
export function contained(root, path) {
    const rel = relative(root, path);
    return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}
export async function sourceIdentity(root, paths) {
    const listing = await executeFile('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...paths], { cwd: root, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
    const names = [...new Set(listing.stdout.toString('utf8').split('\0').filter(Boolean))]
        .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
    const records = [];
    for (const name of names) {
        const path = resolve(root, name);
        if (!contained(root, path))
            throw new Error('SOURCE_PATH_ESCAPE');
        let data;
        const stat = await lstat(path).catch((error) => {
            if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')
                return null;
            throw error;
        });
        if (stat === null)
            data = Buffer.from('deleted');
        else if (stat.isSymbolicLink())
            data = Buffer.from(`symlink:${await readlink(path)}`);
        else if (stat.isFile())
            data = await readFile(path);
        else if (stat.isDirectory()) {
            const options = { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } };
            const commit = await executeFile('git', ['-C', path, 'rev-parse', 'HEAD'], options);
            const dirty = await executeFile('git', ['-C', path, 'status', '--porcelain'], options);
            if (dirty.stdout.length !== 0)
                throw new Error('DIRTY_SUBMODULE');
            data = Buffer.from(`gitlink:${commit.stdout.trim()}`);
        }
        else
            throw new Error('UNSUPPORTED_SOURCE_FILE');
        records.push(Buffer.concat([Buffer.from(name), Buffer.from([0]), createHash('sha256').update(data).digest()]));
    }
    const joined = [];
    for (const record of records) {
        if (joined.length !== 0)
            joined.push(Buffer.from('\n'));
        joined.push(record);
    }
    return `sha256:${sha256(Buffer.concat(joined))}`;
}
function object(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        throw new Error('INVALID_SNAPSHOT');
    return value;
}
function strings(value) {
    if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string'))
        throw new Error('INVALID_SNAPSHOT_PATHS');
    return value;
}
/** Rechecks mutable UAR source at evaluation; it never runs acceptance or mutates UAR. */
export async function checkFreshness(snapshotPath) {
    const snapshot = object(JSON.parse(await readFile(snapshotPath, 'utf8')));
    if (typeof snapshot.root !== 'string')
        throw new Error('INVALID_SNAPSHOT_ROOT');
    if (typeof snapshot.inventory_path !== 'string' || typeof snapshot.inventory_sha256 !== 'string')
        throw new Error('INVALID_SNAPSHOT_INVENTORY');
    const inventoryPath = resolve(snapshot.root, snapshot.inventory_path);
    if (!contained(snapshot.root, inventoryPath) || sha256(await readFile(inventoryPath)) !== snapshot.inventory_sha256)
        throw new Error('UAR_INVENTORY_CHANGED');
    for (const kind of ['source', 'fixture']) {
        if (await sourceIdentity(snapshot.root, strings(snapshot[`${kind}_paths`])) !== snapshot[`${kind}_tree`]) {
            throw new Error('UAR_SOURCE_OR_FIXTURE_CHANGED');
        }
    }
    if (!Array.isArray(snapshot.item_files))
        throw new Error('INVALID_ITEM_FILES');
    for (const value of snapshot.item_files) {
        const entry = object(value);
        if (typeof entry.path !== 'string' || typeof entry.sha256 !== 'string')
            throw new Error('INVALID_ITEM_FILE');
        const path = resolve(snapshot.root, entry.path);
        if (!contained(snapshot.root, path) || `sha256:${sha256(await readFile(path))}` !== entry.sha256) {
            throw new Error('UAR_INVENTORY_ITEM_CHANGED');
        }
    }
    if (!Array.isArray(snapshot.receipts))
        throw new Error('INVALID_RECEIPT_INVENTORY');
    if (snapshot.active_operation !== null && snapshot.active_operation !== undefined) {
        const active = object(snapshot.active_operation);
        if (typeof active.original_receipt !== 'string' || typeof active.receipt_sha256 !== 'string'
            || sha256(await readFile(active.original_receipt)) !== active.receipt_sha256)
            throw new Error('UAR_RUNNING_RECEIPT_CHANGED');
    }
    for (const value of snapshot.receipts) {
        const receipt = object(value);
        if (receipt.current === true && (typeof receipt.original_manifest !== 'string' || typeof receipt.manifest_sha256 !== 'string'
            || sha256(await readFile(receipt.original_manifest)) !== receipt.manifest_sha256))
            throw new Error('UAR_ACTION_MANIFEST_CHANGED');
        if (receipt.current !== true || receipt.identity_valid !== true || receipt.raw_valid !== true || receipt.all_groups_complete !== true)
            continue;
        if (!Array.isArray(receipt.raw_artifacts))
            throw new Error('INVALID_RAW_ARTIFACTS');
        for (const raw of receipt.raw_artifacts) {
            const artifact = object(raw);
            if (typeof artifact.path !== 'string' || typeof artifact.expected !== 'string')
                throw new Error('INVALID_RAW_ARTIFACT');
            if (`sha256:${sha256(await readFile(artifact.path))}` !== artifact.expected)
                throw new Error('UAR_RAW_EVIDENCE_CHANGED');
        }
    }
}
/** Importer replaces this sentinel in its private, hash-bound self-contained hook. */
const snapshotFile = '__PHASE_EXIT_UAR_SNAPSHOT_PATH__';
export async function run(_input) {
    try {
        await checkFreshness(snapshotFile);
        return { schema_version: 1, veto: false, reason: 'UAR source, fixtures and inventory item bytes match the imported snapshot.' };
    }
    catch {
        return { schema_version: 1, veto: true, reason: 'UAR source freshness could not be established; recollect and explicitly adopt a new contract revision.' };
    }
}
//# sourceMappingURL=freshness.js.map