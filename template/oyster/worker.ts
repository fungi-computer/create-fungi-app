import { createOysterWorker } from "@fungi.computer/oyster/workers";
// Every invocation frame mints its binding stubs from this one entrypoint.
export {
  OysterBinding,
  OysterInstance,
  OysterMcp,
  OysterRegistry,
  OysterInstallationExecutor,
} from "@fungi.computer/oyster/workers";
export default createOysterWorker();
