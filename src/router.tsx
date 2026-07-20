import { createRouter, createMemoryHistory } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";

const queryClient = new QueryClient();

export const router = createRouter({
  routeTree,
  context: { queryClient },
  history: createMemoryHistory(), // important for Capacitor — no real URLs
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}