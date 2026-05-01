import { requireOutputRule } from "./rules/require-output";

const plugin = {
  rules: {
    "require-output": requireOutputRule,
  },
};

export default plugin;
export { requireOutputRule };
