/**
 * Prints a styled header box to stdout.
 * The label text is passed as a command-line argument.
 * Example usage: `node --experimental-strip-types print-header.ts "📦  Label text"`
 */
import { styleText } from "node:util";
const label = process.argv[2] ?? "";
const bar = "\u2500".repeat(56);
console.log(`\n${styleText(["bold", "magenta"], `\u250c${bar}\u2510`)}`);
console.log(`${styleText(["bold", "magenta"], "\u2502")}  ${label}`);
console.log(`${styleText(["bold", "magenta"], `\u2514${bar}\u2518`)}\n`);
