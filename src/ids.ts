import { defineIdFamily } from "@fungi.computer/cairn/id";

export const starterIds = defineIdFamily({
  family: "app-authoring",
  version: 1,
  kinds: { app: { prefix: "app" }, release: { prefix: "rel" } },
});
