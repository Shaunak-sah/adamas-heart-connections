import { createFileRoute } from "@tanstack/react-router";
import { VerificationStatusPage } from "@/components/afterclass/pages";
import { pageMetadata } from "@/lib/page-metadata";

export const Route = createFileRoute("/verification-pending")({
  head: () => pageMetadata("Verification unavailable", "An approved student-verification method is not configured for AFTERCLASS."),
  component: VerificationStatusPage,
});