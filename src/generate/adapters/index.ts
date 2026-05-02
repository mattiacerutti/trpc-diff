export interface IParserAdapter<TParser = unknown> {
  isParser(value: unknown): value is TParser;
  mergeInputs(inputs: TParser[]): TParser | null;
  toSchema(parser: TParser, io: "input" | "output"): unknown;
}

export {zodAdapter} from "./zod-adapter";
