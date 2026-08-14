// @notjustany/doc-contract — the controlled-document skeleton contract.
//
// Pure, zero-dependency, no fs and no network, so it runs identically in the
// Next app (server-side), in the MCP server on a customer's machine, and in
// tests. Anything that needs to read a file belongs to the caller.

export {
  tokenize,
  decodeEntities,
  normalizeText,
  textOf,
  ALLOWED_TAGS,
  ALLOWED_ATTRS,
  ALLOWED_CLASSES,
  type Tag,
  type Token,
  type ParseIssue,
  type ParseResult,
} from "./parse.ts";

export {
  deriveSkeleton,
  stripGuidance,
  buildTree,
  walk,
  elText,
  isEl,
  countOccurrences,
  STOCK_PLACEHOLDERS,
  CLAUSE_RE,
  type El,
  type Node,
  type TableFacts,
  type SkeletonFacts,
} from "./skeleton.ts";

export {
  validateFragment,
  newText,
  type Issue,
  type Severity,
  type FillMode,
  type ValidateInput,
  type ValidateResult,
} from "./validate.ts";
