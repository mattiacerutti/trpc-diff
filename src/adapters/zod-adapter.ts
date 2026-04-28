import { createSchema } from "zod-openapi";
import { z } from "zod";
import type { ParserOpenApiAdapter } from "../types";

export const zodOpenApiAdapter: ParserOpenApiAdapter<z.ZodType> = {
  isParser(value): value is z.ZodType {
    return value instanceof z.ZodType;
  },

  mergeInputs(inputs) {
    if (inputs.length === 0) {
      return null;
    }
    if (inputs.length === 1) {
      return inputs[0]!;
    }
    return inputs.slice(1).reduce<z.ZodType>((merged, input) => z.intersection(merged, input), inputs[0]!);
  },

  toSchema(parser, io) {
    if ((parser as z.ZodType & { _zod: { def: { type: string } } })._zod.def.type === "void") {
      return {};
    }
    return createSchema(parser, { io, openapiVersion: "3.0.0" }).schema;
  },
};
