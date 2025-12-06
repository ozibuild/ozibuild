import {parse as acornParse} from 'acorn';
import {simple as acornSimpleWalk} from 'acorn-walk';
import {readFileSync} from 'node:fs';

/**
 * Parses a JavaScript file and extracts the names of all exported members.
 * It attempts to identify both ES Modules and CommonJS patterns.
 * * @param {string} filePath - The path to the JS file to parse.
 * @returns {string[]} An array of exported function/variable names.
 */
export function getExportedFunctions(filePath) {
  const exports = new Set();
  let code;

  try {
    code = readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error(`Error reading file: ${err.message}`);
    return [];
  }

  let ast;
  try {
    // Parse the code into an AST.
    // ecmaVersion: 'latest' allows modern syntax (async/await, etc).
    // sourceType: 'module' allows 'import' and 'export' keywords.
    ast = acornParse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module'
    });
  } catch (err) {
    // If parsing fails (syntax error), return empty list gracefully
    // This prevents the CLI from crashing if the user is in the middle of typing
    return [];
  }

  // Walk the AST looking for specific nodes
  acornSimpleWalk(ast, {

    // ============================================================
    // 1. Handle ES Modules (export function, export const, etc.)
    // ============================================================
    ExportNamedDeclaration(node) {
      // Pattern: export function myFunc() {}
      if (node.declaration) {
        if (node.declaration.type === 'FunctionDeclaration') {
          if (node.declaration.id) {
            exports.add(node.declaration.id.name);
          }
        }
        // Pattern: export const myFunc = () => {}
        else if (node.declaration.type === 'VariableDeclaration') {
          node.declaration.declarations.forEach(decl => {
            if (decl.id && decl.id.name) {
              exports.add(decl.id.name);
            }
          });
        }
      }

      // Pattern: export { myFunc, other as alias }
      if (node.specifiers) {
        node.specifiers.forEach(spec => {
          // .exported is the name the outside world sees
          if (spec.exported && spec.exported.name) {
            exports.add(spec.exported.name);
          }
        });
      }
    },

    // Pattern: export default ...
    ExportDefaultDeclaration(node) {
      exports.add('default');
    },

    // ============================================================
    // 2. Handle CommonJS (exports.foo = ..., module.exports = ...)
    // ============================================================
    AssignmentExpression(node) {
      const { left, right } = node;

      // We only care about property assignments (MemberExpression)
      if (left.type !== 'MemberExpression') return;

      // Pattern: exports.myFunc = ...
      if (left.object.name === 'exports' && left.property.name) {
        exports.add(left.property.name);
        return;
      }

      // Pattern: module.exports.myFunc = ...
      if (left.object.type === 'MemberExpression' &&
        left.object.object.name === 'module' &&
        left.object.property.name === 'exports' &&
        left.property.name) {
        exports.add(left.property.name);
        return;
      }

      // Pattern: module.exports = { myFunc: ... }
      // This overwrites the whole object, so we extract keys from the object literal
      if (left.object.name === 'module' && left.property.name === 'exports') {
        if (right.type === 'ObjectExpression') {
          right.properties.forEach(prop => {
            if (prop.key && prop.key.name) {
              exports.add(prop.key.name);
            }
          });
        }
      }
    }
  });

  return Array.from(exports);
}
