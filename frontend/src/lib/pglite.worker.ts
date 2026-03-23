import { worker } from "@electric-sql/pglite/worker";
import { PGlite } from "@electric-sql/pglite";

worker({
  init: async () => new PGlite(),
});
