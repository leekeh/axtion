/**
 * Prints a styled header box to stdout.
 * The label text is passed as a command-line argument.
 * Example usage: `node --experimental-strip-types print-header.ts "📦  Label text"`
 */
const label = process.argv[2] ?? "";
const bar = "\u2500".repeat(56);
console.log(`\n\x1b[1;35m\u250c${bar}\u2510\x1b[0m`);
console.log(`\x1b[1;35m\u2502\x1b[0m  ${label}`);
console.log(`\x1b[1;35m\u2514${bar}\u2518\x1b[0m\n`);
