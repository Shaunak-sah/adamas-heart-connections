import { createFileRoute } from "@tanstack/react-router";

import { LandingPage } from "@/components/afterclass/pages";
import { pageMetadata } from "@/lib/page-metadata";

export const Route = createFileRoute("/")({
  head: () => pageMetadata("Some connections happen after class", "A more personal way to meet people from your university. AFTERCLASS is an independent student-focused project, with real access not yet available."),
  component: LandingPage,
});
