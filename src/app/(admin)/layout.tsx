import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
