import { createFileRoute } from "@tanstack/react-router";
import { InformationPage, getPageInfo } from "@/components/afterclass/pages";
import { pageMetadata } from "@/lib/page-metadata";

export const Route = createFileRoute("/login")({
  head: () => { const page = getPageInfo("login"); return pageMetadata(page.title, page.description); },
  component: () => <InformationPage kind="login" />,
});