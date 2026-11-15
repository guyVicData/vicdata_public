// VicData 0.8 feedback B3 (R-NO-BUILD-NOTES): the source half of the build-notes scan -- every string and
// piece of JSX text in a component, read with the TypeScript parser (comments are never nodes). Tests and the
// rule runner only (it loads the compiler).
import ts from "typescript";
import { userTextFindings, type Finding } from "./build-notes";

/** Builders' words in a component's strings and JSX text. Skipped: imports, data attributes and keys, a
 * console call's or a thrown error's words, and a view ID (the code's own key: case "DV-SMT-A-NOW"). */
export function sourceFindings(file: string, src: string): Finding[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: Finding[] = [];
  const skip = (n: ts.Node): boolean => {
    for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
      if (ts.isJsxAttribute(p) && /^(data-|key$)/.test(p.name.getText(sf))) return true;
      if (ts.isCallExpression(p) && /^console\.|^(new )?Error$/.test(p.expression.getText(sf))) return true;
      if (ts.isNewExpression(p) && p.expression.getText(sf) === "Error") return true;
    }
    return false;
  };
  const visit = (n: ts.Node) => {
    const text = ts.isJsxText(n) || ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) ? (n as ts.LiteralLikeNode).text : null;
    // A stylesheet in a template string keeps its own comments; they are never shown.
    const shown = text?.replace(/\/\*[\s\S]*?\*\//g, "") ?? null;
    if (shown && !skip(n)) {
      const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      for (const f of userTextFindings(`${file}:${line}`, shown)) if (f.what !== "a view ID") out.push(f);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}
