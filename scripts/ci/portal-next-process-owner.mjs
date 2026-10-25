import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// These are process/source observations only. Never execute a command or server
// script to determine ownership, and never include script contents in diagnostics.
function argv(command) {
  const result = []; let token = '', quote = null;
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (quote) { if (char === quote) quote = null; else token += char; }
    else if (char === '"' || char === "'") quote = char;
    else if (/\s/.test(char)) { if (token) { result.push(token); token = ''; } }
    else if (';&|'.includes(char)) return [];
    else if (char === '\\' && command[index + 1] === ' ') { token += ' '; index += 1; }
    else token += char;
  }
  if (quote) return [];
  if (token) result.push(token);
  return result;
}
function paths(root) {
  const windows = /^[a-z]:[\\/]/i.test(root);
  const api = windows ? path.win32 : path.posix;
  const normalize = value => {
    const normalized = api.normalize(value).replaceAll('\\', '/').replace(/\/$/, '');
    return windows ? normalized.toLowerCase() : normalized;
  };
  return { api, normalize, absolute: value => api.isAbsolute(value), root: normalize(root),
    portal: normalize(api.join(root, 'apps', 'portal')) };
}
function nodeScript(args) {
  if (!/^(?:node|nodejs)(?:\.exe)?$/i.test(args[0]?.replaceAll('\\', '/').split('/').at(-1) ?? '')) return null;
  let index = 1;
  while (args[index]?.startsWith('-')) {
    const flag = args[index++];
    if (['-e', '--eval', '-p', '--print', '-c', '--check', '--test', '--run'].some(value => flag === value || flag.startsWith(value + '='))) return null;
    if (['--require', '-r', '--import', '--conditions'].includes(flag)) index += 1;
    else if (!/^(?:--inspect(?:-brk)?(?:=.*)?|--enable-source-maps|--no-warnings|--require=.+|--import=.+|--conditions=.+)$/.test(flag)) return null;
  }
  return args[index] ? { script: args[index], rest: args.slice(index + 1) } : null;
}
function cliOwner(args, info, scope) {
  const script = nodeScript(args) ?? { script: args[0], rest: args.slice(1) };
  if (!script.script || !scope.absolute(script.script)) return null;
  const actual = scope.normalize(script.script);
  const locations = [scope.root, scope.portal].flatMap(root => [
    root + '/node_modules/next/dist/bin/next', root + '/node_modules/next/dist/bin/next.js',
    root + '/node_modules/.bin/next', root + '/node_modules/.bin/next.cmd',
  ]);
  if (!locations.includes(actual) || script.rest[0] !== 'dev' || script.rest.some(arg => ['--help','-h','--version','-v'].includes(arg))) return null;
  const values = new Set(['-p', '--port', '-H', '--hostname', '--experimental-https-key', '--experimental-https-cert', '--experimental-https-ca']);
  let directory;
  for (let index = 1; index < script.rest.length; index += 1) {
    const arg = script.rest[index];
    if (values.has(arg)) { index += 1; continue; }
    if (arg.startsWith('-')) continue;
    if (directory) return null;
    directory = arg;
  }
  if (directory && directory !== '.') {
    const target = scope.absolute(directory) ? directory : scope.api.resolve(info.cwd || scope.root, directory);
    if (scope.normalize(target) !== scope.portal) return null;
  } else if (info.cwd && scope.normalize(info.cwd) !== scope.portal) return null;
  // Without a reported cwd, an exact checkout-local CLI is ownership evidence,
  // but an explicit foreign project directory always overrides that evidence.
  return { kind: 'checkout-next-dev-cli' };
}
function readScript(file) {
  const stat = fs.statSync(file);
  return stat.isFile() && stat.size <= 1024 * 1024 ? fs.readFileSync(file, 'utf8') : '';
}
function customOwner(args, scope, loadScript) {
  const invocation = nodeScript(args);
  if (!invocation || !scope.absolute(invocation.script) || !/\.[cm]?[jt]s$/i.test(invocation.script)) return null;
  let source;
  try { source = loadScript(invocation.script); } catch { return null; }
  if (!source || source.length > 1024 * 1024) return null;
  const ast = ts.createSourceFile(invocation.script, source, ts.ScriptTarget.Latest, true);
  if (ast.parseDiagnostics.length || ast.statements.some(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'require' || ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === 'require'))) return null;
  const bindings = new Map(), moduleRequires = new Set(), importedNext = new Set();
  for (const statement of ast.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      if (statement.moduleSpecifier.text === 'next' && statement.importClause?.name) importedNext.add(statement.importClause.name.text);
      if (['node:module', 'module'].includes(statement.moduleSpecifier.text)) {
        const named = statement.importClause?.namedBindings;
        if (named && ts.isNamedImports(named)) for (const element of named.elements) if ((element.propertyName?.text ?? element.name.text) === 'createRequire') moduleRequires.add(element.name.text);
      }
    }
    if (!ts.isVariableStatement(statement) || !(statement.declarationList.flags & ts.NodeFlags.Const)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) bindings.set(declaration.name.text, declaration.initializer);
      else if (ts.isObjectBindingPattern(declaration.name) && declaration.initializer && ts.isCallExpression(declaration.initializer) && declaration.initializer.expression.getText(ast) === 'require' && ['node:module', 'module'].includes(declaration.initializer.arguments[0]?.text)) {
        for (const element of declaration.name.elements) if (ts.isIdentifier(element.name) && (element.propertyName?.getText(ast) ?? element.name.text) === 'createRequire') moduleRequires.add(element.name.text);
      }
    }
  }
  function literal(node, seen = new Set()) {
    if (!node) return null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isIdentifier(node) && !seen.has(node.text)) return literal(bindings.get(node.text), new Set([...seen, node.text]));
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = literal(node.left, seen), right = literal(node.right, seen);
      if (left !== null && right !== null) return left + right;
    }
    return null;
  }
  function isRequire(node) {
    if (!ts.isIdentifier(node)) return false;
    if (node.text === 'require' && !bindings.has('require')) return true;
    const value = bindings.get(node.text);
    return Boolean(value && ts.isCallExpression(value) && ts.isIdentifier(value.expression) && moduleRequires.has(value.expression.text));
  }
  function nextFactory(node, seen = new Set()) {
    if (ts.isIdentifier(node)) {
      if (importedNext.has(node.text)) return true;
      if (seen.has(node.text)) return false;
      const value = bindings.get(node.text);
      return value ? nextFactory(value, new Set([...seen, node.text])) : false;
    }
    return ts.isCallExpression(node) && isRequire(node.expression) && node.arguments.length === 1 && literal(node.arguments[0]) === 'next';
  }
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const call = declaration.initializer;
      if (!call || !ts.isCallExpression(call) || !nextFactory(call.expression) || !call.arguments[0] || !ts.isObjectLiteralExpression(call.arguments[0])) continue;
      let dev = false, directory = null;
      for (const prop of call.arguments[0].properties) {
        if (ts.isSpreadAssignment(prop)) { dev = false; directory = null; continue; }
        if (!ts.isPropertyAssignment(prop)) continue;
        const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : '';
        if (key === 'dev') dev = prop.initializer.kind === ts.SyntaxKind.TrueKeyword;
        if (key === 'dir') directory = literal(prop.initializer);
      }
      if (dev && directory && scope.absolute(directory) && scope.normalize(directory) === scope.portal) return { kind: 'checkout-programmatic-next-dev' };
    }
  }
  return null;
}
function direct(info, scope, loadScript) {
  const args = info?.argv ?? argv(info?.commandLine ?? '');
  return cliOwner(args, info, scope) ?? customOwner(args, scope, loadScript);
}

/** Returns evidence for this checkout only; unknown commands remain unclassified. */
export function portalNextDevOwner(info, root, { loadScript = readScript } = {}) {
  if (!info) return null;
  const scope = paths(root), own = direct(info, scope, loadScript);
  if (own) return { ...info, ...own };
  const args = info.argv ?? argv(info.commandLine ?? ''), invocation = nodeScript(args);
  const child = /^next-server(?: \(v[^)]+\))?$/.test((info.commandLine ?? '').trim()) ||
    invocation && scope.absolute(invocation.script) && scope.normalize(invocation.script) === scope.root + '/node_modules/next/dist/server/lib/start-server.js';
  if (!child || !info.parentPid || !info.parentCommandLine) return null;
  const parent = direct({ commandLine: info.parentCommandLine, argv: info.parentArgv }, scope, loadScript);
  return parent ? { ...info, kind: 'next-server-child', ownerPid: info.parentPid, ownerCommandLine: info.parentCommandLine } : null;
}


// Linux ps prints an unquoted display string. Prefer its real NUL-separated
// argument vector where available so a checkout path containing spaces is exact.
export function readProcessArgv(pid) {
  if (!/^\d+$/.test(String(pid))) return undefined;
  try { return fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean); }
  catch { return undefined; }
}
