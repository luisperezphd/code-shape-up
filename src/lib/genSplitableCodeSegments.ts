import generate from "@babel/generator";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import * as esprima from "esprima";

function genParts(tokens: esprima.Token[]): string[] {
  return tokens.map((o) => {
    if (o.type === "BlockComment") {
      return `/*${o.value}*/`;
    }

    return o.value;
  });
}

function joinTokens(tokens: esprima.Token[]) {
  return genParts(tokens).join(" ");
}

export function genSplitableCodeSegments(
  originalCode: string,
  validate = true // set to false to improve performance
): string[] {
  const slicableCode = addParenToRetExprsCode(originalCode);
  const tokens = esprima.tokenize(slicableCode, { comment: true });
  const slicableTokens = mergeNonSplitTokens(tokens);
  const parts = slicableTokens.map((o) => o.value);

  if (validate) {
    // validate results
    const codeFromSlicableTokens = joinTokens(slicableTokens);
    let normSlicableFromTokensCode;
    try {
      normSlicableFromTokensCode = normalizeCode(codeFromSlicableTokens);
    } catch (e) {
      if (e instanceof SyntaxError) {
        const index = e.loc.line - 1;
        console.log("Error line", {
          // format
          before: parts.slice(Math.max(0, index - 10), index).join(" "),
          at: parts[index],
          after: parts.slice(index, index + 10).join(" "),
          tokens: index === 0 ? slicableTokens.slice(0, 1) : slicableTokens.slice(index - 1, index + 2),
        });
      }
      throw e;
    }

    const normOriginalCode = normalizeCode(originalCode);
    if (normOriginalCode !== normSlicableFromTokensCode) {
      throw new Error("Could not generate tokens (generated code mismatch)");
    }
  }

  return parts;
}

function parseCode(code: string) {
  return parser.parse(code, {
    sourceType: "script",
    plugins: ["jsx"],
    attachComment: false,
  });
}

function addParenToRetExprsCode(code: string): string {
  const ast = parseCode(code);
  addParenToRetExprs(ast);
  const output = generate(ast, {}, code);
  return output.code;
}

function mergeNonSplitTokens(tokens: esprima.Token[]) {
  const newTokens = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const nextToken = tokens[i + 1];

    if (isToken(token, "Keyword", "return") && isToken(nextToken, "Punctuator", "(")) {
      newTokens.push({ type: "$Combined", value: `${token.value} ${nextToken.value}` });
      i++;
    } else if (isToken(nextToken, "Punctuator", "++") || isToken(nextToken, "Punctuator", "--")) {
      newTokens.push({ type: "$Combined", value: `${token.value} ${nextToken.value}` });
      i++;
    } else if (isToken(token, "Keyword", "throw")) {
      newTokens.push({ type: "$Combined", value: `${token.value} ${nextToken.value}` });
      i++;
    } else {
      newTokens.push(token);
    }
  }

  return newTokens;
}

function addParenToRetExprs(ast: parser.ParseResult<t.File>) {
  traverse(ast, {
    ReturnStatement(path) {
      if (path.node.argument) {
        if (!t.isParenthesizedExpression(path.node.argument)) {
          const newExpression = t.parenthesizedExpression(path.node.argument);
          path.node.argument = newExpression;
        }
      }
    },
  });
}

function normalizeCode(code: string): string {
  const ast = parseCode(code); // check if it's valid code
  const output = generate(ast, { comments: false }, code);
  return output.code;
}

function isToken(token: esprima.Token | null, type: "Keyword" | "Punctuator", value: string) {
  if (token == null) return false;
  return token.type === type && token.value === value;
}

// function rel(relative: string) {
//   return path.resolve(__dirname, relative);
// }
