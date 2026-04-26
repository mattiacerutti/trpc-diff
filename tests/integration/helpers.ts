import {z} from "zod";

interface IProcedureLike {
  _def: {
    type: "query" | "mutation" | "subscription";
    inputs?: z.ZodType[];
    output?: z.ZodType;
  };
}

export function mutation(input: z.ZodType, output: z.ZodType): IProcedureLike {
  return {
    _def: {
      type: "mutation",
      inputs: [input],
      output,
    },
  };
}

export function query(input: z.ZodType, output: z.ZodType): IProcedureLike {
  return {
    _def: {
      type: "query",
      inputs: [input],
      output,
    },
  };
}

export function router(procedures: Record<string, IProcedureLike>) {
  return {_def: {procedures}};
}
