import { prisma } from "../lib/prisma";
import { dispatchLoop } from "./dispatcher";
import { runWarRoomAgentOnce } from "../agents/warRoomAgent";

async function main() {
  console.log("Starting Orchestrator Loop...");
  setInterval(async () => {
    try {
      await dispatchLoop(prisma);
      await runWarRoomAgentOnce(); // Claim 1: War Room Check
    } catch (error) {
      console.error("Error in dispatch loop:", error);
    }
  }, 10000); // Run every 10 seconds
}

main();
