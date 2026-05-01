import { RuleTester } from "eslint";
import { describe, it } from "vitest";
import { requireOutputRule } from "@/eslint/rules/require-output";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

describe("require-output", () => {
  it("allows procedures with explicit output", () => {
    ruleTester.run("require-output", requireOutputRule, {
      valid: [
        "publicProcedure.output(userSchema).query(() => user)",
        "protectedProcedure.input(inputSchema).output(userSchema).mutation(() => user)",
        "t.procedure.use(auth).output(eventSchema).subscription(() => events)",
        "publicProcedure.output(z.void()).mutation(() => undefined)",
        "publicProcedure.output(userSchema).meta({ auth: true }).query(() => user)",
        "publicProcedure.input(inputSchema).use(auth).output(userSchema).mutation(() => user)",
      ],
      invalid: [],
    });
  });

  it("reports procedures missing output", () => {
    ruleTester.run("require-output", requireOutputRule, {
      valid: [],
      invalid: [
        {
          code: "publicProcedure.query(() => user)",
          errors: [{ messageId: "missingOutput" }],
        },
        {
          code: "t.procedure.query(() => user)",
          errors: [{ messageId: "missingOutput" }],
        },
        {
          code: "protectedProcedure.input(inputSchema).mutation(() => user)",
          errors: [{ messageId: "missingOutput" }],
        },
        {
          code: "t.procedure.use(auth).subscription(() => events)",
          errors: [{ messageId: "missingOutput" }],
        },
        {
          code: "publicProcedure.meta({ auth: true }).input(inputSchema).query(() => user)",
          errors: [{ messageId: "missingOutput" }],
        },
        {
          code: "adminProcedure.mutation(() => user)",
          errors: [{ messageId: "missingOutput" }],
        },
      ],
    });
  });

  it("ignores non-procedure calls and unsupported member access", () => {
    ruleTester.run("require-output", requireOutputRule, {
      valid: [
        "client.user.query({ id: '1' })",
        "db.user.mutation(() => user)",
        "query(() => user)",
        "publicProcedure['query'](() => user)",
      ],
      invalid: [],
    });
  });
});
