import type { Rule } from "eslint";

const TERMINAL_METHODS = new Set(["query", "mutation", "subscription"]);
const PROCEDURE_METHODS = new Set(["procedure", "input", "output", "use", "meta"]);

type NodeLike = Rule.Node & Record<string, unknown>;

interface ChainInfo {
  methods: string[];
  rootNames: string[];
}

function isNode(value: unknown): value is NodeLike {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

function getPropertyName(node: NodeLike): string | undefined {
  if (node.type !== "MemberExpression" || node.computed === true || !isNode(node.property)) {
    return undefined;
  }

  return node.property.type === "Identifier" ? String(node.property.name) : undefined;
}

function collectRootNames(node: unknown): string[] {
  if (!isNode(node)) {
    return [];
  }

  if (node.type === "Identifier") {
    return [String(node.name)];
  }

  if (node.type === "MemberExpression") {
    const objectNames = collectRootNames(node.object);
    const propertyName = getPropertyName(node);
    return propertyName ? [...objectNames, propertyName] : objectNames;
  }

  return [];
}

function collectChainInfo(node: unknown): ChainInfo {
  const methods: string[] = [];
  let current = node;

  while (isNode(current)) {
    if (current.type === "CallExpression") {
      current = current.callee;
      continue;
    }

    if (current.type !== "MemberExpression") {
      break;
    }

    const methodName = getPropertyName(current);
    if (methodName) {
      methods.unshift(methodName);
    }

    current = current.object;
  }

  return {
    methods,
    rootNames: collectRootNames(current),
  };
}

function isProcedureName(name: string): boolean {
  return name.toLowerCase().includes("procedure");
}

function isLikelyProcedureChain({ methods, rootNames }: ChainInfo): boolean {
  return rootNames.some(isProcedureName) || methods.some((method) => PROCEDURE_METHODS.has(method));
}

export const requireOutputRule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require explicit output schemas on tRPC procedures.",
    },
    messages: {
      missingOutput: "Add an explicit .output() schema so trpc-diff can generate an accurate response contract.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callNode = node as NodeLike;
        if (!isNode(callNode.callee)) {
          return;
        }

        const terminalMethod = getPropertyName(callNode.callee);
        if (!terminalMethod || !TERMINAL_METHODS.has(terminalMethod)) {
          return;
        }

        const chain = collectChainInfo(callNode);
        if (!isLikelyProcedureChain(chain) || chain.methods.includes("output")) {
          return;
        }

        context.report({
          node,
          messageId: "missingOutput",
        });
      },
    };
  },
};
