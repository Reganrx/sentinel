// Cloudflare dashboard source is maintained in ../worker.js. This typed entrypoint
// deliberately re-exports the same Worker for local tooling and source discovery.
import worker from "../worker.js";
export default worker;
export { SentinelCoordinator } from "../worker.js";
