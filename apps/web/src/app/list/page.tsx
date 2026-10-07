import type { Metadata } from "next";
import { ListWizard } from "@/components/list/ListWizard";

export const metadata: Metadata = { title: "List air rights" };

export default function ListPage() {
  return <ListWizard />;
}
