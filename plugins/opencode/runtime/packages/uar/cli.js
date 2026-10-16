import { importUarSnapshot } from './importer.js';
function parse(argv) {
    let root;
    let output;
    let adoptionReference;
    let activeOperationObservation;
    const receipts = [];
    for (let i = 0; i < argv.length; i++) {
        const flag = argv[i];
        const value = argv[i + 1];
        if (flag === '--receipt') {
            const receipt = argv[i + 2];
            if (!value || !receipt || value.startsWith('--') || receipt.startsWith('--'))
                return null;
            receipts.push({ manifest: value, receipt });
            i += 2;
        }
        else if (flag === '--root' && root === undefined && value && !value.startsWith('--')) {
            root = value;
            i++;
        }
        else if (flag === '--output' && output === undefined && value && !value.startsWith('--')) {
            output = value;
            i++;
        }
        else if (flag === '--adoption-reference' && adoptionReference === undefined && value && !value.startsWith('--')) {
            adoptionReference = value;
            i++;
        }
        else if (flag === '--active-operation-observation' && activeOperationObservation === undefined && value && !value.startsWith('--')) {
            activeOperationObservation = value;
            i++;
        }
        else
            return null;
    }
    if (!root || !output)
        return null;
    return { root, output, ...(receipts.length ? { receipts } : {}), ...(adoptionReference ? { adoptionReference } : {}),
        ...(activeOperationObservation ? { activeOperationObservation } : {}) };
}
const options = parse(process.argv.slice(2));
if (options === null) {
    process.stderr.write('Usage: node cli.js --root UAR_ROOT --output NEW_PRIVATE_DIRECTORY [--receipt MANIFEST RECEIPT]... [--adoption-reference OPERATOR_REFERENCE] [--active-operation-observation HOST_OBSERVATION]\n');
    process.exitCode = 14;
}
else {
    const result = await importUarSnapshot(options);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.ok ? 0 : 14;
}
//# sourceMappingURL=cli.js.map