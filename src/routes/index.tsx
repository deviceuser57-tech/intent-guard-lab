import { createFileRoute } from "@tanstack/react-router";
import { Workbench } from "@/components/Workbench";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prompt Engineering Workbench — Enterprise" },
      {
        name: "description",
        content:
          "Design, secure, evaluate and govern production prompts for OpenAI and Anthropic, in English and Arabic.",
      },
      { property: "og:title", content: "Prompt Engineering Workbench — Enterprise" },
      {
        property: "og:description",
        content: "Intent analysis, red-team audits, evaluation and a versioned prompt registry.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Workbench,
});
