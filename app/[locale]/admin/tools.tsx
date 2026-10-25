import { getTranslations } from "next-intl/server";
import { getAdminTools, getToolSuggestions } from "@/lib/admin/data";
import { ActionLogProvider } from "./action-log";
import { PanelHeading } from "./review-queue";
import { ToolsAdmin } from "./tools-admin";

/** "Kelola tools": the catalog (add, edit, deactivate) and the makers' suggestions (§2.8). */
export async function ToolsPanel() {
  const t = await getTranslations("admin.tools");
  const [tools, suggestions] = await Promise.all([getAdminTools(), getToolSuggestions()]);

  return (
    <>
      <PanelHeading title={t.rich("title", { em: (chunks) => chunks })} lede={t("lede")} />
      <ActionLogProvider>
        <ToolsAdmin tools={tools} suggestions={suggestions} />
      </ActionLogProvider>
    </>
  );
}
