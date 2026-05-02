import type {AnyRouter} from "@trpc/server";
import type {IGenerateContractOptions, IOpenApiDocument} from "@/types";
import {ContractGenerator} from "@/generate/contract-generator";
import {IParserAdapter} from "@/generate/adapters";

export function generateContract(router: AnyRouter, adapters: IParserAdapter[], options: IGenerateContractOptions = {}): IOpenApiDocument {
  const generator = new ContractGenerator(adapters, options);
  return generator.generate(router);
}
