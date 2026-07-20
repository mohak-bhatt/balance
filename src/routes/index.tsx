import { createFileRoute } from "@tanstack/react-router";
import { HomeContent } from "@/components/HomeContent";
import { BottomPill } from "@/components/BottomPill";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Balance" },
      { name: "description", content: "An offline-first, OLED-black personal finance tracker." },
    ],
  }),
  component: () => (
    <>
      <HomeContent />
      <BottomPill />
    </>
  ),
});
