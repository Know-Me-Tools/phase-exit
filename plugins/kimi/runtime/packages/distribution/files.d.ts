/** Copy files only; reject symlinks rather than creating or following them. */
export declare function copyTree(source: string, destination: string): Promise<void>;
