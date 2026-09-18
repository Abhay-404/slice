"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import Playground from "@/components/Playground";
import { useProfile } from "@/lib/progress";
import { topicById } from "@/lib/topics";

export default function PlayPage() {
  const { id } = useParams<{ id: string }>();
  const { ready } = useProfile();
  const topic = topicById(id);
  if (!ready) return null;
  if (!topic) return <Missing />;
  return <Playground key={`play-${topic.id}`} topic={topic} mode="play" />;
}

function Missing() {
  return (
    <main className="tm-app mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5">
      <p>That topic isn&rsquo;t here yet.</p>
      <Link href="/home" className="tm-press tm-press-gold mt-4 w-full">
        Back to topics
      </Link>
    </main>
  );
}
