import { PlayerConsole } from "@/components/player-console";

export const metadata = { title: "Join · SQuiz" };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PlayerConsole code={code.toUpperCase()} />;
}
