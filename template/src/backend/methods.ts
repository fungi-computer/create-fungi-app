import * as z from "zod";
import {
  defineAppBackend,
  defineAppMethod,
} from "@fungi.computer/agar/backend-definition";

export const greetingInput = z.object({ name: z.string().trim().min(1) });
export const greetingOutput = z.object({ message: z.string() });

export const appBackend = defineAppBackend({
  methods: {
    greet: defineAppMethod({
      description: "Say hello",
      effect: "read",
      requires: [],
      input: greetingInput,
      output: greetingOutput,
      handler: ({ name }) => ({ message: `Hello, ${name}!` }),
    }),
  },
});
