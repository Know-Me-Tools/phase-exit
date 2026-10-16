import { importUarSnapshot } from './importer.js';
import type { ImportOptions, ReceiptInput } from './types.js';

function parse(argv: string[]): ImportOptions | null {
  let root: string | undefined; let output: string | undefined; let adoptionReference: string | undefined;
  let activeOperationObservation: string | undefined;
  let inventoryPath: string | undefined; let inventorySha256: string | undefined;
  const receipts: ReceiptInput[] = [];
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]; const value = argv[i + 1];
    if (flag === '--receipt') {
      const receipt = argv[i + 2];
      if (!value || !receipt || value.startsWith('--') || receipt.startsWith('--')) return null;
      receipts.push({ manifest: value, receipt }); i += 2;
    } else if (flag === '--root' && root === undefined && value && !value.startsWith('--')) { root = value; i++; }
    else if (flag === '--output' && output === undefined && value && !value.startsWith('--')) { output = value; i++; }
    else if (flag === '--adoption-reference' && adoptionReference === undefined && value && !value.startsWith('--')) { adoptionReference = value; i++; }
    else if (flag === '--active-operation-observation' && activeOperationObservation === undefined && value && !value.startsWith('--')) { activeOperationObservation = value; i++; }
    else if (flag === '--inventory' && inventoryPath === undefined && value && !value.startsWith('--')) { inventoryPath = value; i++; }
    else if (flag === '--inventory-sha256' && inventorySha256 === undefined && value && /^[a-f0-9]{64}$/.test(value)) { inventorySha256 = value; i++; }
    else return null;
  }
  if (!root || !output || (inventoryPath === undefined) !== (inventorySha256 === undefined)) return null;
  return { root, output, ...(receipts.length ? { receipts } : {}), ...(adoptionReference ? { adoptionReference } : {}),
    ...(activeOperationObservation ? { activeOperationObservation } : {}),
    ...(inventoryPath !== undefined && inventorySha256 !== undefined ? { inventory: { path: inventoryPath, sha256: inventorySha256 } } : {}) };
}
const options = parse(process.argv.slice(2));
if (options === null) {
  process.stderr.write('Usage: node cli.js --root UAR_ROOT --output NEW_PRIVATE_DIRECTORY [--inventory PATH --inventory-sha256 HEX] [--receipt MANIFEST RECEIPT]... [--adoption-reference OPERATOR_REFERENCE] [--active-operation-observation HOST_OBSERVATION]\n');
  process.exitCode = 14;
} else {
  const result = await importUarSnapshot(options);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.ok ? 0 : 14;
}
