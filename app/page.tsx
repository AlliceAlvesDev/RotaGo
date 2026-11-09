import { headers } from "next/headers";
import { RotasDashboard } from "@/components/rotas-dashboard";

export default async function Home() {
  const requestHeaders = await headers();
  const encodedName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedName && requestHeaders.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8"
      ? decodeURIComponent(encodedName)
      : encodedName;
  const firstName = fullName?.trim().split(/\s+/)[0] || null;

  return <RotasDashboard firstName={firstName} />;
}
