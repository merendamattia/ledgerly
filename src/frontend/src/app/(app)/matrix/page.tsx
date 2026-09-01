"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetMatrixView } from "@/components/matrix/asset-matrix-view";
import { AssetReturnMatrixView } from "@/components/matrix/asset-return-matrix-view";
import { CashflowMatrixView } from "@/components/matrix/cashflow-matrix-view";

/** Matrix hub: a top selector switching between asset, return and cash-flow matrices. */
export default function MatrixPage() {
  const t = useTranslations("matrixPage");
  const [view, setView] = useState("assets");

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="assets">{t("assets")}</TabsTrigger>
          <TabsTrigger value="returns">{t("returns")}</TabsTrigger>
          <TabsTrigger value="cashflow">{t("cashFlow")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "assets" ? (
        <AssetMatrixView />
      ) : view === "returns" ? (
        <AssetReturnMatrixView />
      ) : (
        <CashflowMatrixView />
      )}
    </div>
  );
}
