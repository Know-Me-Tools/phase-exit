export async function run() {
  if (process.env.JEV_API_KEY !== undefined || process.env.NODE_OPTIONS !== undefined) {
    throw new Error("Credential or Node injection environment reached hook child");
  }
  return { schema_version: 1, veto: false, reason: "Sensitive environment absent", evidence_proposals: [], amendment_proposals: [] };
}
