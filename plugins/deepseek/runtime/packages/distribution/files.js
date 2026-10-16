import { copyFile, lstat, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
/** Copy files only; reject symlinks rather than creating or following them. */
export async function copyTree(source, destination) {
    const info = await lstat(source);
    if (info.isSymbolicLink())
        throw new Error("Symbolic links are unsupported package inputs");
    if (info.isDirectory()) {
        await mkdir(destination, { recursive: true });
        for (const name of await readdir(source))
            await copyTree(join(source, name), join(destination, name));
    }
    else if (info.isFile())
        await copyFile(source, destination);
    else
        throw new Error("Unsupported package input type");
}
//# sourceMappingURL=files.js.map