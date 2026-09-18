"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import Playground from "@/components/Playground";
import { useProfile } from "@/lib/progress";
import { topicById } from "@/lib/topics";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const { ready } = useProfile();
  const topic = topicById(id);
  if (!ready) return null;
  if (!topic) {
    return (
      <main className="tm-app mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5">
        <p>Nothing to review here yet.</p>
        <Link href="/home" className="tm-press tm-press-gold mt-4 w-full">
          Back to topics
        </Link>
      </main>
    );
  }
  return <Playground key={`review-${topic.id}`} topic={topic} mode="review" />;
}
