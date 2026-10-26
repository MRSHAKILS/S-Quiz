import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { HostConsole } from "@/components/host-console";

export const metadata = { title: "Host · SQuiz" };

export default async function HostPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!(await auth())?.user) redirect(`/login?next=/host/${code}`);
  return (
    <>
      <AppHeader />
      <HostConsole code={code.toUpperCase()} />
    </>
  );
}
